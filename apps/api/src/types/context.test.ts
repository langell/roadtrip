import { describe, expect, it, vi } from 'vitest';
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';

const prismaMock = { trip: {} } as const;

vi.mock('../lib/prisma.js', () => ({
  prisma: prismaMock,
}));

const { createContext } = await import('./context.js');

describe('createContext', () => {
  const buildReq = (userId?: string) => ({
    header: (name: string) => (name === 'x-user-id' ? userId : undefined),
  });

  it('returns prisma instance and parsed user id', () => {
    const ctx = createContext({
      req: buildReq('user-123'),
    } as unknown as CreateExpressContextOptions);

    expect(ctx).toEqual({ prisma: prismaMock, userId: 'user-123' });
  });

  it('allows anonymous contexts when header missing', () => {
    const ctx = createContext({
      req: buildReq(),
    } as unknown as CreateExpressContextOptions);

    expect(ctx.prisma).toBe(prismaMock);
    expect(ctx.userId).toBeUndefined();
  });
});
