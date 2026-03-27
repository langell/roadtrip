# API (`@roadtrip/api`)

Express + tRPC + Prisma backend for RoadTrip.

## Prerequisites

- Node.js 22.x
- pnpm 9.x

## Setup

From the repository root:

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
```

Required values in `apps/api/.env`:

- `DATABASE_URL`
- `GOOGLE_MAPS_API_KEY`
- `AUTH_SECRET` (must match web `AUTH_SECRET` for signed API bearer validation)

Google API requirements for `GOOGLE_MAPS_API_KEY`:

- `Geocoding API` enabled (origin geocoding).
- `Places API (New)` enabled (suggestions).
- API key restrictions must allow `Places API (New)` method `places:searchText`.
- Billing must be enabled in the Google Cloud project.

Optional values:

- `LOG_LEVEL` (defaults to `info`)
- `PORT` (defaults to `3001`)
- `ANON_SUGGESTIONS_RATE_LIMIT_WINDOW_MS` (defaults to `300000`)
- `ANON_SUGGESTIONS_RATE_LIMIT_MAX` (defaults to `60`)
- `TRIP_PLAN_CACHE_TTL_DAYS` (defaults to `30`; controls itinerary cache expiration)
- `TRIP_PLAN_CACHE_DEBUG` (`true`/`false`; defaults to `false`, adds cache debug metadata to `/trips/plan` response in non-production)
- `OTEL_ENABLED` (`true` to enable OpenTelemetry)
- `OTEL_SERVICE_NAME` (defaults to `roadtrip-api`)
- `OTEL_EXPORTER_OTLP_ENDPOINT`
- `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`
- `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT`

## Run (development)

From the repository root:

```bash
pnpm --filter @roadtrip/api dev
```

API health endpoint:

- `http://localhost:3001/health` (or your custom `PORT`)

Suggestions endpoint:

- `GET /suggestions?location=...&radiusKm=...&theme=...`
- Uses Geocoding + Places API (New) text search (`v1/places:searchText`).
- On upstream failure, returns `502` with `error: UPSTREAM_PLACES_ERROR`.
- In non-production, includes `diagnosticCode` and `diagnosticStage` for faster troubleshooting.

## Observability

Structured logs are emitted as JSON to stdout and include `requestId`, `route`, `method`, `status`, and `latencyMs`. Each response also includes the `x-request-id` header for correlation.

To enable OpenTelemetry traces and metrics locally:

1. Set `OTEL_ENABLED=true`.
2. Provide an OTLP endpoint via `OTEL_EXPORTER_OTLP_ENDPOINT` (or the traces/metrics specific endpoints).
3. Optionally set `OTEL_SERVICE_NAME` to customize the service name.

## Database

Push Prisma schema:

```bash
pnpm --filter @roadtrip/api db:push
```

Create a local migration:

```bash
pnpm --filter @roadtrip/api db:migrate
```
