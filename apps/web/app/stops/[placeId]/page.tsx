import type { Metadata } from 'next';
import Link from 'next/link';
import { NearbyHotels } from '../../../components/NearbyHotels';
import { getPlaceCoords, reverseGeocode } from '../../../lib/geocode';

type Props = {
  params: Promise<{ placeId: string }>;
  searchParams: Promise<{ title?: string; desc?: string; img?: string }>;
};

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { placeId } = await params;
  const { title, desc } = await searchParams;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  const name = title ?? 'Discover this stop';
  const description =
    desc ?? `Explore ${name} and find hotels, directions, and trip ideas.`;

  return {
    title: `${name} — HipTrip`,
    description,
    openGraph: {
      title: name,
      description,
      siteName: 'HipTrip',
      url: siteUrl ? `${siteUrl}/stops/${placeId}` : undefined,
    },
    twitter: { card: 'summary', title: name, description },
  };
}

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

const buildStaticMapUrl = (lat: number, lng: number): string => {
  if (!MAPS_KEY) return '';
  const params = new URLSearchParams({
    center: `${lat},${lng}`,
    zoom: '13',
    size: '1200x400',
    scale: '2',
    key: MAPS_KEY,
    maptype: 'roadmap',
  });
  params.append('markers', `color:0x1B4332|${lat},${lng}`);
  params.append('style', 'feature:poi|visibility:off');
  params.append('style', 'feature:transit|visibility:off');
  params.append('style', 'feature:road|element:geometry|color:0xffffff');
  params.append('style', 'feature:landscape|element:geometry|color:0xf4f4ef');
  params.append('style', 'feature:water|element:geometry|color:0xc8ddd4');
  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
};

const buildDirectionsUrl = (lat: number, lng: number, name: string): string => {
  const dest = encodeURIComponent(`${name}@${lat},${lng}`);
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;
};

