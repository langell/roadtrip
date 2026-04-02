import Link from 'next/link';
import Image from 'next/image';
import { requireAuth } from '../../lib/session';
import { getMyTripsServer } from '../../lib/server-api-client';
import Logo from '../../components/Logo';
import TripCardActions from '../../components/TripCardActions';
import type { SavedTrip } from '../../lib/api-client';

const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
const MAX_VISIBLE_STOPS = 3;

async function getFirstStopPhotoUrl(placeId: string): Promise<string | null> {
  if (!MAPS_API_KEY) return null;
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=photos&key=${MAPS_API_KEY}`,
      { next: { revalidate: 86400 } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      result?: { photos?: { photo_reference: string }[] };
    };
    const ref = data.result?.photos?.[0]?.photo_reference;
    if (!ref) return null;
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=600&photo_reference=${encodeURIComponent(ref)}&key=${MAPS_API_KEY}`;
  } catch {
    return null;
  }
}

type TripWithPhoto = SavedTrip & { photoUrl: string | null };

async function enrichTripsWithPhotos(trips: SavedTrip[]): Promise<TripWithPhoto[]> {
  const results = await Promise.allSettled(
    trips.map(async (trip) => {
      const sorted = trip.stops.slice().sort((a, b) => a.order - b.order);
      const firstStop = sorted[0];
      const photoUrl = firstStop ? await getFirstStopPhotoUrl(firstStop.placeId) : null;
      return { ...trip, photoUrl };
    }),
  );
  return results.map((r, i) => {
    const fallback = trips[i] ?? trips[0];
    return r.status === 'fulfilled' ? r.value : { ...fallback, photoUrl: null };
  });
}

function getInitials(name?: string | null, email?: string | null): string {
  const src = name ?? email ?? '?';
  return src
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

const TripsPage = async () => {
  const session = await requireAuth('/trips');
  const rawTrips = await getMyTripsServer();
  const trips = await enrichTripsWithPhotos(rawTrips);
  const initials = getInitials(session.user.name, session.user.email);
  const userImage = session.user.image ?? null;

  return (
    <div className="min-h-screen bg-wayfarer-bg font-body text-wayfarer-text-main">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between bg-wayfarer-bg/90 px-6 backdrop-blur-sm md:px-10">
        <Logo />
        <nav className="flex items-center gap-4">
          <Link
            href="/planner"
            className="hidden text-sm font-semibold text-wayfarer-text-muted transition-colors hover:text-wayfarer-primary sm:block"
          >
            Plan a Trip
          </Link>
          <Link href="/account" title="Account">
            {userImage ? (
              <Image
                src={userImage}
                alt={session.user.name ?? 'Account'}
                width={36}
                height={36}
                className="h-9 w-9 rounded-full object-cover shadow-wayfarer-soft transition hover:opacity-85"
              />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-wayfarer-primary font-display text-sm font-bold text-white shadow-wayfarer-soft transition hover:opacity-85">
                {initials}
              </span>
            )}
          </Link>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-10 md:px-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-wayfarer-text-muted">
          Saved
        </p>
        <h1 className="mb-8 font-display text-3xl font-bold text-wayfarer-primary md:text-4xl">
          My Trips
        </h1>

        {trips.length === 0 ? (
          <div className="rounded-2xl bg-wayfarer-surface p-10 text-center shadow-wayfarer-soft">
            <p className="mb-1 font-display text-lg font-bold text-wayfarer-primary">
              No saved trips yet
            </p>
            <p className="mb-6 text-sm text-wayfarer-text-muted">
              Plan your first route and save it here.
            </p>
            <Link
              href="/planner"
              className="inline-flex items-center justify-center rounded-xl bg-wayfarer-primary px-6 py-3 text-base font-bold text-white shadow-wayfarer-ambient transition hover:opacity-90"
            >
              Plan a Trip
            </Link>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {trips.map((trip) => {
              const sorted = trip.stops.slice().sort((a, b) => a.order - b.order);
              const first = sorted[0];
              const last = sorted[sorted.length - 1];
              const hasRoute = sorted.length >= 2 && first && last;
              const visibleStops = sorted.slice(0, MAX_VISIBLE_STOPS);
              const hiddenCount = sorted.length - visibleStops.length;

              return (
                <li
                  key={trip.id}
                  className="flex flex-col overflow-hidden rounded-2xl bg-wayfarer-surface shadow-wayfarer-soft"
                >
                  {/* Photo */}
                  {trip.photoUrl ? (
                    <img // noqa: @next/next/no-img-element — redirect URL, cannot use next/image
                      src={trip.photoUrl}
                      alt={first?.name ?? trip.name}
                      className="h-40 w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-40 w-full items-center justify-center bg-wayfarer-primary/10">
                      <span className="text-4xl opacity-20">🗺️</span>
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex flex-1 flex-col p-4">
                    {/* Name + Map View */}
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <p className="font-display text-base font-bold leading-snug text-wayfarer-primary">
                        {trip.name}
                      </p>
                      {trip.stops.length > 0 && (
                        <Link
                          href={`/trips/${trip.id}/map`}
                          className="shrink-0 rounded-lg bg-wayfarer-primary px-3 py-1.5 text-xs font-bold text-white transition hover:opacity-85"
                        >
                          Map
                        </Link>
                      )}
                    </div>

                    {/* Route summary */}
                    {hasRoute && (
                      <p className="mb-3 truncate text-sm text-wayfarer-text-muted">
                        {first.name}
                        <span className="mx-1.5 text-wayfarer-primary/60">→</span>
                        {last.name}
                      </p>
                    )}

                    {/* Stops */}
                    <ol className="mb-auto space-y-1.5">
                      {visibleStops.map((stop) => (
                        <li key={stop.id} className="flex items-center gap-2 text-sm">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-wayfarer-primary/15 text-[10px] font-bold text-wayfarer-primary">
                            {stop.order + 1}
                          </span>
                          <span className="truncate text-wayfarer-text-main">
                            {stop.name}
                          </span>
                        </li>
                      ))}
                      {hiddenCount > 0 && (
                        <li className="pl-7 text-xs text-wayfarer-text-muted">
                          +{hiddenCount} more stop{hiddenCount !== 1 ? 's' : ''}
                        </li>
                      )}
                    </ol>

                    {/* Footer metadata */}
                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-wayfarer-accent/20 pt-3">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-wayfarer-primary/10 px-2.5 py-0.5 text-xs font-semibold text-wayfarer-primary">
                          {trip.stops.length} stop{trip.stops.length !== 1 ? 's' : ''}
                        </span>
                        <span className="text-xs text-wayfarer-text-muted">
                          {new Date(trip.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                      <TripCardActions tripId={trip.id} shareToken={trip.shareToken} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
};

export default TripsPage;
