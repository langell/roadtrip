# Story ID: RT-011 – Footer Company Pages

## Outcome

- Visitors can open dedicated company pages from the footer to learn about HipTrip and trust the brand.

## Acceptance Criteria

- [ ] Footer `About` link routes to a new web page with company overview content.
- [ ] Footer `Journal` link routes to a new web page with journal placeholder/listing content.
- [ ] New pages use shared design tokens and follow `docs/design-system.md` typography, spacing, and color rules.
- [ ] Footer links no longer point to placeholders for these entries.

## Tasks

- [ ] Create `apps/web/app/about/page.tsx` with brand-aligned content scaffold (owner: )
- [ ] Create `apps/web/app/journal/page.tsx` with article index scaffold (owner: )
- [ ] Update footer links in `apps/web/app/page.tsx` to point to `/about` and `/journal` (owner: )
- [ ] Add/adjust web test coverage for navigation to new pages (owner: )

## Notes

- Keep implementation minimal MVP content; avoid adding features not required by footer navigation.
- Align page shell with current HipTrip homepage visual language.
