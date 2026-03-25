import { router } from '../lib/trpc.js';
import { tripRouter } from './trip-router.js';

export const appRouter = router({
  trip: tripRouter
});

export type AppRouter = typeof appRouter;
