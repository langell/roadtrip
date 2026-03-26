# Story ID: RT-008 – Anonymous Trip Search with Auth-Gated Save

## Outcome

- New users can search and preview trip suggestions without signing in, while save functionality requires authentication.

## Acceptance Criteria

- [ ] Anonymous users can access trip search and view generated suggestions in web/mobile.
- [ ] Anonymous users attempting to save a trip are prompted to authenticate instead of writing data.
- [ ] Authenticated users retain current save/list trip behavior with real user identity.
- [ ] API enforces auth for save/list/write endpoints and allows anonymous read-only search endpoints.
- [ ] Anonymous search requests are rate-limited (for example per IP and time window) and return `429` when limit is exceeded.
- [ ] Tests cover anonymous search success, anonymous save rejection/gate, and authenticated save success.

## Tasks

- [ ] Define anonymous vs authenticated endpoint contract (owner: Platform/API).
- [ ] Update API auth guards so read-only search supports anonymous requests while save/write routes require auth (owner: API).
- [ ] Add rate limiting for anonymous search requests to reduce abuse/spam risk (owner: API/Platform).
- [ ] Update web planner UX to show sign-in prompt/CTA when anonymous users click save (owner: Web).
- [ ] Update mobile planner UX to gate save action behind authentication prompt/state (owner: Mobile).
- [ ] Add/adjust test coverage for anonymous and authenticated flows across API and clients (owner: API/Web/Mobile).

## Notes

- Keep this aligned with Auth.js best practices and current RT-004 token strategy.
- Coordinate with `stories/Backlog/2026-03-auth-user-context.md` so both stories land without contract drift.
- Validate with: `pnpm --filter @roadtrip/api test`, `pnpm --filter @roadtrip/web build`, `pnpm --filter @roadtrip/mobile test`.
