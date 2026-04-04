'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import ProfileDropdown from './ProfileDropdown';

type AuthControlsProps = {
  variant?: 'default' | 'nav';
};

const AuthControls = ({ variant = 'default' }: AuthControlsProps) => {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const isNav = variant === 'nav';
  const signInHref = { pathname: '/sign-in' as const, query: { callbackUrl: pathname } };

  if (status === 'loading') {
    return <div className="h-9 w-9 rounded-full bg-wayfarer-surface animate-pulse" />;
  }

  if (session?.user) {
    const initials = (session.user.name ?? session.user.email ?? '?')
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

    const avatar = (
      <Link
        href="/account"
        aria-label="Your account"
        className="group relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-2 ring-wayfarer-primary/30 hover:ring-wayfarer-primary transition-all overflow-hidden"
      >
        {session.user.image ? (
          <Image
            src={session.user.image}
            alt={session.user.name ?? 'Profile'}
            fill
            className="object-cover"
            sizes="36px"
          />
        ) : (
          <span className="bg-wayfarer-primary text-white font-body text-xs font-bold w-full h-full flex items-center justify-center">
            {initials}
          </span>
        )}
      </Link>
    );

    if (isNav) return <ProfileDropdown />;

    return (
      <div className="flex items-center justify-end gap-3">
        {avatar}
        <button
          type="button"
          className="font-body text-sm font-semibold text-wayfarer-text-muted transition-colors hover:text-wayfarer-primary"
          onClick={() => {
            void signOut();
          }}
        >
          Sign out
        </button>
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
