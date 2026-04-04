import 'dotenv/config';
import { shutdownObservability } from './observability.js';
import type { Server } from 'node:http';
import { randomBytes } from 'node:crypto';
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
import { aiStopDescriptionService } from './services/ai-stop-description-service.js';
import { prisma } from './lib/prisma.js';
import { getRequestUserId } from './lib/request-auth.js';
import { requireAuth } from './lib/require-auth.js';
import { normalizeLocationKey } from './lib/normalize-location.js';

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type PlannedStopResolved = {
  query: string;
  status: 'resolved';
  stopType: StopType;
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

type StopType = 'attraction' | 'pit_stop' | 'photo_op' | null;

type PlannedStopUnresolved = {
  query: string;
  status: 'unresolved';
  stopType: StopType;
  errorCode: 'NOT_FOUND' | 'UPSTREAM_ERROR';
};

type PlannedStop = PlannedStopResolved | PlannedStopUnresolved;

type PlannedOption = {
  title: string;
  rationale: string;
  stops: PlannedStop[];
};

const stopTypeSchema = z
  .enum(['attraction', 'pit_stop', 'photo_op'])
  .nullable()
  .optional()
  .transform((v) => v ?? null);

const plannedStopResolvedSchema = z.object({
  query: z.string().min(1),
  status: z.literal('resolved'),
  stopType: stopTypeSchema,
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
  stopType: stopTypeSchema,
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
  const base = env.PUBLIC_API_URL ?? `${req.protocol}://${req.get('host')}`;
  return `${base}/places/photo?name=${encodedPhotoName}`;
};

// Rewrites a cached photo proxy URL to use the current server's base URL.
// Cached entries may contain a production hostname; this normalises them at read time.
const rewritePhotoProxyUrl = (
  req: express.Request,
  imageUrl: string | undefined,
): string | undefined => {
  if (!imageUrl) return undefined;
  try {
    const parsed = new URL(imageUrl);
    const photoName = parsed.searchParams.get('name');
    if (parsed.pathname === '/places/photo' && photoName) {
      return buildSuggestionImageUrl(req, photoName);
    }
  } catch {
    // not a valid URL — return unchanged
  }
  return imageUrl;
};

const createAnonymousRateLimiter = (windowMs: number, max: number) => {
  const hitsByIp = new Map<string, RateLimitEntry>();

  return (ipAddress: string) => {
    const now = Date.now();
    const existing = hitsByIp.get(ipAddress);

    if (!existing || existing.resetAt <= now) {
      hitsByIp.set(ipAddress, { count: 1, resetAt: now + windowMs });
      return true;
    }

    if (existing.count >= max) {
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
  const allowAnonymousSuggestionRequest = createAnonymousRateLimiter(
    env.ANON_SUGGESTIONS_RATE_LIMIT_WINDOW_MS,
    env.ANON_SUGGESTIONS_RATE_LIMIT_MAX,
  );
  const allowAnonymousPhotoRequest = createAnonymousRateLimiter(
    env.ANON_PHOTO_RATE_LIMIT_WINDOW_MS,
    env.ANON_PHOTO_RATE_LIMIT_MAX,
  );
  app.use(
    cors(
      env.CORS_ORIGIN
        ? { origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()), credentials: true }
        : undefined,
    ),
  );
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(express.json());
  app.use(requestLoggingMiddleware);

  app.get('/health', (_, res) => {
    res.json({ status: 'ok' });
  });

  app.get(
    '/ready',
    withAsyncHandler(async (_, res) => {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ok' });
    }),
  );

  app.get(
    '/discover',
    withAsyncHandler(async (req, res) => {
      const now = new Date();

      // 1. Trending routes — top entries from TripPlanCache, deduplicated by location
      const trendingCandidates = await prisma.tripPlanCache.findMany({
        where: { expiresAt: { gt: now }, validOptions: { gt: 0 } },
        orderBy: [{ engagementScore: 'desc' }, { updatedAt: 'desc' }],
        take: 30,
      });

      type CachedStop = {
        status: string;
        suggestion?: { imageUrl?: string };
      };
      type CachedOption = { title?: string; stops?: CachedStop[] };

      const seenLocations = new Set<string>();
      const trendingRoutes: {
        cacheId: string;
        location: string;
        radiusKm: number;
        themes: string[];
        engagementScore: number;
        previewTitle: string;
        previewImageUrl?: string;
      }[] = [];

      for (const cache of trendingCandidates) {
        const locKey = cache.location.toLowerCase().trim();
        if (!seenLocations.has(locKey) && trendingRoutes.length < 6) {
          seenLocations.add(locKey);
          const options = cache.options as CachedOption[] | null;
          const firstOption = Array.isArray(options) ? options[0] : null;
          const previewImageUrl = firstOption?.stops?.find((s) => s.status === 'resolved')
            ?.suggestion?.imageUrl;
          trendingRoutes.push({
            cacheId: cache.id,
            location: cache.location,
            radiusKm: cache.radiusKm,
            themes: cache.themesKey.split('|'),
            engagementScore: cache.engagementScore,
            previewTitle: firstOption?.title ?? cache.location,
            previewImageUrl: rewritePhotoProxyUrl(req, previewImageUrl),
          });
        }
      }

      // 2. Popular stops — mined from TripPlanCache, ranked by weighted appearance count
      type DiscoverStop = {
        id: string;
        placeId: string;
        title: string;
        description: string;
        imageUrl?: string;
        url?: string;
        sponsored: boolean;
      };

      type CachedResolvedStop = {
        status: 'resolved';
        suggestion: {
          id: string;
          placeId: string;
          title: string;
          description: string;
          imageUrl?: string;
        };
      };
      type CachedStopEntry = {
        status: string;
        suggestion?: CachedResolvedStop['suggestion'];
      };
      type CachedOptionEntry = { stops?: CachedStopEntry[] };

      // Reuse the trendingCandidates already fetched, plus fetch a wider set for stop mining
      const stopCandidates = await prisma.tripPlanCache.findMany({
        where: { expiresAt: { gt: now }, validOptions: { gt: 0 } },
        orderBy: [{ engagementScore: 'desc' }, { updatedAt: 'desc' }],
        take: 100,
      });

      // Tally each placeId weighted by the cache entry's engagementScore
      const stopScores = new Map<
        string,
        { score: number; stop: CachedResolvedStop['suggestion'] }
      >();

      for (const entry of stopCandidates) {
        const options = entry.options as CachedOptionEntry[] | null;
        if (!Array.isArray(options)) continue;
        for (const option of options) {
          for (const stop of option.stops ?? []) {
            if (stop.status !== 'resolved' || !stop.suggestion) continue;
            const { placeId } = stop.suggestion;
            const existing = stopScores.get(placeId);
            const weight = 1 + entry.engagementScore;
            if (existing) {
              existing.score += weight;
            } else {
              stopScores.set(placeId, { score: weight, stop: stop.suggestion });
            }
          }
        }
      }

      const popularStops: DiscoverStop[] = [...stopScores.entries()]
        .sort((a, b) => b[1].score - a[1].score)
        .slice(0, 9)
        .map(([, { stop }]) => ({
          id: stop.id,
          placeId: stop.placeId,
          title: stop.title,
          description: stop.description,
          imageUrl: rewritePhotoProxyUrl(req, stop.imageUrl),
          sponsored: false,
        }));

      // 3. Sponsored stops — inject up to 2 active records at positions 1 and 4
      const sponsored = await prisma.sponsoredPlace.findMany({
        where: { active: true },
        orderBy: { updatedAt: 'desc' },
        take: 2,
      });

      const sponsoredStops: DiscoverStop[] = sponsored.map((s) => ({
        id: s.id,
        placeId: s.placeId,
        title: s.title,
        description: s.description,
        imageUrl: s.imageUrl ?? undefined,
        url: s.url ?? undefined,
        sponsored: true,
      }));

      res.json({ trendingRoutes, nearbyStops: popularStops, sponsoredStops });
    }),
  );

  app.get(
    '/places/photo',
    withAsyncHandler(async (req, res) => {
      const userId = await getRequestUserId(req);

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

  app.get(
    '/trips/:id',
    requireAuth,
    withAsyncHandler(async (req, res) => {
      const userId = res.locals.userId as string;
      const { id } = req.params;

      const trip = await prisma.trip.findUnique({
        where: { id },
        include: { stops: { orderBy: { order: 'asc' } } },
      });

      if (!trip || trip.userId !== userId) {
        res.status(404).json({ error: 'NOT_FOUND' });
        return;
      }

      const filters = trip.filters as {
        location?: string;
        themes?: string[];
        rationale?: string;
      };

      // Compute drive-time estimates using haversine + 1.4× road factor at ~80 km/h
      const stopsWithLegs = trip.stops.map((stop, i) => {
        const prev = trip.stops[i - 1];
        let driveTimeMin: number | null = null;
        if (prev) {
          const distKm = haversineKm(prev.lat, prev.lng, stop.lat, stop.lng);
          driveTimeMin = Math.round(((distKm * 1.4) / 80) * 60);
        }
        return {
          id: stop.id,
          placeId: stop.placeId,
          name: stop.name,
          order: stop.order,
          lat: stop.lat,
          lng: stop.lng,
          notes: stop.notes ?? undefined,
          imageUrl: stop.imageUrl ?? undefined,
          driveTimeMin,
        };
      });

      res.json({
        id: trip.id,
        name: trip.name,
        originLat: trip.originLat,
        originLng: trip.originLng,
        shareToken: trip.shareToken ?? undefined,
        location: filters.location ?? '',
        themes: filters.themes ?? [],
        rationale: filters.rationale ?? '',
        stops: stopsWithLegs,
      });
    }),
  );

  app.delete(
    '/trips/:id',
    requireAuth,
    withAsyncHandler(async (req, res) => {
      const userId = res.locals.userId as string;
      const { id } = req.params;

      const trip = await prisma.trip.findUnique({ where: { id } });
      if (!trip || trip.userId !== userId) {
        res.status(404).json({ error: 'NOT_FOUND' });
        return;
      }

      await prisma.trip.delete({ where: { id } });
      res.status(204).send();
    }),
  );

  app.put(
    '/users/me',
    requireAuth,
    withAsyncHandler(async (req, res) => {
      const userId = res.locals.userId as string;
      const schema = z.object({
        email: z.string().email().nullable().optional(),
        name: z.string().nullable().optional(),
        image: z.string().nullable().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'INVALID_BODY' });
        return;
      }
      await prisma.user.upsert({
        where: { id: userId },
        update: parsed.data,
        create: { id: userId, ...parsed.data },
      });
      res.status(204).send();
    }),
  );

  app.get(
    '/users/me',
    requireAuth,
    withAsyncHandler(async (_req, res) => {
      const userId = res.locals.userId as string;
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        res.status(404).json({ error: 'NOT_FOUND' });
        return;
      }
      res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        role: user.role,
      });
    }),
  );

  app.get(
    '/trips/:id/sponsored-stop',
    requireAuth,
    withAsyncHandler(async (req, res) => {
      const userId = res.locals.userId as string;
      const { id } = req.params;

      const trip = await prisma.trip.findUnique({
        where: { id },
        include: { stops: { orderBy: { order: 'asc' } } },
      });

      if (!trip || trip.userId !== userId) {
        res.status(404).json({ error: 'NOT_FOUND' });
        return;
      }

      const sponsored = await prisma.sponsoredPlace.findMany({
        where: { active: true },
      });

      if (sponsored.length === 0) {
        res.json(null);
        return;
      }

      // Pick the sponsor closest to the trip midpoint stop.
      // Sponsors without lat/lng fall back to last place so geo-tagged sponsors
      // always win over untagged ones.
      const midStop = trip.stops[Math.floor(trip.stops.length / 2)];
      const refLat = midStop?.lat ?? trip.originLat;
      const refLng = midStop?.lng ?? trip.originLng;

      const best = sponsored.sort((a, b) => {
        const distA =
          a.lat != null && a.lng != null
            ? haversineKm(refLat, refLng, a.lat, a.lng)
            : Infinity;
        const distB =
          b.lat != null && b.lng != null
            ? haversineKm(refLat, refLng, b.lat, b.lng)
            : Infinity;
        return distA - distB;
      })[0];

      if (!best) {
        res.json(null);
        return;
      }
      // If the best sponsor is already a stop on this trip, try the next closest instead.
      const tripPlaceIds = new Set(trip.stops.map((s) => s.placeId));
      const picked =
        best.placeId && tripPlaceIds.has(best.placeId)
          ? (sponsored.find((s) => !tripPlaceIds.has(s.placeId)) ?? best)
          : best;

      res.json({
        id: picked.id,
        placeId: picked.placeId,
        title: picked.title,
        description: picked.description,
        imageUrl: picked.imageUrl ?? undefined,
        url: picked.url ?? undefined,
        lat: picked.lat ?? undefined,
        lng: picked.lng ?? undefined,
      });
    }),
  );

  // Sponsored stop for the planner (no trip yet) — query by lat/lng.
  app.get(
    '/sponsored-stop/nearby',
    requireAuth,
    withAsyncHandler(async (req, res) => {
      const latRaw = req.query.lat;
      const lngRaw = req.query.lng;
      const lat = typeof latRaw === 'string' ? parseFloat(latRaw) : NaN;
      const lng = typeof lngRaw === 'string' ? parseFloat(lngRaw) : NaN;
      if (isNaN(lat) || isNaN(lng)) {
        res.status(400).json({ error: 'INVALID_COORDS' });
        return;
      }

      const MAX_SPONSOR_RADIUS_KM = 200;

      const sponsored = await prisma.sponsoredPlace.findMany({ where: { active: true } });
      if (sponsored.length === 0) {
        res.json(null);
        return;
      }

      const best = sponsored
        .map((s) => ({
          sponsor: s,
          distKm:
            s.lat != null && s.lng != null
              ? haversineKm(lat, lng, s.lat, s.lng)
              : Infinity,
        }))
        .filter(({ distKm }) => distKm <= MAX_SPONSOR_RADIUS_KM)
        .sort((a, b) => a.distKm - b.distKm)[0]?.sponsor;

      if (!best) {
        res.json(null);
        return;
      }
      res.json({
        id: best.id,
        placeId: best.placeId,
        title: best.title,
        description: best.description,
        imageUrl: best.imageUrl ?? undefined,
        url: best.url ?? undefined,
        lat: best.lat ?? undefined,
        lng: best.lng ?? undefined,
      });
    }),
  );

  app.get(
    '/trips/cache/:id',
    withAsyncHandler(async (req, res) => {
      const { id } = req.params;
      const entry = await prisma.tripPlanCache.findUnique({ where: { id } });
      if (!entry) {
        res.status(404).json({ error: 'NOT_FOUND' });
        return;
      }

      const parsedOptions = plannedOptionsSchema.safeParse(entry.options);
      if (!parsedOptions.success || parsedOptions.data.length === 0) {
        res.status(404).json({ error: 'NO_OPTIONS' });
        return;
      }

      const options = parsedOptions.data.map((option) => ({
        ...option,
        stops: option.stops.map((stop) => {
          if (stop.status !== 'resolved') return stop;
          return {
            ...stop,
            suggestion: {
              ...stop.suggestion,
              imageUrl: rewritePhotoProxyUrl(req, stop.suggestion.imageUrl),
            },
          };
        }),
      }));

      res.json({
        location: entry.location,
        radiusKm: entry.radiusKm,
        themes: entry.themesKey.split('|'),
        source: 'cache' as const,
        options,
      });
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
          radiusKm: { gte: input.radiusKm * 0.75, lte: input.radiusKm * 1.25 },
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

      const useSse = req.headers.accept === 'text/event-stream';

      // Helper to write an SSE event (only used on the AI/streaming path)
      const sendSse = (event: string, data: unknown): void => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

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

          const hydratedOptions = parsedOptions.data.map((option) => ({
            ...option,
            stops: option.stops.map((stop) => {
              if (stop.status !== 'resolved') return stop;
              return {
                ...stop,
                suggestion: {
                  ...stop.suggestion,
                  imageUrl: rewritePhotoProxyUrl(req, stop.suggestion.imageUrl),
                },
              };
            }),
          }));

          if (useSse) {
            res.writeHead(200, {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache, no-transform',
              'X-Accel-Buffering': 'no',
            });
            sendSse('header', {
              location: input.location,
              radiusKm: input.radiusKm,
              themes: input.themes,
              source: 'cache',
            });
            for (const option of hydratedOptions) {
              sendSse('option', option);
            }
            sendSse('done', { degraded: false });
            res.end();
          } else {
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
              options: hydratedOptions,
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
          }
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

      // Start SSE response before the AI call so the client knows we're working
      if (useSse) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'X-Accel-Buffering': 'no',
        });
        sendSse('header', {
          location: input.location,
          radiusKm: input.radiusKm,
          themes: input.themes,
          source: 'ai',
        });
      }

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

        if (useSse) {
          sendSse('error', { code: 'AI_PLANNER_ERROR' });
          res.end();
        } else {
          res.status(502).json({
            error: 'AI_PLANNER_ERROR',
            ...(process.env.NODE_ENV !== 'production'
              ? {
                  diagnosticCode: aiError.code,
                  diagnosticStage: aiError.stage,
                }
              : {}),
          });
        }
        return;
      }

      // Resolve stops for each option concurrently and emit each as it resolves
      const resolveOption = async (option: {
        title: string;
        rationale: string;
        stops: { name: string; stopType: StopType }[];
      }): Promise<PlannedOption> => {
        const stopTypeByName = new Map(option.stops.map((s) => [s.name, s.stopType]));

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
            stopQueries: option.stops.map((s) => s.name),
          });
        } catch (error) {
          const placesError = toPlacesErrorMeta(error);
          logError(requestLogger, 'places.trip-planner enrich failure', error, {
            ...placesError,
            optionTitle: option.title,
          });

          stopResults = option.stops.map((s) => ({
            query: s.name,
            errorCode: 'UPSTREAM_ERROR' as const,
          }));
        }

        return {
          title: option.title,
          rationale: option.rationale,
          stops: stopResults.map((stopResult) => {
            const stopType = stopTypeByName.get(stopResult.query) ?? null;
            if (!stopResult.suggestion) {
              return {
                query: stopResult.query,
                status: 'unresolved' as const,
                stopType,
                errorCode: stopResult.errorCode ?? 'NOT_FOUND',
              };
            }

            const { photoName, ...suggestion } = stopResult.suggestion;
            return {
              query: stopResult.query,
              status: 'resolved' as const,
              stopType,
              suggestion: {
                ...suggestion,
                imageUrl: buildSuggestionImageUrl(req, photoName),
              },
            };
          }),
        } satisfies PlannedOption;
      };

      const options = await Promise.all(
        plans.options.map(async (option) => {
          const resolved = await resolveOption(option);
          if (useSse) sendSse('option', resolved);
          return resolved;
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
            locationKey: normalizeLocationKey(input.location),
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

      if (useSse) {
        sendSse('done', { degraded: plans.degraded ?? false });
        res.end();
        return;
      }

      const responsePayload: {
        location: string;
        radiusKm: number;
        themes: string[];
        source: 'ai';
        options: PlannedOption[];
        degraded?: boolean;
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
        ...(plans.degraded ? { degraded: true } : {}),
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

  const savePlanOptionSchema = z.object({
    title: z.string().min(1),
    rationale: z.string().optional(),
    location: z.string().min(1),
    originLat: z.number(),
    originLng: z.number(),
    radiusKm: z.number().positive(),
    themes: z.array(z.string().min(1)).min(1),
    stops: z
      .array(
        z.object({
          placeId: z.string().min(1),
          name: z.string().min(1),
          lat: z.number(),
          lng: z.number(),
          notes: z.string().optional(),
          imageUrl: z.string().url().optional(),
          order: z.number().int().min(0),
        }),
      )
      .min(1),
  });

  app.post(
    '/trips/save-plan',
    requireAuth,
    withAsyncHandler(async (req, res) => {
      const userId = res.locals.userId as string;

      const parsed = savePlanOptionSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'INVALID_BODY' });
        return;
      }

      const input = parsed.data;
      const requestLogger = getRequestLogger(res);

      // Generate AI descriptions for all stops — fire-and-forget on failure so
      // the save never fails because of the AI call.
      let descriptions: Record<string, string> = {};
      try {
        descriptions = await aiStopDescriptionService.generateDescriptions({
          stops: input.stops.map((s) => s.name),
          location: input.location,
          themes: input.themes,
        });
      } catch (error) {
        logError(requestLogger, 'ai.stop-descriptions failure', error, {
          location: input.location,
          stopCount: input.stops.length,
        });
      }

      const trip = await prisma.trip.create({
        data: {
          userId,
          name: input.title,
          originLat: input.originLat,
          originLng: input.originLng,
          filters: {
            radiusKm: input.radiusKm,
            themes: input.themes,
            location: input.location,
            rationale: input.rationale,
          },
          stops: {
            create: input.stops.map((stop) => ({
              placeId: stop.placeId,
              name: stop.name,
              order: stop.order,
              lat: stop.lat,
              lng: stop.lng,
              notes: descriptions[stop.name] ?? stop.notes,
              imageUrl: stop.imageUrl,
            })),
          },
        },
        include: { stops: { orderBy: { order: 'asc' } } },
      });

      res.status(201).json(trip);
    }),
  );

  const buildShareUrl = (token: string) =>
    `${env.PUBLIC_SITE_URL ?? 'http://localhost:3000'}/s/${token}`;

  app.post(
    '/trips/:id/share',
    requireAuth,
    withAsyncHandler(async (req, res) => {
      const userId = res.locals.userId as string;
      const { id } = req.params;

      const trip = await prisma.trip.findUnique({ where: { id } });

      if (!trip || trip.userId !== userId) {
        res.status(404).json({ error: 'NOT_FOUND' });
        return;
      }

      if (trip.shareToken) {
        res.json({ shareUrl: buildShareUrl(trip.shareToken) });
        return;
      }

      const shareToken = randomBytes(9).toString('base64url');
      await prisma.trip.update({ where: { id }, data: { shareToken } });

      res.json({ shareUrl: buildShareUrl(shareToken) });
    }),
  );

  app.get(
    '/trips/shared/:token',
    withAsyncHandler(async (req, res) => {
      const { token } = req.params;

      const trip = await prisma.trip.findUnique({
        where: { shareToken: token },
        include: { stops: { orderBy: { order: 'asc' } } },
      });

      if (!trip) {
        res.status(404).json({ error: 'NOT_FOUND' });
        return;
      }

      const filters = trip.filters as {
        location?: string;
        themes?: string[];
        rationale?: string;
      };

      const sharedStopsWithLegs = trip.stops.map((stop, i) => {
        const prev = trip.stops[i - 1];
        let driveTimeMin: number | null = null;
        if (prev) {
          const distKm = haversineKm(prev.lat, prev.lng, stop.lat, stop.lng);
          driveTimeMin = Math.round(((distKm * 1.4) / 80) * 60);
        }
        return {
          id: stop.id,
          name: stop.name,
          order: stop.order,
          notes: stop.notes ?? undefined,
          placeId: stop.placeId,
          imageUrl: stop.imageUrl ?? undefined,
          lat: stop.lat,
          lng: stop.lng,
          driveTimeMin,
        };
      });

      res.json({
        tripId: trip.id,
        name: trip.name,
        location: filters.location ?? '',
        themes: filters.themes ?? [],
        rationale: filters.rationale ?? '',
        stops: sharedStopsWithLegs,
      });
    }),
  );

  app.use('/trpc', createExpressMiddleware({ router: appRouter, createContext }));

  // ── Admin endpoints ──────────────────────────────────────────────────────
  // Protected by ADMIN_USER_IDS env var (comma-separated list of user IDs).

  const requireAdmin = (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    void (async () => {
      const userId = await getRequestUserId(req);
      if (!userId) {
        res.status(401).json({ error: 'UNAUTHORIZED' });
        return;
      }
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || user.role !== 'ADMIN') {
        res.status(403).json({ error: 'FORBIDDEN' });
        return;
      }
      res.locals.userId = userId;
      next();
    })();
  };

  const sponsorSchema = z.object({
    placeId: z.string().min(1).optional(),
    title: z.string().min(1),
    description: z.string().min(1),
    url: z.string().url().optional().nullable(),
    imageUrl: z.string().url().optional().nullable(),
    lat: z.number().min(-90).max(90).optional().nullable(),
    lng: z.number().min(-180).max(180).optional().nullable(),
    active: z.boolean().optional(),
  });

  app.get(
    '/admin/sponsors',
    requireAdmin,
    withAsyncHandler(async (_req, res) => {
      const sponsors = await prisma.sponsoredPlace.findMany({
        orderBy: { createdAt: 'desc' },
      });
      res.json(sponsors);
    }),
  );

  app.post(
    '/admin/sponsors',
    requireAdmin,
    withAsyncHandler(async (req, res) => {
      const parsed = sponsorSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'INVALID_BODY' });
        return;
      }
      const {
        placeId: providedPlaceId,
        title,
        description,
        url,
        imageUrl,
        lat,
        lng,
        active,
      } = parsed.data;
      const sponsor = await prisma.sponsoredPlace.create({
        data: {
          placeId: providedPlaceId ?? randomBytes(8).toString('hex'),
          title,
          description,
          url: url ?? null,
          imageUrl: imageUrl ?? null,
          lat: lat ?? null,
          lng: lng ?? null,
          active: active ?? true,
        },
      });
      res.status(201).json(sponsor);
    }),
  );

  app.patch(
    '/admin/sponsors/:id',
    requireAdmin,
    withAsyncHandler(async (req, res) => {
      const { id } = req.params;
      const parsed = sponsorSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'INVALID_BODY' });
        return;
      }
      const existing = await prisma.sponsoredPlace.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ error: 'NOT_FOUND' });
        return;
      }
      const sponsor = await prisma.sponsoredPlace.update({
        where: { id },
        data: parsed.data,
      });
      res.json(sponsor);
    }),
  );

  app.delete(
    '/admin/sponsors/:id',
    requireAdmin,
    withAsyncHandler(async (req, res) => {
      const { id } = req.params;
      const existing = await prisma.sponsoredPlace.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ error: 'NOT_FOUND' });
        return;
      }
      await prisma.sponsoredPlace.delete({ where: { id } });
      res.status(204).send();
    }),
  );

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
