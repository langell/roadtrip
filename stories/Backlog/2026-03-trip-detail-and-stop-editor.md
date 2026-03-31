# Story ID: RT-029 – Trip Detail and Stop Editor

## Outcome

- After selecting a generated trip plan, travelers land on a detail screen where they can review every stop, remove stops they don't want, add new stops, and ultimately save the finalized trip.

## Acceptance Criteria

- [ ] Clicking "Select this trip →" on a plan card navigates to a trip detail screen that shows the full plan: title, rationale, and all resolved stops.
- [ ] Authenticated users can remove individual stops from the plan.
- [ ] Authenticated users can add stops (search for a place and append it to the list).
- [ ] Stop order can be changed (drag or up/down controls).
- [ ] A "Save trip" button at the bottom saves the finalized plan and redirects to the saved trips list or a confirmation screen.
- [ ] Anonymous users who click "Save trip" are shown a sign-in modal; after signing in they are returned to the detail screen with their plan intact.
- [ ] The detail screen is shareable via URL (plan data passed via URL state or temporary session storage; no DB write until save).

## Tasks

### Web

- [ ] Add `/plan` route (or modal/sheet overlay) that receives a selected `TripPlanOption` and renders the detail view.
- [ ] Stop list with remove controls and optimistic UI.
- [ ] Add-stop search (reuse `GooglePlacesAutocomplete`, resolve via API `/suggestions`).
- [ ] Stop reorder controls.
- [ ] Save button with auth gate modal for anonymous users.
- [ ] Pass selected plan state from trip planner to detail screen (URL params, context, or session storage).

### API

- [ ] `POST /trips/save-plan` already exists — confirm it accepts the full edited stop list (resolved in RT-023).

### Mobile

- [ ] Mirror the same select → detail → save flow in the mobile planner (coordinate with mobile team).

## Notes

- The `POST /trips/save-plan` API endpoint was built in RT-023 and accepts a fully resolved stop list.
- Keep the detail screen stateless on the server — no draft trips in DB. Only write on explicit Save.
- The Google Stitch MCP server may be used to assist with UI scaffolding and component generation.
- Validate with: `pnpm --filter @roadtrip/web build`, `pnpm --filter @roadtrip/api test`.