export default async function StopDiscoverPage({ params, searchParams }: Props) {
  const { placeId } = await params;
  const { title, desc, img } = await searchParams;

  const name = title ?? 'Unnamed Stop';
  const description = desc ?? null;
  const imageUrl = img ?? null;

  const coords = await getPlaceCoords(placeId);

  const stopLocation = coords ? await reverseGeocode(coords.lat, coords.lng) : null;

  const staticMapUrl = coords ? buildStaticMapUrl(coords.lat, coords.lng) : '';
  const directionsUrl = coords ? buildDirectionsUrl(coords.lat, coords.lng, name) : '';

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'TouristAttraction',
    name,
    description: description ?? `Explore ${name}`,
    image: imageUrl ?? undefined,
    ...(coords
      ? {
          geo: { '@type': 'GeoCoordinates', latitude: coords.lat, longitude: coords.lng },
        }
      : {}),
  };

  return (
    <div className="min-h-screen bg-wayfarer-bg font-body text-wayfarer-text-main antialiased">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {/* Header */}
      <header className="fixed top-0 z-50 flex h-16 w-full items-center justify-between bg-wayfarer-bg/80 px-4 backdrop-blur-xl md:px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-wayfarer-surface"
          >
            <svg
              className="h-5 w-5 text-wayfarer-text-main"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </Link>
          <span className="font-display text-base font-extrabold tracking-tight text-wayfarer-primary">
            HipTrip
          </span>
        </div>
        {directionsUrl && (
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-10 w-10 items-center justify-center rounded-full text-wayfarer-text-muted transition-colors hover:bg-wayfarer-surface"
            title="Get Directions"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="3 11 22 2 13 21 11 13 3 11" />
            </svg>
          </a>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-24 pt-20 md:px-8">
        {/* Hero + title */}
        <section className="mt-4 grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
          {/* Image */}
          <div className="lg:col-span-8">
            <div className="aspect-[4/3] overflow-hidden rounded-[2rem] bg-wayfarer-surface shadow-wayfarer-ambient md:aspect-[16/10]">
              {imageUrl ? (
                <img src={imageUrl} alt={name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-wayfarer-surface-deep">
                  <svg
                    className="h-16 w-16 text-wayfarer-accent"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                  >
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                </div>
              )}
            </div>
          </div>

          {/* Title + CTAs */}
          <div className="space-y-8 lg:col-span-4 lg:pl-4">
            <div className="space-y-2">
              <span className="inline-block rounded-full bg-wayfarer-tertiary-fixed px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-wayfarer-tertiary-fixed-dark">
                Popular Stop
              </span>
              <h1 className="font-display text-4xl font-extrabold leading-tight tracking-tight text-wayfarer-primary md:text-5xl lg:text-6xl">
                {name}
              </h1>
              {stopLocation && (
                <div className="flex items-center gap-2 text-wayfarer-text-muted">
                  <svg
                    className="h-4 w-4 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <p className="text-sm font-medium">{stopLocation}</p>
                </div>
              )}
            </div>

            {description && (
              <p className="pl-5 text-lg leading-relaxed text-wayfarer-text-muted">
                {description}
              </p>
            )}

            {/* Action buttons */}
            <div className="flex flex-col gap-3 pt-2">
              <Link
                href={`/planner?location=${encodeURIComponent(name)}`}
                className="flex w-full items-center justify-center gap-3 rounded-xl bg-wayfarer-primary py-4 px-6 font-display font-bold text-white shadow-wayfarer-ambient transition-transform hover:scale-[1.02] active:scale-95"
              >
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                Plan a Trip Here
              </Link>
              {directionsUrl && (
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-3 rounded-xl bg-wayfarer-surface-deep py-4 px-6 font-display font-bold text-wayfarer-primary transition-transform hover:scale-[1.02] active:scale-95"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="3 11 22 2 13 21 11 13 3 11" />
                  </svg>
                  Get Directions
                </a>
              )}
            </div>
          </div>
        </section>

        {/* Map */}
        {staticMapUrl && (
          <section className="mt-16">
            <div
              className="group relative overflow-hidden rounded-3xl shadow-wayfarer-ambient"
              style={{ height: '280px' }}
            >
              <img
                src={staticMapUrl}
                alt={`Map showing ${name}`}
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-wayfarer-primary/40 to-transparent" />
              <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between">
                <div className="rounded-2xl bg-wayfarer-bg/90 p-4 backdrop-blur-md">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-wayfarer-text-muted">
                    Coordinates
                  </p>
                  <p className="font-bold text-wayfarer-primary">
                    {coords!.lat.toFixed(4)}°, {coords!.lng.toFixed(4)}°
                  </p>
                </div>
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-wayfarer-primary text-white shadow-wayfarer-ambient transition-opacity hover:opacity-90"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="3 11 22 2 13 21 11 13 3 11" />
                  </svg>
                </a>
              </div>
            </div>
          </section>
        )}

        {/* Hotels */}
        {coords && <NearbyHotels lat={coords.lat} lng={coords.lng} stopName={name} />}

        {/* Plan CTA banner */}
        <section className="mt-16 overflow-hidden rounded-3xl bg-wayfarer-primary px-8 py-10 text-white shadow-wayfarer-ambient">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-widest opacity-70">
            Ready to go?
          </p>
          <h2 className="mb-4 font-display text-2xl font-extrabold leading-tight md:text-3xl">
            Build a full road trip through {stopLocation ?? name}
          </h2>
          <p className="mb-6 max-w-lg text-sm leading-relaxed opacity-80">
            HipTrip&apos;s AI plans your entire route — stops, drive times, and hotels —
            in seconds. Free to use.
          </p>
          <Link
            href={`/planner?location=${encodeURIComponent(name)}`}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-display text-sm font-bold text-wayfarer-primary shadow transition-transform hover:scale-[1.02] active:scale-95"
          >
            Plan this trip →
          </Link>
        </section>
      </main>
    </div>
  );
}
