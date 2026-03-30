# Story ID: RT-001 – Trip Suggestions Deliver Real Data

## Outcome

- Travelers can request themed stop suggestions for a city and see real Google Places data in both the API and web planner experience.

## Acceptance Criteria

- [x] `/trpc.trip.suggestions` proxies the Google Places API and returns structured stops with distance, title, and description.
- [x] Anonymous requests are allowed for suggestions and trip planning (with rate limiting); saves require auth.
- [x] `POST /trips/save-generated` and `GET /trips` reject unauthenticated requests with 401.
- [x] Authenticated trip saves work with real user identity (no FK constraint errors).
- [x] Web planner UI renders AI plan options with loading + empty states.
- [x] Coverage for the service + router + HTTP endpoints remains ≥80%.

## Tasks

### API

- [x] Google Places client (`google-places-service.ts`) with geocode, nearby search, and stop resolution.
- [x] AI trip planner service with multi-theme support and plan cache (30d TTL, engagement scoring).
- [x] `tripRouter.suggestions` via tRPC — anonymous access allowed.
- [x] `GET /suggestions` and `POST /trips/plan` REST endpoints — anonymous with rate limiting.
- [x] `GET /trips` and `POST /trips/save-generated` REST endpoints — auth required (`requireAuth`).
- [x] Remove `Trip → User` and `AnalyticsEvent → User` FK constraints so JWT sub IDs work as `userId` without needing DB User records.
- [x] Fix test-environment auth bypass: `AUTH_SECRET` cleared in `beforeEach` so bare bearer strings work in tests.

### Web

- [x] `fetchTripPlans` API client calls `POST /trips/plan` with optional auth header.
- [x] Trip planner UI renders AI plan options with per-option stops, images, and loading skeleton.

### Docs & Ops

- [ ] Update `.env.example` and README with Google API enablement steps and required vars.

## Notes

- `User.id` is the Google OAuth sub (string). `User` model exists for future profile use but has no FK relations from Trip/AnalyticsEvent.
- Anonymous suggestions use in-memory rate limiting (IP-keyed); auth'd users bypass the limit.
- Turbo command: `pnpm --filter @roadtrip/api test -- --coverage`.
