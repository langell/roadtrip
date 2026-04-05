import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { withAsyncHandler } from '../lib/async-handler.js';
import { requireAuth } from '../lib/require-auth.js';
import { haversineKm } from '../lib/haversine.js';

export const sponsoredRouter = Router();

// Sponsored stop for a saved trip — geo-closest to midpoint
sponsoredRouter.get(
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

    const sponsored = await prisma.sponsoredPlace.findMany({ where: { active: true } });
    if (sponsored.length === 0) {
      res.json(null);
      return;
    }

    const midStop = trip.stops[Math.floor(trip.stops.length / 2)];
    const refLat = midStop?.lat ?? trip.originLat;
    const refLng = midStop?.lng ?? trip.originLng;

    const sorted = [...sponsored].sort((a, b) => {
      const distA =
        a.lat != null && a.lng != null
          ? haversineKm(refLat, refLng, a.lat, a.lng)
          : Infinity;
      const distB =
        b.lat != null && b.lng != null
          ? haversineKm(refLat, refLng, b.lat, b.lng)
          : Infinity;
      return distA - distB;
    });

    const best = sorted[0];
    if (!best) {
      res.json(null);
      return;
    }

    const tripPlaceIds = new Set(trip.stops.map((s) => s.placeId));
    const picked =
      best.placeId && tripPlaceIds.has(best.placeId)
        ? (sorted.find((s) => !tripPlaceIds.has(s.placeId)) ?? best)
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

// Sponsored stop for the planner (no trip yet) — query by lat/lng
sponsoredRouter.get(
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
          s.lat != null && s.lng != null ? haversineKm(lat, lng, s.lat, s.lng) : Infinity,
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
