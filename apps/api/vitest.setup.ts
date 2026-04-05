// Clear auth secrets so tests use the no-secret bypass path by default.
// Tests that need JWT verification set AUTH_SECRET explicitly in beforeEach.
delete process.env.AUTH_SECRET;
delete process.env.NEXTAUTH_SECRET;

process.env.DATABASE_URL ??= 'postgres://user:pass@localhost:5432/test';
process.env.GOOGLE_MAPS_API_KEY ??= 'test-key';
process.env.GOOGLE_MAPS_API_BASE_URL ??= 'https://maps.googleapis.com';
process.env.GOOGLE_PLACES_RESULT_LIMIT ??= '6';
process.env.GOOGLE_PLACES_CACHE_TTL_SECONDS ??= '60';
process.env.GOOGLE_PLACES_TIMEOUT_MS ??= '5000';
process.env.GOOGLE_PLACES_RETRY_COUNT ??= '1';
process.env.ANON_SUGGESTIONS_RATE_LIMIT_WINDOW_MS ??= '300000';
process.env.ANON_SUGGESTIONS_RATE_LIMIT_MAX ??= '60';
process.env.ANON_PHOTO_RATE_LIMIT_WINDOW_MS ??= '300000';
process.env.ANON_PHOTO_RATE_LIMIT_MAX ??= '200';
process.env.CRON_SECRET ??= 'test-cron-secret';
process.env.PREWARM_MAX_LOCATIONS ??= '10';
process.env.PREWARM_MAX_THEME_COMBOS ??= '2';
process.env.PREWARM_MAX_GENERATIONS ??= '30';
