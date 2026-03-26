# RoadTrip Monorepo

Production-grade Turborepo powering the RoadTrip platform across web, mobile, and API surfaces.

## Stack Overview

- **Web**: Next.js 14 (App Router) + Tailwind + NextAuth
- **Mobile**: Expo (React Native 0.74) + React Navigation
- **API**: Node.js + Express + tRPC + Prisma (Vercel Postgres)
- **Shared**: Zod schemas (`@roadtrip/types`), design system (`@roadtrip/ui`), unified lint/prettier configs

## Getting Started

1. **Install dependencies**
   ```bash
   corepack enable
   pnpm install
   ```
2. **Environment variables**

   ```bash
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env.local
   ```

   - Fill in required values:
     - `apps/api/.env`: `DATABASE_URL`, `GOOGLE_MAPS_API_KEY` (optional `PORT`, defaults to `3001`)
   - `apps/web/.env.local`: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `NEXTAUTH_SECRET` (optional `NEXTAUTH_URL`, defaults to `http://localhost:3000`)
   - Google Cloud requirements for `GOOGLE_MAPS_API_KEY`:
     - Enable `Geocoding API` and `Places API (New)`.
     - Allow `Places API (New)` method `places:searchText` for this key via API restrictions.
     - Ensure billing is enabled for the Google Cloud project.

3. **Prisma (API)**
   ```bash
   pnpm --filter @roadtrip/api db:push
   ```
4. **Run backend only (API)**
   ```bash
   pnpm --filter @roadtrip/api dev
   ```
   API runs at `http://localhost:3001` (or `PORT` from `apps/api/.env`).
5. **Run frontend only (Web)**
   ```bash
   pnpm --filter @roadtrip/web dev
   ```
   Web runs at `http://localhost:3000`.
6. **Run all apps together (optional)**
   ```bash
   pnpm dev
   ```
   Turborepo runs `web`, `api`, and `mobile` dev servers in parallel.

## Testing & Quality

- `pnpm lint` – ESLint via shared config
- `pnpm test` – Runs Vitest/Jest/Playwright suites per package
- Husky + lint-staged guard commits
- Playwright config lives in `apps/web`

## Deployment Notes

- Web + Edge functions deploy on Vercel
- API deploys as Vercel serverless or container on Railway/Fly (depends on env)
- Mobile delivered via Expo EAS

## Project Layout

```
apps/
   web/      # Next.js frontend (see `apps/web/README.md`)
   mobile/   # Expo React Native
   api/      # Express + tRPC + Prisma (see `apps/api/README.md`)
packages/
  ui/       # Shared design system
  types/    # Zod schemas & DTOs
  config/   # ESLint/Prettier/TS presets
prisma/
  schema.prisma
```
