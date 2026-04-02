import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getSharedTrip } from '../../../../../lib/api-client';

type Props = {
  params: Promise<{ token: string; stopId: string }>;
};

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

const buildDirectionsUrl = (lat: number, lng: number, name: string): string => {
  const dest = encodeURIComponent(`${name}@${lat},${lng}`);
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;
};

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

const formatDrive = (min: number | null): string | null => {
  if (!min) return null;
  if (min < 60) return `${min} min drive`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h drive` : `${h}h ${m}m drive`;
};

const SharedStopDetailPage = async ({ params }: Props) => {
  const { token, stopId } = await params;

  const plan = await getSharedTrip(token);
  if (!plan) notFound();

  const sorted = [...plan.stops].sort((a, b) => a.order - b.order);
  const waypointIndex = sorted.findIndex((s) => s.id === stopId);
  const stop = sorted[waypointIndex];
  if (waypointIndex === -1 || !stop) notFound();
  const waypointNum = waypointIndex + 1;
  const totalStops = sorted.length;
  const driveLabel = formatDrive(stop.driveTimeMin);
  const isFirst = waypointIndex === 0;
  const isLast = waypointIndex === totalStops - 1;
  const stopLabel = isFirst
    ? 'Start'
    : isLast
      ? 'Final Stop'
      : `Stop ${waypointNum} of ${totalStops}`;
  const staticMapUrl = buildStaticMapUrl(stop.lat, stop.lng);
  const directionsUrl = buildDirectionsUrl(stop.lat, stop.lng, stop.name);
  const backHref = `/s/${token}`;

  return (
    <div className="min-h-screen bg-wayfarer-bg font-body text-wayfarer-text-main antialiased">
      {/* ── Header ───────────────────────────────────────────── */}
      <header className="fixed top-0 z-50 flex h-16 w-full items-center justify-between bg-wayfarer-bg/80 px-4 backdrop-blur-xl md:px-6">
        <div className="flex items-center gap-3">
          <Link
            href={backHref}
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
            {plan.name}
          </span>
        </div>
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
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-24 pt-20 md:px-8">
        {/* ── Hero editorial section ────────────────────────── */}
        <section className="mt-4 grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
          {/* Large image — left 8 cols */}
          <div className="relative lg:col-span-8">
            <div className="aspect-[4/3] overflow-hidden rounded-[2rem] bg-wayfarer-surface shadow-wayfarer-ambient md:aspect-[16/10]">
              {stop.imageUrl ? (
                <img
                  src={stop.imageUrl}
                  alt={stop.name}
                  className="h-full w-full object-cover"
                />
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

            {/* Floating metadata card — desktop only */}
            <div className="hidden lg:absolute lg:-right-10 lg:bottom-10 lg:flex lg:w-60 lg:flex-col lg:gap-4 lg:rounded-3xl lg:bg-wayfarer-bg/90 lg:p-5 lg:shadow-wayfarer-ambient lg:backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-wayfarer-primary-light/30">
                  <svg
                    className="h-5 w-5 text-wayfarer-primary"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polygon points="3 11 22 2 13 21 11 13 3 11" />
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-wayfarer-text-muted">
                    Position
                  </p>
                  <p className="font-semibold text-wayfarer-text-main">{stopLabel}</p>
                </div>
              </div>
              {driveLabel && (
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-wayfarer-secondary/10">
                    <svg
                      className="h-5 w-5 text-wayfarer-secondary"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-wayfarer-text-muted">
                      Drive Time
                    </p>
                    <p className="font-semibold text-wayfarer-text-main">{driveLabel}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Inline metadata chips — mobile only */}
          <div className="flex items-center gap-3 lg:hidden">
            <span className="flex items-center gap-2 rounded-full bg-wayfarer-surface px-4 py-2 text-sm font-semibold text-wayfarer-text-main shadow-wayfarer-soft">
              <svg
                className="h-4 w-4 text-wayfarer-primary"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polygon points="3 11 22 2 13 21 11 13 3 11" />
              </svg>
              {stopLabel}
            </span>
            {driveLabel && (
              <span className="flex items-center gap-2 rounded-full bg-wayfarer-surface px-4 py-2 text-sm font-semibold text-wayfarer-text-main shadow-wayfarer-soft">
                <svg
                  className="h-4 w-4 text-wayfarer-secondary"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                {driveLabel}
              </span>
            )}
          </div>

          {/* Title & narrative — right 4 cols */}
          <div className="space-y-8 lg:col-span-4 lg:pl-4">
            <div className="space-y-2">
              <span className="inline-block rounded-full bg-wayfarer-tertiary-fixed px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-wayfarer-tertiary-fixed-dark">
                Waypoint {String(waypointNum).padStart(2, '0')}
              </span>
              <h1 className="font-display text-4xl font-extrabold leading-tight tracking-tight text-wayfarer-primary md:text-5xl lg:text-6xl">
                {stop.name}
              </h1>
              {plan.location && (
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
                  <p className="text-sm font-medium">{plan.location}</p>
                </div>
              )}
            </div>

            <div className="space-y-6">
              {stop.notes ? (
                <>
                  <p className="pl-5 text-lg leading-relaxed text-wayfarer-text-muted">
                    {stop.notes}
                  </p>
                  <div className="h-px w-12 bg-wayfarer-primary-light" />
                </>
              ) : (
                <p className="text-wayfarer-text-muted">
                  Stop {waypointNum} of {totalStops} on {plan.name}.
                </p>
              )}

              {plan.themes.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {plan.themes.map((theme) => (
                    <span
                      key={theme}
                      className="rounded-full bg-wayfarer-primary-light/30 px-3 py-1 text-xs font-bold uppercase tracking-wider text-wayfarer-primary"
                    >
                      {theme}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-3 pt-2">
              <a
                href={directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-3 rounded-xl bg-wayfarer-primary py-4 px-6 font-display font-bold text-white shadow-wayfarer-ambient transition-transform hover:scale-[1.02] active:scale-95"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="3 11 22 2 13 21 11 13 3 11" />
                </svg>
                Get Directions
              </a>
              <Link
                href={backHref}
                className="flex w-full items-center justify-center gap-3 rounded-xl bg-wayfarer-surface-deep py-4 px-6 font-display font-bold text-wayfarer-primary transition-transform hover:scale-[1.02] active:scale-95"
              >
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                </svg>
                View Full Trip
              </Link>
            </div>
          </div>
        </section>

        {/* ── Details grid ─────────────────────────────────── */}
        <section className="mt-20 grid grid-cols-1 gap-8 md:grid-cols-3">
          {/* Route position card */}
          <div className="rounded-3xl bg-wayfarer-surface p-8 shadow-wayfarer-soft">
            <h3 className="mb-5 font-display text-xl font-bold text-wayfarer-text-main">
              Route Info
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between border-b border-wayfarer-accent/20 pb-3 text-sm">
                <span className="text-wayfarer-text-muted">Trip</span>
                <span className="font-bold text-wayfarer-text-main">{plan.name}</span>
              </div>
              <div className="flex justify-between border-b border-wayfarer-accent/20 pb-3 text-sm">
                <span className="text-wayfarer-text-muted">Waypoint</span>
                <span className="font-bold text-wayfarer-text-main">
                  {waypointNum} of {totalStops}
                </span>
              </div>
              {driveLabel && (
                <div className="flex justify-between text-sm">
                  <span className="text-wayfarer-text-muted">Drive Time</span>
                  <span className="font-bold text-wayfarer-text-main">{driveLabel}</span>
                </div>
              )}
            </div>
            {plan.themes.length > 0 && (
              <p className="mt-5 text-xs italic text-wayfarer-text-muted">
                {plan.themes.join(' · ')}
              </p>
            )}
          </div>

          {/* Map snippet — 2 cols */}
          <div
            className="group relative overflow-hidden rounded-3xl shadow-wayfarer-ambient md:col-span-2"
            style={{ height: '280px' }}
          >
            {staticMapUrl ? (
              <img
                src={staticMapUrl}
                alt={`Map showing ${stop.name}`}
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-wayfarer-surface-deep">
                <p className="text-sm text-wayfarer-text-muted">Map unavailable</p>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-wayfarer-primary/40 to-transparent" />
            <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between">
              <div className="rounded-2xl bg-wayfarer-bg/90 p-4 backdrop-blur-md">
                <p className="text-[10px] font-bold uppercase tracking-widest text-wayfarer-text-muted">
                  Coordinates
                </p>
                <p className="font-bold text-wayfarer-primary">
                  {stop.lat.toFixed(4)}°, {stop.lng.toFixed(4)}°
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

        {/* ── Other stops on this trip ──────────────────────── */}
        {totalStops > 1 && (
          <section className="mt-8">
            <h3 className="mb-4 font-display text-lg font-bold text-wayfarer-text-main">
              Also on this trip
            </h3>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {sorted
                .filter((s) => s.id !== stop.id)
                .slice(0, 4)
                .map((s) => {
                  const idx = sorted.findIndex((x) => x.id === s.id);
                  return (
                    <Link
                      key={s.id}
                      href={`/s/${token}/stops/${s.id}`}
                      className="group relative aspect-square overflow-hidden rounded-2xl bg-wayfarer-surface-deep"
                    >
                      {s.imageUrl ? (
                        <img
                          src={s.imageUrl}
                          alt={s.name}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="h-full w-full bg-wayfarer-surface-deep" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-white/70">
                          Stop {idx + 1}
                        </p>
                        <p className="truncate text-sm font-bold text-white">{s.name}</p>
                      </div>
                    </Link>
                  );
                })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default SharedStopDetailPage;
