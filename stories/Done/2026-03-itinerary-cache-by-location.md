# Story ID: RT-017 – Itinerary Cache By Location

## Outcome

- Reuse previously generated itineraries for nearby searches (within 10 miles) so users get faster results and we reduce unnecessary AI calls.

## Acceptance Criteria

- [x] API saves each generated itinerary with canonical center location data (lat/lng), search metadata, and retrieval timestamp.
- [x] On itinerary search, API first checks DB for a cached itinerary where the search location is within 10 miles of a saved itinerary center.
- [x] If a cache hit is found, API returns cached itinerary payload and does not call AI.
- [x] If no cache hit is found, API calls AI, returns the generated itinerary, and persists it for future nearby queries.
- [x] Response includes source metadata (`cache` or `ai`) for observability and analytics.
- [x] Expiration/refresh policy is defined and implemented (e.g., TTL or stale threshold) to avoid permanently stale itineraries.
- [x] Tests cover cache hit, cache miss, and boundary distance behavior around the 10-mile threshold.

## Tasks

- [x] Add/extend Prisma model(s) for itinerary cache records keyed by geospatial search context (owner: api).
- [x] Implement distance check logic using lat/lng (miles) and nearest-record lookup strategy (owner: api).
- [x] Update itinerary orchestration endpoint to do cache lookup before AI call (owner: api).
- [x] Persist newly generated itineraries after successful AI response (owner: api).
- [x] Add source metadata in API response and structured logging for hit/miss rates (owner: api).
- [x] Add tests for hit/miss/boundary and stale data behavior (owner: api).

## Notes

- Parent dependency: `RT-015` (`2026-03-ai-trip-planner-api-orchestration.md`).
- Confirm cache key inputs: origin-only vs origin + filters/themes + trip constraints.
- Confirm whether cache should be shared globally or scoped to user/account context.
- Distance threshold requirement: 10 miles from requested search location.
- Validation command: `pnpm --filter @roadtrip/api test`
