# API (`@roadtrip/api`)

Express + tRPC + Prisma backend for RoadTrip.

## Prerequisites

- Node.js 22.x
- pnpm 9.x

## Setup

From the repository root:

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
```

Required values in `apps/api/.env`:

- `DATABASE_URL`
- `GOOGLE_MAPS_API_KEY`

Optional values:

- `PORT` (defaults to `3001`)

## Run (development)

From the repository root:

```bash
pnpm --filter @roadtrip/api dev
```

API health endpoint:

- `http://localhost:3001/health` (or your custom `PORT`)

## Database

Push Prisma schema:

```bash
pnpm --filter @roadtrip/api db:push
```

Create a local migration:

```bash
pnpm --filter @roadtrip/api db:migrate
```
