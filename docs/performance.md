# Performance Budgets and Targets

## API Targets

| Endpoint                        | p50 Target | p95 Target | Notes                                |
| ------------------------------- | ---------- | ---------- | ------------------------------------ |
| `GET /discover`                 | < 200 ms   | < 500 ms   | DB-only; no external calls           |
| `POST /trips/plan` (cache hit)  | < 100 ms   | < 300 ms   | Cache lookup + JSON return           |
| `POST /trips/plan` (cache miss) | < 4 s      | < 8 s      | AI generation + Places resolution    |
| `POST /trips/refine-plan`       | < 2 s      | < 4 s      | Tier 1 model; Places batch           |
| `GET /places/photo`             | < 50 ms    | < 150 ms   | Proxy redirect; no body read         |
| `POST /analytics/events`        | < 20 ms    | < 50 ms    | Fire-and-forget; 202 before DB write |

## Web Targets

| Metric                         | Target   | Notes                                                         |
| ------------------------------ | -------- | ------------------------------------------------------------- |
| LCP (Largest Contentful Paint) | < 2.5 s  | Hero image preloaded                                          |
| FID / INP                      | < 100 ms | Planner is client component; streaming keeps main thread free |
| CLS                            | < 0.1    | Reserved heights on image slots                               |
| First plan option visible      | < 1.5 s  | SSE streaming; first `option` event renders immediately       |

## Implemented Optimizations

### API

- **AI plan caching** (`TripPlanCache`): cache hit serves full plan in < 100 ms. TTL configured via `TRIP_PLAN_CACHE_TTL_DAYS`. Cache pre-warmed nightly by `GET /jobs/prewarm-cache`.
- **Fuzzy cache matching**: `locationKey` (normalized string) + lat/lng bounding box (±10 miles) — maximizes hit rate for slight location variations.
- **Streaming plan generation**: SSE streams each resolved option as it completes. First option appears within ~1 s even for cold cache.
- **Parallel Places resolution**: all stop names (primaries + alternatives) for an option are geocoded in a single batch call. Options are resolved concurrently.
- **Two-tier AI model routing**: Tier 1 (fast model) for refinements; Tier 2 for complex generation. Reduces average latency for common operations.
- **Rate limiting**: anonymous suggestion requests are rate-limited in-memory per IP (configurable via env). Auth'd requests are unrestricted.

### Web

- **Loading skeletons**: the planner renders animated skeleton cards while streaming. Spinning message cycle every 3 s sets user expectations.
- **Lazy image loading**: stop images in plan cards and preview sheets use `loading="lazy"`. First stop uses `loading="eager"` on detail pages.
- **Server Components by default**: only interactive surfaces add client JS. The home page, trip detail pages, and stop pages are server-rendered.
- **Static Maps (Static Maps API)**: map pages use Leaflet with tile caching; `MiniRouteMap` in plan cards uses a Static Maps URL (no JS).
- **localStorage plan persistence**: last generated plan is stored to localStorage so returning to the page restores results instantly.

## Monitoring

- **Structured request logs**: every request logs `method`, `path`, `status`, `responseTimeMs` via pino + `requestLoggingMiddleware`.
- **Error logging**: `logError()` emits structured JSON with stack trace, module, and context.
- **`GET /health`** and **`GET /ready`**: health checks for load balancer probes. `/ready` includes a DB query to verify connectivity.
- **Engagement scoring**: `TripPlanCache.engagementScore` increments on each cache serve — used to surface trending routes and prioritize pre-warming.

## Alerting Recommendations

- Alert on `p95 responseTimeMs > 8000` for `POST /trips/plan`
- Alert on `error rate > 2%` for any endpoint
- Alert on `GET /ready` failure (DB connectivity loss)
- Alert on AI upstream errors (`ai.generate-plans.failure` log events)
