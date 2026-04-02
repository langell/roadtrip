# RT-037 — Two-Tier Model Routing

## Problem

Every plan generation uses the same full model regardless of complexity. The retry path (triggered when theme coverage fails) doubles the cost of an already-expensive call. There's no cost differentiation between simple and complex requests.

## Goal

Route to a cheaper/faster model for straightforward requests and reserve the full model for retries and complex theme combinations. Target: 30–50% cost reduction on plan generation with no quality regression.

## Scope

### Tier definitions

- **Tier 1 (fast/cheap)**: `gemini-2.0-flash` or `gemini-2.5-flash` — used for initial generation
- **Tier 2 (full)**: `gemini-2.5-pro` or the current `env.GOOGLE_AI_MODEL` — used for retries and 3-theme combinations

### Routing logic in `AiTripPlannerService`

- Default all initial attempts to Tier 1
- If theme coverage check fails → retry with Tier 2 (current behavior, just uses higher-tier model)
- If themes count ≥ 3 → go directly to Tier 2 (complex requests don't benefit from the cheap model)
- Add `env.GOOGLE_AI_MODEL_FAST` config var (default: `gemini-2.0-flash`) alongside existing `env.GOOGLE_AI_MODEL`

### Config (`apps/api/src/config/env.ts`)

```
GOOGLE_AI_MODEL_FAST: z.string().default('gemini-2.0-flash-exp')
```

### Observability

- Log which tier was used per request: `{ tier: 1 | 2, model, attemptLabel }`
- Track tier usage in `AnalyticsEvent` to measure cost impact

## Acceptance Criteria

- Single-theme searches use Tier 1 by default
- Failed coverage checks retry with Tier 2
- 3-theme searches go directly to Tier 2
- `GOOGLE_AI_MODEL_FAST` can be overridden via env var
- Existing model fallback behavior (v1 → v1beta) still applies within each tier
- No regression in plan quality (theme coverage, stop count, rationale quality)

## Notes

- Gemini 2.0 Flash is ~10x cheaper than 2.5 Pro per token and ~3x faster
- The existing `requestWithModelFallback` method already handles the retry pattern — this story just changes which model is passed in at each stage
