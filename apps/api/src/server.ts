import 'dotenv/config';
import { shutdownObservability } from './observability.js';
import type { Server } from 'node:http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { TripThemeSchema } from '@roadtrip/types';
import { appRouter } from './routes/index.js';
import { createContext } from './types/context.js';
import { env } from './config/env.js';
import { logger, logError } from './lib/logger.js';
import { getRequestLogger, requestLoggingMiddleware } from './lib/request-logging.js';
import {
  googlePlacesService,
  GooglePlacesUpstreamError,
} from './services/google-places-service.js';
import {
  aiTripPlannerService,
  AiTripPlannerError,
} from './services/ai-trip-planner-service.js';
import { prisma } from './lib/prisma.js';
import { getRequestUserId } from './lib/request-auth.js';
import { requireAuth } from './lib/require-auth.js';

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type PlannedStopResolved = {
  query: string;
  status: 'resolved';
  suggestion: {
    id: string;
    placeId: string;
    title: string;
    description: string;
    distanceKm: number;
    lat: number;
    lng: number;
    imageUrl?: string;
  };
};

type PlannedStopUnresolved = {
  query: string;
  status: 'unresolved';
  errorCode: 'NOT_FOUND' | 'UPSTREAM_ERROR';
};

type PlannedStop = PlannedStopResolved | PlannedStopUnresolved;

type PlannedOption = {
  title: string;
  rationale: string;
  stops: PlannedStop[];
};

const plannedStopResolvedSchema = z.object({
  query: z.string().min(1),
  status: z.literal('resolved'),
  suggestion: z.object({
    id: z.string().min(1),
    placeId: z.string().min(1),
    title: z.string().min(1),
    description: z.string().min(1),
    distanceKm: z.number().positive(),
    lat: z.number(),
    lng: z.number(),
    imageUrl: z.string().url().optional(),
  }),
});

const plannedStopUnresolvedSchema = z.object({
  query: z.string().min(1),
  status: z.literal('unresolved'),
  errorCode: z.union([z.literal('NOT_FOUND'), z.literal('UPSTREAM_ERROR')]),
});

const plannedOptionSchema = z.object({
  title: z.string().min(1),
  rationale: z.string().min(1),
  stops: z
    .array(z.union([plannedStopResolvedSchema, plannedStopUnresolvedSchema]))
    .min(1),
});

const plannedOptionsSchema = z.array(plannedOptionSchema).min(1);

const TRIP_PLAN_CACHE_RADIUS_MILES = 10;
const KM_PER_MILE = 1.60934;

const normalizeThemes = (themes: string[]) =>
  Array.from(
    new Set(themes.map((theme) => theme.trim().toLowerCase()).filter(Boolean)),
  ).sort();

const toThemesKey = (themes: string[]) => normalizeThemes(themes).join('|');

const toRadians = (value: number) => (value * Math.PI) / 180;

const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
};

