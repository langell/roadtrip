import type { inferAsyncReturnType } from '@trpc/server';
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { prisma } from '../lib/prisma.js';
import { getRequestUserId } from '../lib/request-auth.js';

export const createContext = async ({ req }: CreateExpressContextOptions) => {
  const userId = await getRequestUserId(req);
  return { prisma, userId };
};

export type Context = inferAsyncReturnType<typeof createContext>;
