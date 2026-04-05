import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { aiTripPlannerService } from '../services/ai-trip-planner-service.js';
import type { Prisma } from '@prisma/client';

type PrewarmResult = {
  attempted: number;
  skipped: number;
  generated: number;
  errors: number;
};

/**
 * Selects the top N distinct locations by engagementScore from the cache.
 */
async function getTrendingLocations(limit: number): Promise<string[]> {
  const rows = await prisma.tripPlanCache.groupBy({
    by: ['locationKey'],
    where: { locationKey: { not: null }, expiresAt: { gt: new Date() } },
    _sum: { engagementScore: true },
    orderBy: { _sum: { engagementScore: 'desc' } },
    take: limit,
  });
  return rows
    .map((r) => r.locationKey)
    .filter((k): k is string => k !== null && k.length > 0);
}

/**
 * Selects the top N most-used themesKeys from the cache for a given locationKey.
 */
async function getTopThemesKeys(locationKey: string, limit: number): Promise<string[]> {
  const rows = await prisma.tripPlanCache.groupBy({
    by: ['themesKey'],
    where: { locationKey, expiresAt: { gt: new Date() } },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: limit,
  });
  return rows.map((r) => r.themesKey);
}

/**
 * Returns true if a valid non-expired cache entry already exists for this combination.
 */
async function cacheEntryExists(
  locationKey: string,
  themesKey: string,
  radiusKm: number,
  maxOptions: number,
): Promise<boolean> {
  const count = await prisma.tripPlanCache.count({
    where: {
      locationKey,
      themesKey,
      radiusKm: { gte: radiusKm * 0.75, lte: radiusKm * 1.25 },
      maxOptions,
      expiresAt: { gt: new Date() },
      validOptions: { gt: 0 },
    },
  });
  return count > 0;
}

/**
 * Nightly cache pre-warmer.
 *
 * Generates trip plans for the top trending destinations + their most-used
 * theme combos. Skips any combination that already has a valid cache entry.
 * Bounded to env.PREWARM_MAX_GENERATIONS per run.
 */
export async function runPrewarmCache(): Promise<PrewarmResult> {
  const result: PrewarmResult = { attempted: 0, skipped: 0, generated: 0, errors: 0 };
  const now = new Date();

  const locations = await getTrendingLocations(env.PREWARM_MAX_LOCATIONS);
  const DEFAULT_RADIUS_KM = 120;
  const DEFAULT_MAX_OPTIONS = 3;

  logger.info({ locationCount: locations.length }, 'cache.prewarm.start');

  for (const locationKey of locations) {
    if (result.attempted >= env.PREWARM_MAX_GENERATIONS) break;

    const themesKeys = await getTopThemesKeys(locationKey, env.PREWARM_MAX_THEME_COMBOS);
    if (themesKeys.length === 0) continue;

    for (const themesKey of themesKeys) {
      if (result.attempted >= env.PREWARM_MAX_GENERATIONS) break;
      result.attempted++;

      const alreadyExists = await cacheEntryExists(
        locationKey,
        themesKey,
        DEFAULT_RADIUS_KM,
        DEFAULT_MAX_OPTIONS,
      );

      if (alreadyExists) {
        result.skipped++;
        logger.info({ locationKey, themesKey }, 'cache.prewarm.skip');
        continue;
      }

      const themes = themesKey.split('|');

      let attemptStatus: 'generated' | 'error' = 'generated';
      try {
        const rawOptions = await aiTripPlannerService.generatePlans({
          location: locationKey,
          radiusKm: DEFAULT_RADIUS_KM,
          themes,
          maxOptions: DEFAULT_MAX_OPTIONS,
        });

        if (rawOptions.length > 0) {
          await prisma.tripPlanCache.create({
            data: {
              location: locationKey,
              locationKey,
              centerLat: 0,
              centerLng: 0,
              radiusKm: DEFAULT_RADIUS_KM,
              themesKey,
              maxOptions: DEFAULT_MAX_OPTIONS,
              options: rawOptions as Prisma.InputJsonValue,
              validOptions: rawOptions.length,
              engagementScore: 0,
              lastServedAt: null,
              expiresAt: new Date(
                now.getTime() + env.TRIP_PLAN_CACHE_TTL_DAYS * 24 * 60 * 60 * 1000,
              ),
            },
          });
          result.generated++;
          logger.info(
            { locationKey, themesKey, count: rawOptions.length },
            'cache.prewarm.generated',
          );
        }
      } catch (error) {
        attemptStatus = 'error';
        result.errors++;
        logger.error({ err: error, locationKey, themesKey }, 'cache.prewarm.error');
      }

      await prisma.analyticsEvent.create({
        data: {
          type: 'cache.prewarm',
          payload: { locationKey, themesKey, status: attemptStatus },
        },
      });
    }
  }

  logger.info(result, 'cache.prewarm.complete');
  return result;
}
