# ADR-001 — AI Plan Caching in Postgres

**Date**: 2026-03-17
**Status**: Accepted

## Context

AI plan generation is slow (3–8 s) and expensive. Multiple users searching the same popular location/theme combination within hours of each other should receive identical-quality results without waiting or burning API quota.

## Decision

Store generated plans in a `TripPlanCache` Postgres table keyed by normalized location + themes + radius. On each `/trips/plan` request:

1. Check cache for an unexpired, valid entry matching the location key (normalized string) or lat/lng bounding box (within 10 miles).
2. On cache hit: return cached options, increment `engagementScore`, record `lastServedAt`.
3. On cache miss: generate with AI, write to cache with a configurable TTL (`TRIP_PLAN_CACHE_TTL_DAYS`).

Cache is pre-warmed nightly by `GET /jobs/prewarm-cache` targeting top-N trending location/theme combos.

## Consequences

- **Faster responses** for popular routes (cache hit ~50 ms vs ~5 s cold).
- **Reduced AI costs** for repeat requests.
- **Staleness risk**: cached plans may reference places that have closed or changed. TTL mitigates this.
- **Single Postgres dependency**: no Redis required for caching. Trade-off is that cache lookup is a DB query, not sub-millisecond.
- **Fuzzy matching complexity**: the bounding-box fallback adds code complexity but significantly improves hit rates for slight location variations.
