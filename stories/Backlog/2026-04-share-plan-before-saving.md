# RT-042 — Share a Plan Before Saving

## Problem

Users can only share a trip after saving it. This means sharing requires account creation, which adds friction for collaborative planning ("does this look good to you?") and for users who just want to send a plan to a friend.

## Goal

Add a Share button to each plan option card in the planner results. Clicking it creates a short-lived public link to that plan without requiring sign-in or saving.

## Scope

### API (`apps/api`)

- New endpoint: `POST /trips/share-preview`
  - Body: the full `TripPlanOption` (resolved stops, rationale, location, themes)
  - Stores the plan in a new `PlanPreview` table (or reuses `TripPlanCache` with a preview flag) with a short UUID token and 48h TTL
  - Returns `{ previewUrl: string }` — e.g. `https://hiptrip.net/preview/abc123`
- New endpoint: `GET /trips/preview/:token`
  - Returns the plan preview for rendering

### New page (`apps/web/app/preview/[token]/page.tsx`)

- Server Component, renders the plan using the same card layout as the shared trip view
- Shows a "Save this trip" CTA that deep-links into the planner with the plan pre-selected
- No auth required to view

### Web (`apps/web/components/trip-planner.tsx`)

- Add Share icon button to each plan option card header
- On click: POST to `/trips/share-preview`, then `navigator.share()` or clipboard copy (same pattern as `TripCardActions`)
- Brief "Link copied!" feedback

### Schema

```prisma
model PlanPreview {
  id        String   @id @default(uuid())
  token     String   @unique @default(uuid())
  planData  Json
  location  String
  themes    String[]
  expiresAt DateTime
  createdAt DateTime @default(now())
}
```

## Acceptance Criteria

- Share button appears on each plan card in results
- Clicking generates a shareable URL with no login required
- Preview page renders the plan correctly and is publicly accessible
- Preview links expire after 48 hours
- "Save this trip" CTA on preview page redirects authenticated users to save flow
- No auth required to share or view a preview

## Notes

- This intentionally avoids cluttering the saved trips concept — previews are ephemeral
- The 48h TTL keeps the DB clean; a cleanup cron can purge expired previews
- Consider reusing the existing SharedTripView layout for the preview page
