import Link from 'next/link';
import { auth } from '../../auth';
import { getDiscoverFeed, type DiscoverStop } from '../../lib/api-client';
import AuthControls from '../../components/auth-controls';
import TrendingRouteCard from '../../components/TrendingRouteCard';
import PlaceCard from '../../components/PlaceCard';

const injectSponsored = (
  organic: DiscoverStop[],
  sponsored: DiscoverStop[],
): DiscoverStop[] => {
  const result = [...organic];
  const positions = [1, 5];
  let sponsorIdx = 0;
  for (const pos of positions) {
    const item = sponsored[sponsorIdx];
    if (sponsorIdx >= sponsored.length || !item) break;
    result.splice(pos, 0, item);
    sponsorIdx++;
  }
  return result;
};

const DiscoverPage = async () => {
  const [session, feed] = await Promise.all([auth(), getDiscoverFeed()]);

  const trendingRoutes = feed?.trendingRoutes ?? [];
  const grid = injectSponsored(feed?.nearbyStops ?? [], feed?.sponsoredStops ?? []);
  const locationContext = feed?.locationContext;

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
            href="/plan"
            className="hidden text-sm font-semibold text-wayfarer-text-muted transition-colors hover:text-wayfarer-primary sm:block"
          >
            Plan a Trip
          </Link>
          <Link
            href="/trips"
            className="hidden text-sm font-semibold text-wayfarer-text-muted transition-colors hover:text-wayfarer-primary sm:block"
          >
            My Trips
          </Link>
          <AuthControls variant="nav" />
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="relative h-72 w-full overflow-hidden md:h-96">
          <img
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuAdZLdf8nn9pGc50ZxckpxO-MI4Z43NG62UapCBUrflkzyOSIMOXQ91-z0gXPE_N4O12b2LD5COH98TcH8qwt54m6y-RDlLubcQbRMzpGiym0zMRsSyv12hfEARw_dGIswWfHhIX4IggfyOE9C4iy8aSmVsCqMfHWBH24pcVP8orhSzxgLaDPGlwnfYKci1hPHvQhd7-M4-Y93Pbm8O1c0dp2UURc8IjHOeoHgQLnx1v3r18vvONM6uPIikoZh3F_WDgZCUtH0akKA"
            alt="Scenic mountain road"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-wayfarer-bg via-black/20 to-transparent" />
          <div className="absolute bottom-8 left-6 md:left-10">
            <h1 className="mb-3 font-display text-3xl font-extrabold leading-tight text-white drop-shadow md:text-5xl">
              Where to next
              {session?.user?.name ? `, ${session.user.name.split(' ')[0]}` : ''}?
            </h1>
            <Link
              href="/plan"
              className="inline-flex items-center gap-2 rounded-xl bg-wayfarer-primary px-5 py-2.5 text-sm font-bold text-white shadow-wayfarer-ambient transition hover:opacity-90"
            >
              Plan a New Trip <span aria-hidden>→</span>
            </Link>
          </div>
        </section>

        {/* Trending Routes */}
        {trendingRoutes.length > 0 && (
          <section className="px-6 py-10 md:px-10">
            <div className="mb-5 flex items-baseline justify-between">
              <h2 className="font-display text-xl font-bold text-wayfarer-primary md:text-2xl">
                Trending Routes
              </h2>
              <Link
                href="/plan"
                className="text-sm font-semibold text-wayfarer-text-muted hover:text-wayfarer-primary"
              >
                Start planning →
              </Link>
            </div>
            <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:grid md:grid-cols-3 md:overflow-visible md:pb-0 lg:grid-cols-4 xl:grid-cols-6">
              {trendingRoutes.map((route, i) => (
                <TrendingRouteCard key={route.cacheId} route={route} index={i} />
              ))}
            </div>
          </section>
        )}

        {/* Popular Stops Near You */}
        <section className="px-6 pb-16 pt-2 md:px-10">
          <div className="mb-5 flex items-baseline justify-between">
            <div>
              <h2 className="font-display text-xl font-bold text-wayfarer-primary md:text-2xl">
                Popular Stops Near You
              </h2>
              {locationContext && (
                <p className="mt-0.5 text-xs text-wayfarer-text-muted">
                  Based on your trip from {locationContext}
                </p>
              )}
            </div>
          </div>

          {grid.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
              {grid.map((stop, i) => (
                <PlaceCard key={`${stop.id}-${i}`} stop={stop} gradientIndex={i} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl bg-wayfarer-surface p-8 text-center shadow-wayfarer-soft">
              <p className="mb-2 font-display text-lg font-semibold text-wayfarer-primary">
                Plan your first trip
              </p>
              <p className="mb-5 text-sm text-wayfarer-text-muted">
                Once you plan a route, we&apos;ll suggest popular stops along the way.
              </p>
              <Link
                href="/plan"
                className="inline-flex items-center gap-2 rounded-xl bg-wayfarer-primary px-5 py-2.5 text-sm font-bold text-white shadow-wayfarer-ambient transition hover:opacity-90"
              >
                Start Planning →
              </Link>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default DiscoverPage;
