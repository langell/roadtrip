import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { withAsyncHandler } from '../lib/async-handler.js';
import { requireAuth } from '../lib/require-auth.js';

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

    // PostGIS: order geo-tagged sponsors by distance; untagged sponsors sort last.
    const rows = await prisma.$queryRaw<SponsoredRow[]>`
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

    const radiusM = MAX_SPONSOR_RADIUS_KM * 1000;

    // PostGIS: filter by radius for geo-tagged sponsors; include untagged as fallback.
    const rows = await prisma.$queryRaw<SponsoredRow[]>`
      SELECT id, "placeId", title, description, "imageUrl", url, lat, lng
      FROM "SponsoredPlace"
      WHERE active = true
        AND (
          location IS NULL
          OR ST_DWithin(
            location,
            ST_SetSRID(ST_MakePoint(${lng}::float, ${lat}::float), 4326)::geography,
            ${radiusM}::float
          )
        )
      ORDER BY
        CASE WHEN location IS NOT NULL
          THEN ST_Distance(
            location,
            ST_SetSRID(ST_MakePoint(${lng}::float, ${lat}::float), 4326)::geography
          )
          ELSE 999999999
        END ASC
      LIMIT 20
    `;

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
