# ADR-001: Caching Strategy for Trip Suggestions

## Status

Proposed

## Context

Trip suggestion endpoints rely on third-party APIs (Google Places, AI models) that have quota, cost, and latency constraints. To ensure performance and reliability, we need a robust caching strategy.

## Decision

- Use a persistent cache (Postgres via Prisma) for trip suggestions, keyed by location, radius, and themes.
- Set a default TTL of 30 days for cache entries.
- Add engagement-based ranking to prioritize popular results.
- Expose cache/AI source metadata in API responses for transparency.
- Add diagnostics and debug flags for local testing.

## Consequences

- Reduces API costs and latency for repeated queries.
- Requires cache invalidation and monitoring.
- Enables future analytics on cache hit/miss and engagement.

---

_Created with spec-kit ADR template. Update as implementation evolves._
