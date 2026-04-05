# Story ID: RT-033 – Route Map View

## Outcome

After saving or viewing a trip, users can see their full planned route on an interactive map alongside an ordered stop list. The map makes the trip tangible and shareable. A single sponsored "suggested stop along your route" card is surfaced inline in the stop list — contextual, non-intrusive ad inventory.

## Design Reference

Stitch project: https://stitch.withgoogle.com/project/9559669237004155255

Layout:

- **Left 60%**: interactive map with a green polyline route and numbered stop markers
- **Right 40%**: scrollable stop list — numbered cards with photo, name, drive time from previous stop, notes snippet
- Between stop 2 and 3: a sponsored "Suggested stop along your route" card with an "Ad" badge and "Add to Trip" action
- Bottom of right panel: "Start Trip" primary CTA, "Share" secondary link

## Acceptance Criteria

- [ ] `/trips/[id]/map` page renders the trip's stops on an interactive map with a route polyline connecting them in order.
- [ ] Each stop has a numbered marker on the map matching its position in the stop list.
- [ ] Clicking a marker in the map highlights the corresponding stop card in the right panel (and vice versa).
- [ ] Estimated drive time between consecutive stops is displayed on each stop card (e.g. "~45 min from previous stop").
- [ ] A single sponsored stop card appears between stop 2 and stop 3, labeled "Ad", with photo, name, and "Add to Trip" ghost button.
- [ ] "Add to Trip" on the sponsored card appends the place to the trip's stop list and fires a `sponsored_click` analytics event.
- [ ] "Start Trip" button links to Google Maps directions for the full route (opens in new tab).
- [ ] "Share" link triggers the existing share flow.
- [ ] Map and stop list are in sync — no stale state between them.
- [ ] Page loads with a skeleton while trip data and map tiles fetch.

## Tasks

- [ ] Add drive-time estimation to `GET /trips/:id` response — use Google Maps Directions API or Distance Matrix API to compute leg durations (owner: api)
- [ ] Add `GET /trips/:id/sponsored-stop` endpoint — returns the best-fit active `SponsoredPlace` near the trip's midpoint (owner: api)
- [ ] Build `/trips/[id]/map` page in Next.js (owner: web)
- [ ] Integrate an embeddable map (Google Maps JS SDK or Mapbox) to render stop markers and polyline (owner: web)
- [ ] Build `StopListPanel` component — ordered cards with drive time, photo, notes, active highlight state (owner: web)
- [ ] Build `SponsoredStopCard` component — matches organic card style with "Ad" badge and "Add to Trip" action (owner: web)
- [ ] Wire map marker ↔ stop card selection sync (owner: web)
- [ ] Fire `sponsored_click` event when "Add to Trip" is tapped on sponsored card (owner: web)
- [ ] Add "Map View" link/button to existing trip detail page (`/trips/[id]`) (owner: web)
- [ ] Add tests for sponsored-stop selection logic (nearest active place to trip midpoint) (owner: api)

## Notes

- Drive time in v1 can use the Directions API with `mode=driving` and `waypoints` for all stops — cache the result in the `Trip` record's `filters` JSON to avoid re-fetching.
- If Directions API is too expensive, fall back to straight-line distance estimate (haversine) with a 1.4× road factor for v1.
- Sponsored stop selection: find the active `SponsoredPlace` closest to the geographic midpoint of the trip's stops.
- The map embed key is the same `GOOGLE_MAPS_API_KEY` — ensure the key has Maps JavaScript API enabled.
- "Start Trip" opens: `https://www.google.com/maps/dir/?api=1&origin=...&destination=...&waypoints=...`
- Validation: `pnpm --filter @roadtrip/api test` and `pnpm --filter @roadtrip/web build`
