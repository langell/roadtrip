import 'dotenv/config';
import type { Server } from 'node:http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { appRouter } from './routes/index.js';
import { createContext } from './types/context.js';
import { env } from './config/env.js';

export const createApp = () => {
  const app = express();
  app.use(cors());
  app.use(helmet());
  app.use(express.json());

  app.get('/health', (_, res) => {
    res.json({ status: 'ok' });
  });

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
