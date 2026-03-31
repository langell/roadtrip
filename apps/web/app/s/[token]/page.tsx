import type { Metadata } from 'next';
import Link from 'next/link';
import { getSharedTrip } from '../../../lib/api-client';

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

  return (
    <div className="min-h-screen bg-wayfarer-bg font-body text-wayfarer-text-main antialiased">
      <header className="px-6 py-6 flex items-center justify-between max-w-2xl mx-auto">
        <Link
          href="/"
          className="font-display text-xl font-extrabold uppercase tracking-[0.2em] text-wayfarer-primary"
        >
          HipTrip
        </Link>
        <span className="text-xs font-body font-semibold text-wayfarer-secondary uppercase tracking-widest">
          Shared Trip
        </span>
      </header>

      <main className="px-6 pb-20 max-w-2xl mx-auto">
        <section className="mb-8">
          <h1 className="font-display text-3xl font-extrabold text-wayfarer-primary mb-2 leading-tight">
            {plan.name}
          </h1>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-wayfarer-text-muted text-sm mb-3">
            <span className="text-base">📍</span>
            <span>{plan.location}</span>
            {plan.themes.length > 0 && (
              <>
                <span className="opacity-40">•</span>
                <span>{plan.themes.join(', ')}</span>
              </>
            )}
          </div>
          {plan.rationale && (
            <p className="text-sm leading-relaxed text-wayfarer-text-muted max-w-xl">
              {plan.rationale}
            </p>
          )}
        </section>

        <section className="space-y-3 mb-12">
          {plan.stops
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((stop, idx) => (
              <div
                key={stop.order}
                className="flex gap-4 items-start bg-wayfarer-surface rounded-2xl px-5 py-4"
              >
                <div className="w-8 h-8 rounded-full bg-wayfarer-primary/10 flex items-center justify-center font-display text-sm font-bold text-wayfarer-primary shrink-0 mt-0.5">
                  {idx + 1}
                </div>
                <div>
                  <p className="font-display font-bold text-wayfarer-primary leading-snug">
                    {stop.name}
                  </p>
                  {stop.notes && (
                    <p className="text-xs text-wayfarer-text-muted mt-1 leading-relaxed">
                      {stop.notes}
                    </p>
                  )}
                </div>
              </div>
            ))}
        </section>

        <div className="text-center">
          <Link
            href="/"
            className="inline-block rounded-xl bg-wayfarer-primary px-8 py-3.5 font-body text-sm font-bold text-white shadow-wayfarer-ambient hover:opacity-90 transition-opacity"
          >
            Plan your own trip →
          </Link>
        </div>
      </main>
    </div>
  );
}
