# RT-038 — Personalization from Saved Trips

## Problem

Every user gets the same generic AI prompt regardless of their history. A user who consistently saves 4-stop foodie routes gets the same suggestions as a first-time user. The AI has no context about individual preferences.

## Goal

When a user has saved trips, extract their preference patterns and inject a personalization hint into the AI prompt. Low token cost (~50 extra tokens), measurable relevance improvement.

## Scope

### Preference extraction (`apps/api`)

- New helper: `getUserPreferences(userId)` — queries the user's saved trips and extracts:
  - Most common themes (from `Trip.filters`)
  - Average stop count
  - Preferred radius range
  - Any recurring stop types (from stop names via keyword matching)
- Returns a short natural-language summary: `"This user tends to prefer foodie + scenic trips with 3–4 stops in a 30km radius."`

### Prompt injection in `AiTripPlannerService`

- Accept optional `userPreferences?: string` in `generatePlans()` input
- Append to system prompt: `"User context: ${userPreferences}. Weight suggestions toward these preferences but don't restrict creativity."`
- Only inject when preferences are available (≥2 saved trips)

### API route update (`/trips/plan`)

- If user is authenticated (`getRequestUserId`), fetch preferences and pass to planner
- Anonymous users get the current generic prompt

## Acceptance Criteria

- Authenticated users with ≥2 saved trips get personalized prompts
- Anonymous and new users get unchanged behavior
- Preference extraction adds <50ms to request time (single indexed query)
- Personalization hint is ≤80 tokens
- No regression in plan quality for users without history

## Notes

- Don't over-constrain the AI — preferences are hints, not hard filters
- Start with theme + stop count; add more signals in a future iteration
- This story intentionally avoids a dedicated preferences table — derive everything from existing Trip/TripStop data
