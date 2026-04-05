# ADR-002 — Two-Tier AI Model Routing

**Date**: 2026-03-28
**Status**: Accepted

## Context

Different operations have different quality/latency trade-offs. Initial plan generation requires the highest-quality model and benefits from retries across theme coverage. Plan refinement and simple follow-up requests can tolerate a faster, cheaper model. Using the same model everywhere wastes quota and adds latency for simple operations.

## Decision

Implement two-tier model routing in `AiTripPlannerService`:

- **Tier 1** (`GOOGLE_AI_MODEL_FAST`, default: `gemini-2.0-flash`): plan refinement, simple requests, fast path.
- **Tier 2** (`GOOGLE_AI_MODEL`, default: `gemini-2.5-flash`): initial plan generation with 3+ themes, retry attempts.

Promotion rules:

- Requests with 3 themes and zero cache hits → Tier 2 from the start.
- Requests with 1–2 themes → Tier 1 first, promote to Tier 2 on retry.
- Refinement always uses Tier 1 (with Tier 2 as fallback if key is missing).

## Consequences

- **Lower cost and latency** for the majority of requests (refinements, simple plans).
- **Maintained quality** for complex multi-theme generation via Tier 2.
- **Two env vars to manage**: `GOOGLE_AI_MODEL` and `GOOGLE_AI_MODEL_FAST`.
- **Degraded fallback**: if AI fails after all retries, the API returns partial options (minimum 2) rather than an error, keeping the user unblocked.
