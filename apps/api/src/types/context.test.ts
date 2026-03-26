import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';

const prismaMock = { trip: {} } as const;

vi.mock('../lib/prisma.js', () => ({
  prisma: prismaMock,
}));

const { createContext } = await import('./context.js');

describe('createContext', () => {
  beforeEach(() => {
    delete process.env.AUTH_SECRET;
    delete process.env.NEXTAUTH_SECRET;
  });

  const buildReq = (headers: Record<string, string | undefined>) => ({
    header: (name: string) => headers[name.toLowerCase()],
  });

  it('returns prisma instance and parsed bearer user id', async () => {
    const ctx = await createContext({
      req: buildReq({ authorization: 'Bearer user-123' }),
    } as unknown as CreateExpressContextOptions);

    expect(ctx).toMatchObject({
      prisma: prismaMock,
      userId: 'user-123',
      requestId: undefined,
    });
    expect(ctx.logger).toBeDefined();
  });

  it('falls back to x-user-id when authorization is missing', async () => {
    const ctx = await createContext({
      req: buildReq({ 'x-user-id': 'legacy-user' }),
    } as unknown as CreateExpressContextOptions);

    expect(ctx).toMatchObject({
      prisma: prismaMock,
      userId: 'legacy-user',
      requestId: undefined,
    });
    expect(ctx.logger).toBeDefined();
  });

  it('allows anonymous contexts when header missing', async () => {
    const ctx = await createContext({
      req: buildReq({}),
    } as unknown as CreateExpressContextOptions);

    expect(ctx.prisma).toBe(prismaMock);
    expect(ctx.userId).toBeUndefined();
  });
});
