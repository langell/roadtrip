import { initTRPC } from '@trpc/server';
import superjson from 'superjson';
import type { Context } from '../types/context.js';

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const procedure = t.procedure;

export const authenticatedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new Error('UNAUTHORIZED');
  }
  return next({ ctx: { ...ctx, userId: ctx.userId } });
});
