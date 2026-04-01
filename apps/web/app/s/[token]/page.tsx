import type { Metadata } from 'next';
import { getSharedTrip } from '../../../lib/api-client';
import SharedTripView from '../../../components/SharedTripView';
import Link from 'next/link';

type Props = {
  params: Promise<{ token: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const plan = await getSharedTrip(token);

  if (!plan) {
    return { title: 'Trip Not Found — HipTrip' };
  }

  return {
    title: `${plan.name} — HipTrip`,
    description: plan.rationale || `A road trip through ${plan.location}`,
    openGraph: {
      title: plan.name,
      description: plan.rationale || `A road trip through ${plan.location}`,
      siteName: 'HipTrip',
    },
  };
}

export default async function SharedTripPage({ params }: Props) {
  const { token } = await params;
  const plan = await getSharedTrip(token);

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

  return <SharedTripView plan={plan} />;
}
