'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';

export default function ProfileDropdown() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (status === 'loading') {
    return <div className="h-9 w-9 animate-pulse rounded-full bg-wayfarer-surface" />;
  }

  if (!session?.user) return null;

  const { name, email, image } = session.user;
  const initials = (name ?? email ?? '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="relative" ref={containerRef}>
      {/* Avatar trigger */}
      <button
        type="button"
        aria-label="Your account"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 ring-wayfarer-primary/30 transition-all hover:ring-wayfarer-primary"
      >
        {image ? (
          <Image
            src={image}
            alt={name ?? 'Profile'}
            fill
            className="object-cover"
            sizes="36px"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-wayfarer-primary font-body text-xs font-bold text-white">
            {initials}
          </span>
        )}
      </button>

      {/* Dropdown card */}
      {open && (
        <div className="absolute right-0 top-12 z-50 w-72 overflow-hidden rounded-2xl bg-wayfarer-surface shadow-wayfarer-ambient ring-1 ring-black/[0.06]">
          {/* Header */}
          <div className="flex flex-col items-center gap-3 px-6 pb-5 pt-6">
            <div className="relative h-16 w-16 overflow-hidden rounded-full ring-2 ring-wayfarer-primary/30">
              {image ? (
                <Image
                  src={image}
                  alt={name ?? 'Profile'}
                  fill
                  className="object-cover"
                  sizes="64px"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-wayfarer-primary font-body text-xl font-bold text-white">
                  {initials}
                </span>
              )}
            </div>
            {name && (
              <p className="font-display text-lg font-bold text-wayfarer-text-main">
                Hi, {name.split(' ')[0]}!
              </p>
            )}
            {email && <p className="text-xs text-wayfarer-text-muted">{email}</p>}
          </div>

          {/* Actions */}
          <div className="border-t border-wayfarer-accent/20 px-4 py-3 flex flex-col gap-1">
            <Link
              href="/trips"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold text-wayfarer-text-main transition-colors hover:bg-wayfarer-bg"
            >
              My Trips
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4 text-wayfarer-text-muted"
              >
                <path
                  fillRule="evenodd"
                  d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z"
                  clipRule="evenodd"
                />
              </svg>
            </Link>
            <button
              type="button"
              onClick={() => void signOut({ callbackUrl: '/' })}
              className="flex w-full items-center rounded-xl px-4 py-3 text-sm font-semibold text-wayfarer-text-muted transition-colors hover:bg-wayfarer-bg hover:text-wayfarer-text-main"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
