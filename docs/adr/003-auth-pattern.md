# ADR-003 — Authentication Pattern (NextAuth + API JWT)

**Date**: 2026-03-15
**Status**: Accepted

## Context

The system has two runtimes: `apps/web` (Next.js, handles sessions) and `apps/api` (Express, stateless). We need a secure way for authenticated web users to call the API without duplicating session management, and we need anonymous users to be able to access a rate-limited subset of endpoints.

## Decision

1. `apps/web` manages sessions via NextAuth (JWT strategy, `NEXTAUTH_SECRET`).
2. A Route Handler at `/api/auth/api-token` mints short-lived JWTs (30-minute TTL) signed with `NEXTAUTH_SECRET` when a valid NextAuth session is present. These tokens include `userId` and `role`.
3. `apps/api` verifies these tokens with the shared secret via `requireAuth` middleware; it never manages sessions itself.
4. Anonymous users may call `/trips/plan`, `/trips/refine-plan`, and `/places/photo` within per-IP rate limits (`ANON_SUGGESTIONS_RATE_LIMIT_*`). All write endpoints require auth.
5. The web client caches the API token for up to 25 minutes in memory to reduce `/api/auth/api-token` round-trips.

## Consequences

- **Stateless API**: no session store needed; any API instance can verify any request.
- **Short-lived tokens**: 30-minute TTL limits exposure from token theft.
- **Shared secret coupling**: `apps/api` and `apps/web` must share `NEXTAUTH_SECRET`. Rotation requires coordinated redeploy.
- **Anonymous access**: rate-limited anonymous plans support unauthenticated demos without requiring sign-in for the core value proposition.
