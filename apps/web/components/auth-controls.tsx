'use client';

import { signIn, signOut, useSession } from 'next-auth/react';
import { Button } from '@roadtrip/ui';

type AuthControlsProps = {
  variant?: 'default' | 'nav';
};

const AuthControls = ({ variant = 'default' }: AuthControlsProps) => {
  const { data: session, status } = useSession();
  const isNav = variant === 'nav';

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
        <Button
          tone={isNav ? 'primary' : 'ghost'}
          className={isNav ? 'px-5 py-2 text-sm font-bold' : undefined}
          onClick={() => {
            void signOut();
          }}
        >
          {isNav ? 'Account' : 'Sign out'}
        </Button>
      </div>
    );
  }

  if (isNav) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-3">
        <button
          type="button"
          className="font-body text-sm font-semibold text-wayfarer-text-main transition-colors hover:text-wayfarer-primary"
          onClick={() => {
            void signIn('google');
          }}
        >
          Login
        </button>
        <Button
          tone="primary"
          className="px-5 py-2 text-sm font-bold"
          onClick={() => {
            void signIn('google');
          }}
        >
          Sign Up
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      <Button
        tone="primary"
        onClick={() => {
          void signIn('google');
        }}
      >
        Continue with Google
      </Button>
      <Button
        tone="ghost"
        onClick={() => {
          void signIn('apple');
        }}
      >
        Continue with Apple
      </Button>
    </div>
  );
};

export default AuthControls;
