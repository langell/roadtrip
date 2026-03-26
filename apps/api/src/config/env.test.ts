import { afterEach, describe, expect, it, vi } from 'vitest';

const baseEnv = {
  NODE_ENV: 'test',
  PORT: '5555',
  DATABASE_URL: 'https://example.com/db',
  GOOGLE_MAPS_API_KEY: 'roadtrip-key',
  GOOGLE_MAPS_API_BASE_URL: 'https://maps.googleapis.com',
  GOOGLE_PLACES_RESULT_LIMIT: '8',
  GOOGLE_PLACES_CACHE_TTL_SECONDS: '120',
  GOOGLE_PLACES_TIMEOUT_MS: '9000',
  GOOGLE_PLACES_RETRY_COUNT: '1',
  ANON_SUGGESTIONS_RATE_LIMIT_WINDOW_MS: '60000',
  ANON_SUGGESTIONS_RATE_LIMIT_MAX: '10',
};

const loadEnvModule = async (
  overrides: Partial<Record<keyof typeof baseEnv, string | undefined>> = {},
) => {
  vi.resetModules();
  vi.unstubAllEnvs();

  Object.keys(baseEnv).forEach((key) => {
    delete process.env[key];
  });

  const values = { ...baseEnv, ...overrides };
  Object.entries(values).forEach(([key, value]) => {
    if (typeof value !== 'undefined') {
      vi.stubEnv(key, value);
    }
  });

  return import('./env.js');
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('env schema', () => {
  it('parses expected environment variables', async () => {
    const { env } = await loadEnvModule();

    expect(env.NODE_ENV).toBe('test');
    expect(env.PORT).toBe(5555);
    expect(env.DATABASE_URL).toBe(baseEnv.DATABASE_URL);
    expect(env.GOOGLE_MAPS_API_KEY).toBe(baseEnv.GOOGLE_MAPS_API_KEY);
    expect(env.GOOGLE_MAPS_API_BASE_URL).toBe(baseEnv.GOOGLE_MAPS_API_BASE_URL);
    expect(env.GOOGLE_PLACES_RESULT_LIMIT).toBe(8);
    expect(env.GOOGLE_PLACES_CACHE_TTL_SECONDS).toBe(120);
    expect(env.GOOGLE_PLACES_TIMEOUT_MS).toBe(9000);
    expect(env.GOOGLE_PLACES_RETRY_COUNT).toBe(1);
    expect(env.ANON_SUGGESTIONS_RATE_LIMIT_WINDOW_MS).toBe(60000);
    expect(env.ANON_SUGGESTIONS_RATE_LIMIT_MAX).toBe(10);
  });

  it('throws when required variables are invalid', async () => {
    await expect(loadEnvModule({ DATABASE_URL: 'not-a-url' })).rejects.toThrow(
      /DATABASE_URL/,
    );
  });

  it('uses defaults for optional Google Places settings', async () => {
    const { env } = await loadEnvModule({
      GOOGLE_MAPS_API_BASE_URL: undefined,
      GOOGLE_PLACES_RESULT_LIMIT: undefined,
      GOOGLE_PLACES_CACHE_TTL_SECONDS: undefined,
      GOOGLE_PLACES_TIMEOUT_MS: undefined,
      GOOGLE_PLACES_RETRY_COUNT: undefined,
      ANON_SUGGESTIONS_RATE_LIMIT_WINDOW_MS: undefined,
      ANON_SUGGESTIONS_RATE_LIMIT_MAX: undefined,
    });

    expect(env.GOOGLE_MAPS_API_BASE_URL).toBe('https://maps.googleapis.com');
    expect(env.GOOGLE_PLACES_RESULT_LIMIT).toBe(6);
    expect(env.GOOGLE_PLACES_CACHE_TTL_SECONDS).toBe(300);
    expect(env.GOOGLE_PLACES_TIMEOUT_MS).toBe(8000);
    expect(env.GOOGLE_PLACES_RETRY_COUNT).toBe(2);
    expect(env.ANON_SUGGESTIONS_RATE_LIMIT_WINDOW_MS).toBe(300000);
    expect(env.ANON_SUGGESTIONS_RATE_LIMIT_MAX).toBe(60);
  });
});
