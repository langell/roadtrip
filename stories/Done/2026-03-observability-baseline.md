# Story ID: RT-010 – Observability Baseline

## Outcome

- Basic metrics and traces for the API so performance and failures can be measured over time.

## Acceptance Criteria

- [x] Request metrics capture count, error rate, and p95 latency.
- [x] Traces include the request lifecycle and upstream HTTP calls.
- [x] Telemetry export is configurable via environment variables.
- [x] Documentation explains how to enable telemetry locally.

## Tasks

- [x] Add OpenTelemetry SDK initialization in `apps/api` (owner: )
- [x] Capture HTTP server spans and outbound call spans (owner: )
- [x] Add basic metrics collection and export (owner: )
- [x] Document setup and env vars in API README (owner: )

## Notes

- Prefer OTLP exporter for traces/metrics; keep vendor neutral.
- Coordinate with `2026-03-structured-logging.md` for shared request IDs.
