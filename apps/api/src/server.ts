import 'dotenv/config';
import { shutdownObservability } from './observability.js';
import type { Server } from 'node:http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { appRouter } from './routes/index.js';
import { createContext } from './types/context.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { requestLoggingMiddleware } from './lib/request-logging.js';
import { createAnonymousRateLimiter } from './lib/rate-limiter.js';
import { prisma } from './lib/prisma.js';
import { discoverRouter } from './routes/discover-router.js';
import { placesRouter } from './routes/places-router.js';
import { tripsRouter } from './routes/trips-router.js';
import { usersRouter } from './routes/users-router.js';
import { sponsoredRouter } from './routes/sponsored-router.js';
import { hotelsRouter } from './routes/hotels-router.js';
import { adminRouter } from './routes/admin-router.js';
import { withAsyncHandler } from './lib/async-handler.js';

export const createApp = () => {
  const app = express();
  app.set('trust proxy', 1);

  // ── Rate limiters (created once, injected via res.locals) ────────────────
  const allowAnonymousSuggestionRequest = createAnonymousRateLimiter(
    env.ANON_SUGGESTIONS_RATE_LIMIT_WINDOW_MS,
    env.ANON_SUGGESTIONS_RATE_LIMIT_MAX,
  );
  const allowAnonymousPhotoRequest = createAnonymousRateLimiter(
    env.ANON_PHOTO_RATE_LIMIT_WINDOW_MS,
    env.ANON_PHOTO_RATE_LIMIT_MAX,
  );

  app.use((_, res, next) => {
    res.locals.allowAnonymousSuggestionRequest = allowAnonymousSuggestionRequest;
    res.locals.allowAnonymousPhotoRequest = allowAnonymousPhotoRequest;
    next();
  });

  // ── Global middleware ────────────────────────────────────────────────────
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

  // ── Health / readiness ───────────────────────────────────────────────────
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

  // ── Domain routers ───────────────────────────────────────────────────────
  app.use('/discover', discoverRouter);
  app.use('/', placesRouter); // handles /places/photo and /suggestions
  app.use('/trips', tripsRouter);
  app.use('/users', usersRouter);
  app.use('/', sponsoredRouter); // handles /trips/:id/sponsored-stop and /sponsored-stop/nearby
  app.use('/hotels', hotelsRouter);
  app.use('/admin', adminRouter);

  // ── tRPC ─────────────────────────────────────────────────────────────────
  app.use('/trpc', createExpressMiddleware({ router: appRouter, createContext }));

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
