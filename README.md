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
   - Duplicate `.env.example` files in `apps/web`, `apps/mobile`, and `apps/api`.
   - Populate values (Vercel Postgres `DATABASE_URL`, Google Maps API keys, NextAuth secrets, etc.).
3. **Prisma**
   ```bash
   pnpm --filter @roadtrip/api db:push
   ```
4. **Development servers**
   ```bash
   pnpm dev
   ```
   Turborepo runs all `dev` scripts in parallel (`web`, `api`, `mobile`).

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
  web/      # Next.js frontend
  mobile/   # Expo React Native
  api/      # Express + tRPC + Prisma
packages/
  ui/       # Shared design system
  types/    # Zod schemas & DTOs
  config/   # ESLint/Prettier/TS presets
prisma/
  schema.prisma
```
