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

// Deterministic gradient per stop so cards look distinct without photos
const GRADIENTS = [
  'from-emerald-900/60 to-teal-800/40',
  'from-wayfarer-primary/50 to-emerald-700/30',
  'from-stone-700/60 to-stone-600/40',
  'from-teal-900/60 to-cyan-800/40',
  'from-green-900/60 to-emerald-800/40',
  'from-slate-700/60 to-slate-600/40',
] as const;

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

  const stops = plan.stops.slice().sort((a, b) => a.order - b.order);

  return (
    <div className="min-h-screen bg-wayfarer-bg font-body text-wayfarer-text-main antialiased">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 h-16 bg-wayfarer-bg/80 backdrop-blur-xl">
        <Link
          href="/"
          className="font-display text-xl font-extrabold uppercase tracking-[0.2em] text-wayfarer-primary"
        >
          HipTrip
        </Link>
        <span className="text-[11px] font-body font-semibold text-wayfarer-secondary uppercase tracking-widest">
          Shared Trip
        </span>
      </header>

      <main className="pt-24 pb-24 px-6 max-w-4xl mx-auto">
        {/* Hero */}
        <section className="mb-10">
          <div className="flex flex-wrap gap-2 mb-4">
            {plan.themes.map((theme) => (
              <span
                key={theme}
                className="px-3 py-1 bg-wayfarer-surface text-wayfarer-primary font-body text-[10px] font-bold uppercase tracking-wider rounded-full"
              >
                {theme}
              </span>
            ))}
          </div>
          <h1 className="font-display text-3xl font-extrabold text-wayfarer-primary mb-2 leading-tight">
            {plan.name}
          </h1>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-wayfarer-text-muted text-sm mb-4">
            <span className="text-base">📍</span>
            <span>{plan.location}</span>
            <span className="opacity-40">•</span>
            <span>
              {stops.length} Stop{stops.length !== 1 ? 's' : ''}
            </span>
          </div>
          {plan.rationale && (
            <p className="text-sm leading-relaxed text-wayfarer-text-muted max-w-2xl">
              {plan.rationale}
            </p>
          )}
        </section>

        {/* Bento grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-16">
          {stops.map((stop, idx) => {
            const gradient = GRADIENTS[idx % GRADIENTS.length];
            const isFeatured = idx % 6 === 0;
            const isSide = idx % 6 === 1;
            const isWide = idx % 6 === 5;
            const isAccent = idx % 6 === 3;

            const colSpan = isFeatured
              ? 'md:col-span-8'
              : isSide
                ? 'md:col-span-4'
                : isWide
                  ? 'md:col-span-8'
                  : isAccent
                    ? 'md:col-span-6'
                    : 'md:col-span-6';

            if (isFeatured) {
              return (
                <div
                  key={stop.order}
                  className={`${colSpan} bg-wayfarer-surface rounded-3xl overflow-hidden`}
                >
                  <div
                    className={`h-48 bg-gradient-to-br ${gradient} flex items-end p-6`}
                  >
                    <span className="px-3 py-1 bg-wayfarer-primary text-white font-body text-[10px] font-bold uppercase tracking-wider rounded-full">
                      Stop {idx + 1}
                    </span>
                  </div>
                  <div className="p-6">
                    <h2 className="font-display text-2xl font-bold text-wayfarer-primary mb-2">
                      {stop.name}
                    </h2>
                    {stop.notes && (
                      <p className="text-wayfarer-text-muted text-sm leading-relaxed">
                        {stop.notes}
                      </p>
                    )}
                  </div>
                </div>
              );
            }

            if (isAccent) {
              return (
                <div
                  key={stop.order}
                  className={`${colSpan} bg-wayfarer-primary text-white rounded-3xl p-6 flex flex-col justify-between relative overflow-hidden`}
                >
                  <div className="absolute inset-0 opacity-10 pointer-events-none bg-gradient-to-br from-white via-transparent to-transparent" />
                  <div className="relative z-10">
                    <span className="px-2 py-0.5 bg-white/20 text-white font-body text-[10px] font-bold uppercase tracking-wider rounded-md">
                      Stop {idx + 1}
                    </span>
                    <h2 className="font-display text-xl font-bold mt-3">{stop.name}</h2>
                    {stop.notes && (
                      <p className="text-white/70 text-sm mt-2 leading-snug line-clamp-3">
                        {stop.notes}
                      </p>
                    )}
                  </div>
                </div>
              );
            }

            if (isWide) {
              return (
                <div
                  key={stop.order}
                  className={`${colSpan} bg-wayfarer-surface rounded-3xl overflow-hidden flex flex-col md:flex-row`}
                >
                  <div
                    className={`md:w-2/5 h-40 md:h-auto bg-gradient-to-br ${gradient}`}
                  />
                  <div className="flex-1 p-8 flex flex-col justify-center">
                    <span className="text-[10px] font-bold text-wayfarer-secondary uppercase tracking-widest font-body mb-2">
                      Stop {idx + 1}
                    </span>
                    <h2 className="font-display text-2xl font-extrabold text-wayfarer-primary mb-3 leading-tight">
                      {stop.name}
                    </h2>
                    {stop.notes && (
                      <p className="text-wayfarer-text-muted text-sm leading-relaxed">
                        {stop.notes}
                      </p>
                    )}
                  </div>
                </div>
              );
            }

            // side / horizontal cards
            return (
              <div
                key={stop.order}
                className={`${colSpan} bg-wayfarer-surface rounded-3xl p-6 flex flex-col justify-between`}
              >
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className={`w-10 h-10 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center font-display text-sm font-bold text-white shrink-0`}
                    >
                      {idx + 1}
                    </div>
                    <span className="text-[10px] font-bold text-wayfarer-secondary uppercase tracking-widest font-body">
                      Stop {idx + 1}
                    </span>
                  </div>
                  <h2 className="font-display text-xl font-bold text-wayfarer-primary leading-tight mb-2">
                    {stop.name}
                  </h2>
                  {stop.notes && (
                    <p className="text-wayfarer-text-muted text-sm leading-snug line-clamp-3">
                      {stop.notes}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="rounded-3xl bg-wayfarer-surface p-8 text-center">
          <p className="font-display text-xl font-bold text-wayfarer-primary mb-2">
            Ready for your own adventure?
          </p>
          <p className="text-sm text-wayfarer-text-muted mb-6 max-w-sm mx-auto">
            HipTrip plans personalised road trips with hidden gems and great stops near
            you.
          </p>
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
