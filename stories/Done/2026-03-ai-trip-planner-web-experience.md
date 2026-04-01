# Story ID: RT-016 – AI Trip Planner Web Experience

## Outcome

- Users can submit trip criteria in the web planner, view an AI-generated itinerary, and inspect enriched stop details in a clear, resilient UI flow.

## Acceptance Criteria

- [ ] Trip planner UI submits criteria to the new AI orchestration endpoint.
- [ ] UI displays **2-3 AI itinerary options** and allows users to review each option's ordered stops.
- [ ] UI displays loading, success, and recoverable error states for AI planning and stop enrichment.
- [ ] Planned stops render in order with enriched details (name, location context, distance display, optional photo).
- [ ] UI clearly indicates partially enriched stops (for example, missing photo/address) without blocking full plan display.
- [ ] Existing criteria controls (distance, themes, location input) remain functional and mapped correctly.
- [ ] Web tests cover request flow and main rendering states.

## Tasks

- [ ] Add web API client method for AI plan endpoint with typed response handling (owner: web).
- [ ] Update planner component state machine (idle/loading/success/partial-error/fatal-error) (owner: web).
- [ ] Render itinerary section with ordered stops and enrichment metadata (owner: web).
- [ ] Add accessible user-facing messages for failures and retries (owner: web).
- [ ] Add/adjust tests for planner submit + results rendering (owner: web).

## Notes

- Parent story: `RT-014` (`2026-03-ai-trip-planning-and-stop-details.md`).
- Depends on API contract from `RT-015`.
- Keep UI aligned to `docs/design-system.md` and existing theme tokens.
- Scope decision (2026-03-27): no extra hard constraints in v1 beyond submitted criteria.
- Validation command: `pnpm --filter @roadtrip/web build`
