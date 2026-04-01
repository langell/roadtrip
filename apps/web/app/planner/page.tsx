import { Suspense } from 'react';
import Link from 'next/link';
import { Surface } from '@roadtrip/ui';
import TripPlanner from '../../components/trip-planner';
import AuthControls from '../../components/auth-controls';

type PlannerPageProps = {
  searchParams: Promise<{ location?: string }>;
};

const PlannerPage = async ({ searchParams }: PlannerPageProps) => {
  const { location } = await searchParams;

  return (
    <div className="min-h-screen bg-wayfarer-bg font-body text-wayfarer-text-main antialiased">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between bg-wayfarer-bg/90 px-6 backdrop-blur-sm md:px-10">
        <Link
          href="/"
          className="font-display text-2xl font-extrabold uppercase tracking-[0.2em] text-wayfarer-primary"
        >
          HipTrip
        </Link>
        <nav className="flex items-center gap-6">
          <Link
            href="/trips"
            className="hidden text-sm font-semibold text-wayfarer-text-muted transition-colors hover:text-wayfarer-primary sm:block"
          >
            My Trips
          </Link>
          <AuthControls variant="nav" />
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-10 md:px-8">
        <div className="mb-6 space-y-2">
          <p className="font-body text-xs uppercase tracking-[0.18em] text-wayfarer-text-muted">
            Route Builder
          </p>
          <h1 className="font-display text-2xl font-bold text-wayfarer-primary md:text-3xl">
            Plan your next drive
          </h1>
        </div>
        <Surface
          elevation="raised"
          className="bg-gradient-to-br from-wayfarer-surface to-wayfarer-surface-deep"
        >
          <Suspense
            fallback={
              <p className="p-6 text-sm text-wayfarer-text-muted">Loading planner…</p>
            }
          >
            <TripPlanner initialLocation={location} />
          </Suspense>
        </Surface>
      </main>
    </div>
  );
};

export default PlannerPage;
