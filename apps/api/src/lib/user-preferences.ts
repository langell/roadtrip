import { prisma } from './prisma.js';

const MIN_TRIPS_FOR_PERSONALIZATION = 2;

type TripFilters = {
  themes?: string[];
  radiusKm?: number;
};

/**
 * Queries a user's saved trips and returns a short natural-language preference
 * hint for injection into the AI prompt. Returns null when the user has fewer
 * than MIN_TRIPS_FOR_PERSONALIZATION saved trips.
 */
export async function getUserPreferences(userId: string): Promise<string | null> {
  const trips = await prisma.trip.findMany({
    where: { userId },
    select: {
      filters: true,
      stops: { select: { order: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  if (trips.length < MIN_TRIPS_FOR_PERSONALIZATION) {
    return null;
  }

  // ── Theme frequency ────────────────────────────────────────────────────────
  const themeCounts: Record<string, number> = {};
  for (const trip of trips) {
    const filters = trip.filters as TripFilters;
    for (const theme of filters.themes ?? []) {
      themeCounts[theme] = (themeCounts[theme] ?? 0) + 1;
    }
  }
  const topThemes = Object.entries(themeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([theme]) => theme);

  // ── Average stop count ─────────────────────────────────────────────────────
  const stopCounts = trips.map((t) => t.stops.length).filter((n) => n > 0);
  const avgStops =
    stopCounts.length > 0
      ? Math.round(stopCounts.reduce((a, b) => a + b, 0) / stopCounts.length)
      : null;

  // ── Preferred radius range ─────────────────────────────────────────────────
  const radii = trips
    .map((t) => (t.filters as TripFilters).radiusKm)
    .filter((r): r is number => typeof r === 'number' && r > 0);
  const avgRadius =
    radii.length > 0 ? Math.round(radii.reduce((a, b) => a + b, 0) / radii.length) : null;

  // ── Build hint ─────────────────────────────────────────────────────────────
  const parts: string[] = [];

  if (topThemes.length > 0) {
    parts.push(`prefers ${topThemes.join(' + ')} trips`);
  }
  if (avgStops !== null) {
    parts.push(`typically ${avgStops} stop${avgStops !== 1 ? 's' : ''}`);
  }
  if (avgRadius !== null) {
    parts.push(`~${avgRadius}km radius`);
  }

  if (parts.length === 0) return null;

  return `This user tends to prefer ${parts.join(', ')}.`;
}
