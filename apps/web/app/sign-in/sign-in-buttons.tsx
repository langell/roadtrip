'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';

type SignInButtonsProps = {
  callbackUrl: string;
  showApple: boolean;
};

export default function SignInButtons({ callbackUrl, showApple }: SignInButtonsProps) {
  const [loading, setLoading] = useState<'google' | 'apple' | null>(null);

  const handleSignIn = async (provider: 'google' | 'apple') => {
    setLoading(provider);
    await signIn(provider, { callbackUrl });
  };

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        disabled={loading !== null}
        onClick={() => {
          void handleSignIn('google');
        }}
        className="flex w-full items-center justify-center gap-3 rounded-xl bg-wayfarer-primary px-6 py-3.5 text-sm font-bold text-white shadow-wayfarer-ambient transition hover:opacity-90 disabled:opacity-60"
      >
        {loading === 'google' ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
        ) : (
          <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
        )}
        Continue with Google
      </button>

      {showApple && (
        <button
          type="button"
          disabled={loading !== null}
          onClick={() => {
            void handleSignIn('apple');
          }}
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-wayfarer-surface-deep px-6 py-3.5 text-sm font-bold text-wayfarer-primary transition hover:bg-wayfarer-surface disabled:opacity-60"
        >
          {loading === 'apple' ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-wayfarer-primary border-t-transparent" />
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.4c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4zm-3.1-17.26c.06 2.06-1.52 3.72-3.56 3.9-.26-1.97 1.56-3.79 3.56-3.9z" />
            </svg>
          )}
          Continue with Apple
        </button>
      )}
    </div>
  );
}
