# Story ID: RT-012 – Footer Product Pages

## Outcome

- Visitors can navigate from footer product links to clear product-focused pages that explain key capabilities.

## Acceptance Criteria

- [ ] Footer `Route Planner` link routes to a product page describing planning workflow and value.
- [ ] Footer `Offline Maps` link routes to a product page describing offline map capabilities and use cases.
- [ ] New pages use existing app layout patterns and Tailwind theme tokens only.
- [ ] Footer links no longer use placeholders for these entries.

## Tasks

- [ ] Create `apps/web/app/product/route-planner/page.tsx` (owner: )
- [ ] Create `apps/web/app/product/offline-maps/page.tsx` (owner: )
- [ ] Update footer links in `apps/web/app/page.tsx` to point to new routes (owner: )
- [ ] Add/adjust Playwright smoke coverage for product footer navigation (owner: )

## Notes

- Keep copy concise and consistent with current homepage tone.
- Reuse shared components where possible; avoid introducing unrelated new UI primitives.
