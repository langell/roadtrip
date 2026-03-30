# Story ID: RT-020 – Security Best Practices

## Outcome

- User data and platform secrets are protected, and security concerns are consistently reviewed before each release.

## Acceptance Criteria

- [ ] All secrets are stored in environment variables — never in code or public config.
- [ ] API endpoints are protected by authentication and authorization checks.
- [ ] Rate limiting is enforced for anonymous endpoints.
- [ ] Sensitive data is never logged or exposed to clients.
- [ ] A security checklist is reviewed before each release.

## Tasks

- [ ] Audit all env var usage and secrets handling (owner: )
- [ ] Add/verify rate limiting middleware for public endpoints (owner: )
- [ ] Add/verify auth guards for all sensitive routes (owner: )
- [ ] Add a pre-release security checklist to `/docs/security.md` (owner: )

## Notes

- Validate with: `pnpm --filter @roadtrip/api test`.
