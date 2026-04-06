import Link from 'next/link';
import { getSession } from '../lib/session';
import { getDiscoverFeed, type DiscoverStop } from '../lib/api-client';
import AuthControls from '../components/auth-controls';
import TrendingRouteCard from '../components/TrendingRouteCard';
import PlaceCard from '../components/PlaceCard';
import Logo from '../components/Logo';

const HERO_IMAGE_URL =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAdZLdf8nn9pGc50ZxckpxO-MI4Z43NG62UapCBUrflkzyOSIMOXQ91-z0gXPE_N4O12b2LD5COH98TcH8qwt54m6y-RDlLubcQbRMzpGiym0zMRsSyv12hfEARw_dGIswWfHhIX4IggfyOE9C4iy8aSmVsCqMfHWBH24pcVP8orhSzxgLaDPGlwnfYKci1hPHvQhd7-M4-Y93Pbm8O1c0dp2UURc8IjHOeoHgQLnx1v3r18vvONM6uPIikoZh3F_WDgZCUtH0akKA';

const SCENIC_BYWAYS_IMAGE_URL =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuA9N2jnzWTz1IaMG2SlTDB38l567WNr8pvaWNXcH0DGDN2Ww3DNYsm5iQotL0Vr_r5iu-ULDISF8rX6mfcGmawnq_G3pYdg9xuhyKIEsvR4fXx1FARKn_6A_9BBaeWTusa6qjhDE530zH85Sd0y_ShdrGf5b4cK6RA7wMYcwbYk5zqwkZTXqsXZAUPv144v2EMuFKj5nXJ_WXZzwkk6RoQaVVcEzuX03-7k04fGCZU0kHB1ol-XVGJ8860u7inK_Oq6H-DLRxKuP7k';

const JOURNAL_IMAGE_URL =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDEz9xjmRvUmwmlDIS493_mzG6RnSZefLWcU7cYqK3BTiUi-TFV5GUmKeu7VpX7pF7_z91wsNITsbJXhyLwIhleVA4cHzhMu4DL9gmtzAqI4N3MFj3yRRidn4R1zH-ijChJuv7mz-70hVp02JZFR97-isXz-cVrzwS9bXAzg8o64i-WrRu9TfreiyRoylX5XmqChP8DKwGtUAkGFN57VGUJlwQbN5ToycJ3VKqi4kaP7OeMCts9epDiRQspPANbgJMYP7eJXZ7ss-g';

const AVATAR_URLS = [
  'https://lh3.googleusercontent.com/aida-public/AB6AXuB8BBkd8_osUL7aawpk3wbcnXai8z38lWyDj-NPBdiTjwWiwXujli8HIPgRvkjSzrXHAZ-ZyNN__oNTiB5FK_Ff3dN1l4NfHbgi7QILGy0coj3ua4SlGIp189N3FmY4aPyYWLZ_4VDoJqo8G0R-NUNjSACZzPZdPxP12gjkIYRJmG8Nb7n6xCHWa8qVUHZlgrlWx52kABw06L4l2ZdXblJrXw7vl6ao7NEqXnqYH5VjBTSR7mwLqkeO9z1PtOwPekU9FUZo5xO9MAI',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCTlZu_QT98M2K0eFajKECqFKisPnQ9WPX-SM7aNQPH7q2wcV7r2z5c9aEkigQOhycg9BktisugoHX9QTuvbY0Db4Goax_Fz6QF7syE3mWOOBgKeEB4qoDeH7ife3v6NPnycCP1dnjU09NL3vdLqILomgmuNkj6VzZdW6vDiW38qWz9VzCjvcRQ7kJh8ZP6_oMjJFD6VXsQail-DLXRUcFSUEoQpbY7pzD1PGwuyCZicgMd2NnMpCxpDWi88Ueu4L7PQVYFaBMoibQ',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuB5PkvVC8dYTEvjBLQO7VJrLCerlPzvufI7yjdnWPREOfzrVCxozbggHTZb-zwoQxXA21Fe4Y0LTx_O4ckO4WvH8IYvuYDx_zWPvyKNZQNLN6Fg5T3LG1iq05QrRU6-bA5gxxs-F6PHpu2DuUZPnvtiOsrEbkyyKHqgsD9wW-StRxVty6Wv2tszoN5BvqbbDiqLMe0_yYgibf_ZnGxrcm5r8lSySE8vn5FH7soXm-glZuGwn7xyVLxvlNDYCj6LUlvrQoF4zKEXM2M',
];

