# RT-045 — Legal & Support Pages (ToS, Privacy, Support, FAQ)

## Goal

Create static informational pages for Terms of Service, Privacy Policy, Support, and FAQ — and surface links to them in the app footer and any relevant onboarding/auth flows.

## Pages

| Route      | Title            |
| ---------- | ---------------- |
| `/terms`   | Terms of Service |
| `/privacy` | Privacy Policy   |
| `/support` | Support          |
| `/faq`     | FAQ              |

## Planned Scope

### Pages (`apps/web/app/`)

- `app/terms/page.tsx` — Terms of Service (static content, last-updated date)
- `app/privacy/page.tsx` — Privacy Policy (static content, last-updated date)
- `app/support/page.tsx` — Support page: contact email, link to FAQ, possibly a simple contact form
- `app/faq/page.tsx` — FAQ page: accordion-style Q&A covering common trip planning questions

All pages are Server Components, statically rendered, no auth required.

### Footer component

- Create or update a shared `Footer` component that renders links to all four pages
- Footer appears on: home/landing page, plan results, shared trip view, saved trips
- Keep it minimal — just the links + copyright line

### Open Questions

- [ ] Do we have finalized ToS and Privacy Policy copy, or use placeholder?
- [ ] Should Support include a contact form, or just an email link for now?
- [ ] Is there a specific FAQ list to seed, or start with common questions?

## Design Notes

- Pages use the same `wayfarer-*` token palette as the rest of the app
- Simple, readable layout — max-w-prose centered, good line height
- On mobile, footer links stack vertically or wrap naturally
