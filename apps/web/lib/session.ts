/**
 * Server-side session helpers.
 *
 * Centralises all `auth()` call patterns so individual pages never import
 * from `../auth` directly for session checks.
 *
 * - `getSession()`    — safe wrapper; returns null on error (use in layout, optional checks)
 * - `getIsLoggedIn()` — boolean shorthand for pages that only need to know auth state
 * - `requireAuth()`   — redirects to sign-in if unauthenticated; returns narrowed session
 */

import { redirect } from 'next/navigation';
import { auth } from '../auth';
import type { Session } from 'next-auth';

export type AuthedSession = Session & { user: NonNullable<Session['user']> };

/** Returns the current session, or null if unauthenticated or if auth throws. */
export const getSession = async (): Promise<Session | null> => {
  try {
    return await auth();
  } catch {
    return null;
  }
};

/** Returns true if the current request has an authenticated user. */
export const getIsLoggedIn = async (): Promise<boolean> => {
  const session = await getSession();
  return !!session?.user;
};

/**
 * Ensures the current request is authenticated.
 * Redirects to `/sign-in?callbackUrl=<callbackUrl>` if not.
 * Returns the session with `user` narrowed to non-nullable.
 */
export const requireAuth = async (callbackUrl: string): Promise<AuthedSession> => {
  const session = await auth();
  if (!session?.user) {
    redirect(`/sign-in?callbackUrl=${callbackUrl}`);
  }
  return session as AuthedSession;
};

/**
 * Ensures the current request is authenticated AND has the ADMIN role.
 * Redirects to `/sign-in` if unauthenticated, or `/` if not an admin.
 */
export const requireAdmin = async (): Promise<AuthedSession> => {
  const session = await auth();
  if (!session?.user) {
    redirect('/sign-in?callbackUrl=/admin');
  }
  if (session.user.role !== 'ADMIN') {
    redirect('/');
  }
  return session as AuthedSession;
};
