# Story ID: RT-015 – AI Trip Planner API Orchestration

## Outcome

- Build a backend orchestration flow that accepts trip criteria, generates an AI itinerary plan, and enriches stops with Places details in one validated response.

## Acceptance Criteria

- [ ] New API endpoint accepts trip criteria (origin, radius, themes, optional constraints) with strict schema validation.
- [ ] API invokes AI planner and requires structured JSON output for **2-3 itinerary options** with ordered stop suggestions and plan rationale.
- [ ] API enriches suggested stops via Places API (New) and returns canonical stop details (`placeId`, name, location, address, optional photo reference).
- [ ] API handles partial enrichment failures without failing the whole request (includes per-stop error metadata/status).
- [ ] API logs orchestration stages (planner request/response parse, places enrichment, fallback path) with sanitized diagnostics.
- [ ] Unit/integration tests cover success path, invalid AI payloads, and partial Places failures.

## Tasks

- [ ] Add request/response schema types in API for planner orchestration contract (owner: api).
- [ ] Implement planner client abstraction (prompt + strict JSON parse/retry behavior) (owner: api).
- [ ] Implement Places enrichment pipeline for AI-proposed stops (owner: api).
- [ ] Add endpoint and wire route/controller + error shaping (owner: api).
- [ ] Add tests for orchestration and failure handling (owner: api).

## Notes

- Parent story: `RT-014` (`2026-03-ai-trip-planning-and-stop-details.md`).
- Use `docs/google-places-api-reference.md` as the Places API source of truth.
- Prefer Nearby Search (New) and Place Details (New) where appropriate for enrichment depth.
- Scope decision (2026-03-27): no extra hard constraints in v1 beyond submitted criteria.
- Validation command: `pnpm --filter @roadtrip/api test`
