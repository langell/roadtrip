import { SignJWT } from 'jose';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getRequestUserId } from './request-auth.js';

const AUTH_SECRET = 'test-auth-secret';

const buildReq = (headers: Record<string, string | string[] | undefined>) => ({
  header: (name: string) => headers[name.toLowerCase()],
});

const signToken = async (
  subject: string,
  secretOverride?: string,
  overrides: { issuer?: string; audience?: string } = {},
) => {
  const secret = secretOverride ?? AUTH_SECRET;
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(overrides.issuer ?? 'roadtrip-web')
    .setAudience(overrides.audience ?? 'roadtrip-api')
    .setSubject(subject)
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(new TextEncoder().encode(secret));
};

describe('getRequestUserId', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    delete process.env.AUTH_SECRET;
    delete process.env.NEXTAUTH_SECRET;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    delete process.env.AUTH_SECRET;
    delete process.env.NEXTAUTH_SECRET;
  });

  // -------------------------------------------------------------------------
  // No credentials
  // -------------------------------------------------------------------------

  it('returns undefined when no authorization header and no x-user-id', async () => {
    const result = await getRequestUserId(buildReq({}));
    expect(result).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Bearer token — no secret (dev/test bypass)
  // -------------------------------------------------------------------------

  it('accepts plain bearer values in test mode when secret missing', async () => {
    const userId = await getRequestUserId(buildReq({ authorization: 'Bearer user-1' }));
    expect(userId).toBe('user-1');
  });

  it('accepts plain bearer values in development mode when secret missing', async () => {
    process.env.NODE_ENV = 'development';
    const userId = await getRequestUserId(buildReq({ authorization: 'Bearer dev-user' }));
    expect(userId).toBe('dev-user');
  });

  it('returns undefined in production mode when secret is missing', async () => {
    process.env.NODE_ENV = 'production';
    const userId = await getRequestUserId(
      buildReq({ authorization: 'Bearer some-token' }),
    );
    expect(userId).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Bearer token — JWT verification
  // -------------------------------------------------------------------------

  it('verifies signed bearer token when AUTH_SECRET configured', async () => {
    process.env.AUTH_SECRET = AUTH_SECRET;
    const token = await signToken('secure-user');

    const userId = await getRequestUserId(buildReq({ authorization: `Bearer ${token}` }));
    expect(userId).toBe('secure-user');
  });

  it('falls back to NEXTAUTH_SECRET when AUTH_SECRET is absent', async () => {
    const nextSecret = 'nextauth-secret-value';
    process.env.NEXTAUTH_SECRET = nextSecret;
    const token = await signToken('nextauth-user', nextSecret);

    const userId = await getRequestUserId(buildReq({ authorization: `Bearer ${token}` }));
    expect(userId).toBe('nextauth-user');
  });

  it('rejects invalid bearer token when secret configured', async () => {
    process.env.AUTH_SECRET = AUTH_SECRET;
    const userId = await getRequestUserId(
      buildReq({ authorization: 'Bearer invalid-token' }),
    );
    expect(userId).toBeUndefined();
  });

  it('rejects JWT signed with the wrong secret', async () => {
    process.env.AUTH_SECRET = AUTH_SECRET;
    const token = await signToken('user-1', 'different-secret');

    const userId = await getRequestUserId(buildReq({ authorization: `Bearer ${token}` }));
    expect(userId).toBeUndefined();
  });

  it('rejects JWT with wrong issuer', async () => {
    process.env.AUTH_SECRET = AUTH_SECRET;
    const token = await signToken('user-1', AUTH_SECRET, { issuer: 'wrong-issuer' });

    const userId = await getRequestUserId(buildReq({ authorization: `Bearer ${token}` }));
    expect(userId).toBeUndefined();
  });

  it('rejects JWT with wrong audience', async () => {
    process.env.AUTH_SECRET = AUTH_SECRET;
    const token = await signToken('user-1', AUTH_SECRET, { audience: 'wrong-audience' });

    const userId = await getRequestUserId(buildReq({ authorization: `Bearer ${token}` }));
    expect(userId).toBeUndefined();
  });

  it('returns undefined when JWT has no sub claim', async () => {
    process.env.AUTH_SECRET = AUTH_SECRET;
    // Build JWT without a subject
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('roadtrip-web')
      .setAudience('roadtrip-api')
      .setIssuedAt()
      .sign(new TextEncoder().encode(AUTH_SECRET));

    const userId = await getRequestUserId(buildReq({ authorization: `Bearer ${token}` }));
    expect(userId).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Bearer token — parsing edge cases
  // -------------------------------------------------------------------------

  it('returns undefined for non-Bearer auth scheme', async () => {
    const userId = await getRequestUserId(
      buildReq({ authorization: 'Basic dXNlcjpwYXNz' }),
    );
    expect(userId).toBeUndefined();
  });

  it('returns undefined for malformed Bearer header with no token', async () => {
    const userId = await getRequestUserId(buildReq({ authorization: 'Bearer' }));
    expect(userId).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // x-user-id legacy header
  // -------------------------------------------------------------------------

  it('falls back to x-user-id in test mode', async () => {
    const userId = await getRequestUserId(buildReq({ 'x-user-id': 'legacy-user' }));
    expect(userId).toBe('legacy-user');
  });

  it('falls back to x-user-id in development mode', async () => {
    process.env.NODE_ENV = 'development';
    const userId = await getRequestUserId(buildReq({ 'x-user-id': 'dev-legacy-user' }));
    expect(userId).toBe('dev-legacy-user');
  });

  it('ignores x-user-id in production mode', async () => {
    process.env.NODE_ENV = 'production';
    const userId = await getRequestUserId(buildReq({ 'x-user-id': 'prod-user' }));
    expect(userId).toBeUndefined();
  });

  it('returns undefined for whitespace-only x-user-id', async () => {
    const userId = await getRequestUserId(buildReq({ 'x-user-id': '   ' }));
    expect(userId).toBeUndefined();
  });

  it('prefers Bearer token over x-user-id when both are present', async () => {
    const userId = await getRequestUserId(
      buildReq({
        authorization: 'Bearer bearer-wins',
        'x-user-id': 'legacy-loses',
      }),
    );
    expect(userId).toBe('bearer-wins');
  });

  it('falls through to x-user-id when Bearer JWT verification fails', async () => {
    process.env.AUTH_SECRET = AUTH_SECRET;
    const badToken = await signToken('ignored-user', 'wrong-secret');

    const userId = await getRequestUserId(
      buildReq({
        authorization: `Bearer ${badToken}`,
        'x-user-id': 'legacy-fallback',
      }),
    );
    expect(userId).toBe('legacy-fallback');
  });

  // -------------------------------------------------------------------------
  // Array header values (normalizeHeaderValue)
  // -------------------------------------------------------------------------

  it('uses first element when authorization header is an array', async () => {
    const userId = await getRequestUserId(
      buildReq({ authorization: ['Bearer first-token', 'Bearer second-token'] }),
    );
    expect(userId).toBe('first-token');
  });
});
