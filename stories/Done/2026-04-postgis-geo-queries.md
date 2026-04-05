# Story ID: RT-047 – PostGIS Geo-Distance Queries

## Outcome

Proximity lookups (sponsored stop "nearest to trip midpoint", hotel nearby, discover popular stops) use database-level geo queries instead of fetching all records and filtering in-memory with haversine. This is a correctness and scalability issue: as the sponsored/hotel dataset grows, in-memory filtering will become slow and waste memory.

## Acceptance Criteria

- [ ] `SponsoredPlace` and any other geo-indexed models have a PostGIS `geography` or `GEOMETRY` column (or Postgres `POINT` with a GiST index).
- [ ] Proximity queries in `sponsored-router.ts` and `hotels-router.ts` use `ST_DWithin` / `ST_Distance` (or equivalent) rather than fetching all rows.
- [ ] The `haversineKm` helper in `apps/api/src/lib/haversine.ts` is removed or limited to tests/non-DB math.
- [ ] New Prisma migration adds the geo column and index.
- [ ] Integration tests verify nearest-stop selection with at least two records at different distances.

## Tasks

- [ ] Enable `postgis` extension in a new Prisma migration (`CREATE EXTENSION IF NOT EXISTS postgis`)
- [ ] Add `location GEOGRAPHY(Point, 4326)` to `SponsoredPlace` (and `TripStop` if needed); backfill from `lat`/`lng`
- [ ] Update `sponsored-router.ts` — `GET /trips/:id/sponsored-stop` and `GET /sponsored-stop/nearby` — to use `prisma.$queryRaw` with `ST_DWithin` / `ORDER BY ST_Distance`
- [ ] Update `hotels-router.ts` if it also does in-memory geo filtering
- [ ] Remove haversine distance loop from the sponsored-stop routes
- [ ] Add/update integration tests

## Notes

- Current in-memory approach: `apps/api/src/routes/sponsored-router.ts` fetches all active `SponsoredPlace` rows and filters with `haversineKm`.
- Supabase (Postgres) supports PostGIS out of the box — no extra provisioning needed if that's the DB host.
- Prisma doesn't have native PostGIS type support; use `prisma.$queryRaw` with tagged-template SQL for geo queries.
- Keep `lat` and `lng` float columns alongside the `geography` column for non-geo use (admin display, JSON serialization).
