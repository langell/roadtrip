# Story ID: RT-008 – Stitch-to-Web Audit and Gap Map

## Outcome

- The team has a clear, prioritized gap map between Stitch MCP screens and the current `apps/web` UI so implementation can happen without guesswork.

## Acceptance Criteria

- [x] All relevant Stitch MCP screens for web are inventoried with screen IDs and mapped to current `apps/web` routes/components.
- [x] A gap matrix exists covering layout, hierarchy, copy, spacing, component usage, and interaction differences.
- [x] Gaps are prioritized (P0/P1/P2) with explicit implementation order and estimated blast radius.
- [x] The audit references `docs/design-system.md` as the tie-breaker when style conflicts exist.

## Tasks

- [x] Pull Stitch project + web screen inventory and capture source screen IDs in story notes.
- [x] Create a side-by-side route/component mapping for `apps/web/app/page.tsx` and key UI modules.
- [x] Document visual and UX deltas with concrete examples and classify severity.
- [x] Produce a sequenced implementation plan that minimizes regressions and merge conflicts.

## Notes

- Stitch project used: `projects/9559669237004155255` (RoadTrip Product Document).
- Design token authority: `docs/design-system.md` (Wayfarer Design System) + project theme metadata in Stitch.

### Screen Inventory (Web-Relevant)

- `projects/9559669237004155255/screens/ef011faa0e204c73a12a40ade6c104c8` — Home Screen (mobile variant A)
- `projects/9559669237004155255/screens/3aadc2d1dec94de2b23a95052dc45d9a` — Home Screen (mobile variant B)
- `projects/9559669237004155255/screens/5a00e907c6d94a8b9b807e1467f72bcd` — Trip Planner Form
- `projects/9559669237004155255/screens/c8c8cb4883c54e55b13cab5874b98190` — Trip Planner Form (variant)
- `projects/9559669237004155255/screens/0138ea8f86a14143b67d3b1881c5f7a8` — Loading Ideas
- `projects/9559669237004155255/screens/27f64fc9d9a3406d9b72809889197275` — Loading Ideas (variant)
- `projects/9559669237004155255/screens/3527bd13f1d64749bdb74574b0d902ef` — Suggested Stops
- `projects/9559669237004155255/screens/ab3700c229184b24b7c12740e4e8fb86` — Suggested Stops (variant)
- `projects/9559669237004155255/screens/861424b84b6f45fb99ddf8cca18689d5` — Stop Details
- `projects/9559669237004155255/screens/56bf6453834d44ecafc19a25694c49d4` — Stop Details (variant)

### Route / Component Mapping

- `apps/web/app/page.tsx`
  - Maps to Home Screen + section composition from planner/loading/suggested states.
- `apps/web/components/trip-planner.tsx`
  - Maps to Trip Planner Form, Loading Ideas, and Suggested Stops behavior blocks.
- `apps/web/components/auth-controls.tsx`
  - Maps to home-header auth CTA region.
- `apps/web/components/hero-phrase.tsx`
  - Maps to hero headline treatment/copy behavior on home.
- `apps/web/lib/api-client.ts`
  - Supports loading/suggestions states represented in Stitch screens.

### Gap Matrix

| Area                               | Current Web                                          | Stitch Direction                                               | Priority | Blast Radius                                         |
| ---------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------- | -------- | ---------------------------------------------------- |
| Layout composition                 | Single-column flow with basic section spacing        | Editorial asymmetry, layered surfaces, stronger section rhythm | P0       | Medium (`app/page.tsx`, planner layout)              |
| Typography hierarchy               | Uses default utility scales; mixed styles            | Display/headline emphasis with Wayfarer scale and rhythm       | P0       | Medium (`page.tsx`, headings/captions)               |
| Token usage                        | Contains hard-coded values and partial palette usage | Strict tokenized palette/surface hierarchy from design system  | P0       | High (`page.tsx`, `trip-planner.tsx`, UI primitives) |
| Loading state fidelity             | Basic fallback text                                  | Explicit loading card/skeleton presentation                    | P1       | Low (`trip-planner.tsx`)                             |
| Suggested stop cards               | Functional cards with image/text                     | Higher-fidelity card hierarchy and spacing cadence             | P1       | Medium (`trip-planner.tsx`)                          |
| Auth CTA placement                 | Utility-aligned controls                             | More integrated hero/nav visual treatment                      | P2       | Low (`auth-controls.tsx`)                            |
| Micro-polish (glass/ambient depth) | Minimal depth and overlap effects                    | Tonal layering + selective ambient polish                      | P2       | Medium (page-level styles)                           |

### Recommended Implementation Order

1. **P0 Token + Typography Baseline** (`RT-009`): normalize colors/type/spacing into token-compliant usage.
2. **P0 Layout Parity** (`RT-010`): align home/planner structure to Stitch composition.
3. **P1 Stateful UI Parity** (`RT-010`): implement loading/suggested-card hierarchy parity.
4. **P2 Auth + Visual Polish** (follow-up): refine CTA placement and depth effects after core parity is stable.

### Scope Guardrails

- Keep this story analysis-only; implementation occurs in `RT-009` and `RT-010`.
- Where Stitch and code conflict, apply `docs/design-system.md` as tie-breaker.
