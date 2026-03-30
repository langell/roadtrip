'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';

type AuthControlsProps = {
  variant?: 'default' | 'nav';
};

const AuthControls = ({ variant = 'default' }: AuthControlsProps) => {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const isNav = variant === 'nav';
  const signInHref = { pathname: '/sign-in' as const, query: { callbackUrl: pathname } };

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-end">
        <span className="font-body text-sm text-wayfarer-text-muted/90">
          Checking session…
        </span>
      </div>
    );
  }

  if (session?.user) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-3">
        <span className="font-body text-sm text-wayfarer-text-muted/90">
          Signed in as {session.user.name ?? session.user.email ?? session.user.id}
        </span>
        {isNav ? (
          <Link
            href="/account"
            className="inline-flex items-center justify-center rounded-xl bg-wayfarer-primary px-5 py-2 text-sm font-bold text-white shadow-wayfarer-ambient transition hover:opacity-90"
          >
            Account
          </Link>
        ) : (
          <button
            type="button"
            className="font-body text-sm font-semibold text-wayfarer-text-muted transition-colors hover:text-wayfarer-primary"
            onClick={() => {
              void signOut();
            }}
          >
            Sign out
          </button>
        )}
      </div>
    );
  }

  if (isNav) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-3">
        <Link
          href={signInHref}
          className="font-body text-sm font-semibold text-wayfarer-text-main transition-colors hover:text-wayfarer-primary"
        >
          Login
        </Link>
        <Link
          href={signInHref}
          className="inline-flex items-center justify-center rounded-xl bg-wayfarer-primary px-5 py-2 text-sm font-bold text-white shadow-wayfarer-ambient transition hover:opacity-90"
        >
          Sign Up
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      <Link
        href={signInHref}
        className="inline-flex items-center justify-center rounded-xl bg-wayfarer-primary px-6 py-3 text-base font-bold text-white shadow-wayfarer-ambient transition hover:opacity-90"
      >
        Continue with Google
      </Link>
    </div>
  );
};

export default AuthControls;
