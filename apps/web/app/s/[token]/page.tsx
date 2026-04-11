import type { Metadata } from 'next';
import { getSharedTrip } from '../../../lib/api-client';
import SharedTripView from '../../../components/SharedTripView';
import Link from 'next/link';
import { getIsLoggedIn } from '../../../lib/session';

type Props = {
  params: Promise<{ token: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const plan = await getSharedTrip(token);

  if (!plan) {
    return { title: 'Trip Not Found — HipTrip' };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  const description =
    plan.rationale ||
    `A curated road trip through ${plan.location} with ${plan.stops.length} stops.`;
  const coverImage = plan.stops.find((s) => s.imageUrl)?.imageUrl;
  const ogImages = coverImage
    ? [{ url: coverImage, width: 1200, height: 630, alt: plan.name }]
    : [];

  return {
    title: `${plan.name} — HipTrip`,
    description,
    keywords: [
      plan.location,
      'road trip',
      'travel itinerary',
      'trip planner',
      ...plan.themes,
    ],
    openGraph: {
      title: plan.name,
      description,
      siteName: 'HipTrip',
      type: 'website',
      url: siteUrl ? `${siteUrl}/s/${token}` : undefined,
      images: ogImages,
    },
    twitter: {
      card: 'summary_large_image',
      title: plan.name,
      description,
      images: coverImage ? [coverImage] : [],
    },
  };
}

export default async function SharedTripPage({ params }: Props) {
  const { token } = await params;
  const [plan, isLoggedIn] = await Promise.all([getSharedTrip(token), getIsLoggedIn()]);

  if (!plan) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-wayfarer-bg font-body text-wayfarer-text-muted px-6">
        <div className="text-center max-w-sm">
          <p className="font-display text-2xl font-bold text-wayfarer-primary mb-3">
            Trip not found
          </p>
          <p className="text-sm text-wayfarer-text-muted mb-6">
            This link may have expired or been removed.
          </p>
          <Link
            href="/"
            className="inline-block rounded-xl bg-wayfarer-primary px-6 py-3 font-body text-sm font-bold text-white hover:opacity-90 transition-opacity"
          >
            Plan your own trip
          </Link>
        </div>
      </div>
    );
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: plan.name,
    description: plan.rationale || `A curated road trip through ${plan.location}.`,
    numberOfItems: plan.stops.length,
    itemListElement: plan.stops
      .sort((a, b) => a.order - b.order)
      .map((stop, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: stop.name,
        url: siteUrl ? `${siteUrl}/s/${token}/stops/${stop.id}` : undefined,
        item: {
          '@type': 'TouristAttraction',
          name: stop.name,
          image: stop.imageUrl ?? undefined,
          geo: {
            '@type': 'GeoCoordinates',
            latitude: stop.lat,
            longitude: stop.lng,
          },
        },
      })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SharedTripView plan={plan} shareToken={token} isLoggedIn={isLoggedIn} />
    </>
  );
}
