'use client';

import { signIn, signOut, useSession } from 'next-auth/react';
import { Button } from '@roadtrip/ui';

const AuthControls = () => {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-end">
        <span className="font-body text-sm text-wayfarer-text-muted">
          Checking session…
        </span>
      </div>
    );
  }

  if (session?.user) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-3">
        <span className="font-body text-sm text-wayfarer-text-muted">
          Signed in as {session.user.name ?? session.user.email ?? session.user.id}
        </span>
        <Button
          tone="ghost"
          onClick={() => {
            void signOut();
          }}
        >
          Sign out
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
