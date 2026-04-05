import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().url(),
  GOOGLE_MAPS_API_KEY: z.string().min(1),
  GOOGLE_MAPS_API_BASE_URL: z.string().url().default('https://maps.googleapis.com'),
  GOOGLE_AI_API_KEY: z.string().min(1).optional(),
  AI_GATEWAY_API_KEY: z.string().min(1).optional(),
  GOOGLE_AI_MODEL: z.string().min(1).default('gemini-3-flash'),
  GOOGLE_AI_MODEL_FAST: z.string().min(1).default('gemini-2.0-flash'),
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
  ANON_PHOTO_RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .max(3600000)
    .default(300000),
  ANON_PHOTO_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(1000).default(200),
  TRIP_PLAN_CACHE_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  TRIP_PLAN_CACHE_DEBUG: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  PUBLIC_API_URL: z.string().url().optional(),
  PUBLIC_SITE_URL: z.string().url().optional(),
  CORS_ORIGIN: z.string().optional(),
  AUTH_SECRET: z.string().min(1).optional(),
  NEXTAUTH_SECRET: z.string().min(1).optional(),
  // Comma-separated list of user IDs that can access admin endpoints
  ADMIN_USER_IDS: z.string().optional(),
  // Affiliate partner IDs for hotel monetization
  EXPEDIA_AFFILIATE_ID: z.string().min(1).optional(),
  BOOKING_AFFILIATE_ID: z.string().min(1).optional(),
  // Cron job auth
  CRON_SECRET: z.string().min(1).optional(),
  // Cache pre-warming config
  PREWARM_MAX_LOCATIONS: z.coerce.number().int().min(1).max(100).default(10),
  PREWARM_MAX_THEME_COMBOS: z.coerce.number().int().min(1).max(10).default(2),
  PREWARM_MAX_GENERATIONS: z.coerce.number().int().min(1).max(100).default(30),
});

export const env = schema.parse(process.env);
