# RT-043 — Hotel Affiliate Cards (Expedia + Booking.com)

## Goal

Surface professional hotel recommendation cards near trip stops and/or along trip routes, earning affiliate commission per booking click-through.

## Monetization

- **Expedia Rapid API (EAN)** — primary integration, ~4–6% commission per booking
- **Booking.com Affiliate Partner API** — secondary integration, adds coverage and redundancy

## Open Questions (to confirm before implementation)

- [ ] Where do cards appear? (stop detail pages, trip plan results, saved trip view, or all three?)
- [ ] Passive deep-link cards or active date-based availability search?

## Planned Scope

### Phase 1 — Expedia Rapid API

- `HotelSearchService` in `apps/api/src/services/` — wraps Expedia Rapid API
- `GET /hotels/nearby?lat=&lng=&radiusKm=` — returns top 3–5 hotels near a point
- `HotelCard` component in `apps/web/components/` — Airbnb-style card with photo, name, rating, price, CTA
- Placement TBD based on open questions above
- Affiliate link deep-links to Expedia with affiliate tracking params

### Phase 2 — Booking.com Affiliate Partner API

- Add `BookingSearchService` alongside Expedia service
- Merge or fallback results (show Expedia if available, Booking.com if not, or blend)
- Add Booking.com affiliate tracking

## Setup Required (by user)

### Expedia Rapid API

- Apply at https://developer.expediagroup.com → Products → Rapid API
- Receive: `Partner Key` + `Shared Secret`
- Add to env: `EXPEDIA_API_KEY`, `EXPEDIA_API_SECRET`

### Booking.com Affiliate Partner API

- Apply at https://partner.booking.com → Affiliate program
- Receive: `Affiliate ID` + API credentials
- Add to env: `BOOKING_AFFILIATE_ID`, `BOOKING_API_KEY`

## Design Notes

- Cards must be visually polished — Airbnb-level quality
- Show: hero photo, hotel name, star rating, review score, price per night, distance from stop
- Clear "Sponsored / Affiliate" label for transparency
- "Book on Expedia" / "Book on Booking.com" CTA button
- Mobile-first — horizontal scroll strip on small screens
