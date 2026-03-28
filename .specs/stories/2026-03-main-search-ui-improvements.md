# Main Search UI Improvements

## Status

Proposed

## Context

The current main search interface is functional but lacks user-friendly features like auto-complete, proper location formatting, and quick access to advanced options. Improving this will help users plan trips faster and with more confidence.

## Outcome

As a user planning a road trip, I want the main search interface to be more helpful and visually polished, so that I can quickly find locations, set my search radius, and discover interesting stops.

## Acceptance Criteria

- Location input provides auto-complete suggestions (Google Places or similar).
- Location input auto-capitalizes to proper case (e.g., "san francisco" → "San Francisco").
- Radius slider increments by 5 miles and defaults to 100 miles.
- Checkbox for "Smart pitstops" (AI/curated suggestions).
- Checkbox for "Photo ops" (photogenic locations).
- All controls follow the design system for spacing, color, and typography.
- Mobile and desktop layouts are both supported.

## Tasks

- [ ] Implement location input with auto-complete and capitalization.
- [ ] Update radius slider to increment by 5 and default to 100.
- [ ] Add checkboxes for Smart pitstops and Photo ops.
- [ ] Apply design system tokens and styles.
- [ ] Test on both mobile and desktop layouts.
- [ ] Reference Stitch MCP for visual direction.
- [ ] Update docs/design-system.md if new tokens are needed.

## Notes

- Reference Stitch MCP for visual direction.
- Use design tokens from `docs/design-system.md`.
- Link this spec to implementation PRs/issues for traceability.
