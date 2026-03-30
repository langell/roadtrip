# Story ID: RT-004 – Auth and Real User Context

## Outcome

- Trips, analytics, and suggestions are associated with real authenticated users instead of demo IDs.

## Acceptance Criteria

- [x] API no longer relies on static/demo user IDs for primary flows.
- [x] Web and mobile send authenticated context accepted by API middleware.
- [x] Unauthorized requests return consistent 401 behavior.
- [x] Existing trip and analytics writes remain functional with real user identity.
- [x] Auth integration has test coverage for success/unauthorized paths.

## Tasks

- [x] Define auth strategy for web and mobile (token/session contract) (owner: Platform).
- [x] Update API context creation and auth middleware to parse/verify real identity (owner: API).
- [x] Replace client-side demo header defaults with authenticated headers (owner: Web/Mobile).
- [x] Demo data wiped — no migration needed (owner: API).
- [x] Add endpoint-level tests for authenticated and unauthenticated behavior (owner: API).

## Notes

- Key files: `apps/api/src/types/context.ts`, `apps/api/src/lib/trpc.ts`, web/mobile API clients.
- Coordinate with deployment env vars before rollout.
- Mobile contract: send `Authorization: Bearer <token>` where token is provided via `EXPO_PUBLIC_API_BEARER_TOKEN` until native Auth.js-compatible session/token issuance is added.
