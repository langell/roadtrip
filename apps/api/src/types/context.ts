import type { inferAsyncReturnType } from '@trpc/server';
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { prisma } from '../lib/prisma.js';
import { getRequestUserId } from '../lib/request-auth.js';
import { logger } from '../lib/logger.js';
import { getRequestContext } from '../lib/request-logging.js';

export const createContext = async ({ req, res }: CreateExpressContextOptions) => {
  const userId = await getRequestUserId(req);
  const requestContext = res ? getRequestContext(res) : undefined;
  return {
    prisma,
    userId,
    requestId: requestContext?.requestId,
    logger: requestContext?.logger ?? logger,
  };
};

export type Context = inferAsyncReturnType<typeof createContext>;
