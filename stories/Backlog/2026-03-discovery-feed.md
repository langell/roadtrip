# Story ID: RT-032 – Discovery & Inspiration Feed

## Outcome

Users who are logged in land on a curated discovery feed instead of jumping straight to the trip planner. The feed surfaces trending routes, popular stops near them, and sponsored placements — creating a natural re-engagement loop and a high-value inventory surface for ads.

## Design Reference

Stitch project: https://stitch.withgoogle.com/project/9559669237004155255

Layout:

- **Hero**: full-bleed photo with headline "Where to next?" and "Plan a New Trip" CTA
- **Trending Routes**: horizontal scroll row of route cards (photo, route name, distance, theme chips)
- **Popular Stops Near You**: 3-column bento grid of place cards; 1–2 cards per page load carry a subtle "Sponsored" badge

## Acceptance Criteria

- [ ] Logged-in users land on the discovery feed at `/discover` (or are redirected from `/`).
- [ ] "Trending Routes" row shows up to 6 routes pulled from `TripPlanCache` ordered by `engagementScore`.
- [ ] "Popular Stops Near You" grid shows up to 9 stops from the Places API based on the user's most recent trip origin (or a generic popular-places fallback).
- [ ] Up to 2 sponsored stops per page load are injected into the grid from `SponsoredPlace` (active only), clearly labeled "Sponsored".
- [ ] Sponsored cards are visually consistent with organic cards but carry a tonal "Sponsored" badge — not a banner, not a pop-up.
- [ ] Feed gracefully degrades: if no location context exists, show a "Where are you starting from?" prompt instead of the nearby stops grid.
- [ ] Page renders with a loading skeleton before data arrives.
- [ ] Sponsored click events fire an analytics event (`sponsored_click` with `placeId`, `position`).

## Tasks

- [ ] Add `GET /discover` API endpoint — returns `{ trendingRoutes, nearbyStops, sponsoredSpots }` (owner: api)
- [ ] Implement trending routes query from `TripPlanCache` (top N by `engagementScore`, distinct by `themesKey + location`) (owner: api)
- [ ] Implement nearby stops query via Places API using last-trip-origin fallback (owner: api)
- [ ] Implement sponsored injection: merge up to 2 active `SponsoredPlace` rows into the nearby stops result at positions 2 and 6 (owner: api)
- [ ] Build `/discover` page in Next.js with hero, trending row, and bento grid (owner: web)
- [ ] Build `TrendingRouteCard` component — photo, route name, distance badge, theme chips (owner: web)
- [ ] Build `PlaceCard` component — photo, name, category badge, optional Sponsored label (owner: web)
- [ ] Fire `sponsored_click` analytics event on sponsored card click (owner: web)
- [ ] Redirect logged-in users from `/` to `/discover` (owner: web)
- [ ] Add tests for sponsored injection logic and fallback behavior (owner: api)

## Notes

- `SponsoredPlace` table already exists in the DB with `active`, `placeId`, `name`, `lat`, `lng`, `imageUrl`, `category` fields.
- `TripPlanCache` already has `engagementScore` — use it for trending ranking.
- Sponsored positions (2 and 6) are hardcoded in v1; make configurable later.
- Do not show more than 2 sponsored cards per page load to avoid over-saturation.
- Sponsored cards must be visually indistinguishable in shape/size from organic cards — only the badge differentiates them.
- Validation: `pnpm --filter @roadtrip/api test` and `pnpm --filter @roadtrip/web build`
