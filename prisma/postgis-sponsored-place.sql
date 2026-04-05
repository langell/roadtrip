-- RT-047: PostGIS geo-distance queries for SponsoredPlace
-- Run this once against your production database.
-- Requires superuser (or a role with CREATE EXTENSION privilege) for step 1.

-- 1. Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Add geography column (safe to re-run — IF NOT EXISTS)
ALTER TABLE "SponsoredPlace"
  ADD COLUMN IF NOT EXISTS location geography(Point, 4326);

-- 3. Backfill existing rows from lat/lng columns
UPDATE "SponsoredPlace"
SET location = ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
WHERE lat IS NOT NULL
  AND lng IS NOT NULL
  AND location IS NULL;

-- 4. Add GiST index for fast ST_DWithin / ST_Distance queries
CREATE INDEX IF NOT EXISTS "SponsoredPlace_location_gist_idx"
  ON "SponsoredPlace" USING gist (location);
