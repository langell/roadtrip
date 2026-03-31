# Story ID: RT-014 – AI Trip Planning with Stop Details

## Outcome

- As a user, I can enter trip criteria and receive an AI-generated best-fit trip plan, then see detailed stop information enriched from Places API.

## Acceptance Criteria

- [ ] User can enter trip criteria (origin, distance/range, themes, optional constraints) and submit a planning request.
- [ ] System sends criteria to an AI planning step that returns **2-3 structured itinerary options** (ordered stops, rationale, estimated route flow).
- [ ] After AI plan generation, system resolves each suggested stop against Places API and returns enriched stop details (canonical place id, name, coordinates, address, photo metadata when available).
- [ ] UI displays the final plan with ordered stops and enriched details, and gracefully handles partial failures (for example: some stop details unavailable).
- [ ] Response includes clear status/error messages when AI planning fails or Places enrichment fails.

## Tasks

- [ ] Deliver backend orchestration via `RT-015` (`2026-03-ai-trip-planner-api-orchestration.md`).
- [ ] Deliver web UX integration via `RT-016` (`2026-03-ai-trip-planner-web-experience.md`).
- [ ] Validate end-to-end flow from criteria input to enriched stop rendering.

## Notes

- Prefer Places API (New) docs in `docs/google-places-api-reference.md`.
- Multi-theme filtering should remain aligned with Nearby Search (New) and valid place types.
- Scope decision (2026-03-27): return 2-3 itinerary options.
- Scope decision (2026-03-27): no extra hard constraints in v1 beyond submitted criteria.
- Consider introducing a deterministic JSON output format for AI responses to reduce parsing errors.
- Child stories:
  - `RT-015` `2026-03-ai-trip-planner-api-orchestration.md`
  - `RT-016` `2026-03-ai-trip-planner-web-experience.md`
- Suggested validation commands:
  - `pnpm --filter @roadtrip/api test`
  - `pnpm --filter @roadtrip/web build`
