# Pre-Release Security Checklist

Review this checklist before every production release.

## Secrets and Configuration

- [ ] All secrets are in environment variables — no API keys, tokens, or passwords hardcoded in source.
- [ ] `AUTH_SECRET` is set on both the web app (Vercel) **and** the API server, and the values match.
- [ ] `GOOGLE_MAPS_API_KEY` is restricted in Google Cloud Console (HTTP referrer restrictions for web; IP restrictions for API server).
- [ ] `GOOGLE_AI_API_KEY` / `AI_GATEWAY_API_KEY` is set and not exposed to the client.
- [ ] `CORS_ORIGIN` is set to the production web app URL only (not `*`).
- [ ] `PUBLIC_SITE_URL` is set to the production web app URL (used to build share links).
- [ ] No `.env` files (other than `.env.example`) are committed to the repo.

## Authentication and Authorization

- [ ] All user-data endpoints require `requireAuth` middleware or `authenticatedProcedure`.
- [ ] Ownership checks are in place: users can only read/write their own trips (`trip.userId === userId`).
- [ ] The `/ready` and `/health` endpoints do not expose sensitive runtime data.
- [ ] The `/trips/shared/:token` endpoint only exposes the fields explicitly listed (name, stops, themes — no userId, no private metadata).

## Rate Limiting

- [ ] Anonymous `/suggestions` requests are rate-limited (`ANON_SUGGESTIONS_RATE_LIMIT_MAX` per `ANON_SUGGESTIONS_RATE_LIMIT_WINDOW_MS`).
- [ ] Anonymous `/trips/plan` requests are rate-limited (shares the same limiter as suggestions).
- [ ] Anonymous `/places/photo` requests are rate-limited (`ANON_PHOTO_RATE_LIMIT_MAX` per `ANON_PHOTO_RATE_LIMIT_WINDOW_MS`).
- [ ] Rate limit defaults are appropriate for expected traffic (adjust env vars if needed before launch).

## Data Exposure

- [ ] Diagnostic codes (`diagnosticCode`, `diagnosticStage`) are only returned in non-production environments.
- [ ] Logs do not contain raw API keys, full JWT tokens, or user PII beyond userId.
- [ ] The API never forwards raw upstream error bodies to clients.
- [ ] `imageUrl` values stored in the DB point to the API's own `/places/photo` proxy — not directly to Google's API with embedded keys.

## Dependencies

- [ ] Run `pnpm audit` — no high or critical vulnerabilities outstanding without a documented exception.
- [ ] Dependencies are pinned or ranged conservatively (no `*` versions).

## Infrastructure

- [ ] The API server is behind HTTPS in production (TLS termination at load balancer or reverse proxy).
- [ ] `trust proxy` is set only if the API actually runs behind a trusted proxy (currently set to `1`).
- [ ] Helmet middleware is active (`helmet()` is called in `createApp`).
- [ ] CORS is locked to the specific origin(s) listed in `CORS_ORIGIN`.
- [ ] Database connection uses SSL in production (`sslmode=require` in `DATABASE_URL` or equivalent).

## Pre-Deploy Checklist

- [ ] `pnpm lint` passes with no errors.
- [ ] `pnpm --filter @roadtrip/api test` passes with coverage thresholds met.
- [ ] `pnpm --filter @roadtrip/web build` succeeds.
- [ ] New endpoints added since last release have been reviewed against this checklist.
