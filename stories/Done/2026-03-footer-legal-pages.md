# Story ID: RT-013 – Footer Legal Pages

## Outcome

- Visitors can access legal information directly from the footer, improving transparency and compliance readiness.

## Acceptance Criteria

- [ ] Footer `Privacy` link routes to a new privacy page.
- [ ] Footer `Terms` link routes to a new terms page.
- [ ] Legal pages include clear sectioned placeholders suitable for legal review handoff.
- [ ] Footer links no longer use placeholders for legal entries.

## Tasks

- [ ] Create `apps/web/app/privacy/page.tsx` with structured policy sections (owner: )
- [ ] Create `apps/web/app/terms/page.tsx` with structured terms sections (owner: )
- [ ] Update footer links in `apps/web/app/page.tsx` to point to `/privacy` and `/terms` (owner: )
- [ ] Add simple nav coverage in web tests for legal pages (owner: )

## Notes

- Content should be non-legal placeholder text clearly marked for later legal approval.
- Maintain accessibility semantics (`h1`, section headings, readable contrast).
