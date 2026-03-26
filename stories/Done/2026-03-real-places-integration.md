# Story ID: RT-002 – Real Places Integration in API

## Outcome

- Travelers receive real place suggestions from Google APIs instead of placeholders, improving relevance and trust.

## Acceptance Criteria

- [ ] API suggestions endpoint returns real, normalized place results with `id`, `placeId`, `title`, `description`, `distanceKm`, `lat`, and `lng`.
- [ ] Service handles upstream API failures gracefully and returns typed errors (no unhandled crashes).
- [ ] Response is deterministic for tests via mocked clients.
- [ ] In-memory cache with TTL reduces repeated external calls for identical `(location, radiusKm, theme)` requests.
- [ ] Unit and integration tests cover success, empty results, and failure scenarios.

## Tasks

- [ ] Add a Google Places client module with geocode + nearby search capabilities (owner: API).
- [ ] Normalize Google responses into shared suggestion shape and distance approximation logic (owner: API).
- [ ] Add retry + timeout + error normalization strategy (owner: API).
- [ ] Implement keyed in-memory caching with configurable TTL (owner: API).
- [ ] Update `trip.suggestions` and REST `/suggestions` to use the new service (owner: API).
- [ ] Add/expand Vitest coverage for service and endpoints (owner: API).

## Notes

- Key files: `apps/api/src/services/google-places-service.ts`, `apps/api/src/routes/trip-router.ts`, `apps/api/src/server.ts`.
- Keep existing auth behavior (`x-user-id`) until auth story is completed.
- Validate with: `pnpm --filter @roadtrip/api test && pnpm --filter @roadtrip/api build`.
