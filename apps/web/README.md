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

- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- `AUTH_SECRET` (preferred)
- `AUTH_GOOGLE_ID` (Google OAuth client ID)
- `AUTH_GOOGLE_SECRET` (Google OAuth client secret)
- `AUTH_APPLE_ID` (Apple Services ID)
- `AUTH_APPLE_SECRET` (Apple client secret)

Optional values:

- `NEXTAUTH_URL` (defaults to `http://localhost:3000`)
- `NEXTAUTH_SECRET` (legacy alias for `AUTH_SECRET`)
- `NEXT_PUBLIC_API_BASE_URL` (defaults to `http://localhost:3001` in development and `https://hoptrip.net` in production)

## Run (development)

From the repository root:

```bash
pnpm --filter @roadtrip/web dev
```

App URL:

- `http://localhost:3000`
