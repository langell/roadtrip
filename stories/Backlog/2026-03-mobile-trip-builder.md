# Story ID: RT-002 – Mobile Planner Saves Trips Offline

## Outcome

- Mobile users can draft a trip on the Expo app, save it locally when offline, and sync it to the API when connectivity returns.

## Acceptance Criteria

- [ ] Planner screen lets users add/edit/remove stops and see validation errors inline.
- [ ] Saving offline persists to secure storage and rehydrates on next launch.
- [ ] When network is back, queued drafts POST to `/trpc.trip.create` and clear from the queue after confirmation.
- [ ] Jest + Playwright-native tests cover reducers, storage adapter, and happy/sad sync flows.

## Tasks

- [ ] `apps/mobile`: Introduce a trip draft reducer + Zustand/EAS store, with tests for mutation logic.
- [ ] `apps/mobile`: Wire SecureStore (or MMKV) adapter for offline queue, build sync worker hooked to NetInfo events.
- [ ] `apps/mobile`: Implement UI affordances (status badge, retry button) and E2E coverage via Detox/Expo or Playwright-native.
- [ ] `apps/api`: Ensure `tripRouter.create` supports idempotent client-provided IDs or dedupe tokens to avoid duplicates.

## Notes

- Consider feature-flagging sync until API idempotency lands.
- Turbo focus: `pnpm --filter @roadtrip/mobile test`, `pnpm --filter @roadtrip/api test`.
