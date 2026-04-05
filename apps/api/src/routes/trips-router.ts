import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { TripThemeSchema, PlannedOptionsSchema } from '@roadtrip/types';
import type { PlannedOption, StopType } from '@roadtrip/types';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { withAsyncHandler } from '../lib/async-handler.js';
import { requireAuth } from '../lib/require-auth.js';
import { getRequestLogger } from '../lib/request-logging.js';
import { logError } from '../lib/logger.js';
import { getRequestUserId } from '../lib/request-auth.js';
import { getRequesterIp } from '../lib/rate-limiter.js';
import { haversineKm, toRadians } from '../lib/haversine.js';
import { buildSuggestionImageUrl, rewritePhotoProxyUrl } from '../lib/photo-url.js';
import { toPlacesErrorMeta, toAiPlannerErrorMeta } from '../lib/error-meta.js';
import { googlePlacesService } from '../services/google-places-service.js';
import { aiTripPlannerService } from '../services/ai-trip-planner-service.js';
import { aiStopDescriptionService } from '../services/ai-stop-description-service.js';
import { normalizeLocationKey } from '../lib/normalize-location.js';
import { getUserPreferences } from '../lib/user-preferences.js';

const TRIP_PLAN_CACHE_RADIUS_MILES = 10;
const KM_PER_MILE = 1.60934;

const buildShareUrl = (token: string) =>
  `${env.PUBLIC_SITE_URL ?? 'http://localhost:3000'}/s/${token}`;

const computeStopsWithLegs = (
  stops: {
    id?: string;
    name: string;
    order: number;
    lat: number;
    lng: number;
    notes?: string | null;
    placeId: string;
    imageUrl?: string | null;
    driveTimeMin?: number | null;
  }[],
) =>
  stops.map((stop, i) => {
    const prev = stops[i - 1];
    let driveTimeMin: number | null = null;
    if (prev) {
      const distKm = haversineKm(prev.lat, prev.lng, stop.lat, stop.lng);
      driveTimeMin = Math.round(((distKm * 1.4) / 80) * 60);
    }
    return {
      ...stop,
      notes: stop.notes ?? undefined,
      imageUrl: stop.imageUrl ?? undefined,
      driveTimeMin,
    };
  });

export const tripsRouter = Router();

// ── Cache lookup by ID (public) ──────────────────────────────────────────────