const SiteFooter = () => (
  <footer className="border-t border-wayfarer-accent/20 bg-wayfarer-surface py-12">
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 md:flex-row md:justify-between md:px-8">
      <div>
        <p className="font-display text-xl font-black uppercase tracking-[0.2em] text-wayfarer-primary">
          HipTrip
        </p>
        <p className="mt-2 max-w-xs text-sm text-wayfarer-text-muted">
          Built for the curious. Designed for the drive.
        </p>
      </div>
      <div className="flex flex-wrap gap-10 text-sm">
        <div className="space-y-2">
          <p className="font-bold uppercase tracking-wider text-wayfarer-primary">
            Company
          </p>
          <Link
            href="/about"
            className="block text-wayfarer-text-muted hover:text-wayfarer-primary"
          >
            About
          </Link>
          <Link
            href="/journal"
            className="block text-wayfarer-text-muted hover:text-wayfarer-primary"
          >
            Journal
          </Link>
        </div>
        <div className="space-y-2">
          <p className="font-bold uppercase tracking-wider text-wayfarer-primary">
            Product
          </p>
          <Link
            href="/product/route-planner"
            className="block text-wayfarer-text-muted hover:text-wayfarer-primary"
          >
            Route Planner
          </Link>
          <Link
            href="/product/offline-maps"
            className="block text-wayfarer-text-muted hover:text-wayfarer-primary"
          >
            Offline Maps
          </Link>
        </div>
        <div className="space-y-2">
          <p className="font-bold uppercase tracking-wider text-wayfarer-primary">
            Support
          </p>
          <Link
            href="/support"
            className="block text-wayfarer-text-muted hover:text-wayfarer-primary"
          >
            Contact Us
          </Link>
          <Link
            href="/faq"
            className="block text-wayfarer-text-muted hover:text-wayfarer-primary"
          >
            FAQ
          </Link>
        </div>
        <div className="space-y-2">
          <p className="font-bold uppercase tracking-wider text-wayfarer-primary">
            Legal
          </p>
          <Link
            href="/privacy"
            className="block text-wayfarer-text-muted hover:text-wayfarer-primary"
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            className="block text-wayfarer-text-muted hover:text-wayfarer-primary"
          >
            Terms
          </Link>
        </div>
      </div>
    </div>
  </footer>
);

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

// ─── Authenticated: Discover Feed ────────────────────────────────────────────

