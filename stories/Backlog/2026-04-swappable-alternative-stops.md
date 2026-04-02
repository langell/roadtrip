# RT-040 — Swappable Alternative Stops

## Problem

Users often like a plan overall but want to swap one stop. Currently they must regenerate the whole plan or manually edit after saving. There's no way to explore alternatives for individual stops.

## Goal

Each stop in a plan card shows 2–3 swappable alternatives. User taps a chevron to cycle through options without touching the rest of the plan.

## Scope

### Alternative generation

- When generating a plan, ask the AI to return 2 alternative stop names per stop alongside the primary (schema change: `stop: { primary: string, alternatives: string[] }`)
- Alternatives are resolved through the Places API alongside the primary stop (parallel resolution)
- If resolution fails for an alternative, skip it silently

### Schema update (`AiTripPlannerService`)

```typescript
const AiTripStopSchema = z.object({
  primary: z.string().min(1),
  alternatives: z.array(z.string()).max(2).default([]),
});
```

### Web (`apps/web/components/trip-planner.tsx`)

- Each resolved stop shows a swap icon if alternatives exist
- Tapping cycles to the next alternative (local state, no API call)
- The active selection is what gets saved when user clicks "Select"
- Swapped stops are visually distinguished (subtle border or swap icon state)

### Cache compatibility

- Cache stores the full stop objects including alternatives
- No cache invalidation needed — alternatives are additive

## Acceptance Criteria

- Each stop in a new plan has up to 2 alternatives available
- Swapping a stop updates the card in-place without affecting other stops
- The swapped version is what gets saved
- Alternatives are resolved (have lat/lng and photo) before being shown
- Falls back gracefully when no alternatives are available (swap button hidden)
- No regression in plan generation speed (alternative resolution is parallel)

## Notes

- This does not require an extra AI call — alternatives come from the same generation
- Prompt addition is ~20 tokens; response addition is ~30 tokens per stop — minimal cost increase
- Consider capping alternatives at 2 to keep prompt/response size manageable
