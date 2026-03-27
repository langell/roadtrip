# Google Places API (New) Reference

This project reference captures the canonical Places API (New) docs we rely on when implementing search behavior.

## Primary docs

- Overview: https://developers.google.com/maps/documentation/places/web-service
- Features: https://developers.google.com/maps/documentation/places/web-service#features-for-places-api-new
- Nearby Search (New): https://developers.google.com/maps/documentation/places/web-service/nearby-search
- Place Types (New): https://developers.google.com/maps/documentation/places/web-service/place-types
- Place Details (New): https://developers.google.com/maps/documentation/places/web-service/place-details
- Place Photos (New): https://developers.google.com/maps/documentation/places/web-service/place-photos
- REST reference: https://developers.google.com/maps/documentation/places/web-service/reference/rest

## Implementation rules used in this repo

1. Multi-theme nearby discovery should use **Nearby Search (New)** (`POST /v1/places:searchNearby`) with `includedTypes`.
2. Do **not** issue one Text Search call per theme for multi-theme filtering.
3. Always pass an explicit field mask (`X-Goog-FieldMask`) to control returned fields and billing.
4. Keep `locationRestriction.circle.radius` in valid range (`0..50000` meters, non-zero for practical use).
5. `includedTypes` values must come from **Table A** in Place Types (New).
6. Nearby Search `maxResultCount` is capped (`1..20`) and should be clamped in code.

## Current project mapping notes

Current journey themes map to `includedTypes` arrays in API service code. If themes or UX labels change, update both:

- API mapping in `apps/api/src/services/google-places-service.ts`
- UI theme options in `apps/web/components/trip-planner.tsx`

## Quick request template (Nearby Search New)

```http
POST https://places.googleapis.com/v1/places:searchNearby
X-Goog-Api-Key: <API_KEY>
X-Goog-FieldMask: places.id,places.displayName,places.formattedAddress,places.shortFormattedAddress,places.location,places.photos
Content-Type: application/json

{
  "includedTypes": ["restaurant", "cafe"],
  "maxResultCount": 20,
  "rankPreference": "DISTANCE",
  "locationRestriction": {
    "circle": {
      "center": { "latitude": 37.7937, "longitude": -122.3965 },
      "radius": 5000
    }
  }
}
```