const DiscoverView = async ({ name }: { name: string | null | undefined }) => {
  const feed = await getDiscoverFeed();

  const trendingRoutes = feed?.trendingRoutes ?? [];
  const grid = injectSponsored(feed?.nearbyStops ?? [], feed?.sponsoredStops ?? []);

  return (
    <div className="min-h-screen bg-wayfarer-bg font-body text-wayfarer-text-main antialiased">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between bg-wayfarer-bg/90 px-6 backdrop-blur-sm md:px-10">
        <Logo />
        <nav className="flex items-center gap-6">
          <Link
            href="/planner"
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
            src={HERO_IMAGE_URL}
            alt="Scenic mountain road"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-wayfarer-bg via-black/20 to-transparent" />
          <div className="absolute bottom-8 left-6 md:left-10">
            <h1 className="mb-3 font-display text-3xl font-extrabold leading-tight text-white drop-shadow md:text-5xl">
              Where to next
              {name ? `, ${name.split(' ')[0]}` : ''}?
            </h1>
            <Link
              href="/planner"
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
                href="/planner"
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
                href="/planner"
                className="inline-flex items-center gap-2 rounded-xl bg-wayfarer-primary px-5 py-2.5 text-sm font-bold text-white shadow-wayfarer-ambient transition hover:opacity-90"
              >
                Start Planning →
              </Link>
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
};

// ─── Unauthenticated: Stitch Landing Page ────────────────────────────────────

const LandingView = () => (
  <div className="bg-wayfarer-bg font-body text-wayfarer-text-main antialiased">
    <header className="fixed top-0 z-50 flex h-16 w-full items-center justify-between bg-transparent px-6 md:px-10">
      <Logo />
      <div className="flex items-center gap-4">
        <AuthControls variant="nav" />
      </div>
    </header>

    <main className="relative min-h-screen overflow-hidden">
      {/* Hero */}
      <section className="relative h-[574px] w-full flex-shrink-0 md:h-screen">
        <img
          alt="Scenic mountain road"
          className="absolute inset-0 h-full w-full object-cover"
          src={HERO_IMAGE_URL}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-wayfarer-bg/20 to-wayfarer-bg" />
      </section>

      {/* Hero Content */}
      <section className="relative z-10 -mt-24 flex-grow px-6 pb-12 md:absolute md:inset-0 md:mt-0 md:flex md:items-center md:px-20 lg:px-32">
        <div className="max-w-xl">
          <div className="mb-6 flex items-center gap-3">
            <span className="h-1 w-12 rounded-full bg-wayfarer-primary-light" />
            <span className="font-display text-xs font-bold uppercase tracking-[0.2em] text-wayfarer-primary">
              The Open Road Awaits
            </span>
          </div>

          <h1 className="mb-6 font-display text-5xl font-extrabold leading-[1.1] tracking-tight text-wayfarer-primary md:text-7xl">
            Turn any drive into a{' '}
            <em className="not-italic italic text-wayfarer-tertiary">journey.</em>
          </h1>

          <p className="mb-10 max-w-md font-body text-lg leading-relaxed text-wayfarer-text-muted md:text-xl">
            Experience the hidden gems, scenic detours, and local secrets that transform
            transportation into exploration.
          </p>

          <div className="flex flex-col gap-4 sm:flex-row">
            <Link
              href="/sign-in"
              className="flex items-center justify-center gap-3 rounded-xl bg-gradient-to-br from-[#012d1d] to-wayfarer-primary px-8 py-5 text-lg font-bold text-white shadow-xl shadow-wayfarer-primary/20 transition-all hover:opacity-90 active:scale-95"
            >
              Start Your Trip
              <span aria-hidden>→</span>
            </Link>
            <Link
              href="/planner"
              className="flex items-center justify-center gap-3 rounded-xl bg-wayfarer-surface-deep px-8 py-5 text-lg font-bold text-wayfarer-primary transition-all hover:bg-wayfarer-surface active:scale-95"
            >
              Browse Routes
            </Link>
          </div>

          <div className="mt-12 flex items-center gap-6">
            <div className="flex -space-x-3">
              <img
                alt="User"
                className="h-10 w-10 rounded-full border-2 border-wayfarer-bg object-cover"
                src={AVATAR_URLS[0]}
              />
              <img
                alt="User"
                className="h-10 w-10 rounded-full border-2 border-wayfarer-bg object-cover"
                src={AVATAR_URLS[1]}
              />
              <img
                alt="User"
                className="h-10 w-10 rounded-full border-2 border-wayfarer-bg object-cover"
                src={AVATAR_URLS[2]}
              />
            </div>
            <div className="text-sm">
              <span className="block font-bold text-wayfarer-primary">
                Join 12,000+ wayfarers
              </span>
              <span className="text-wayfarer-text-muted">Finding their path today</span>
            </div>
          </div>
        </div>
      </section>

      {/* Bento Feature Grid */}
      <section className="bg-wayfarer-bg px-6 pb-32 pt-12 md:px-20 lg:px-32">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Wide — Curated Scenic Byways */}
          <div className="relative min-h-[400px] overflow-hidden rounded-[2rem] bg-wayfarer-surface p-8 transition-all md:col-span-2 md:p-12 group">
            <div className="relative z-10">
              <h3 className="mb-4 max-w-xs font-display text-3xl font-bold leading-tight text-wayfarer-primary">
                Curated Scenic Byways
              </h3>
              <p className="mb-6 max-w-sm text-wayfarer-text-muted">
                Expertly designed routes that prioritize the view over the clock.
              </p>
              <Link
                href="/planner"
                className="inline-flex items-center gap-2 font-bold text-wayfarer-primary hover:opacity-70 transition-opacity"
              >
                Explore Collections →
              </Link>
            </div>
            <div className="absolute bottom-0 right-0 h-full w-2/3 opacity-40 transition-transform duration-700 group-hover:scale-105">
              <img
                className="h-full w-full rounded-tl-[4rem] object-cover"
                src={SCENIC_BYWAYS_IMAGE_URL}
                alt="Mountain lake"
              />
            </div>
          </div>

          {/* Dark — Offline Precision */}
          <div className="flex flex-col justify-end gap-4 rounded-[2rem] bg-wayfarer-primary p-8 text-white">
            <p className="text-3xl">🗺️</p>
            <h3 className="font-display text-2xl font-bold">Offline Precision</h3>
            <p className="text-sm text-white/80">
              Download entire regions for seamless navigation even where cellular service
              fails.
            </p>
          </div>

          {/* Smart Pit-Stops + Photo Ops */}
          <div className="flex flex-col gap-6 rounded-[2rem] bg-wayfarer-surface-deep p-8">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-wayfarer-secondary/10 text-wayfarer-secondary">
                🍽️
              </div>
              <div>
                <p className="font-semibold text-wayfarer-primary">Smart Pit-Stops</p>
                <p className="text-xs text-wayfarer-text-muted">Recommended local eats</p>
              </div>
            </div>
            <div className="h-px bg-wayfarer-accent/20" />
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-wayfarer-tertiary/10 text-wayfarer-tertiary">
                📸
              </div>
              <div>
                <p className="font-semibold text-wayfarer-primary">Photo Ops</p>
                <p className="text-xs text-wayfarer-text-muted">Timed for golden hour</p>
              </div>
            </div>
          </div>

          {/* Journey Journal */}
          <div className="flex flex-col items-center gap-8 rounded-[2rem] border border-wayfarer-accent/20 p-8 md:col-span-2 md:flex-row md:p-12">
            <div className="flex-1">
              <h3 className="mb-4 font-display text-3xl font-bold text-wayfarer-primary">
                Journey Journal
              </h3>
              <p className="text-wayfarer-text-muted">
                Automatically stitch your photos, stops, and route into a beautiful,
                shareable digital scrapbook of your adventure.
              </p>
            </div>
            <div className="-rotate-3 h-32 w-full max-w-48 overflow-hidden rounded-2xl border-4 border-white shadow-wayfarer-soft transition-transform hover:rotate-0 md:w-48">
              <img
                className="h-full w-full object-cover"
                src={JOURNAL_IMAGE_URL}
                alt="Journey journal polaroid"
              />
            </div>
          </div>
        </div>
      </section>
    </main>

    <SiteFooter />
  </div>
);

// ─── Page ─────────────────────────────────────────────────────────────────────

const HomePage = async () => {
  const session = await getSession();

  if (session?.user) {
    return <DiscoverView name={session.user.name} />;
  }

  return <LandingView />;
};

export default HomePage;
