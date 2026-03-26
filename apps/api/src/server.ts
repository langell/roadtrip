import 'dotenv/config';
import type { Server } from 'node:http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { z } from 'zod';
import { appRouter } from './routes/index.js';
import { createContext } from './types/context.js';
import { env } from './config/env.js';
import { googlePlacesService } from './services/google-places-service.js';
import { prisma } from './lib/prisma.js';
import { getRequestUserId } from './lib/request-auth.js';

type RateLimitEntry = {
  count: number;
  resetAt: number;
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

const createAnonymousSuggestionsRateLimiter = () => {
  const hitsByIp = new Map<string, RateLimitEntry>();

  return (ipAddress: string) => {
    const now = Date.now();
    const existing = hitsByIp.get(ipAddress);

    if (!existing || existing.resetAt <= now) {
      hitsByIp.set(ipAddress, {
        count: 1,
        resetAt: now + env.ANON_SUGGESTIONS_RATE_LIMIT_WINDOW_MS,
      });
      return true;
    }

    if (existing.count >= env.ANON_SUGGESTIONS_RATE_LIMIT_MAX) {
      return false;
    }

    existing.count += 1;
    hitsByIp.set(ipAddress, existing);
    return true;
  };
};

export const createApp = () => {
  const app = express();
  const allowAnonymousSuggestionRequest = createAnonymousSuggestionsRateLimiter();
  app.use(cors());
  app.use(helmet());
  app.use(express.json());

  app.get('/health', (_, res) => {
    res.json({ status: 'ok' });
  });

  app.get(
    '/suggestions',
    withAsyncHandler(async (req, res) => {
      const userId = await getRequestUserId(req);

      if (!userId && !allowAnonymousSuggestionRequest(getRequesterIp(req))) {
        res.status(429).json({ error: 'RATE_LIMITED' });
        return;
      }

      const location = req.query.location;
      const theme = req.query.theme;
      const radiusKm = Number(req.query.radiusKm);

      if (
        typeof location !== 'string' ||
        typeof theme !== 'string' ||
        Number.isNaN(radiusKm)
      ) {
        res.status(400).json({ error: 'INVALID_QUERY' });
        return;
      }

      try {
        const suggestions = await googlePlacesService.findStops({
          location,
          theme,
          radiusKm,
        });

        res.json(suggestions);
      } catch {
        res.status(502).json({ error: 'UPSTREAM_PLACES_ERROR' });
      }
    }),
  );

  app.get(
    '/trips',
    withAsyncHandler(async (req, res) => {
      const userId = await getRequestUserId(req);
      if (!userId) {
        res.status(401).json({ error: 'UNAUTHORIZED' });
        return;
      }

      const trips = await prisma.trip.findMany({
        where: { userId },
        include: { stops: { orderBy: { order: 'asc' } } },
        orderBy: { createdAt: 'desc' },
      });

      res.json(trips);
    }),
  );

  const saveGeneratedTripSchema = z.object({
    location: z.string().min(3),
    radiusKm: z.number().positive(),
    theme: z.string().min(1),
    name: z.string().min(1).optional(),
  });

  app.post(
    '/trips/save-generated',
    withAsyncHandler(async (req, res) => {
      const userId = await getRequestUserId(req);
      if (!userId) {
        res.status(401).json({ error: 'UNAUTHORIZED' });
        return;
      }

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
          theme: input.theme,
        });
      } catch {
        res.status(502).json({ error: 'UPSTREAM_PLACES_ERROR' });
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

  app.use('/trpc', createExpressMiddleware({ router: appRouter, createContext }));

  return app;
};

export const registerSignalHandlers = (server: Server) => {
  const shutdown = () => server.close();
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
};

export const startServer = () => {
  const app = createApp();
  const server = app.listen(env.PORT, () => {
    console.log(`API ready on http://localhost:${env.PORT}`);
  });
  registerSignalHandlers(server);
  return server;
};

if (process.env.NODE_ENV !== 'test') {
  startServer();
}
