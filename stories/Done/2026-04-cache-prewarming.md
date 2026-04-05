# RT-036 — Cache Pre-Warming for Trending Destinations

## Problem

First-time searches for popular destinations always pay full LLM latency and cost, even though the same plans get generated repeatedly. Users in Key West, Nashville, Sedona etc. all wait 10+ seconds for results that could have been pre-generated.

## Goal

A scheduled job generates and caches trip plans for the top N trending destinations during off-peak hours. Users searching popular areas get instant cached results.

## Scope

### Trending destination selection

- Query `TripPlanCache` grouped by `locationKey`, ordered by `engagementScore DESC`, take top 20
- Also include any location searched 3+ times in the past 7 days with no cache hit (track in a new `CacheMiss` table or reuse `AnalyticsEvent`)

### Cron job (`apps/api`)

- New file: `apps/api/src/jobs/prewarm-cache.ts`
- Runs nightly at 2am UTC via a cron endpoint (`GET /jobs/prewarm-cache`) protected by `CRON_SECRET` header
- For each trending location × popular theme combos (top 3 theme combinations from cache):
  - Skip if a valid (non-expired) cache entry already exists
  - Generate plans via `aiTripPlannerService.generatePlans()`
  - Write to `TripPlanCache` with normal TTL
- Limit: max 30 generations per run to bound cost

### Vercel / deployment

- Add cron schedule to `vercel.json` or `vercel.ts`: `0 2 * * *` → `/jobs/prewarm-cache`
- The API is on Vercel — use the existing `withAsyncHandler` pattern

### Observability

- Log each pre-warm attempt: location, themes, hit/skip/error
- Emit an `AnalyticsEvent` with type `cache.prewarm` for tracking

## Acceptance Criteria

- Nightly job runs without errors for top 20 locations
- Subsequent user searches for those locations hit cache (source: `'cache'` in response)
- Job is idempotent — running twice doesn't create duplicate entries
- Cost per run is bounded (≤30 AI calls)
- CRON_SECRET protects the endpoint from public invocation

## Notes

- Theme combinations to pre-warm: derive from the most common `themesKey` values in existing cache entries
- Start conservative (top 10 locations, top 2 theme combos each) and tune based on cache hit metrics
