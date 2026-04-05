# Story ID: RT-046 – Distributed Rate Limiting (Redis)

## Outcome

Anonymous API rate limits are enforced consistently across all API server instances, not just per-process. The current in-memory `Map` resets on restart and allows the same IP to hit full quotas on each pod.

## Acceptance Criteria

- [ ] Anonymous `/suggestions` and `/places/photo` rate limits are backed by Redis (e.g., Upstash).
- [ ] Rate limit state survives API process restarts and is shared across any future horizontal scaling.
- [ ] Existing rate limit semantics (window, max) are preserved — only the storage layer changes.
- [ ] `createAnonymousRateLimiter` in `apps/api/src/lib/rate-limiter.ts` is updated or replaced.
- [ ] Integration test verifies rate limiting works across a simulated "two-instance" scenario.

## Tasks

- [ ] Add `REDIS_URL` env var to `apps/api/src/config/env.ts` and `vitest.setup.ts`
- [ ] Install an Upstash Redis client (`@upstash/redis` or `ioredis`)
- [ ] Replace in-memory `Map` in `rate-limiter.ts` with a sliding-window Redis counter (e.g., `INCR` + `EXPIRE` or Upstash Rate Limit SDK)
- [ ] Update tests; add a test that verifies cross-request counting

## Notes

- Current implementation: `apps/api/src/lib/rate-limiter.ts` — in-memory `Map<string, { count, resetAt }>`.
- Upstash Rate Limit SDK (`@upstash/ratelimit`) is a clean drop-in with sliding window support.
- If Redis is unavailable at startup, consider failing open (allow the request) with a warning log rather than hard-crashing — keeps dev experience smooth.
