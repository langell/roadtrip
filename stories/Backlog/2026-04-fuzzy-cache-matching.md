# RT-035 — Fuzzy Cache Matching

## Problem

The plan cache uses exact string matching on `location + themes + radius`. "Key West" and "Key West, FL" miss each other. Users 5 miles apart with slightly different radius sliders both trigger fresh AI calls. Cache hit rate is low, so most searches pay full LLM cost.

## Goal

Increase cache hit rate by normalizing location strings and relaxing the radius match to a bounding-box overlap check. Target: 40–60% reduction in AI calls for popular destinations.

## Scope

### Location normalization

- Strip state/country suffixes for matching (keep original for display)
- Lowercase, trim, collapse whitespace
- Strip common suffixes: ", FL", ", CA", "United States", etc.
- Store a `locationKey` (normalized) alongside `location` (display) in `TripPlanCache`

### Radius fuzzy matching

- Instead of exact `radiusKm` match, query cache entries where the stored radius is within ±25% of the requested radius and the center point is within the requested radius
- Use PostGIS distance or simple lat/lng bounding box: `|centerLat - reqLat| < radiusKm/111` and same for lng
- Pick the best matching cache entry (closest center + most similar radius)

### Migration

- Add `locationKey` column to `TripPlanCache` via Prisma migration
- Backfill existing rows with normalized keys

### Cache write

- Write `locationKey` on every new cache entry
- Cache key uniqueness constraint moves from exact `(location, themesKey, radiusKm)` to `(locationKey, themesKey)` bucket — multiple radius sizes may coexist

## Acceptance Criteria

- "Key West" and "Key West, FL" hit the same cache entry
- A 25km search reuses a cached 30km plan for the same location
- Cache write still stores the original user-entered location for display
- No regression in cache TTL or expiry behavior
- Prisma migration runs clean on production Neon

## Notes

- The `TripPlanCache` already has `centerLat`/`centerLng` — use these for proximity checks
- No vector embeddings needed; simple string normalization + bounding box covers the common cases
