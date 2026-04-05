# Architecture Overview

## Service Boundaries

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser / Mobile                                               │
│                                                                 │
│   apps/web (Next.js 15, App Router)                             │
│   ├── Server Components  →  apps/api REST endpoints             │
│   ├── Client Components  →  apps/api REST endpoints (fetch)     │
│   └── /api/auth/*        →  NextAuth (JWT session)              │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTP (REST + tRPC)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  apps/api (Express, Node.js standalone)                         │
│                                                                 │
│  REST routes (/trips, /discover, /analytics, /admin, /jobs …)  │
│  tRPC router (/trpc — legacy, minimal surface)                  │
│                                                                 │
│  Services:                                                      │
│  ├── AiTripPlannerService  →  Google AI (Gemini via AI SDK)     │
│  ├── GooglePlacesService   →  Google Maps Places API            │
│  └── AiStopDescriptionService → Google AI                       │
│                                                                 │
│  Database: Neon (Postgres) via Prisma ORM                       │
│  Auth: JWT verification (NextAuth secret shared)                │
└─────────────────────────────────────────────────────────────────┘

packages/
├── types/   — Zod schemas + TypeScript types shared by API and web
└── ui/      — Shared React components (Button, etc.)
```

## Key Design Decisions

### Auth

- NextAuth manages sessions in `apps/web`
- `apps/web/app/api/auth/api-token` mints short-lived JWTs from the session
- `apps/api` verifies JWTs with the shared `NEXTAUTH_SECRET`
- Anonymous users get rate-limited access to suggestion/plan endpoints

### Caching

- AI-generated plans are cached in `TripPlanCache` (Postgres, TTL-based)
- Cache lookup uses `locationKey` (normalized) + lat/lng bounding box fallback
- Cache is warmed nightly by the `GET /jobs/prewarm-cache` job
- See [ADR-001](adr/001-plan-caching.md)

### AI Orchestration

- Two-tier model routing: Tier 1 (`GOOGLE_AI_MODEL_FAST`) for fast/cheap calls; Tier 2 (`GOOGLE_AI_MODEL`) for quality
- Tier 1 is used for plan refinement and simple requests
- Tier 2 (with retries + fallback degradation) is used for initial plan generation with 3 themes
- Parallel Places API resolution: all stop names (primary + alternatives) resolved in a single batch call per option
- See [ADR-002](adr/002-ai-orchestration.md)

### Shared Types

- `@roadtrip/types` (`packages/types/`) is the source of truth for plan schemas
- API validates input/output with Zod schemas from this package
- Web imports TypeScript types from `apps/web/lib/api-client.ts` (manually maintained)
- **Known drift risk**: `api-client.ts` types are hand-maintained; if API shapes change, both must be updated
- Mitigation: critical types (PlannedStop, PlannedSuggestion) are exported from `@roadtrip/types` and should be reused in api-client

### Sponsored Content

- `SponsoredPlace` table holds active/inactive sponsors
- Injected into discover feed at grid positions 1 and 5 (0-indexed), max 2 per page
- Geo-targeted injection on trip maps: closest active sponsor within 200 km of trip origin
- Impression and click events flow through `POST /analytics/events`

### Analytics

- All events go through `POST /analytics/events` (public endpoint, fire-and-forget)
- Canonical types: `trip_generate`, `trip_save`, `trip_open`, `sponsored_click`, `sponsored_impression`
- Admin reporting via `GET /analytics/events`
- Events must never block user-facing flows (DB write is not awaited in response)

## Known Technical Debt

| Area               | Issue                                                                             | Priority          |
| ------------------ | --------------------------------------------------------------------------------- | ----------------- |
| `api-client.ts`    | Types hand-maintained, can drift from API                                         | Medium            |
| tRPC router        | Legacy surface — `tripRouter.trackEvent` is superseded by REST analytics endpoint | Low               |
| `prewarm-cache.ts` | Type errors (`AiTripPlans.length`) — pre-existing                                 | Low               |
| `PlaceCard.tsx`    | `gradientIndex` used as position proxy for analytics                              | Low               |
| Rate limiting      | In-memory only — not shared across replicas                                       | Tracked in RT-046 |
| Geo queries        | Haversine in app layer — not leveraging PostGIS                                   | Tracked in RT-047 |

## Feature Checklist (before starting a new story)

- [ ] API contract defined (endpoint, request schema, response schema)
- [ ] Types added/updated in `@roadtrip/types` if shared
- [ ] DB schema changes use `prisma db push` (dev) or migration (prod)
- [ ] New endpoints have tests (happy path, validation, auth gating, error handling)
- [ ] Coverage thresholds maintained (80% global, 95% services)
- [ ] Web build passes (`pnpm --filter @roadtrip/web build`)
- [ ] Story moved to `Done/` and STATUS.md updated
