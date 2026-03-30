# Story ID: RT-026 – Sign-In and Sign-Up Page

## Outcome

- Users have a dedicated, on-brand sign-in/sign-up page instead of the raw NextAuth default, and the nav "Login" and "Sign Up" buttons route to it correctly.

## Acceptance Criteria

- [ ] A `/sign-in` page exists with Google and Apple sign-in buttons matching the design system.
- [ ] Nav "Login" and "Sign Up" buttons route to `/sign-in` instead of calling `signIn()` directly.
- [ ] After successful sign-in the user is redirected back to where they came from (callbackUrl).
- [ ] Page handles loading state (e.g. while OAuth redirect is in flight).
- [ ] Page is accessible and works on mobile and desktop.

## Tasks

- [ ] Create `apps/web/app/sign-in/page.tsx` with Google and Apple sign-in buttons (owner: )
- [ ] Update `auth-controls.tsx` nav variant to link to `/sign-in` instead of calling `signIn()` directly (owner: )
- [ ] Pass `callbackUrl` so users return to the page they came from after signing in (owner: )
- [ ] Apply design system tokens — consistent with existing auth-controls styling (owner: )
- [ ] Add Playwright smoke test for sign-in page render (owner: )

## Notes

- Use `signIn('google', { callbackUrl })` and `signIn('apple', { callbackUrl })` on the page itself.
- Apple provider requires `AUTH_APPLE_ID` and `AUTH_APPLE_SECRET` — only render Apple button if the provider is configured (check via a server-side env flag or try/catch).
- Reference `components/auth-controls.tsx` for existing button styles.
