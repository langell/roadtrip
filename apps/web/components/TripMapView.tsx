'use client';
/* global google */

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import Logo from './Logo';
import ProfileDropdown from './ProfileDropdown';
import type { TripDetail, SponsoredStop, TripDetailStop } from '../lib/api-client';

const getApiToken = async (): Promise<string | undefined> => {
  try {
    const res = await fetch('/api/auth/api-token', {
      cache: 'no-store',
      credentials: 'same-origin',
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { token?: string };
    return data.token;
  } catch {
    return undefined;
  }
};

type Props = {
  trip: TripDetail;
  sponsored: SponsoredStop | null;
};

const formatDriveSegment = (min: number): string => {
  if (min < 60) return `${min} min drive`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h drive` : `${h}h ${m}m drive`;
};

const formatTotalTime = (min: number): string => {
  if (min < 60) return `${min}m drive`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h drive` : `${h}h ${m}m drive`;
};

const buildGoogleMapsUrl = (trip: TripDetail): string => {
  if (trip.stops.length === 0) return 'https://www.google.com/maps';
  const sorted = [...trip.stops].sort((a, b) => a.order - b.order);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (!first || !last) return 'https://www.google.com/maps';
  const origin = `${first.lat},${first.lng}`;
  const destination = `${last.lat},${last.lng}`;
  const waypoints = sorted
    .slice(1, -1)
    .map((s) => `${s.lat},${s.lng}`)
    .join('|');
  const url = new URL('https://www.google.com/maps/dir/');
  url.searchParams.set('api', '1');
  url.searchParams.set('origin', origin);
  url.searchParams.set('destination', destination);
  if (waypoints) url.searchParams.set('waypoints', waypoints);
  url.searchParams.set('travelmode', 'driving');
  return url.toString();
};

export default function TripMapView({ trip, sponsored }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [mapsReady, setMapsReady] = useState(false);
  const stopCardRefs = useRef<(HTMLDivElement | null)[]>([]);

  const sorted = [...trip.stops].sort((a, b) => a.order - b.order);
  const totalDriveMin = sorted.reduce((sum, s) => sum + (s.driveTimeMin ?? 0), 0);

  // Wait for the globally-loaded Maps API (GoogleMapsScriptLoader in layout)
  // to expose importLibrary — poll every 100 ms until it's ready.
  useEffect(() => {
    if (typeof window.google?.maps?.importLibrary === 'function') {
      setMapsReady(true);
      return;
    }
    const interval = setInterval(() => {
      if (typeof window.google?.maps?.importLibrary === 'function') {
        setMapsReady(true);
        clearInterval(interval);
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const handleMarkerClick = useCallback((idx: number) => {
    setActiveIdx(idx);
    stopCardRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

  // Initialise the map
  useEffect(() => {
    if (!mapsReady || !mapRef.current || sorted.length === 0) return;

    let cancelled = false;

    const init = async () => {
      // With loading=async all classes must come from importLibrary —
      // the google.maps namespace exists but constructors are not pre-populated.
      const [{ LatLngBounds }, { Map: GMap, Polyline }, { AdvancedMarkerElement }] =
        await Promise.all([
          google.maps.importLibrary('core') as Promise<google.maps.CoreLibrary>,
          google.maps.importLibrary('maps') as Promise<google.maps.MapsLibrary>,
          google.maps.importLibrary('marker') as Promise<google.maps.MarkerLibrary>,
        ]);

      if (cancelled) return;

      const bounds = new LatLngBounds();
      sorted.forEach((s) => bounds.extend({ lat: s.lat, lng: s.lng }));

      const map = new GMap(mapRef.current!, {
        // mapId is required for AdvancedMarkerElement; styles[] is ignored when mapId is set
        ...(process.env.NEXT_PUBLIC_GOOGLE_MAP_ID
          ? { mapId: process.env.NEXT_PUBLIC_GOOGLE_MAP_ID }
          : {}),
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: false,
        // Natural light style (only applied when no mapId; use Cloud-based styling otherwise)
        styles: [
          { featureType: 'poi', stylers: [{ visibility: 'off' }] },
          { featureType: 'transit', stylers: [{ visibility: 'off' }] },
          {
            featureType: 'road',
            elementType: 'geometry',
            stylers: [{ color: '#ffffff' }],
          },
          {
            featureType: 'road',
            elementType: 'geometry.stroke',
            stylers: [{ color: '#e8e8e3' }],
          },
          {
            featureType: 'landscape',
            elementType: 'geometry',
            stylers: [{ color: '#f4f4ef' }],
          },
          {
            featureType: 'water',
            elementType: 'geometry',
            stylers: [{ color: '#c8ddd4' }],
          },
          {
            featureType: 'administrative',
            elementType: 'labels.text.fill',
            stylers: [{ color: '#66615e' }],
          },
          {
            featureType: 'road',
            elementType: 'labels.text.fill',
            stylers: [{ color: '#66615e' }],
          },
        ],
      });
      map.fitBounds(bounds);
      mapInstanceRef.current = map;

      // Dashed route polyline
      new Polyline({
        path: sorted.map((s) => ({ lat: s.lat, lng: s.lng })),
        map,
        strokeColor: '#1B4332',
        strokeOpacity: 0,
        icons: [
          {
            icon: {
              path: 'M 0,-1 0,1',
              strokeOpacity: 1,
              strokeWeight: 3,
              scale: 4,
            },
            offset: '0',
            repeat: '16px',
          },
        ],
      });

      markersRef.current = sorted.map((stop, i) => {
        const pin = document.createElement('div');
        pin.style.cssText = [
          'width:32px',
          'height:32px',
          'border-radius:50%',
          'background:#1B4332',
          'border:3px solid #fff',
          'box-shadow:0 2px 8px rgba(0,0,0,0.25)',
          'display:flex',
          'align-items:center',
          'justify-content:center',
          'font-family:Plus Jakarta Sans,sans-serif',
          'font-size:13px',
          'font-weight:700',
          'color:#fff',
          'cursor:pointer',
        ].join(';');
        pin.textContent = String(i + 1);

        const marker = new AdvancedMarkerElement({
          position: { lat: stop.lat, lng: stop.lng },
          map,
          content: pin,
          title: stop.name,
        });
        marker.addListener('gmp-click', () => handleMarkerClick(i));
        return marker;
      });
    }; // end init

    void init();

    return () => {
      cancelled = true;
      markersRef.current.forEach((m) => {
        m.map = null;
      });
      markersRef.current = [];
    };
  }, [mapsReady, sorted.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update active marker size by restyling the pin element directly
  useEffect(() => {
    if (markersRef.current.length === 0) return;
    markersRef.current.forEach((marker, i) => {
      const pin = marker.content as HTMLElement | null;
      if (!pin) return;
      const isActive = i === activeIdx;
      pin.style.width = isActive ? '40px' : '32px';
      pin.style.height = isActive ? '40px' : '32px';
      pin.style.border = isActive ? '4px solid #fff' : '3px solid #fff';
      pin.style.fontSize = isActive ? '15px' : '13px';
    });
  }, [activeIdx]);

  // Build list items — sponsored card after stop index 1
  const listItems: Array<
    { type: 'stop'; stop: TripDetailStop; idx: number } | { type: 'sponsored' }
  > = [];
  sorted.forEach((stop, i) => {
    listItems.push({ type: 'stop', stop, idx: i });
    if (i === 1 && sponsored) listItems.push({ type: 'sponsored' });
  });

  return (
    <div className="flex h-screen flex-col bg-wayfarer-bg font-body text-wayfarer-text-main antialiased">
      {/* ── Top nav ──────────────────────────────────────────── */}
      <header className="fixed top-0 z-50 flex w-full items-center justify-between bg-wayfarer-bg/90 backdrop-blur-md px-6 py-4 shadow-[0_1px_0_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-8">
          <Logo />
          <nav className="hidden items-center gap-6 md:flex">
            <button className="font-display font-bold text-wayfarer-primary">Map</button>
            <button className="font-display text-wayfarer-text-muted transition-colors hover:text-wayfarer-primary">
              Stops
            </button>
            <button className="font-display text-wayfarer-text-muted transition-colors hover:text-wayfarer-primary">
              Journal
            </button>
            <button className="font-display text-wayfarer-text-muted transition-colors hover:text-wayfarer-primary">
              Profile
            </button>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <ShareButton tripId={trip.id} variant="header" />
          <Link
            href="/planner"
            className="rounded-xl bg-wayfarer-primary px-6 py-2 font-display font-bold text-white transition-opacity hover:opacity-90 active:scale-95"
          >
            New Trip
          </Link>
          <ProfileDropdown />
        </div>
      </header>

      {/* ── Main split layout ─────────────────────────────────── */}
      {/*
          Mobile  : stacked — map fixed height, itinerary scrolls below
          Desktop : side-by-side — map 60%, itinerary 40%
      */}
      <main className="flex min-h-screen flex-col pt-[64px] md:h-screen md:flex-row md:overflow-hidden">
        {/* Map panel */}
        <section className="relative h-[45vw] min-h-[240px] max-h-[360px] shrink-0 overflow-hidden md:h-auto md:max-h-none md:flex-[3]">
          <div ref={mapRef} className="h-full w-full" />
          {!mapsReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-wayfarer-surface">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-wayfarer-primary border-t-transparent" />
            </div>
          )}
          {/* Floating zoom controls */}
          <div className="pointer-events-none absolute bottom-6 left-6 flex flex-col gap-3">
            <button
              onClick={() =>
                mapInstanceRef.current?.setZoom(
                  (mapInstanceRef.current.getZoom() ?? 10) + 1,
                )
              }
              className="pointer-events-auto rounded-xl bg-white p-3 shadow-wayfarer-soft transition-colors hover:bg-wayfarer-surface"
            >
              <svg
                className="h-5 w-5 text-wayfarer-primary"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
            </button>
            <button
              onClick={() =>
                mapInstanceRef.current?.setZoom(
                  (mapInstanceRef.current.getZoom() ?? 10) - 1,
                )
              }
              className="pointer-events-auto rounded-xl bg-white p-3 shadow-wayfarer-soft transition-colors hover:bg-wayfarer-surface"
            >
              <svg
                className="h-5 w-5 text-wayfarer-primary"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M5 12h14" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </section>

        {/* ── Itinerary panel — full width scrollable on mobile, 40% on desktop ── */}
        <aside className="flex flex-col bg-wayfarer-bg md:min-h-0 md:flex-[2] md:overflow-hidden">
          {/* Panel header */}
          <div className="shrink-0 px-8 pb-4 pt-6">
            <h1 className="mb-1 font-display text-4xl font-extrabold leading-none tracking-tight text-wayfarer-primary">
              {trip.name}
            </h1>
            <p className="text-wayfarer-text-muted">
              {sorted.length} stop{sorted.length !== 1 ? 's' : ''}
              {totalDriveMin > 0 && ` • ${formatTotalTime(totalDriveMin)}`}
            </p>
            {trip.themes.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {trip.themes.map((theme) => (
                  <span
                    key={theme}
                    className="rounded-full bg-wayfarer-primary-light/30 px-4 py-1 text-xs font-bold uppercase tracking-wider text-wayfarer-primary"
                  >
                    {theme}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Scrollable stop list */}
          <div className="flex-1 overflow-y-auto px-8 py-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <div className="space-y-0">
              {listItems.map((item, itemIdx) => {
                if (item.type === 'sponsored') {
                  return (
                    <SponsoredCard
                      key="sponsored"
                      sponsored={sponsored!}
                      tripId={trip.id}
                    />
                  );
                }

                const { stop, idx } = item;
                const isActive = activeIdx === idx;
                const isFirst = idx === 0;
                const isLast = idx === sorted.length - 1;
                const nextStop = sorted[idx + 1];
                const driveToNext = nextStop?.driveTimeMin ?? null;
                // Don't show drive row if sponsored card follows (it renders between stops 2 and 3)
                const nextItemIsSponsored = listItems[itemIdx + 1]?.type === 'sponsored';

                return (
                  <div key={stop.id}>
                    <div className="flex gap-6">
                      {/* Timeline column */}
                      <div className="flex flex-col items-center">
                        <div
                          className={`flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full font-display text-sm font-bold text-white shadow-md transition-transform ${
                            isActive ? 'scale-110' : ''
                          }`}
                          style={{ backgroundColor: '#1B4332' }}
                          onClick={() => {
                            setActiveIdx(idx);
                            stopCardRefs.current[idx]?.scrollIntoView({
                              behavior: 'smooth',
                              block: 'nearest',
                            });
                          }}
                        >
                          {idx + 1}
                        </div>
                        {!isLast && (
                          <div className="my-3 min-h-8 w-0.5 flex-1 rounded-full bg-wayfarer-primary-light/30" />
                        )}
                      </div>

                      {/* Stop card */}
                      <div
                        ref={(el) => {
                          stopCardRefs.current[idx] = el;
                        }}
                        onClick={() => setActiveIdx(idx)}
                        className={`mb-4 flex-1 cursor-pointer rounded-3xl p-5 transition-colors group ${
                          isActive
                            ? 'bg-wayfarer-surface-deep'
                            : 'bg-wayfarer-surface hover:bg-wayfarer-surface-deep'
                        }`}
                      >
                        <div className="flex gap-4">
                          {stop.imageUrl ? (
                            <img
                              src={stop.imageUrl}
                              alt={stop.name}
                              className="h-20 w-20 shrink-0 rounded-2xl object-cover shadow-sm transition-transform group-hover:scale-105"
                            />
                          ) : (
                            <div className="h-20 w-20 shrink-0 rounded-2xl bg-wayfarer-surface-deep" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between">
                              <h3 className="font-display text-lg font-bold leading-tight text-wayfarer-primary">
                                {stop.name}
                              </h3>
                              <span className="ml-2 shrink-0 text-xs font-bold uppercase text-wayfarer-text-muted opacity-60">
                                {isFirst
                                  ? 'Start'
                                  : isLast
                                    ? 'Finish'
                                    : `Stop ${idx + 1}`}
                              </span>
                            </div>
                            {stop.notes && (
                              <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-wayfarer-text-muted">
                                {stop.notes}
                              </p>
                            )}
                            <Link
                              href={`/trips/${trip.id}/stops/${stop.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-wayfarer-primary/70 transition-colors hover:text-wayfarer-primary"
                            >
                              Details
                              <svg
                                className="h-3 w-3"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M5 12h14M12 5l7 7-7 7" />
                              </svg>
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Drive-time row between stops */}
                    {!isLast && !!driveToNext && !nextItemIsSponsored && (
                      <div className="mb-2 ml-4 flex items-center gap-3 py-1 pl-10">
                        <svg
                          className="h-4 w-4 shrink-0 text-wayfarer-primary-light"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M12 2 4.5 20.29l.71.71L12 18l6.79 3 .71-.71L12 2z" />
                        </svg>
                        <p className="text-xs font-bold uppercase italic tracking-widest text-wayfarer-text-muted/70">
                          {formatDriveSegment(driveToNext)}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Actions — inline at bottom of scroll, no sticky chrome */}
            <div className="flex items-center gap-4 pb-10 pt-4">
              <a
                href={buildGoogleMapsUrl(trip)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-1 items-center justify-center gap-3 rounded-2xl bg-wayfarer-primary py-4 font-display font-bold text-white shadow-wayfarer-ambient transition-opacity hover:opacity-95"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Start Trip
              </a>
              <ShareButton tripId={trip.id} variant="footer" />
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}

// ── Sponsored card ──────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

const recordAnalytics = (type: string, payload: Record<string, string>) => {
  void getApiToken().then((token) => {
    void fetch(`${API_BASE}/trpc/analytics.record`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ type, payload }),
    });
  });
};

function SponsoredCard({
  sponsored,
  tripId,
}: {
  sponsored: SponsoredStop;
  tripId: string;
}) {
  useEffect(() => {
    recordAnalytics('sponsored_impression', { placeId: sponsored.placeId, tripId });
  }, [sponsored.placeId, tripId]);

  const handleClick = () => {
    recordAnalytics('sponsored_click', { placeId: sponsored.placeId, tripId });
    if (sponsored.url) window.open(sponsored.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="mb-4 ml-14 rounded-3xl border border-wayfarer-tertiary-fixed/40 bg-wayfarer-tertiary-fixed/20 p-5 relative overflow-hidden">
      <div className="absolute right-3 top-3">
        <span className="rounded bg-wayfarer-tertiary-fixed px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-wayfarer-tertiary-fixed-dark">
          Ad
        </span>
      </div>
      <div className="flex items-center gap-4">
        {sponsored.imageUrl ? (
          <img
            src={sponsored.imageUrl}
            alt={sponsored.title}
            className="h-14 w-14 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-wayfarer-tertiary-fixed/40">
            <svg
              className="h-6 w-6 text-wayfarer-tertiary-fixed-dark"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z" />
            </svg>
          </div>
        )}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-wayfarer-tertiary-fixed-dark opacity-80">
            Along your route
          </p>
          <h4 className="font-display text-base font-extrabold text-wayfarer-primary">
            {sponsored.title}
          </h4>
          <p className="text-xs leading-relaxed text-wayfarer-text-muted">
            {sponsored.description}
          </p>
        </div>
      </div>
      {sponsored.url && (
        <button
          onClick={handleClick}
          className="mt-3 w-full rounded-xl border border-wayfarer-primary py-2 text-sm font-semibold text-wayfarer-primary transition hover:bg-wayfarer-primary hover:text-white"
        >
          Learn More
        </button>
      )}
    </div>
  );
}

// ── Share button ────────────────────────────────────────────────────────────

function ShareButton({
  tripId,
  variant,
}: {
  tripId: string;
  variant: 'header' | 'footer';
}) {
  const [state, setState] = useState<'idle' | 'copied'>('idle');

  const handleShare = async () => {
    try {
      const token = await getApiToken();
      const headers: Record<string, string> = {};
      if (token) headers.authorization = `Bearer ${token}`;
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001'}/trips/${encodeURIComponent(tripId)}/share`,
        { method: 'POST', headers },
      );
      if (!res.ok) return;
      const data = (await res.json()) as { shareUrl: string };

      if (navigator.share) {
        try {
          await navigator.share({ url: data.shareUrl });
          return;
        } catch {
          // user cancelled or share failed — fall through to clipboard
        }
      }

      await navigator.clipboard.writeText(data.shareUrl);
      setState('copied');
      setTimeout(() => setState('idle'), 2000);
    } catch {
      // ignore
    }
  };

  if (variant === 'footer') {
    return (
      <button
        onClick={() => void handleShare()}
        className="flex items-center gap-2 rounded-2xl px-6 py-4 font-display font-bold text-wayfarer-primary transition-colors hover:bg-wayfarer-surface-deep"
      >
        <svg
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
        {state === 'copied' ? 'Copied!' : 'Share'}
      </button>
    );
  }

  // header variant
  return (
    <button
      onClick={() => void handleShare()}
      className="hidden font-body font-medium text-wayfarer-text-muted transition-colors hover:text-wayfarer-primary md:block"
    >
      {state === 'copied' ? 'Copied!' : 'Share'}
    </button>
  );
}
