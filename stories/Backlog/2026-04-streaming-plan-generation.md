# RT-034 — Streaming Plan Generation

## Problem

Users wait 8–15 seconds staring at a spinner while the AI generates a full trip plan before anything appears. This feels slow and opaque, and causes drop-off before results are seen.

## Goal

Stream the AI response token by token so stop names and rationale appear progressively as they're generated. The perceived wait drops to near-zero — users see the first stop within ~1 second.

## Scope

### API (`apps/api`)

- Switch the `/trips/plan` route from `generateContent` (blocking) to `streamGenerateContent` (server-sent events or chunked transfer)
- Pipe the Gemini stream through to the Express response using `res.setHeader('Content-Type', 'text/event-stream')`
- Parse partial JSON chunks on the fly using a streaming JSON parser (e.g. `@streamparser/json`) and emit each complete `option` object as a discrete SSE event as soon as it's fully parsed

### Web (`apps/web`)

- Update `fetchTripPlans` in `api-client.ts` to consume an SSE stream instead of a single JSON response
- In `trip-planner.tsx`, replace the single `planOptions` state update with an incremental append: each option card renders as it arrives
- Show a subtle "Generating…" pulse on the last card while streaming is in progress
- Gracefully fall back to current behavior if streaming is unavailable

## Acceptance Criteria

- First plan option card appears within ~1–2s of submitting the form
- Remaining options appear progressively (no layout jump)
- Error handling works the same as today (bad stream → error state)
- Build passes with no regressions

## Notes

- Gemini Flash supports streaming via `streamGenerateContent` on both v1 and v1beta
- No prompt or schema changes required — only the transport layer changes
- This is purely a perceived-speed win; actual generation time is unchanged
