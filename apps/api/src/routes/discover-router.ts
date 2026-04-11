import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { withAsyncHandler } from '../lib/async-handler.js';
import { rewritePhotoProxyUrl } from '../lib/photo-url.js';
import { aiStopDescriptionService } from '../services/ai-stop-description-service.js';

type CachedStop = { status: string; suggestion?: { imageUrl?: string } };
type CachedOption = { title?: string; stops?: CachedStop[] };
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
type CachedStopEntry = { status: string; suggestion?: CachedResolvedStop['suggestion'] };
type CachedOptionEntry = { stops?: CachedStopEntry[] };

type DiscoverStop = {
  id: string;
  placeId: string;
  title: string;
  description: string;
  imageUrl?: string;
  url?: string;
  sponsored: boolean;
};

export const discoverRouter = Router();

discoverRouter.get(
  '/',
  withAsyncHandler(async (req, res) => {
    const now = new Date();

    // 1. Trending routes — top entries from TripPlanCache, deduplicated by location
    const trendingCandidates = await prisma.tripPlanCache.findMany({
      where: { expiresAt: { gt: now }, validOptions: { gt: 0 } },
      orderBy: [{ engagementScore: 'desc' }, { updatedAt: 'desc' }],
      take: 30,
    });

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
    const stopCandidates = await prisma.tripPlanCache.findMany({
      where: { expiresAt: { gt: now }, validOptions: { gt: 0 } },
      orderBy: [{ engagementScore: 'desc' }, { updatedAt: 'desc' }],
      take: 100,
    });

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

    const topStops = [...stopScores.entries()]
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, 5)
      .map(([, { stop }]) => ({
        id: stop.id,
        placeId: stop.placeId,
        title: stop.title,
        description: stop.description,
        imageUrl: rewritePhotoProxyUrl(req, stop.imageUrl),
        sponsored: false,
      }));

    // Enrich with AI-generated descriptions (cached 24h per placeId; falls back to original)
    let aiDescriptions: Record<string, string> = {};
    try {
      aiDescriptions = await aiStopDescriptionService.generateDiscoverDescriptions(
        topStops.map((s) => ({
          placeId: s.placeId,
          title: s.title,
          description: s.description,
        })),
      );
    } catch {
      // Non-fatal — original descriptions are used as fallback
    }

    const nearbyStops: DiscoverStop[] = topStops.map((s) => ({
      ...s,
      description: aiDescriptions[s.placeId] ?? s.description,
    }));

    // 3. Sponsored stops
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

    res.json({ trendingRoutes, nearbyStops, sponsoredStops });
  }),
);
