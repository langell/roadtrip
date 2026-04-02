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

---

## Current Implementation

### Cache lookup (`apps/api/src/server.ts` — `/trips/plan` route)

The current query requires **exact** `themesKey`, `radiusKm`, and `maxOptions` matches. Only the center-point bounding box is already fuzzy:

```typescript
const themesKey = toThemesKey(input.themes); // e.g. "foodie|scenic"
const cacheRadiusKm = TRIP_PLAN_CACHE_RADIUS_MILES * KM_PER_MILE;

const latDelta = cacheRadiusKm / 111.32;
const lngDelta = cacheRadiusKm / (111.32 * Math.cos(toRadians(origin.lat)));

const cacheCandidates = await prisma.tripPlanCache.findMany({
  where: {
    themesKey, // exact match — "Key West" vs "Key West, FL" misses here
    radiusKm: input.radiusKm, // exact match — 25km vs 30km always misses
    maxOptions: input.maxOptions,
    expiresAt: { gt: now },
    validOptions: { gt: 0 },
    centerLat: { gte: origin.lat - latDelta, lte: origin.lat + latDelta },
    centerLng: { gte: origin.lng - lngDelta, lte: origin.lng + lngDelta },
  },
  orderBy: [{ engagementScore: 'desc' }, { updatedAt: 'desc' }],
  take: 25,
});
```

After fetching candidates, it filters by haversine distance and picks the best:

```typescript
const cacheHit = cacheCandidates
  .map((c) => ({
    candidate: c,
    distanceKm: haversineKm(origin.lat, origin.lng, c.centerLat, c.centerLng),
  }))
  .filter(({ distanceKm }) => distanceKm <= cacheRadiusKm)
  .sort(
    (a, b) => b.candidate.engagementScore - a.candidate.engagementScore,
  )[0]?.candidate;
```

### Cache write

```typescript
await prisma.tripPlanCache.create({
  data: {
    location: input.location, // raw user string, used for display
    centerLat: origin.lat,
    centerLng: origin.lng,
    radiusKm: input.radiusKm, // exact radius stored
    themesKey, // pipe-separated sorted themes
    maxOptions: input.maxOptions,
    options: validOptions,
    validOptions: validOptions.length,
    engagementScore: 1,
    expiresAt: new Date(
      now.getTime() + env.TRIP_PLAN_CACHE_TTL_DAYS * 24 * 60 * 60 * 1000,
    ),
  },
});
```

### Prisma schema (`TripPlanCache`)

```prisma
model TripPlanCache {
  id              String    @id @default(uuid())
  location        String    // display string — "Key West, FL"
  centerLat       Float
  centerLng       Float
  radiusKm        Float
  themesKey       String    // "foodie|scenic" — exact match today
  maxOptions      Int
  options         Json
  validOptions    Int
  engagementScore Int       @default(0)
  lastServedAt    DateTime?
  expiresAt       DateTime
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  // locationKey String?  ← to be added by this story
}
```

### What needs to change

1. Add `locationKey String?` to `TripPlanCache` — normalized, used for matching
2. Write `locationKey` on cache create (normalize `input.location`)
3. Change cache lookup: match on `locationKey` instead of raw `location` string; relax `radiusKm` to a ±25% range instead of exact
4. Add a Prisma migration and backfill script for existing rows
