# RT-041 — Stop Detail Preview Sheet

## Problem

Users tap "Details →" on a plan stop and get navigated away from the planner to a full stop detail page. If they want to compare stops across plans, they have to go back and forward repeatedly. This breaks the decision-making flow.

## Goal

Tapping a stop name in the planner results opens a bottom sheet with the key details (photo, rating, hours, notes, distance) without leaving the page. Full navigation to the detail page remains available as a secondary action.

## Scope

### Web (`apps/web/components/trip-planner.tsx`)

- Replace "Details →" link with a tap handler that opens a `StopPreviewSheet` component
- `StopPreviewSheet`: modal/drawer component (bottom sheet on mobile, centered overlay on desktop)
  - Stop photo (large)
  - Name, distance from origin
  - Notes/description from the plan
  - "Open in Maps" external link
  - "View Full Details →" link to the stop detail page
  - Close button / tap-outside-to-dismiss

### Data

- All required data is already in the resolved stop object (`suggestion.imageUrl`, `suggestion.description`, `suggestion.lat/lng`) — no additional API call needed
- "Open in Maps" uses `https://www.google.com/maps/search/?api=1&query=lat,lng&query_place_id=placeId`

## Acceptance Criteria

- Tapping a stop name opens the preview sheet without page navigation
- Sheet shows photo, description, and distance
- "View Full Details" navigates to the existing stop detail page
- Sheet is dismissible via close button and backdrop tap
- Works correctly on mobile (bottom sheet) and desktop (centered)
- No regression to the existing Details link behavior on saved trip pages

## Notes

- This is purely a client-side UI change — no API changes needed
- Keep the sheet lightweight; the full stop detail page handles notes, rationale, and nav
