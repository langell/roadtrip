import Image from 'next/image';
import Link from 'next/link';
import { signOut } from '../../auth';
import { requireAuth } from '../../lib/session';
import Logo from '../../components/Logo';

const AccountPage = async () => {
  const session = await requireAuth('/account');
  const { name, email, image } = session.user;
  const initials = (name ?? email ?? '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-wayfarer-bg font-body text-wayfarer-text-main">
      <header className="flex h-16 items-center justify-between px-6 md:px-10">
        <Logo />
      </header>

      <main className="mx-auto w-full max-w-2xl px-6 py-12 md:px-8">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-wayfarer-text-muted">
          Account
        </p>
        <h1 className="mb-10 font-display text-3xl font-bold text-wayfarer-primary md:text-4xl">
          Your Profile
        </h1>

        <div className="rounded-2xl bg-wayfarer-surface p-6 shadow-wayfarer-soft md:p-8">
          <div className="flex items-center gap-5">
            {image ? (
              <Image
                src={image}
                alt={name ?? 'Profile photo'}
                width={64}
                height={64}
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-wayfarer-primary text-xl font-bold text-white">
                {initials}
              </span>
            )}
            <div className="min-w-0">
              {name && (
                <p className="truncate font-display text-xl font-bold text-wayfarer-primary">
                  {name}
                </p>
              )}
              {email && (
                <p className="truncate text-sm text-wayfarer-text-muted">{email}</p>
              )}
            </div>
          </div>

          <div className="mt-8 border-t border-wayfarer-accent/40 pt-6">
            <Link
              href="/trips"
              className="mb-4 flex items-center justify-between rounded-xl bg-wayfarer-primary/10 px-4 py-3 text-sm font-semibold text-wayfarer-primary transition-colors hover:bg-wayfarer-primary/20"
            >
              My Trips
              <span aria-hidden="true">→</span>
            </Link>

            <form
              action={async () => {
                'use server';
                await signOut({ redirectTo: '/' });
              }}
            >
              <button
                type="submit"
                className="text-sm font-semibold text-wayfarer-text-muted transition-colors hover:text-wayfarer-primary"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AccountPage;
