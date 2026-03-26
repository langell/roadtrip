# Stories Workflow

Stories are the source of truth for implementation work.

## Folder structure

- `stories/Backlog/` → all not-yet-complete stories.
- `stories/Done/` → completed stories.
- `stories/template.md` → template for new stories.
- `stories/STATUS.md` → current progress log; update after completing each story.

## Rules

1. Always pull active work from `stories/Backlog/` first.
2. If new work is discovered during implementation, create a new story in `stories/Backlog/`.
3. Keep each story focused on one outcome with explicit acceptance criteria.
4. When a story is completed:
   - mark acceptance criteria/tasks complete in the story file,
   - move the story file from `stories/Backlog/` to `stories/Done/`,
   - add an entry to `stories/STATUS.md`.
5. Keep story naming as `YYYY-MM-short-slug.md` (for example, `2026-03-trip-suggestions.md`).