const toPlacesErrorMeta = (error: unknown) => {
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

const toAiPlannerErrorMeta = (error: unknown) => {
  if (error instanceof AiTripPlannerError) {
    return {
      code: error.message,
      stage: error.stage,
      details: error.details,
    };
  }

  return {
    code: 'UNKNOWN_AI_PLANNER_ERROR',
    stage: 'unknown',
    details: {
      message: String(error),
    },
  };
};

const withAsyncHandler =
  <TReq extends express.Request, TRes extends express.Response>(
    handler: (req: TReq, res: TRes) => Promise<void>,
  ) =>
  (req: TReq, res: TRes) => {
    void handler(req, res);
  };

const getRequesterIp = (req: express.Request) => {
  const forwardedFor = req.header('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() ?? 'unknown';
  }

  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
};

const buildSuggestionImageUrl = (req: express.Request, photoName?: string) => {
  if (!photoName) {
    return undefined;
  }

  const encodedPhotoName = encodeURIComponent(photoName);
  const base = env.PUBLIC_API_BASE_URL ?? `${req.protocol}://${req.get('host')}`;
  return `${base}/places/photo?name=${encodedPhotoName}`;
};

const createAnonymousSuggestionsRateLimiter = () => {
  const hitsByIp = new Map<string, RateLimitEntry>();

  return (ipAddress: string) => {
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
  app.set('trust proxy', 1);
  const allowAnonymousSuggestionRequest = createAnonymousSuggestionsRateLimiter();
  app.use(
    cors(
      env.CORS_ORIGIN
        ? { origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()), credentials: true }
        : undefined,
    ),
  );
  app.use(helmet());
  app.use(express.json());
  app.use(requestLoggingMiddleware);

  app.get('/health', (_, res) => {
    res.json({ status: 'ok' });
  });

  app.get(
    '/places/photo',
    withAsyncHandler(async (req, res) => {
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

      const photoUrl = new URL(
        `/v1/places/${encodeURIComponent(placeId)}/photos/${encodeURIComponent(photoReference)}/media`,
        'https://places.googleapis.com',
      );
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
          requestLogger.warn(
            {
              photoName,
              maxWidthPx,
              status: response.status,
              body: upstreamErrorBody,
            },
            'places.photo upstream non-ok response',
          );
          res.status(502).json({ error: 'UPSTREAM_PHOTO_ERROR' });
          return;
        }

        const contentType = response.headers.get('content-type') ?? 'image/jpeg';
        const cacheControl = response.headers.get('cache-control');
        if (cacheControl) {
          res.setHeader('cache-control', cacheControl);
        } else {
          res.setHeader('cache-control', 'public, max-age=3600');
        }

        const imageBuffer = Buffer.from(await response.arrayBuffer());
        res.setHeader('content-type', contentType);
        res.status(200).send(imageBuffer);
      } catch (error) {
        const requestLogger = getRequestLogger(res);
        logError(requestLogger, 'places.photo upstream failure', error, {
          photoName,
          maxWidthPx,
        });
        res.status(502).json({ error: 'UPSTREAM_PHOTO_ERROR' });
      }
    }),
  );

  app.get(
    '/suggestions',
    withAsyncHandler(async (req, res) => {
      const userId = await getRequestUserId(req);

      if (!userId && !allowAnonymousSuggestionRequest(getRequesterIp(req))) {
        res.status(429).json({ error: 'RATE_LIMITED' });
        return;
      }

      const location = req.query.location;
      const themeQuery = req.query.theme;
      const radiusKm = Number(req.query.radiusKm);
      const themeValues = Array.isArray(themeQuery)
        ? themeQuery
        : typeof themeQuery === 'string'
          ? [themeQuery]
          : [];
      const parsedThemes = z.array(TripThemeSchema).nonempty().safeParse(themeValues);

      if (
        typeof location !== 'string' ||
        Number.isNaN(radiusKm) ||
        !parsedThemes.success
      ) {
        res.status(400).json({ error: 'INVALID_QUERY' });
        return;
      }

      const themes = parsedThemes.data;

      try {
        const suggestions = await googlePlacesService.findStops({
          location,
          themes,
          radiusKm,
        });

        res.json(
          suggestions.map(({ photoName, ...suggestion }) => ({
            ...suggestion,
            imageUrl: buildSuggestionImageUrl(req, photoName),
          })),
        );
      } catch (error) {
        const placesError = toPlacesErrorMeta(error);
        const requestLogger = getRequestLogger(res);
        logError(requestLogger, 'places.suggestions upstream failure', error, {
          ...placesError,
          input: {
            location,
            themes,
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
    }),
  );

  app.get(
    '/trips',
    requireAuth,
    withAsyncHandler(async (req, res) => {
      const userId = res.locals.userId as string;

      const trips = await prisma.trip.findMany({
        where: { userId },
        include: { stops: { orderBy: { order: 'asc' } } },
        orderBy: { createdAt: 'desc' },
      });

      res.json(trips);
    }),
  );

  const saveGeneratedTripSchema = z.object({
    location: z.string().min(3),
    radiusKm: z.number().positive(),
    theme: z.string().min(1),
    name: z.string().min(1).optional(),
  });

  app.post(
    '/trips/plan',
    withAsyncHandler(async (req, res) => {
      const requestLogger = getRequestLogger(res);
      const userId = await getRequestUserId(req);

      if (!userId && !allowAnonymousSuggestionRequest(getRequesterIp(req))) {
        res.status(429).json({ error: 'RATE_LIMITED' });
        return;
      }

      const planTripSchema = z.object({
        location: z.string().min(3),
        radiusKm: z.number().positive().max(500),
        themes: z.array(TripThemeSchema).min(1),
        maxOptions: z.union([z.literal(2), z.literal(3)]).default(3),
        modifiers: z
          .object({
            smartPitstops: z.boolean().optional(),
            photoOps: z.boolean().optional(),
          })
          .optional(),
      });

      const parsed = planTripSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'INVALID_BODY' });
        return;
      }

      const input = parsed.data;
      const themesKey = toThemesKey(input.themes);
      const cacheRadiusKm = TRIP_PLAN_CACHE_RADIUS_MILES * KM_PER_MILE;
      const now = new Date();

      let origin;
      try {
        origin = await googlePlacesService.geocodeLocation(input.location);
      } catch (error) {
        const placesError = toPlacesErrorMeta(error);
        logError(requestLogger, 'places.trip-planner geocode failure', error, {
          ...placesError,
          input: {
            location: input.location,
            radiusKm: input.radiusKm,
            themes: input.themes,
            maxOptions: input.maxOptions,
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

      const latDelta = cacheRadiusKm / 111.32;
      const cosLatitude = Math.max(Math.cos(toRadians(origin.lat)), 0.2);
      const lngDelta = cacheRadiusKm / (111.32 * cosLatitude);

      const cacheCandidates = await prisma.tripPlanCache.findMany({
        where: {
          themesKey,
          radiusKm: input.radiusKm,
          maxOptions: input.maxOptions,
          expiresAt: { gt: now },
          validOptions: { gt: 0 },
          centerLat: {
            gte: origin.lat - latDelta,
            lte: origin.lat + latDelta,
          },
          centerLng: {
            gte: origin.lng - lngDelta,
            lte: origin.lng + lngDelta,
          },
        },
        orderBy: [{ engagementScore: 'desc' }, { updatedAt: 'desc' }],
        take: 25,
      });

      const cacheCandidatesWithDistance = cacheCandidates.map((candidate) => ({
        candidate,
        distanceKm: haversineKm(
          origin.lat,
          origin.lng,
          candidate.centerLat,
          candidate.centerLng,
        ),
      }));

      const cacheHitWithDistance = cacheCandidatesWithDistance
        .filter(({ distanceKm }) => distanceKm <= cacheRadiusKm)
        .sort((a, b) => {
          if (b.candidate.engagementScore !== a.candidate.engagementScore) {
            return b.candidate.engagementScore - a.candidate.engagementScore;
          }
          if (a.distanceKm !== b.distanceKm) {
            return a.distanceKm - b.distanceKm;
          }
          return b.candidate.updatedAt.getTime() - a.candidate.updatedAt.getTime();
        })[0];

      const cacheHit = cacheHitWithDistance?.candidate;
      const cacheHitDistanceKm = cacheHitWithDistance?.distanceKm;
      const nearestCandidateDistanceKm =
        cacheCandidatesWithDistance.length > 0
          ? Math.min(...cacheCandidatesWithDistance.map(({ distanceKm }) => distanceKm))
          : null;
      const debugEnabled =
        env.TRIP_PLAN_CACHE_DEBUG && process.env.NODE_ENV !== 'production';

      if (cacheHit) {
        const parsedOptions = plannedOptionsSchema.safeParse(cacheHit.options);
        if (parsedOptions.success && parsedOptions.data.length) {
          await prisma.tripPlanCache.update({
            where: { id: cacheHit.id },
            data: {
              engagementScore: { increment: 1 },
              lastServedAt: now,
            },
          });

          requestLogger.info(
            {
              cacheId: cacheHit.id,
              engagementScore: cacheHit.engagementScore,
              validOptions: cacheHit.validOptions,
              distanceMiles:
                typeof cacheHitDistanceKm === 'number'
                  ? Number((cacheHitDistanceKm / KM_PER_MILE).toFixed(2))
                  : undefined,
            },
            'trip.plan.cache_hit',
          );

          const responsePayload: {
            location: string;
            radiusKm: number;
            themes: string[];
            source: 'cache';
            options: z.infer<typeof plannedOptionsSchema>;
            cacheDebug?: {
              enabled: true;
              radiusMiles: number;
              nearestCandidateDistanceMiles: number | null;
              selectedCandidateDistanceMiles: number | null;
              candidateCount: number;
            };
          } = {
            location: input.location,
            radiusKm: input.radiusKm,
            themes: input.themes,
            source: 'cache',
            options: parsedOptions.data,
          };

          if (debugEnabled) {
            responsePayload.cacheDebug = {
              enabled: true,
              radiusMiles: TRIP_PLAN_CACHE_RADIUS_MILES,
              nearestCandidateDistanceMiles:
                typeof nearestCandidateDistanceKm === 'number'
                  ? Number((nearestCandidateDistanceKm / KM_PER_MILE).toFixed(2))
                  : null,
              selectedCandidateDistanceMiles:
                typeof cacheHitDistanceKm === 'number'
                  ? Number((cacheHitDistanceKm / KM_PER_MILE).toFixed(2))
                  : null,
              candidateCount: cacheCandidates.length,
            };
          }

          res.status(200).json(responsePayload);
          return;
        }
      }

      requestLogger.info(
        {
          themesKey,
          candidateCount: cacheCandidates.length,
          nearestCandidateDistanceMiles:
            typeof nearestCandidateDistanceKm === 'number'
              ? Number((nearestCandidateDistanceKm / KM_PER_MILE).toFixed(2))
              : null,
        },
        'trip.plan.cache_miss',
      );

      let plans;
      try {
        plans = await aiTripPlannerService.generatePlans({
          location: input.location,
          radiusKm: input.radiusKm,
          themes: input.themes,
          maxOptions: input.maxOptions,
          modifiers: input.modifiers,
        });
      } catch (error) {
        const aiError = toAiPlannerErrorMeta(error);
        logError(requestLogger, 'ai.trip-planner failure', error, {
          ...aiError,
          input: {
            location: input.location,
            radiusKm: input.radiusKm,
            themes: input.themes,
            maxOptions: input.maxOptions,
          },
        });

        res.status(502).json({
          error: 'AI_PLANNER_ERROR',
          ...(process.env.NODE_ENV !== 'production'
            ? {
                diagnosticCode: aiError.code,
                diagnosticStage: aiError.stage,
              }
            : {}),
        });
        return;
      }

      const options = await Promise.all(
        plans.options.map(async (option) => {
          let stopResults: Array<{
            query: string;
            suggestion?: {
              id: string;
              placeId: string;
              title: string;
              description: string;
              distanceKm: number;
              lat: number;
              lng: number;
              photoName?: string;
            };
            errorCode?: 'NOT_FOUND' | 'UPSTREAM_ERROR';
          }>;

          try {
            stopResults = await googlePlacesService.resolvePlannedStops({
              location: input.location,
              radiusKm: input.radiusKm,
              stopQueries: option.stops,
            });
          } catch (error) {
            const placesError = toPlacesErrorMeta(error);
            logError(requestLogger, 'places.trip-planner enrich failure', error, {
              ...placesError,
              optionTitle: option.title,
            });

            stopResults = option.stops.map((query) => ({
              query,
              errorCode: 'UPSTREAM_ERROR' as const,
            }));
          }

          return {
            title: option.title,
            rationale: option.rationale,
            stops: stopResults.map((stopResult) => {
              if (!stopResult.suggestion) {
                return {
                  query: stopResult.query,
                  status: 'unresolved' as const,
                  errorCode: stopResult.errorCode ?? 'NOT_FOUND',
                };
              }

              const { photoName, ...suggestion } = stopResult.suggestion;
              return {
                query: stopResult.query,
                status: 'resolved' as const,
                suggestion: {
                  ...suggestion,
                  imageUrl: buildSuggestionImageUrl(req, photoName),
                },
              };
            }),
          } satisfies PlannedOption;
        }),
      );

      const validOptions = options.filter(
        (option) =>
          option.stops.length > 0 &&
          option.stops.every((stop) => stop.status === 'resolved'),
      );

      if (validOptions.length > 0) {
        await prisma.tripPlanCache.create({
          data: {
            location: input.location,
            centerLat: origin.lat,
            centerLng: origin.lng,
            radiusKm: input.radiusKm,
            themesKey,
            maxOptions: input.maxOptions,
            options: validOptions as Prisma.InputJsonValue,
            validOptions: validOptions.length,
            engagementScore: 1,
            lastServedAt: now,
            expiresAt: new Date(
              now.getTime() + env.TRIP_PLAN_CACHE_TTL_DAYS * 24 * 60 * 60 * 1000,
            ),
          },
        });
      }

      const responsePayload: {
        location: string;
        radiusKm: number;
        themes: string[];
        source: 'ai';
        options: PlannedOption[];
        cacheDebug?: {
          enabled: true;
          radiusMiles: number;
          nearestCandidateDistanceMiles: number | null;
          selectedCandidateDistanceMiles: null;
          candidateCount: number;
        };
      } = {
        location: input.location,
        radiusKm: input.radiusKm,
        themes: input.themes,
        source: 'ai',
        options,
      };

      if (debugEnabled) {
        responsePayload.cacheDebug = {
          enabled: true,
          radiusMiles: TRIP_PLAN_CACHE_RADIUS_MILES,
          nearestCandidateDistanceMiles:
            typeof nearestCandidateDistanceKm === 'number'
              ? Number((nearestCandidateDistanceKm / KM_PER_MILE).toFixed(2))
              : null,
          selectedCandidateDistanceMiles: null,
          candidateCount: cacheCandidates.length,
        };
      }

      res.status(200).json(responsePayload);
    }),
  );

  app.post(
    '/trips/save-generated',
    requireAuth,
    withAsyncHandler(async (req, res) => {
      const userId = res.locals.userId as string;

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
          themes: [input.theme],
        });
      } catch (error) {
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
    }),
  );

  app.use('/trpc', createExpressMiddleware({ router: appRouter, createContext }));

  return app;
};

export const registerSignalHandlers = (server: Server) => {
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

const app = createApp();

export default app;

if (process.env.NODE_ENV !== 'test' && process.env.VERCEL !== '1') {
  startServer();
}
