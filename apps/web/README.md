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
- `NEXTAUTH_SECRET`

Optional values:

- `NEXTAUTH_URL` (defaults to `http://localhost:3000`)

## Run (development)

From the repository root:

```bash
pnpm --filter @roadtrip/web dev
```

App URL:

- `http://localhost:3000`
