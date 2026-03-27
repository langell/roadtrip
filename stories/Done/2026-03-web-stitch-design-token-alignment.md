# Story ID: RT-009 – Web Design Token Alignment to Stitch

## Outcome

- The web UI uses a consistent tokenized visual system aligned with Stitch direction and `docs/design-system.md`, reducing one-off styling drift.

## Acceptance Criteria

- [x] Web typography, spacing, radius, and color usage are aligned to approved design tokens for all updated screens.
- [x] No new hard-coded colors, fonts, or ad-hoc shadow values are introduced in `apps/web`.
- [x] Existing components in `packages/ui` and `apps/web/components` consume tokenized styles consistently.
- [x] Visual diffs for updated screens show no unresolved P0/P1 token mismatches from RT-008.

## Tasks

- [x] Identify current token violations in `apps/web` and `packages/ui` from the RT-008 gap map.
- [x] Refactor affected components to use existing tokens/utilities and remove style duplication.
- [x] Update/add lightweight tests or snapshots where tokenized rendering behavior could regress.
- [x] Validate builds/tests for `@roadtrip/web` and `@roadtrip/ui` after refactors.

## Notes

- Scope is token/system alignment only; avoid layout restructuring unless required by token adoption.
- Follow project constraints: minimal UX changes, no extra features outside Stitch/design-system direction.

### Implemented Token Alignment

- Added Wayfarer token mapping in `apps/web/tailwind.config.ts`:
  - `colors.wayfarer.*`
  - `fontFamily.display` (`Plus Jakarta Sans`) and `fontFamily.body` (`Manrope`)
  - `borderRadius.card` and `boxShadow.wayfarer-*` utilities
- Refactored shared UI primitives to token classes:
  - `packages/ui/src/components/Button.tsx`
  - `packages/ui/src/components/Surface.tsx`
- Refactored web components/pages to token classes:
  - `apps/web/app/page.tsx`
  - `apps/web/components/trip-planner.tsx`
  - `apps/web/components/auth-controls.tsx`
  - `apps/web/components/hero-phrase.tsx`

### Validation

- `pnpm --filter @roadtrip/ui build` ✅
- `pnpm --filter @roadtrip/web build` ✅