tripsRouter.get(
  '/cache/:id',
  withAsyncHandler(async (req, res) => {
    const { id } = req.params;
    const entry = await prisma.tripPlanCache.findUnique({ where: { id } });
    if (!entry) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }

    const parsedOptions = PlannedOptionsSchema.safeParse(entry.options);
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

// ── List trips ───────────────────────────────────────────────────────────────

tripsRouter.get(
  '/',
  requireAuth,
  withAsyncHandler(async (_req, res) => {
    const userId = res.locals.userId as string;
    const trips = await prisma.trip.findMany({
      where: { userId },
      include: { stops: { orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(trips);
  }),
);

// ── Get trip by ID ───────────────────────────────────────────────────────────

tripsRouter.get(
  '/:id',
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

    res.json({
      id: trip.id,
      name: trip.name,
      originLat: trip.originLat,
      originLng: trip.originLng,
      shareToken: trip.shareToken ?? undefined,
      location: filters.location ?? '',
      themes: filters.themes ?? [],
      rationale: filters.rationale ?? '',
      stops: computeStopsWithLegs(trip.stops),
    });
  }),
);

// ── Delete trip ──────────────────────────────────────────────────────────────

tripsRouter.delete(
  '/:id',
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

// ── Share trip ───────────────────────────────────────────────────────────────

tripsRouter.post(
  '/:id/share',
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

// ── Get shared trip by token ─────────────────────────────────────────────────

tripsRouter.get(
  '/shared/:token',
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

    res.json({
      tripId: trip.id,
      name: trip.name,
      location: filters.location ?? '',
      themes: filters.themes ?? [],
      rationale: filters.rationale ?? '',
      stops: computeStopsWithLegs(trip.stops),
    });
  }),
);

// ── Refine plan (targeted AI edit of one option) ────────────────────────────

const refinePlanSchema = z.object({
  location: z.string().min(1),
  themes: z.array(TripThemeSchema).min(1),
  instruction: z.string().min(1).max(200),
  planOption: z.object({
    title: z.string().min(1),
    rationale: z.string().min(1),
    stops: z.array(z.object({ name: z.string().min(1) })).min(1),
  }),
});

tripsRouter.post(
  '/refine-plan',
  withAsyncHandler(async (req, res) => {
    const requestLogger = getRequestLogger(res);
    const userId = await getRequestUserId(req);
    const { allowAnonymousSuggestionRequest } = res.locals as {
      allowAnonymousSuggestionRequest: (ip: string) => boolean;
    };

    if (!userId && !allowAnonymousSuggestionRequest(getRequesterIp(req))) {
      res.status(429).json({ error: 'RATE_LIMITED' });
      return;
    }

    const parsed = refinePlanSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'INVALID_BODY' });
      return;
    }

    const input = parsed.data;

    let rawOption: {
      title: string;
      rationale: string;
      stops: { name: string; stopType: StopType }[];
    };
    try {
      rawOption = await aiTripPlannerService.refinePlan({
        existingOption: input.planOption,
        instruction: input.instruction,
        location: input.location,
        themes: input.themes,
      });
    } catch (error) {
      const aiError = toAiPlannerErrorMeta(error);
      logError(requestLogger, 'ai.refine-plan failure', error, {
        ...aiError,
        input: { location: input.location, themes: input.themes },
      });
      res.status(502).json({ error: 'AI_PLANNER_ERROR' });
      return;
    }

    // Geocode origin for distance calculations in resolvePlannedStops
    let origin: { lat: number; lng: number };
    try {
      origin = await googlePlacesService.geocodeLocation(input.location);
    } catch (error) {
      const placesError = toPlacesErrorMeta(error);
      logError(requestLogger, 'places.refine-plan geocode failure', error, {
        ...placesError,
      });
      res.status(502).json({ error: 'UPSTREAM_PLACES_ERROR' });
      return;
    }

    const stopTypeByName = new Map(rawOption.stops.map((s) => [s.name, s.stopType]));

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
        radiusKm: 200,
        stopQueries: rawOption.stops.map((s) => s.name),
      });
    } catch (error) {
      logError(requestLogger, 'places.refine-plan enrich failure', error, {});
      stopResults = rawOption.stops.map((s) => ({
        query: s.name,
        errorCode: 'UPSTREAM_ERROR' as const,
      }));
    }

    const refinedOption: PlannedOption = {
      title: rawOption.title,
      rationale: rawOption.rationale,
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
    };

    requestLogger.info(
      {
        location: input.location,
        themes: input.themes,
        stopCount: refinedOption.stops.length,
      },
      'ai.refine-plan success',
    );

    // suppress unused-var warning — origin is used for geocode validation above
    void origin;

    res.status(200).json(refinedOption);
  }),
);

// ── Plan trip (AI + cache) ───────────────────────────────────────────────────

const planTripSchema = z.object({
  location: z.string().min(3),
  radiusKm: z.number().positive().max(500),
  themes: z.array(TripThemeSchema).min(1),
  maxOptions: z.union([z.literal(2), z.literal(3)]).default(3),
  modifiers: z
    .object({ smartPitstops: z.boolean().optional(), photoOps: z.boolean().optional() })
    .optional(),
});

const toThemesKey = (themes: string[]) =>
  Array.from(new Set(themes.map((t) => t.trim().toLowerCase()).filter(Boolean)))
    .sort()
    .join('|');

