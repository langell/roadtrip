# Story ID: RT-006 – Analytics Funnel Events

## Outcome

- Product team can track core funnel behavior across generate/save/open/click actions to guide prioritization and monetization decisions.

## Acceptance Criteria

- [ ] Core events are recorded: `trip_generate`, `trip_save`, `trip_open`, `sponsored_click`.
- [ ] Event payloads follow a stable, documented schema.
- [ ] Event writes are resilient and do not break user-facing flows.
- [ ] Query path exists for basic reporting (latest events by type/time/user).
- [ ] Tests verify event creation and payload validation.

## Tasks

- [ ] Define canonical event names and payload schema (owner: Product/API).
- [ ] Add event helper module and validation guardrails (owner: API).
- [ ] Wire event tracking into web/mobile user actions (owner: Web/Mobile).
- [ ] Add API query endpoint/procedure for basic event inspection (owner: API).
- [ ] Add tests for event writes and read filters (owner: API).

## Notes

- Data source table: `AnalyticsEvent`.
- Avoid PII in payloads unless explicitly required.
