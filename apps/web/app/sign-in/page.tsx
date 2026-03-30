import Link from 'next/link';
import SignInButtons from './sign-in-buttons';

type SignInPageProps = {
  searchParams: Promise<{ callbackUrl?: string }>;
};

const SignInPage = async ({ searchParams }: SignInPageProps) => {
  const { callbackUrl } = await searchParams;
  const redirectTo = callbackUrl ?? '/';
  const showApple = !!(process.env.AUTH_APPLE_ID && process.env.AUTH_APPLE_SECRET);

  return (
    <div className="flex min-h-screen flex-col bg-wayfarer-bg font-body text-wayfarer-text-main">
      <header className="flex h-16 items-center px-6 md:px-10">
        <Link
          href="/"
          className="font-display text-2xl font-extrabold uppercase tracking-[0.2em] text-wayfarer-primary"
        >
          HipTrip
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 space-y-2">
            <h1 className="font-display text-3xl font-bold text-wayfarer-primary">
              Welcome back
            </h1>
            <p className="text-sm text-wayfarer-text-muted">
              Sign in to save trips, discover routes, and plan your next adventure.
            </p>
          </div>

          <SignInButtons callbackUrl={redirectTo} showApple={showApple} />

          <p className="mt-6 text-center text-xs text-wayfarer-text-muted">
            By continuing, you agree to our{' '}
            <Link href="/terms" className="underline hover:text-wayfarer-primary">
              Terms
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="underline hover:text-wayfarer-primary">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  );
};

export default SignInPage;
