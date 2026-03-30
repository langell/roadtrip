# Story ID: RT-027 – Account Page

## Outcome

- Authenticated users can view their profile and manage their account from a dedicated `/account` page, and the nav "Account" button routes there instead of signing them out.

## Acceptance Criteria

- [ ] A `/account` page exists showing the user's name/email and profile avatar (if available).
- [ ] Nav "Account" button routes to `/account` instead of triggering `signOut()` directly.
- [ ] Account page has a clearly labelled "Sign out" action.
- [ ] Unauthenticated users visiting `/account` are redirected to `/sign-in`.
- [ ] Page is accessible and works on mobile and desktop.

## Tasks

- [ ] Create `apps/web/app/account/page.tsx` with profile info and sign-out button (owner: )
- [ ] Update `auth-controls.tsx` nav variant "Account" button to link to `/account` (owner: )
- [ ] Add auth guard — redirect unauthenticated users to `/sign-in` (owner: )
- [ ] Display user avatar (next/image) if `session.user.image` is available, fallback to initials (owner: )
- [ ] Add Playwright smoke test: authenticated user sees account page, unauthenticated is redirected (owner: )

## Notes

- Use `auth()` from `apps/web/auth.ts` for server-side session check in the page component.
- Sign-out should call `signOut({ redirectTo: '/' })`.
- Depends on RT-026 (sign-in page) for the redirect target.
