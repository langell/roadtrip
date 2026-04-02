# RT-039 — "Refine This Plan" Flow

## Problem

If a user likes a plan but wants one change ("swap the brewery for a coffee shop" or "add a lunch stop"), they have to regenerate from scratch — full latency, full cost, and they lose the parts they liked.

## Goal

Let users send a natural-language edit instruction against an existing plan. The AI returns a modified version of the same plan. Far fewer tokens than a full generation, preserves user context.

## Scope

### API (`apps/api`)

- New endpoint: `POST /trips/refine-plan`
  - Body: `{ planOption: TripPlanOption, instruction: string, location: string, themes: string[] }`
  - Sends the existing option + instruction to the AI: `"Here is an existing trip plan: [plan]. The user wants to: [instruction]. Return a modified version of this plan with minimal changes."`
  - Returns a single `TripPlanOption` (not an array)
  - Uses Tier 1 model (cheap/fast — this is a small targeted edit)
  - No cache write for refinements

### Web (`apps/web/components/trip-planner.tsx`)

- Add a "Refine" button on each plan option card (pencil icon)
- Opens an inline text input: `"What would you like to change?"`
- On submit, calls the new endpoint and replaces that card's content in-place
- Loading state on the card being refined
- "Undo" restores the previous version (keep prior option in state)

## Acceptance Criteria

- Refine button appears on each generated plan card
- Submitting an instruction updates that card without affecting others
- Response time is noticeably faster than full generation
- Undo works (one level deep)
- Empty instruction is a no-op
- Works for both cached and AI-generated original plans

## Notes

- Keep the instruction input short (max 200 chars) to bound token usage
- The AI should only modify 1–2 stops per refinement to avoid full regeneration behavior
- This feature unlocks a conversational planning loop without requiring a full chat interface
