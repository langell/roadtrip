# Story ID: RT-031 – Shareable Plan Links

## Outcome

After saving a plan, the user gets a Share button that opens the native iOS/Android share sheet (or copies to clipboard on desktop). Anyone who receives the link can view the full plan — stops, descriptions, distances — without an account.

## Acceptance Criteria

- [ ] After a plan is saved, a **Share** button appears on the plan detail page.
- [ ] Tapping Share triggers `navigator.share()` on mobile; falls back to copying the URL to clipboard on desktop.
- [ ] The shared URL is `https://hiptrip.net/s/[token]` — a short, opaque token (not the internal trip UUID).
- [ ] Visiting `/s/[token]` renders a read-only view of the plan (name, stops, stop descriptions, distances). No auth required.
- [ ] The shared view includes a **"Plan your own trip"** CTA that links back to `/`.
- [ ] The share token is stable — sharing the same trip multiple times returns the same URL.
- [ ] Share tokens do not expire (no TTL in v1).

## Technical Design

### Database

Add `shareToken` to the `Trip` model (Prisma migration):

```prisma
model Trip {
  // ... existing fields
  shareToken String? @unique
}
```

Generate with `crypto.randomBytes(9).toString('base64url')` → 12-char URL-safe string.

### API — new endpoints

**`POST /trips/:id/share`** — auth required, must own trip

- If `trip.shareToken` is already set, return it (idempotent).
- Otherwise generate a new token, write it to the DB, return `{ shareUrl }`.
- Returns `404` if trip not found or doesn't belong to the caller.

```typescript
// Response
{
  shareUrl: 'https://hiptrip.net/s/abc123xyz';
}
```

**`GET /trips/shared/:token`** — public, no auth

- Looks up trip by `shareToken`.
- Returns trip name, stops (name, description pulled from filters.rationale, lat/lng, order), location, themes.
- Returns `404` if token not found.

```typescript
// Response
{
  name: string;
  location: string;
  themes: string[];
  stops: Array<{ name: string; order: number; notes?: string }>;
}
```

### Web — API client additions

```typescript
// apps/web/lib/api-client.ts
shareTrip(tripId: string): Promise<{ shareUrl: string } | null>
getSharedTrip(token: string): Promise<SharedPlan | null>
```

### Web — plan detail changes (`apps/web/app/plan/plan-detail.tsx`)

- After successful save (`savePlanOption` returns `{ saved: true, tripId }`), show a **Share** button alongside the existing success state.
- Share button calls `shareTrip(tripId)`, then:
  - If `navigator.share` is available: `navigator.share({ title, text, url })`
  - Otherwise: `navigator.clipboard.writeText(shareUrl)` + show "Link copied!" toast

### Web — new public page (`apps/web/app/s/[token]/page.tsx`)

- Server Component, fetches `GET /trips/shared/:token` at render time.
- If token not found: renders a friendly "This plan is no longer available" message + CTA to `/`.
- If found: renders read-only plan card — name, location, themes, numbered stop list.
- No header auth controls — just the RoadTrip wordmark + "Plan your own trip →" CTA.
- `generateMetadata`: title = trip name, description = "Check out this road trip".

## Tasks

### API

- [ ] Write Prisma migration adding `shareToken String? @unique` to Trip (owner: api)
- [ ] Add `POST /trips/:id/share` endpoint — generate/return share token, require auth + ownership (owner: api)
- [ ] Add `GET /trips/shared/:token` public endpoint — return plan data, no auth (owner: api)
- [ ] Use `env.NEXT_PUBLIC_API_BASE_URL` (or a new `PUBLIC_SITE_URL` env var) to build the `shareUrl` returned by the API (owner: api)
- [ ] Add tests for both endpoints: happy path, not-found, wrong owner, idempotent re-share (owner: api)

### Web

- [ ] Add `shareTrip(tripId)` to `apps/web/lib/api-client.ts` (owner: web)
- [ ] Add `getSharedTrip(token)` and `SharedPlan` type to `apps/web/lib/api-client.ts` (owner: web)
- [ ] Add Share button to plan detail — appears after save, calls `shareTrip`, then `navigator.share` or clipboard fallback (owner: web)
- [ ] Create `apps/web/app/s/[token]/page.tsx` — public read-only plan view (owner: web)
- [ ] Add "Link copied!" feedback (brief inline message, no external toast library) (owner: web)

## Notes

- The token is generated server-side with `crypto.randomBytes(9).toString('base64url')` — 72 bits of entropy, collision-safe at this scale.
- Use `PUBLIC_SITE_URL` (e.g. `https://hiptrip.net`) in the API to build the full share URL. Add to `apps/api/src/config/env.ts` as optional, fall back to `NEXT_PUBLIC_API_BASE_URL` (strips `/api` suffix) for local dev.
- `navigator.share` requires HTTPS. On localhost it will silently skip to the clipboard fallback — test the share sheet on a real device after deploy.
- The shared page at `/s/[token]` should be indexable by search engines (no `noindex`) — this is free organic traffic.
- Stop descriptions: the `stops` table has `name`, `lat`, `lng`, `notes` but not a description field. The shared view can use `notes` if present and omit descriptions otherwise. Full stop details (descriptions, images) would require resolving against Google Places — out of scope for v1, noted for RT-029.