tripsRouter.post(
  '/plan',
  withAsyncHandler(async (req, res) => {
    const requestLogger = getRequestLogger(res);
    const userId = await getRequestUserId(req);
    const { allowAnonymousSuggestionRequest } = res.locals as {
      allowAnonymousSuggestionRequest: (ip: string) => boolean;
    };

    if (!userId && !allowAnonymousSuggestionRequest(getRequesterIp(req))) {
      res.status(429).json({ error: 'RATE_LIMITED' });
      return;
    }

    const parsed = planTripSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'INVALID_BODY' });
      return;
    }

    const input = parsed.data;
    const themesKey = toThemesKey(input.themes);
    const cacheRadiusKm = TRIP_PLAN_CACHE_RADIUS_MILES * KM_PER_MILE;
    const now = new Date();
    const debugEnabled =
      env.TRIP_PLAN_CACHE_DEBUG && process.env.NODE_ENV !== 'production';

    let origin: { lat: number; lng: number };
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
        },
      });
      res.status(502).json({
        error: 'UPSTREAM_PLACES_ERROR',
        ...(process.env.NODE_ENV !== 'production'
          ? { diagnosticCode: placesError.code, diagnosticStage: placesError.stage }
          : {}),
      });
      return;
    }

    const latDelta = cacheRadiusKm / 111.32;
    const cosLatitude = Math.max(Math.cos(toRadians(origin.lat)), 0.2);
    const lngDelta = cacheRadiusKm / (111.32 * cosLatitude);

    const locationKey = normalizeLocationKey(input.location);
    const cacheCandidates = await prisma.tripPlanCache.findMany({
      where: {
        themesKey,
        radiusKm: { gte: input.radiusKm * 0.75, lte: input.radiusKm * 1.25 },
        maxOptions: input.maxOptions,
        expiresAt: { gt: now },
        validOptions: { gt: 0 },
        // Match by normalized location key (fast index path) OR by geographic
        // bounding box (covers legacy entries without locationKey and handles
        // cases where the same city name appears in multiple regions).
        // Haversine filtering below further disambiguates geographic false-positives.
        OR: [
          { locationKey },
          {
            centerLat: { gte: origin.lat - latDelta, lte: origin.lat + latDelta },
            centerLng: { gte: origin.lng - lngDelta, lte: origin.lng + lngDelta },
          },
        ],
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
        if (b.candidate.engagementScore !== a.candidate.engagementScore)
          return b.candidate.engagementScore - a.candidate.engagementScore;
        if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
        return b.candidate.updatedAt.getTime() - a.candidate.updatedAt.getTime();
      })[0];

    const cacheHit = cacheHitWithDistance?.candidate;
    const cacheHitDistanceKm = cacheHitWithDistance?.distanceKm;
    const nearestCandidateDistanceKm =
      cacheCandidatesWithDistance.length > 0
        ? Math.min(...cacheCandidatesWithDistance.map(({ distanceKm }) => distanceKm))
        : null;

    const useSse = req.headers.accept === 'text/event-stream';
    const sendSse = (event: string, data: unknown): void => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const hydrateOptions = (options: z.infer<typeof PlannedOptionsSchema>) =>
      options.map((option) => ({
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

    if (cacheHit) {
      const parsedOptions = PlannedOptionsSchema.safeParse(cacheHit.options);
      if (parsedOptions.success && parsedOptions.data.length) {
        await prisma.tripPlanCache.update({
          where: { id: cacheHit.id },
          data: { engagementScore: { increment: 1 }, lastServedAt: now },
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

        const hydratedOptions = hydrateOptions(parsedOptions.data);

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
          for (const option of hydratedOptions) sendSse('option', option);
          sendSse('done', { degraded: false });
          res.end();
        } else {
          res.status(200).json({
            location: input.location,
            radiusKm: input.radiusKm,
            themes: input.themes,
            source: 'cache' as const,
            options: hydratedOptions,
            ...(debugEnabled
              ? {
                  cacheDebug: {
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
                  },
                }
              : {}),
          });
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

    type RawStopResult = {
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
    };

    const toSuggestion = (sr: RawStopResult) => {
      if (!sr.suggestion) return null;
      const { photoName, ...rest } = sr.suggestion;
      return { ...rest, imageUrl: buildSuggestionImageUrl(req, photoName) };
    };

    // Helper: resolve a raw AI option to a PlannedOption with Places API enrichment
    const resolveOption = async (option: {
      title: string;
      rationale: string;
      stops: { name: string; alternatives: string[]; stopType: StopType }[];
    }): Promise<PlannedOption> => {
      const stopTypeByName = new Map(option.stops.map((s) => [s.name, s.stopType]));
      const altsByPrimary = new Map(option.stops.map((s) => [s.name, s.alternatives]));

      // Collect all queries: primaries + alternatives (flattened, guard against missing field)
      const allQueries = [
        ...option.stops.map((s) => s.name),
        ...option.stops.flatMap((s) => s.alternatives ?? []),
      ];
      const uniqueQueries = Array.from(new Set(allQueries));

      let allResults: RawStopResult[];
      try {
        allResults = await googlePlacesService.resolvePlannedStops({
          location: input.location,
          radiusKm: input.radiusKm,
          stopQueries: uniqueQueries,
        });
      } catch (error) {
        const placesError = toPlacesErrorMeta(error);
        logError(requestLogger, 'places.trip-planner enrich failure', error, {
          ...placesError,
          optionTitle: option.title,
        });
        allResults = uniqueQueries.map((q) => ({
          query: q,
          errorCode: 'UPSTREAM_ERROR' as const,
        }));
      }

      const resultByQuery = new Map(allResults.map((r) => [r.query, r]));

      return {
        title: option.title,
        rationale: option.rationale,
        stops: option.stops.map((stop) => {
          const stopType = stopTypeByName.get(stop.name) ?? null;
          const primaryResult = resultByQuery.get(stop.name);
          if (!primaryResult?.suggestion) {
            return {
              query: stop.name,
              status: 'unresolved' as const,
              stopType,
              errorCode: primaryResult?.errorCode ?? 'NOT_FOUND',
            };
          }
          const primarySuggestion = toSuggestion(primaryResult)!;
          const alternatives = (altsByPrimary.get(stop.name) ?? [])
            .map((altName) =>
              toSuggestion(resultByQuery.get(altName) ?? { query: altName }),
            )
            .filter((s): s is NonNullable<typeof s> => s !== null);

          return {
            query: stop.name,
            status: 'resolved' as const,
            stopType,
            suggestion: primarySuggestion,
            ...(alternatives.length > 0 ? { alternatives } : {}),
          };
        }),
      } satisfies PlannedOption;
    };

    // Helper: write resolved options to the plan cache
    const writePlanCache = async (validOptions: PlannedOption[]) => {
      if (validOptions.length === 0) return;
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
    };

    // ── Personalization: fetch user preferences for authenticated users ─────────
    const userPreferences = userId
      ? await getUserPreferences(userId).catch(() => null)
      : null;

    // ── SSE path: stream from Gemini, resolve + emit each option as it arrives ──
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

      const resolvedOptions: PlannedOption[] = [];
      const pending: Promise<void>[] = [];
      let streamFailed = false;

      try {
        for await (const rawOption of aiTripPlannerService.generatePlansStream({
          location: input.location,
          radiusKm: input.radiusKm,
          themes: input.themes,
          maxOptions: input.maxOptions,
          modifiers: input.modifiers,
          ...(userPreferences ? { userPreferences } : {}),
        })) {
          const p = resolveOption(rawOption)
            .then((resolved) => {
              sendSse('option', resolved);
              resolvedOptions.push(resolved);
            })
            .catch((err: unknown) => {
              const placesError = toPlacesErrorMeta(err);
              logError(
                requestLogger,
                'places.trip-planner enrich failure (stream)',
                err,
                {
                  ...placesError,
                  optionTitle: rawOption.title,
                },
              );
            });
          pending.push(p);
        }
      } catch (error) {
        const aiError = toAiPlannerErrorMeta(error);
        logError(requestLogger, 'ai.trip-planner stream failure', error, {
          ...aiError,
          input: {
            location: input.location,
            radiusKm: input.radiusKm,
            themes: input.themes,
          },
        });
        streamFailed = true;
      }

      await Promise.allSettled(pending);

      if (streamFailed && resolvedOptions.length === 0) {
        sendSse('error', { code: 'AI_PLANNER_ERROR' });
        res.end();
        return;
      }

      const validStreamOptions = resolvedOptions.filter(
        (option) =>
          option.stops.length > 0 && option.stops.every((s) => s.status === 'resolved'),
      );
      await writePlanCache(validStreamOptions);

      sendSse('done', { degraded: resolvedOptions.length < input.maxOptions });
      res.end();
      return;
    }

    // ── JSON path: blocking generate + all options at once ────────────────────
    let plans: Awaited<ReturnType<typeof aiTripPlannerService.generatePlans>>;
    try {
      plans = await aiTripPlannerService.generatePlans({
        location: input.location,
        radiusKm: input.radiusKm,
        themes: input.themes,
        maxOptions: input.maxOptions,
        modifiers: input.modifiers,
        ...(userPreferences ? { userPreferences } : {}),
      });
    } catch (error) {
      const aiError = toAiPlannerErrorMeta(error);
      logError(requestLogger, 'ai.trip-planner failure', error, {
        ...aiError,
        input: {
          location: input.location,
          radiusKm: input.radiusKm,
          themes: input.themes,
        },
      });
      res.status(502).json({
        error: 'AI_PLANNER_ERROR',
        ...(process.env.NODE_ENV !== 'production'
          ? { diagnosticCode: aiError.code, diagnosticStage: aiError.stage }
          : {}),
      });
      return;
    }

    const options = await Promise.all(
      plans.options.map((option) => resolveOption(option)),
    );

    const validOptions = options.filter(
      (option) =>
        option.stops.length > 0 && option.stops.every((s) => s.status === 'resolved'),
    );
    await writePlanCache(validOptions);

    res.status(200).json({
      location: input.location,
      radiusKm: input.radiusKm,
      themes: input.themes,
      source: 'ai' as const,
      options,
      ...(plans.degraded ? { degraded: true } : {}),
      ...(debugEnabled
        ? {
            cacheDebug: {
              enabled: true,
              radiusMiles: TRIP_PLAN_CACHE_RADIUS_MILES,
              nearestCandidateDistanceMiles:
                typeof nearestCandidateDistanceKm === 'number'
                  ? Number((nearestCandidateDistanceKm / KM_PER_MILE).toFixed(2))
                  : null,
              selectedCandidateDistanceMiles: null,
              candidateCount: cacheCandidates.length,
            },
          }
        : {}),
    });
  }),
);

// ── Save generated trip ──────────────────────────────────────────────────────

const saveGeneratedTripSchema = z.object({
  location: z.string().min(3),
  radiusKm: z.number().positive(),
  theme: z.string().min(1),
  name: z.string().min(1).optional(),
});

tripsRouter.post(
  '/save-generated',
  requireAuth,
  withAsyncHandler(async (req, res) => {
    const userId = res.locals.userId as string;
    const parsed = saveGeneratedTripSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'INVALID_BODY' });
      return;
    }

    const input = parsed.data;
    let suggestions: Awaited<ReturnType<typeof googlePlacesService.findStops>>;
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
          ? { diagnosticCode: placesError.code, diagnosticStage: placesError.stage }
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
          create: suggestions.map((s, i) => ({
            placeId: s.placeId,
            name: s.title,
            order: i,
            lat: s.lat,
            lng: s.lng,
            notes: s.description,
          })),
        },
      },
      include: { stops: { orderBy: { order: 'asc' } } },
    });

    res.status(201).json(trip);
  }),
);

// ── Save plan option ─────────────────────────────────────────────────────────

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

tripsRouter.post(
  '/save-plan',
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
