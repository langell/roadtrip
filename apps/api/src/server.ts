import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { appRouter } from './routes/index.js';
import { createContext } from './types/context.js';
import { env } from './config/env.js';

const app = express();
app.use(cors());
app.use(helmet());
app.use(express.json());

app.get('/health', (_, res) => {
  res.json({ status: 'ok' });
});

app.use('/trpc', createExpressMiddleware({ router: appRouter, createContext }));

const server = app.listen(env.PORT, () => {
  console.log(`API ready on http://localhost:${env.PORT}`);
});

process.on('SIGINT', () => server.close());
process.on('SIGTERM', () => server.close());
