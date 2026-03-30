# Web (`@roadtrip/web`)

Next.js frontend for RoadTrip.

## Prerequisites

- Node.js 22.x
- pnpm 9.x

## Setup

From the repository root:

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local
```

Required values in `apps/web/.env.local`:

- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — enable **Maps JavaScript API** and **Places API (New)** in Google Cloud Console; restrict the key to HTTP referrers for your domain.
- `NEXT_PUBLIC_API_BASE_URL` — base URL of the API server (e.g. `http://localhost:3001` locally, `https://api.hiptrip.net` in production).
- `AUTH_SECRET` — random secret used to sign NextAuth JWTs; generate with `openssl rand -base64 32`.
- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` — Google OAuth 2.0 credentials; create at [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials → OAuth 2.0 Client. Add `http://localhost:3000/api/auth/callback/google` (dev) and `https://yourdomain.com/api/auth/callback/google` (prod) as authorized redirect URIs.

Optional values:

- `NEXTAUTH_URL` — set to your production domain (e.g. `https://hiptrip.net`); required when `AUTH_SECRET` is set and the host can't be inferred.
- `NEXTAUTH_SECRET` — legacy alias for `AUTH_SECRET`.
- `AUTH_APPLE_ID` / `AUTH_APPLE_SECRET` — Apple Sign In credentials; Apple button only appears when both are set.
- `NEXT_PUBLIC_TRIP_PLAN_SOURCE_BADGE` (`dev` | `always` | `never`; defaults to `dev`)

## Run (development)

From the repository root:

```bash
pnpm --filter @roadtrip/web dev
```

App URL:

- `http://localhost:3000`
