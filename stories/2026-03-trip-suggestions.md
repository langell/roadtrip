# Story ID: RT-001 – Trip Suggestions Deliver Real Data

## Outcome

- Travelers can request themed stop suggestions for a city and see real Google Places data in both the API and web planner experience.

## Acceptance Criteria

- [ ] `/trpc.trip.suggestions` proxies the Google Places API (or mocked service in tests) and returns at least 3 structured stops with distance, title, and description.
- [ ] Requests require `x-user-id` auth headers and reject when missing.
- [ ] Web planner UI renders the returned stops in the hero section with loading + empty states.
- [ ] Coverage for the service + router + UI components remains ≥80%.

## Tasks

### API

- [ ] Extend `env.ts` + tests with Google Places config (API key scopes, radius defaults, result cap) and document required vars.
- [ ] Add `apps/api/src/services/google-places-client.ts` that performs geocode lookup, nearby search, and maps results into the shared `PlaceSuggestion` shape with retry + error normalization.
- [ ] Layer a lightweight in-memory cache (keyed by `location/theme/radius`) with TTL + unit tests to protect the quota while keeping deterministic tests.
- [ ] Update `tripRouter.suggestions` to require `ctx.userId`, call the new client, cap to ≥3 stops, and cover success + error cases via Vitest (mock client + auth guard).

### Web

- [ ] Create a dedicated tRPC hook (or React Query call) that fetches `trip.suggestions`, injects `x-user-id`, and exposes loading/error states to the Planner.
- [ ] Render the suggestions list in the hero section with accessible headings, skeleton/loading, and empty-state messaging wired to the hook state.
- [ ] Add component tests for the list renderer (mock hook) to lock visual states, plus update Playwright spec to validate the hero shows 3+ stops when API responds.

### Docs & Ops

- [ ] Update `.env.example`, README, and story notes with Google API enablement steps, rate-limit guidance, and the new configuration knobs.

## Breakdown Playbook

- Capture env/config changes first so code, docs, and CI agree.
- Introduce new service modules with focused unit tests before touching routers or UI.
- Wire procedures/endpoints next, guarding auth + adding contract tests.
- Integrate UI/hooks only after backend contracts are stable, then finish with e2e coverage.
- Update docs/env templates as soon as new configuration is required to avoid drift.

## Notes

- Google Maps Places Nearby Search doc: https://developers.google.com/maps/documentation/places/web-service/search-nearby
- Turbo command focus: `pnpm --filter @roadtrip/api test -- --coverage`, `pnpm --filter @roadtrip/web test`.
