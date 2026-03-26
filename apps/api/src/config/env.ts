import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().url(),
  GOOGLE_MAPS_API_KEY: z.string().min(1),
  GOOGLE_MAPS_API_BASE_URL: z.string().url().default('https://maps.googleapis.com'),
  GOOGLE_PLACES_RESULT_LIMIT: z.coerce.number().int().min(1).max(20).default(6),
  GOOGLE_PLACES_CACHE_TTL_SECONDS: z.coerce.number().int().min(0).max(3600).default(300),
  GOOGLE_PLACES_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30000).default(8000),
  GOOGLE_PLACES_RETRY_COUNT: z.coerce.number().int().min(0).max(5).default(2),
  ANON_SUGGESTIONS_RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .max(3600000)
    .default(300000),
  ANON_SUGGESTIONS_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(1000).default(60),
});

export const env = schema.parse(process.env);
