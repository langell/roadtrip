# Story ID: RT-005 – Sponsored Places Ranking and Labeling

## Outcome

- Sponsored content is blended into suggestions in a controlled, transparent way that preserves user trust and monetization value.

## Acceptance Criteria

- [ ] Sponsored places can be inserted into suggestion results using configurable placement rules.
- [ ] Sponsored entries are clearly labeled in API output and UI rendering.
- [ ] Ranking logic enforces frequency caps to avoid over-saturation.
- [ ] Active/inactive sponsorship state is respected from DB.
- [ ] Tests cover insertion logic and edge cases.

## Tasks

- [ ] Define ranking policy (position windows, max sponsored count, frequency cap) (owner: Product/API).
- [ ] Add service layer to merge organic + sponsored candidates (owner: API).
- [ ] Extend response schema with sponsorship metadata (owner: API/Types).
- [ ] Update web/mobile renderers to show sponsored badge/text (owner: Web/Mobile).
- [ ] Add unit tests for merge/ranking rules (owner: API).

## Notes

- Data source table: `SponsoredPlace`.
- Keep logic deterministic and configurable via env/settings.
