import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SignJWT } from 'jose';
import { getRequestUserId } from './request-auth.js';

const AUTH_SECRET = 'test-auth-secret';

const buildReq = (headers: Record<string, string | undefined>) => ({
  header: (name: string) => headers[name.toLowerCase()],
});

const signToken = async (subject: string) => {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('roadtrip-web')
    .setAudience('roadtrip-api')
    .setSubject(subject)
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(new TextEncoder().encode(AUTH_SECRET));
};

describe('getRequestUserId', () => {
  const originalAuthSecret = process.env.AUTH_SECRET;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    delete process.env.AUTH_SECRET;
    delete process.env.NEXTAUTH_SECRET;
  });

  afterEach(() => {
    process.env.AUTH_SECRET = originalAuthSecret;
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('accepts plain bearer values in test mode when secret missing', async () => {
    const userId = await getRequestUserId(buildReq({ authorization: 'Bearer user-1' }));
    expect(userId).toBe('user-1');
  });

  it('verifies signed bearer token when secret configured', async () => {
    process.env.AUTH_SECRET = AUTH_SECRET;
    const token = await signToken('secure-user');

    const userId = await getRequestUserId(buildReq({ authorization: `Bearer ${token}` }));
    expect(userId).toBe('secure-user');
  });

  it('rejects invalid bearer token when secret configured', async () => {
    process.env.AUTH_SECRET = AUTH_SECRET;

    const userId = await getRequestUserId(
      buildReq({ authorization: 'Bearer invalid-token' }),
    );
    expect(userId).toBeUndefined();
  });

  it('falls back to x-user-id in test mode', async () => {
    const userId = await getRequestUserId(buildReq({ 'x-user-id': 'legacy-user' }));
    expect(userId).toBe('legacy-user');
  });
});
