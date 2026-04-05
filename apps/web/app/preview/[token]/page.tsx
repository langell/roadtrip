import type { Metadata } from 'next';
import Link from 'next/link';
import { getPlanPreview } from '../../../lib/api-client';
import type { PlannedStopResolved } from '../../../lib/api-client';
import { getIsLoggedIn } from '../../../lib/session';

type Props = {
  params: Promise<{ token: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const preview = await getPlanPreview(token);
  if (!preview) return { title: 'Plan Not Found — HipTrip' };
  return {
    title: `${preview.planOption.title} — HipTrip`,
    description: preview.planOption.rationale || `A road trip near ${preview.location}`,
    openGraph: {
      title: preview.planOption.title,
      description: preview.planOption.rationale || `A road trip near ${preview.location}`,
      siteName: 'HipTrip',
    },
  };
}

const KM_PER_MILE = 1.60934;

export default async function PlanPreviewPage({ params }: Props) {
  const { token } = await params;
  const [preview, isLoggedIn] = await Promise.all([
    getPlanPreview(token),
    getIsLoggedIn(),
  ]);

  if (!preview) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-wayfarer-bg px-6">
        <div className="max-w-sm text-center">
          <p className="mb-3 font-display text-2xl font-bold text-wayfarer-primary">
            Preview not found
          </p>
          <p className="mb-6 font-body text-sm text-wayfarer-text-muted">
            This preview link may have expired (links last 48 hours).
          </p>
          <Link
            href="/"
            className="inline-block rounded-xl bg-wayfarer-primary px-6 py-3 font-body text-sm font-bold text-white transition-opacity hover:opacity-90"
          >
            Plan your own trip
          </Link>
        </div>
      </div>
    );
  }

  const resolvedStops = preview.planOption.stops.filter(
    (s): s is PlannedStopResolved => s.status === 'resolved',
  );

  const expiresDate = new Date(preview.expiresAt);
  const expiresLabel = expiresDate.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div className="min-h-screen bg-wayfarer-bg">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-wayfarer-surface bg-white/90 px-4 py-3 backdrop-blur-md md:px-8">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <Link href="/" className="font-display text-lg font-bold text-wayfarer-primary">
            HipTrip
          </Link>
          <span className="font-body text-xs text-wayfarer-text-muted">
            Preview · expires {expiresLabel}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8 md:px-6">
        {/* Plan header */}
        <div className="rounded-card bg-white p-5 shadow-wayfarer-soft">
          <p className="mb-1 font-body text-xs uppercase tracking-[0.12em] text-wayfarer-secondary">
            {preview.themes.join(' · ')} · near {preview.location}
          </p>
          <h1 className="font-display text-2xl font-bold text-wayfarer-primary">
            {preview.planOption.title}
          </h1>
          {preview.planOption.rationale && (
            <p className="mt-2 font-body text-sm leading-relaxed text-wayfarer-text-muted">
              {preview.planOption.rationale}
            </p>
          )}
        </div>

        {/* Stop list */}
        <ol className="space-y-4">
          {resolvedStops.map((stop, i) => {
            const s = stop.suggestion;
            const distanceMi = Math.max(1, Math.round(s.distanceKm / KM_PER_MILE));
            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lng}&query_place_id=${s.placeId}`;
            return (
              <li key={s.id} className="rounded-card bg-white shadow-wayfarer-soft">
                {s.imageUrl ? (
                  <img
                    src={s.imageUrl}
                    alt={s.title}
                    className="h-44 w-full rounded-t-2xl object-cover"
                    loading={i === 0 ? 'eager' : 'lazy'}
                  />
                ) : (
                  <div className="flex h-44 w-full items-center justify-center rounded-t-2xl bg-wayfarer-surface font-body text-xs uppercase tracking-[0.12em] text-wayfarer-text-muted">
                    No image available
                  </div>
                )}
                <div className="p-4">
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-body text-xs uppercase tracking-[0.1em] text-wayfarer-text-muted">
                        Stop {i + 1}
                      </p>
                      <h2 className="font-display text-lg font-bold leading-snug text-wayfarer-primary">
                        {s.title}
                      </h2>
                    </div>
                    <span className="mt-1 shrink-0 font-body text-xs uppercase tracking-[0.1em] text-wayfarer-secondary">
                      {distanceMi} mi
                    </span>
                  </div>
                  <p className="mb-3 font-body text-sm leading-relaxed text-wayfarer-text-muted">
                    {s.description}
                  </p>
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-body text-xs font-semibold text-wayfarer-primary hover:underline"
                  >
                    Open in Maps ↗
                  </a>
                </div>
              </li>
            );
          })}
        </ol>

        {/* Save CTA */}
        <div className="rounded-card bg-white p-5 shadow-wayfarer-soft text-center">
          <p className="mb-1 font-display text-lg font-bold text-wayfarer-primary">
            Like this trip?
          </p>
          <p className="mb-4 font-body text-sm text-wayfarer-text-muted">
            Save it to your account to access it anytime and get full stop details.
          </p>
          {isLoggedIn ? (
            <Link
              href={`/?preview=${token}`}
              className="inline-block rounded-xl bg-wayfarer-primary px-6 py-3 font-body text-sm font-bold text-white shadow-wayfarer-ambient transition hover:opacity-90"
            >
              Save this trip →
            </Link>
          ) : (
            <Link
              href={`/sign-in?next=${encodeURIComponent(`/?preview=${token}`)}`}
              className="inline-block rounded-xl bg-wayfarer-primary px-6 py-3 font-body text-sm font-bold text-white shadow-wayfarer-ambient transition hover:opacity-90"
            >
              Sign in to save →
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}
