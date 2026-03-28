# Main Search UI Improvements

## Story

As a user planning a road trip, I want the main search interface to be more helpful and visually polished, so that I can quickly find locations, set my search radius, and discover interesting stops.

### Acceptance Criteria

- **Location Input**
  - Provides auto-complete suggestions as the user types (using Google Places or similar).
  - Automatically updates the capitalization of the location to proper case (e.g., "san francisco" → "San Francisco").

- **Radius Slider**
  - Increments in steps of 5 miles.
  - Defaults to 100 miles on load.

- **Additional Options**
  - Checkbox: "Smart pitstops" (enables AI/curated stop suggestions).
  - Checkbox: "Photo ops" (enables search for photogenic locations).

- **UI/UX**
  - All controls follow the design system for spacing, color, and typography.
  - Mobile and desktop layouts are both supported.

### Notes

- Reference Stitch MCP for visual direction.
- Use design tokens from `docs/design-system.md`.
- Add this story to the Backlog and update `stories/STATUS.md` after completion.
