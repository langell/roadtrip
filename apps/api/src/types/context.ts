import type { inferAsyncReturnType } from '@trpc/server';
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { prisma } from '../lib/prisma.js';

export const createContext = ({ req }: CreateExpressContextOptions) => {
  const userId = req.header('x-user-id');
  return { prisma, userId };
};

export type Context = inferAsyncReturnType<typeof createContext>;
