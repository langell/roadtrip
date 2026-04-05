import { Router } from 'express';
import { env } from '../config/env.js';
import { withAsyncHandler } from '../lib/async-handler.js';
import { getRequestLogger } from '../lib/request-logging.js';
import { runPrewarmCache } from '../jobs/prewarm-cache.js';

export const jobsRouter = Router();

/**
 * GET /jobs/prewarm-cache
 *
 * Nightly cache pre-warmer. Protected by CRON_SECRET header.
 * Intended to be called by a cron scheduler (e.g. Vercel cron, GitHub Actions).
 */
jobsRouter.get(
  '/prewarm-cache',
  withAsyncHandler(async (req, res) => {
    const requestLogger = getRequestLogger(res);

    if (env.CRON_SECRET) {
      const authHeader = req.headers.authorization;
      if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
        res.status(401).json({ error: 'UNAUTHORIZED' });
        return;
      }
    }

    requestLogger.info('jobs.prewarm-cache.start');
    const result = await runPrewarmCache();
    requestLogger.info(result, 'jobs.prewarm-cache.complete');

    res.status(200).json(result);
  }),
);
