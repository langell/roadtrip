# RT-044 — Hotel Active Search (Date-Based Availability)

## Goal

Upgrade hotel cards from passive deep-links to a full date-based availability search experience, showing live prices and inventory from Expedia and Booking.com directly in the app.

## Prerequisites

- RT-043 (Hotel Affiliate Cards — passive) must be complete
- Expedia Rapid API and Booking.com Affiliate API credentials in place

## Planned Scope

- Date range picker UI (check-in / check-out)
- Guest count selector
- Live availability + pricing from Expedia Rapid API
- Booking.com as fallback/secondary source
- Filtered results (price, rating, distance)
- Deep-link CTAs that pre-fill dates on partner site
- Loading/skeleton states for async price fetches

## Design Notes

- Should feel like a lightweight hotel search embedded in the trip context
- Not a full OTA — keep it scoped to stops/route area
