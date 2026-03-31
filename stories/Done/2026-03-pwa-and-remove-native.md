# Story ID: RT-030 – PWA + Remove React Native App

## Outcome

- The web app becomes an installable Progressive Web App so mobile users get a native-like experience without a separate codebase, and the Expo app is removed entirely.

## Acceptance Criteria

- [x] Web app is installable on iOS and Android home screens via PWA (manifest + service worker).
- [x] App has a name, icon, theme color, and splash screen configured in the manifest.
- [x] Saved trips are written to the database (existing `POST /trips/save-plan` endpoint) — no client-side-only storage.
- [x] The app works offline for previously-viewed content (service worker caches static assets and shell).
- [x] `apps/mobile` directory and all mobile-related workspace config is removed from the monorepo.
- [x] Turbo pipeline, root `package.json`, and `pnpm-workspace.yaml` no longer reference `@roadtrip/mobile`.
- [x] CI/lint/test pipelines pass cleanly after removal.

## Tasks

### Web — PWA

- [x] Add `apps/web/public/manifest.json` with name, short_name, icons, theme_color, background_color, display: standalone (owner: web)
- [x] Add icons (192x192, 512x512 PNG) to `apps/web/public/icons/` — generated via `scripts/generate-pwa-icons.mjs` (owner: web)
- [x] Add `<link rel="manifest">` and `<meta name="theme-color">` to root layout (owner: web)
- [x] Register a Next.js-compatible service worker for asset caching — manual `public/sw.js` with cache-first for `_next/static`, network-first for navigation (owner: web)
- [x] Verify installability in Chrome DevTools Lighthouse PWA audit — manifest panel confirmed correct, all warnings resolved (owner: web)

### Web — Database saves

- [x] Confirm existing "Save trip" flow on `/plan` already calls `POST /trips/save-plan` and persists to DB — confirmed working via `savePlanOption()` in `lib/api-client.ts` (owner: web)
- [x] Add "Saved Trips" link / entry point accessible from mobile viewport — added `/trips` page + "My Trips" button in account page (owner: web)

### Remove React Native

- [x] Delete `apps/mobile/` directory (owner: infra)
- [x] Remove `@roadtrip/mobile` from `pnpm-workspace.yaml` — not needed; workspace uses `apps/*` glob (owner: infra)
- [x] Remove `dev:mobile` script from root `package.json` (owner: infra)
- [x] Remove mobile from `turbo.json` pipeline if referenced — not referenced (owner: infra)
- [x] Remove RT-022 from `stories/RANKING.md` and move story file to `stories/Done/` with a note that it was superseded by RT-030 (owner: infra)
- [x] Remove mobile references from `packages/config/eslint/base.mjs` (owner: infra)
- [x] Run `pnpm install` and `pnpm lint && pnpm test` to confirm clean state (owner: infra)

## Notes

- Existing save flow already hits the database via `savePlanOption()` in `apps/web/lib/api-client.ts` → `POST /trips/save-plan`. The AC is mostly a confirmation pass.
- For the service worker, `next-pwa` (maintained fork: `@ducanh2912/next-pwa`) is the lowest-friction option with Next.js App Router. Alternative: write a minimal `public/sw.js` manually to avoid a dependency.
- iOS Safari requires `apple-touch-icon` meta tag in addition to the manifest for home-screen install.
- Offline caching scope: cache the app shell (JS/CSS chunks) and static assets. API responses are live-only — no offline trip generation.
- Validation: `pnpm --filter @roadtrip/web build`, `pnpm lint`, `pnpm test`, Lighthouse PWA audit score ≥ 90.
