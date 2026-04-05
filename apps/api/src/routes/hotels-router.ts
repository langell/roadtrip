import { Router } from 'express';
import { withAsyncHandler } from '../lib/async-handler.js';
import { getRequestLogger } from '../lib/request-logging.js';
import { logError } from '../lib/logger.js';
import { hotelSearchService } from '../services/hotel-search-service.js';

export const hotelsRouter = Router();

// Public — no auth required (geo data only, no PII)
hotelsRouter.get(
  '/nearby',
  withAsyncHandler(async (req, res) => {
    const requestLogger = getRequestLogger(res);
    const latRaw = req.query.lat;
    const lngRaw = req.query.lng;
    const radiusRaw = req.query.radiusKm;
    const lat = typeof latRaw === 'string' ? parseFloat(latRaw) : NaN;
    const lng = typeof lngRaw === 'string' ? parseFloat(lngRaw) : NaN;
    const radiusKm = typeof radiusRaw === 'string' ? parseFloat(radiusRaw) : 15;

    if (isNaN(lat) || isNaN(lng)) {
      res.status(400).json({ error: 'INVALID_COORDS' });
      return;
    }

    try {
      const hotels = await hotelSearchService.searchNearby({ lat, lng, radiusKm });
      res.json(hotels);
    } catch (error) {
      logError(requestLogger, 'hotels.nearby.failure', error, { lat, lng, radiusKm });
      res.json([]);
    }
  }),
);
