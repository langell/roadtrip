import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { withAsyncHandler } from '../lib/async-handler.js';
import { requireAuth } from '../lib/require-auth.js';
import { haversineKm } from '../lib/haversine.js';

export const sponsoredRouter = Router();

type SponsoredRow = {
  id: string;
  placeId: string;
  title: string;
  description: string;
  imageUrl: string | null;
  url: string | null;
  lat: number | null;
  lng: number | null;
};

// Fetch active sponsored places sorted by distance from (refLat, refLng).
// Uses PostGIS ST_Distance when the location column exists; falls back to
// fetching all rows and sorting in-memory with haversine when it doesn't.
const fetchSortedByDistance = async (
  refLat: number,
  refLng: number,
  maxKm?: number,
): Promise<SponsoredRow[]> => {
  try {
    if (maxKm != null) {
      const radiusM = maxKm * 1000;
      return await prisma.$queryRaw<SponsoredRow[]>`
        SELECT id, "placeId", title, description, "imageUrl", url, lat, lng
        FROM "SponsoredPlace"
        WHERE active = true
          AND (
            location IS NULL
            OR ST_DWithin(
              location,
              ST_SetSRID(ST_MakePoint(${refLng}::float, ${refLat}::float), 4326)::geography,
              ${radiusM}::float
            )
          )
        ORDER BY
          CASE WHEN location IS NOT NULL
            THEN ST_Distance(
              location,
              ST_SetSRID(ST_MakePoint(${refLng}::float, ${refLat}::float), 4326)::geography
            )
            ELSE 999999999
          END ASC
        LIMIT 20
      `;
    }

    return await prisma.$queryRaw<SponsoredRow[]>`
      SELECT id, "placeId", title, description, "imageUrl", url, lat, lng
      FROM "SponsoredPlace"
      WHERE active = true
      ORDER BY
        CASE WHEN location IS NOT NULL
          THEN ST_Distance(
            location,
            ST_SetSRID(ST_MakePoint(${refLng}::float, ${refLat}::float), 4326)::geography
          )
          ELSE 999999999
        END ASC
      LIMIT 20
    `;
  } catch {
    // PostGIS unavailable or location column not yet migrated — fall back to
    // fetching all active rows and sorting in-memory with haversine.
    const all = await prisma.sponsoredPlace.findMany({ where: { active: true } });

    const withDist = all.map((s) => ({
      row: {
        id: s.id,
        placeId: s.placeId,
        title: s.title,
        description: s.description,
        imageUrl: s.imageUrl,
        url: s.url,
        lat: s.lat,
        lng: s.lng,
      } satisfies SponsoredRow,
      distKm:
        s.lat != null && s.lng != null
          ? haversineKm(refLat, refLng, s.lat, s.lng)
          : Infinity,
    }));

    withDist.sort((a, b) => a.distKm - b.distKm);

    const filtered = maxKm != null ? withDist.filter((x) => x.distKm <= maxKm) : withDist;
    return filtered.map((x) => x.row);
  }
};

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

    const midStop = trip.stops[Math.floor(trip.stops.length / 2)];
    const refLat = midStop?.lat ?? trip.originLat;
    const refLng = midStop?.lng ?? trip.originLng;

    const rows = await fetchSortedByDistance(refLat, refLng);

    if (rows.length === 0) {
      res.json(null);
      return;
    }

    // Skip the closest if its placeId is already a stop in this trip.
    const tripPlaceIds = new Set(trip.stops.map((s) => s.placeId));
    const best = rows[0];
    const picked =
      best.placeId && tripPlaceIds.has(best.placeId)
        ? (rows.find((s) => !tripPlaceIds.has(s.placeId)) ?? best)
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

const MAX_SPONSOR_RADIUS_KM = 200;

// Sponsored stop for the planner (no trip yet) — query by lat/lng within radius
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

    const rows = await fetchSortedByDistance(lat, lng, MAX_SPONSOR_RADIUS_KM);

    if (rows.length === 0) {
      res.json(null);
      return;
    }

    const best = rows[0];
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
