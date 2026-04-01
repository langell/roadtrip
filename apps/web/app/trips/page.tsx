import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '../../auth';
import { getMyTrips } from '../../lib/api-client';

const TripsPage = async () => {
  const session = await auth();

  if (!session?.user) {
    redirect('/sign-in?callbackUrl=/trips');
  }

  const trips = await getMyTrips();

  return (
    <div className="min-h-screen bg-wayfarer-bg font-body text-wayfarer-text-main">
      <header className="flex h-16 items-center justify-between px-6 md:px-10">
        <Link
          href="/"
          className="font-display text-2xl font-extrabold uppercase tracking-[0.2em] text-wayfarer-primary"
        >
          RoadTrip
        </Link>
        <Link
          href="/account"
          className="font-body text-sm font-semibold text-wayfarer-text-muted transition-colors hover:text-wayfarer-primary"
        >
          Account
        </Link>
      </header>

      <main className="mx-auto w-full max-w-2xl px-6 py-12 md:px-8">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-wayfarer-text-muted">
          Saved
        </p>
        <h1 className="mb-10 font-display text-3xl font-bold text-wayfarer-primary md:text-4xl">
          My Trips
        </h1>

        {trips.length === 0 ? (
          <div className="rounded-2xl bg-wayfarer-surface p-8 text-center shadow-wayfarer-soft">
            <p className="mb-6 text-wayfarer-text-muted">No saved trips yet.</p>
            <Link
              href="/plan"
              className="inline-flex items-center justify-center rounded-xl bg-wayfarer-primary px-6 py-3 text-base font-bold text-white shadow-wayfarer-ambient transition hover:opacity-90"
            >
              Plan a Trip
            </Link>
          </div>
        ) : (
          <ul className="space-y-4">
            {trips.map((trip) => (
              <li
                key={trip.id}
                className="rounded-2xl bg-wayfarer-surface p-6 shadow-wayfarer-soft"
              >
                <div className="mb-1 flex items-start justify-between gap-3">
                  <p className="font-display text-lg font-bold text-wayfarer-primary">
                    {trip.name}
                  </p>
                  {trip.stops.length > 0 && (
                    <Link
                      href={{ pathname: '/trips/[id]/map', query: { id: trip.id } }}
                      className="shrink-0 rounded-lg bg-wayfarer-primary/10 px-3 py-1 text-xs font-semibold text-wayfarer-primary transition hover:bg-wayfarer-primary hover:text-white"
                    >
                      Map View
                    </Link>
                  )}
                </div>
                <p className="mb-3 text-sm text-wayfarer-text-muted">
                  {trip.stops.length} stop{trip.stops.length !== 1 ? 's' : ''} &middot;{' '}
                  {new Date(trip.createdAt).toLocaleDateString()}
                </p>
                {trip.stops.length > 0 && (
                  <ol className="space-y-1">
                    {trip.stops.map((stop) => (
                      <li key={stop.id} className="flex items-start gap-2 text-sm">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-wayfarer-primary/15 text-xs font-bold text-wayfarer-primary">
                          {stop.order + 1}
                        </span>
                        <span className="text-wayfarer-text-main">{stop.name}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
};

export default TripsPage;
