# Story ID: RT-007 – Reliability and Deployment Hardening

## Outcome

- Web/API deployments are predictable and resilient, with fewer runtime surprises and clearer operational behavior.

## Acceptance Criteria

- [ ] Vercel project configuration for web is stable and reproducible in repo config.
- [ ] API deployment path is defined and validated separately from web.
- [ ] Required env vars are validated at startup with actionable errors.
- [ ] Critical endpoints have baseline health/readiness checks.
- [ ] CI/build checks reliably catch config regressions.

## Tasks

- [ ] Finalize and document Vercel web settings (`root`, build/install/output) (owner: Platform).
- [ ] Define API deployment target/config and runbook (owner: Platform).
- [ ] Tighten env parsing/docs for web/mobile/api required vars (owner: API/Web/Mobile).
- [ ] Add/verify health and readiness checks for API (owner: API).
- [ ] Add CI checks for build/lint/test and lockfile correctness (owner: Platform).

## Notes

- Prior incidents: lockfile tracking, output directory mismatch, root directory mismatch.
- Keep runbooks concise in root README + app READMEs.
