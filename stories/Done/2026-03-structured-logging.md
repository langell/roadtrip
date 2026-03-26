# Story ID: RT-009 – Structured Logging Baseline

## Outcome

- Consistent, queryable JSON logs for API requests and errors to speed up debugging and incident response.

## Acceptance Criteria

- [x] API logs are JSON formatted and include `requestId`, `route`, `method`, `status`, and `latencyMs`.
- [x] Errors include stack traces and are correlated to the same `requestId`.
- [x] Log level is configurable via environment variable.
- [x] Sensitive fields are redacted from logs.

## Tasks

- [x] Choose and configure a logger in `apps/api` with JSON output (owner: )
- [x] Add request correlation middleware and pass `requestId` through handlers (owner: )
- [x] Add error logging helper used by routes/services (owner: )
- [x] Document logging behavior in API README (owner: )

## Notes

- Keep logging vendor-neutral; wire outputs to stdout for now.
- Related: `docs/design-system.md` not applicable.
