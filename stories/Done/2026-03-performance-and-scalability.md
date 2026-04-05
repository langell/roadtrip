# Story ID: RT-021 – Performance and Scalability

## Outcome

- The app feels fast and responsive for users, and the backend scales with demand at any load.

## Acceptance Criteria

- [ ] API suggestion responses return in <1s p95 for typical queries.
- [ ] Caching is in place for expensive/slow API calls (Places, AI, etc.).
- [ ] Web/mobile UIs show loading states and never block the main thread.
- [ ] Performance monitoring is active (API and web) with alerting for slow endpoints.
- [ ] Performance budgets and targets are documented in `/docs/performance.md`.

## Tasks

- [ ] Add API and web performance monitoring (e.g., Vercel Analytics, custom logs) (owner: )
- [ ] Profile and optimize the slowest endpoints (add cache, parallelize where appropriate) (owner: )
- [ ] Add/verify loading skeletons for all async UI states (owner: )
- [ ] Document performance budgets and targets in `/docs/performance.md` (owner: )

## Notes

- Validate with: `pnpm --filter @roadtrip/api test && pnpm --filter @roadtrip/web test`.
