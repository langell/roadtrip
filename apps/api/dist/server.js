import 'dotenv/config';
import { shutdownObservability } from './observability.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { z } from 'zod';
import { appRouter } from './routes/index.js';
import { createContext } from './types/context.js';
import { env } from './config/env.js';
import { logger, logError } from './lib/logger.js';
import { getRequestLogger, requestLoggingMiddleware } from './lib/request-logging.js';
import { googlePlacesService, GooglePlacesUpstreamError, } from './services/google-places-service.js';
import { prisma } from './lib/prisma.js';
import { getRequestUserId } from './lib/request-auth.js';
const toPlacesErrorMeta = (error) => {
    if (error instanceof GooglePlacesUpstreamError) {
        return {
            code: error.message,
            stage: error.stage,
            details: error.details,
        };
    }
    return {
        code: 'UNKNOWN_PLACES_ERROR',
        stage: 'unknown',
        details: {
            message: String(error),
        },
    };
};
const withAsyncHandler = (handler) => (req, res) => {
    void handler(req, res);
};
const getRequesterIp = (req) => {
    const forwardedFor = req.header('x-forwarded-for');
    if (forwardedFor) {
        return forwardedFor.split(',')[0]?.trim() ?? 'unknown';
    }
    return req.ip ?? req.socket.remoteAddress ?? 'unknown';
};
const buildSuggestionImageUrl = (req, photoName) => {
    if (!photoName) {
        return undefined;
    }
    const encodedPhotoName = encodeURIComponent(photoName);
    return `${req.protocol}://${req.get('host')}/places/photo?name=${encodedPhotoName}`;
};
const createAnonymousSuggestionsRateLimiter = () => {
    const hitsByIp = new Map();
    return (ipAddress) => {
        const now = Date.now();
        const existing = hitsByIp.get(ipAddress);
        if (!existing || existing.resetAt <= now) {
            hitsByIp.set(ipAddress, {
                count: 1,
                resetAt: now + env.ANON_SUGGESTIONS_RATE_LIMIT_WINDOW_MS,
            });
            return true;
        }
        if (existing.count >= env.ANON_SUGGESTIONS_RATE_LIMIT_MAX) {
            return false;
        }
        existing.count += 1;
        hitsByIp.set(ipAddress, existing);
        return true;
    };
};
export const createApp = () => {
    const app = express();
    const allowAnonymousSuggestionRequest = createAnonymousSuggestionsRateLimiter();
    app.use(cors());
    app.use(helmet());
    app.use(express.json());
    app.use(requestLoggingMiddleware);
    app.get('/health', (_, res) => {
        res.json({ status: 'ok' });
    });
    app.get('/places/photo', withAsyncHandler(async (req, res) => {
        res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
        const photoName = req.query.name;
        const maxWidthRaw = Number(req.query.maxWidthPx);
        const maxWidthPx = Number.isFinite(maxWidthRaw)
            ? Math.max(128, Math.min(Math.round(maxWidthRaw), 1600))
            : 800;
        if (typeof photoName !== 'string' || !photoName.startsWith('places/')) {
            res.status(400).json({ error: 'INVALID_PHOTO_NAME' });
            return;
        }
        const photoNameMatch = /^places\/([^/]+)\/photos\/(.+)$/.exec(photoName);
        if (!photoNameMatch) {
            res.status(400).json({ error: 'INVALID_PHOTO_NAME' });
            return;
        }
        const [, placeId, photoReference] = photoNameMatch;
        const photoUrl = new URL(`/v1/places/${encodeURIComponent(placeId)}/photos/${encodeURIComponent(photoReference)}/media`, 'https://places.googleapis.com');
        photoUrl.searchParams.set('maxWidthPx', String(maxWidthPx));
        try {
            const requestLogger = getRequestLogger(res);
            const response = await fetch(photoUrl, {
                headers: {
                    'X-Goog-Api-Key': env.GOOGLE_MAPS_API_KEY,
                },
            });
            if (!response.ok) {
                const upstreamErrorBody = await response.text();
                requestLogger.warn({
                    photoName,
                    maxWidthPx,
                    status: response.status,
                    body: upstreamErrorBody,
                }, 'places.photo upstream non-ok response');
                res.status(502).json({ error: 'UPSTREAM_PHOTO_ERROR' });
                return;
            }
            const contentType = response.headers.get('content-type') ?? 'image/jpeg';
            const cacheControl = response.headers.get('cache-control');
            if (cacheControl) {
                res.setHeader('cache-control', cacheControl);
            }
            else {
                res.setHeader('cache-control', 'public, max-age=3600');
            }
            const imageBuffer = Buffer.from(await response.arrayBuffer());
            res.setHeader('content-type', contentType);
            res.status(200).send(imageBuffer);
        }
        catch (error) {
            const requestLogger = getRequestLogger(res);
            logError(requestLogger, 'places.photo upstream failure', error, { photoName, maxWidthPx });
            res.status(502).json({ error: 'UPSTREAM_PHOTO_ERROR' });
        }
    }));
    app.get('/suggestions', withAsyncHandler(async (req, res) => {
        const userId = await getRequestUserId(req);
        if (!userId && !allowAnonymousSuggestionRequest(getRequesterIp(req))) {
            res.status(429).json({ error: 'RATE_LIMITED' });
            return;
        }
        const location = req.query.location;
        const theme = req.query.theme;
        const radiusKm = Number(req.query.radiusKm);
        if (typeof location !== 'string' ||
            typeof theme !== 'string' ||
            Number.isNaN(radiusKm)) {
            res.status(400).json({ error: 'INVALID_QUERY' });
            return;
        }
        try {
            const suggestions = await googlePlacesService.findStops({
                location,
                theme,
                radiusKm,
            });
            res.json(suggestions.map(({ photoName, ...suggestion }) => ({
                ...suggestion,
                imageUrl: buildSuggestionImageUrl(req, photoName),
            })));
        }
        catch (error) {
            const placesError = toPlacesErrorMeta(error);
            const requestLogger = getRequestLogger(res);
            logError(requestLogger, 'places.suggestions upstream failure', error, {
                ...placesError,
                input: {
                    location,
                    theme,
                    radiusKm,
                    authenticated: Boolean(userId),
                },
            });
            res.status(502).json({
                error: 'UPSTREAM_PLACES_ERROR',
                ...(process.env.NODE_ENV !== 'production'
                    ? {
                        diagnosticCode: placesError.code,
                        diagnosticStage: placesError.stage,
                    }
                    : {}),
            });
        }
    }));
    app.get('/trips', withAsyncHandler(async (req, res) => {
        const userId = await getRequestUserId(req);
        if (!userId) {
            res.status(401).json({ error: 'UNAUTHORIZED' });
            return;
        }
        const trips = await prisma.trip.findMany({
            where: { userId },
            include: { stops: { orderBy: { order: 'asc' } } },
            orderBy: { createdAt: 'desc' },
        });
        res.json(trips);
    }));
    const saveGeneratedTripSchema = z.object({
        location: z.string().min(3),
        radiusKm: z.number().positive(),
        theme: z.string().min(1),
        name: z.string().min(1).optional(),
    });
    app.post('/trips/save-generated', withAsyncHandler(async (req, res) => {
        const userId = await getRequestUserId(req);
        if (!userId) {
            res.status(401).json({ error: 'UNAUTHORIZED' });
            return;
        }
        const parsed = saveGeneratedTripSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: 'INVALID_BODY' });
            return;
        }
        const input = parsed.data;
        let suggestions;
        try {
            suggestions = await googlePlacesService.findStops({
                location: input.location,
                radiusKm: input.radiusKm,
                theme: input.theme,
            });
        }
        catch (error) {
            const placesError = toPlacesErrorMeta(error);
            const requestLogger = getRequestLogger(res);
            logError(requestLogger, 'places.save-generated upstream failure', error, {
                ...placesError,
                input: {
                    location: input.location,
                    theme: input.theme,
                    radiusKm: input.radiusKm,
                    userId,
                },
            });
            res.status(502).json({
                error: 'UPSTREAM_PLACES_ERROR',
                ...(process.env.NODE_ENV !== 'production'
                    ? {
                        diagnosticCode: placesError.code,
                        diagnosticStage: placesError.stage,
                    }
                    : {}),
            });
            return;
        }
        if (!suggestions.length) {
            res.status(422).json({ error: 'NO_SUGGESTIONS' });
            return;
        }
        const origin = suggestions[0];
        const trip = await prisma.trip.create({
            data: {
                userId,
                name: input.name ?? `${input.theme} trip from ${input.location}`,
                originLat: origin.lat,
                originLng: origin.lng,
                filters: {
                    radiusKm: input.radiusKm,
                    theme: input.theme,
                    maxStops: suggestions.length,
                },
                stops: {
                    create: suggestions.map((suggestion, index) => ({
                        placeId: suggestion.placeId,
                        name: suggestion.title,
                        order: index,
                        lat: suggestion.lat,
                        lng: suggestion.lng,
                        notes: suggestion.description,
                    })),
                },
            },
            include: { stops: { orderBy: { order: 'asc' } } },
        });
        res.status(201).json(trip);
    }));
    app.use('/trpc', createExpressMiddleware({ router: appRouter, createContext }));
    return app;
};
export const registerSignalHandlers = (server) => {
    const shutdown = () => {
        void shutdownObservability();
        server.close();
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
};
export const startServer = () => {
    const app = createApp();
    const server = app.listen(env.PORT, () => {
        logger.info({ port: env.PORT }, 'api.ready');
    });
    registerSignalHandlers(server);
    return server;
};
if (process.env.NODE_ENV !== 'test') {
    startServer();
}
