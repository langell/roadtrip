# Story ID: RT-018 – Main Search UI Improvements

## Outcome

- Users planning a road trip can quickly find locations, set their search radius, and discover interesting stops through a more helpful and visually polished search interface.

## Acceptance Criteria

- [x] Location input provides auto-complete suggestions as the user types (Google Places or similar).
- [x] Location input automatically formats text to proper case (e.g., "san francisco" → "San Francisco").
- [x] Radius slider increments in steps of 5 miles and defaults to 100 miles on load.
- [x] Checkbox for "Smart pitstops" enables AI/curated stop suggestions.
- [x] Checkbox for "Photo ops" enables search for photogenic locations.
- [x] All controls follow the design system for spacing, color, and typography.
- [x] Mobile and desktop layouts are both supported.

## Tasks

- [x] Implement location input with auto-complete and proper-case formatting (owner: )
- [x] Update radius slider to increment by 5 and default to 100 miles (owner: )
- [x] Add "Smart pitstops" and "Photo ops" checkboxes (owner: )
- [x] Apply design system tokens and styles to all controls (owner: )
- [x] Verify layout on mobile and desktop (owner: )

## Notes

- Reference Stitch MCP for visual direction.
- Use design tokens from `docs/design-system.md`.
- Validate with: `pnpm --filter @roadtrip/web test`.
