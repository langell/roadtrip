# Story ID: RT-003 – Mobile Saved Trip Details

## Outcome

- Mobile users can open a saved trip and view a structured stop-by-stop itinerary, making saved plans actionable.

## Acceptance Criteria

- [ ] Saved trip cards in mobile are tappable and open a details view/state.
- [ ] Details show trip name, origin, and ordered stops with distance/context.
- [ ] Empty and loading states are clear and non-blocking.
- [ ] UI matches Stitch direction and `docs/design-system.md` tokens.
- [ ] Mobile tests cover opening a trip and rendering stops.

## Tasks

- [ ] Add API/client shape for detailed saved trip payload (owner: API/Mobile).
- [ ] Extend mobile trip API client with fetch-by-id/details method (owner: Mobile).
- [ ] Implement details panel/screen within planner flow (owner: Mobile).
- [ ] Render ordered stop metadata and notes from persisted `TripStop` records (owner: Mobile).
- [ ] Add tests for interaction and render states (owner: Mobile).

## Notes

- Key files: `apps/mobile/src/features/trip/PlannerScreen.tsx`, `apps/mobile/src/features/trip/api-client.ts`.
- Reference Stitch mobile screens before UI changes.
- Validate with: `pnpm --filter @roadtrip/mobile test`.
