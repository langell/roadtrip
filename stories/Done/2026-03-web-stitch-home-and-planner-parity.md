# Story ID: RT-025 – Home + Planner Screen Parity with Stitch

## Outcome

- The `apps/web` home and planner experience visually and structurally matches the approved Stitch screens while preserving current functionality.

## Acceptance Criteria

- [x] Homepage hero and planner composition match Stitch screen structure, alignment, and spacing intent.
- [x] Existing interactions (search, suggestions loading/empty states, auth-aware behavior) continue to work.
- [x] Any required copy updates from Stitch are applied without breaking tests or accessibility semantics.
- [x] Playwright smoke coverage validates that critical sections render and remain usable after parity updates.

## Tasks

- [x] Create parity implementation slices from RT-008 gap matrix (hero/layout, planner form hierarchy, suggested cards/states).
- [x] Implement layout/component parity updates for `apps/web/app/page.tsx` and related components.
- [x] Align planner visual hierarchy with Stitch while keeping API integration behavior unchanged.
- [x] Update affected tests (unit + Playwright) for structure/copy changes.
- [x] Run `pnpm --filter @roadtrip/web build` and web test suite before handoff.

## Notes

- Use RT-008 priority order; defer lower-priority visual polish to separate stories if needed.
- Do not add net-new pages/modals/features unless explicitly shown in approved Stitch screens.

### Kickoff (2026-03-27)

- Canonical Stitch screens (project `9559669237004155255`):
  - Home Screen: `ef011faa0e204c73a12a40ade6c104c8`
  - Trip Planner Form: `5a00e907c6d94a8b9b807e1467f72bcd`
  - Loading Ideas state: `0138ea8f86a14143b67d3b1881c5f7a8`
  - Suggested Stops state: `3527bd13f1d64749bdb74574b0d902ef`

- Implementation order:
  1.  Homepage shell parity (`app/page.tsx`): section rhythm, headline/supporting copy hierarchy.
  2.  Planner form parity (`components/trip-planner.tsx`): grouped controls, labels, spacing cadence.
  3.  Suggestion/list state parity (`components/trip-planner.tsx`): loading/empty/content card hierarchy.
  4.  Interaction safety + smoke tests (`tests/home.spec.ts` and affected component tests).

### Delivered (2026-03-27)

- Homepage parity pass implemented in `apps/web/app/page.tsx`:
  - added route-builder section intro and stronger heading hierarchy
  - preserved existing auth + planner behavior
- Planner parity pass implemented in `apps/web/components/trip-planner.tsx`:
  - grouped form fields into a surfaced planner block with improved hierarchy
  - added explicit loading skeleton cards for suggestion generation state
  - retained existing search/query behavior and empty/content states
- Smoke test updated in `apps/web/tests/home.spec.ts` to assert planner CTA visibility.

### Validation

- `pnpm --filter @roadtrip/web test` ✅
- `pnpm --filter @roadtrip/web build` ✅ (after clearing stale `.next` cache)
