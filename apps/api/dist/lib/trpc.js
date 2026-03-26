import { initTRPC } from '@trpc/server';
import superjson from 'superjson';
const t = initTRPC.context().create({
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
