# Story ID: RT-028 – Smart Pit-Stops and Photo Ops Filter Toggles

## Outcome

- Travelers can activate Smart Pit-Stops and Photo Ops modifiers to shape the character of their generated trip, and the toggles feel polished and native to the design system.

## Acceptance Criteria

- [x] Smart Pit-Stops toggle adds practical road trip stops (fuel, coffee, rest) woven naturally into the generated itinerary options.
- [x] Photo Ops toggle biases the AI toward photogenic/scenic locations (overlooks, murals, golden-hour viewpoints).
- [x] Both modifiers stack additively with selected themes.
- [x] Modifiers are optional — either or both can be active independently of theme selection.
- [x] The UI replaces HTML checkboxes with pill/switch toggles styled to match the design system.
- [x] Toggle state is included in the `POST /trips/plan` request payload as `modifiers`.
- [x] The API prompt incorporates active modifiers as additive instructions without overriding theme guidance.
- [x] Existing behavior is unchanged when neither modifier is active.

## Tasks

### API

- [x] Add optional `modifiers?: { smartPitstops?: boolean; photoOps?: boolean }` to the `/trips/plan` Zod schema in `server.ts`.
- [x] Extend `AiTripPlannerService.generatePlans` with `buildModifierPrompt` — injected between theme guidance and hard requirements.

### Web

- [x] Replace `<input type="checkbox">` with pill toggle buttons (`role="switch"`) in `trip-planner.tsx`.
- [x] Include `modifiers` in `fetchTripPlans` call when either toggle is active.
- [x] Update `fetchTripPlans` signature in `api-client.ts` to accept `modifiers`.

## Notes

- Modifier prompt additions:
  - `smartPitstops`: practical stops — coffee, scenic fuel, roadside stretch
  - `photoOps`: visual character — overlooks, murals, iconic backdrops, photography spots
- Toggle uses `role="switch"` + `aria-checked` for accessibility. Active state: `bg-wayfarer-secondary`. Inactive: `bg-wayfarer-surface-deep`.
