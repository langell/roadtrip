import { afterEach, describe, expect, it, vi } from 'vitest';

const baseEnv = {
  NODE_ENV: 'test',
  PORT: '5555',
  DATABASE_URL: 'https://example.com/db',
  GOOGLE_MAPS_API_KEY: 'roadtrip-key',
};

const loadEnvModule = async (
  overrides: Partial<Record<keyof typeof baseEnv, string | undefined>> = {},
) => {
  vi.resetModules();
  vi.unstubAllEnvs();

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
  });

  it('throws when required variables are invalid', async () => {
    await expect(loadEnvModule({ DATABASE_URL: 'not-a-url' })).rejects.toThrow(
      /DATABASE_URL/,
    );
  });
});
