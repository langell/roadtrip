import { Router } from 'express';
import { z } from 'zod';
import { TripThemeSchema } from '@roadtrip/types';
import { env } from '../config/env.js';
import { withAsyncHandler } from '../lib/async-handler.js';
import { getRequestLogger } from '../lib/request-logging.js';
import { logError } from '../lib/logger.js';
import { getRequestUserId } from '../lib/request-auth.js';
import { getRequesterIp } from '../lib/rate-limiter.js';
import { toPlacesErrorMeta } from '../lib/error-meta.js';
import { buildSuggestionImageUrl } from '../lib/photo-url.js';
import { googlePlacesService } from '../services/google-places-service.js';

// Mounted at / — handles /places/photo and /suggestions
export const placesRouter = Router();

placesRouter.get(
  '/places/photo',
  withAsyncHandler(async (req, res) => {
    const userId = await getRequestUserId(req);
    const { allowAnonymousPhotoRequest } = res.locals as {
      allowAnonymousPhotoRequest: (ip: string) => boolean;
    };

    if (!userId && !allowAnonymousPhotoRequest(getRequesterIp(req))) {
      res.status(429).json({ error: 'RATE_LIMITED' });
      return;
    }

    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

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
      `/v1/places/${encodeURIComponent(placeId ?? '')}/photos/${encodeURIComponent(photoReference ?? '')}/media`,
      'https://places.googleapis.com',
    );
    photoUrl.searchParams.set('maxWidthPx', String(maxWidthPx));

    try {
      const requestLogger = getRequestLogger(res);
      const response = await fetch(photoUrl, {
        headers: { 'X-Goog-Api-Key': env.GOOGLE_MAPS_API_KEY },
      });

      if (!response.ok) {
        const upstreamErrorBody = await response.text();
        requestLogger.warn(
          { photoName, maxWidthPx, status: response.status, body: upstreamErrorBody },
          'places.photo upstream non-ok response',
        );
        res.status(502).json({ error: 'UPSTREAM_PHOTO_ERROR' });
        return;
      }

      const contentType = response.headers.get('content-type') ?? 'image/jpeg';
      const cacheControl = response.headers.get('cache-control');
      res.setHeader('cache-control', cacheControl ?? 'public, max-age=3600');
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

placesRouter.get(
  '/suggestions', // mounted at root — path is /suggestions
  withAsyncHandler(async (req, res) => {
    const userId = await getRequestUserId(req);
    const { allowAnonymousSuggestionRequest } = res.locals as {
      allowAnonymousSuggestionRequest: (ip: string) => boolean;
    };

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

    if (typeof location !== 'string' || Number.isNaN(radiusKm) || !parsedThemes.success) {
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
        input: { location, themes, radiusKm, authenticated: Boolean(userId) },
      });
      res.status(502).json({
        error: 'UPSTREAM_PLACES_ERROR',
        ...(process.env.NODE_ENV !== 'production'
          ? { diagnosticCode: placesError.code, diagnosticStage: placesError.stage }
          : {}),
      });
    }
  }),
);
