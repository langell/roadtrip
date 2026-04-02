'use client';
/* global google */

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import Logo from './Logo';
import { useRouter } from 'next/navigation';
import type { SharedPlan } from '../lib/api-client';
import { savePlanOption } from '../lib/api-client';

type Props = {
  plan: SharedPlan;
  shareToken: string;
  isLoggedIn: boolean;
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

const buildGoogleMapsUrl = (stops: SharedPlan['stops']): string => {
  if (stops.length === 0) return 'https://www.google.com/maps';
  const sorted = [...stops].sort((a, b) => a.order - b.order);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (!first || !last) return 'https://www.google.com/maps';
  const url = new URL('https://www.google.com/maps/dir/');
  url.searchParams.set('api', '1');
  url.searchParams.set('origin', `${first.lat},${first.lng}`);
  url.searchParams.set('destination', `${last.lat},${last.lng}`);
  const waypoints = sorted
    .slice(1, -1)
    .map((s) => `${s.lat},${s.lng}`)
    .join('|');
  if (waypoints) url.searchParams.set('waypoints', waypoints);
  url.searchParams.set('travelmode', 'driving');
  return url.toString();
};

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export default function SharedTripView({ plan, shareToken, isLoggedIn }: Props) {
  const router = useRouter();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [mapsReady, setMapsReady] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const stopCardRefs = useRef<(HTMLDivElement | null)[]>([]);

  const sorted = [...plan.stops].sort((a, b) => a.order - b.order);
  const totalDriveMin = sorted.reduce((sum, s) => sum + (s.driveTimeMin ?? 0), 0);

  const handleSave = useCallback(async () => {
    if (!isLoggedIn) {
      router.push(`/sign-in?callbackUrl=/s/${shareToken}`);
      return;
    }
    if (saveState === 'saving' || saveState === 'saved') return;
    setSaveState('saving');

    const first = sorted[0];
    const result = await savePlanOption({
      title: plan.name,
      rationale: plan.rationale,
      location: plan.location,
      originLat: first?.lat ?? 0,
      originLng: first?.lng ?? 0,
      radiusKm: 50,
      themes: plan.themes,
      stops: sorted.map((s, i) => ({
        placeId: s.placeId,
        name: s.name,
        lat: s.lat,
        lng: s.lng,
        notes: s.notes,
        imageUrl: s.imageUrl,
        order: i,
      })),
    });

    if (result.saved) {
      setSaveState('saved');
    } else if (!result.saved && result.requiresAuth) {
      router.push(`/sign-in?callbackUrl=/s/${shareToken}`);
    } else {
      setSaveState('error');
      setTimeout(() => setSaveState('idle'), 3000);
    }
  }, [isLoggedIn, saveState, plan, sorted, shareToken, router]);

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

  useEffect(() => {
    if (!mapsReady || !mapRef.current || sorted.length === 0) return;

    let cancelled = false;

    const init = async () => {
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
        ...(process.env.NEXT_PUBLIC_GOOGLE_MAP_ID
          ? { mapId: process.env.NEXT_PUBLIC_GOOGLE_MAP_ID }
          : {}),
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: false,
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

      new Polyline({
        path: sorted.map((s) => ({ lat: s.lat, lng: s.lng })),
        map,
        strokeColor: '#1B4332',
        strokeOpacity: 0,
        icons: [
          {
            icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, strokeWeight: 3, scale: 4 },
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
    };

    void init();

    return () => {
      cancelled = true;
      markersRef.current.forEach((m) => {
        m.map = null;
      });
      markersRef.current = [];
    };
  }, [mapsReady, sorted.length]); // eslint-disable-line react-hooks/exhaustive-deps

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

  return (
    <div className="flex h-screen flex-col bg-wayfarer-bg font-body text-wayfarer-text-main antialiased">
      {/* Header */}
      <header className="fixed top-0 z-50 flex w-full items-center justify-between bg-wayfarer-bg/90 backdrop-blur-md px-6 py-4 shadow-[0_1px_0_rgba(0,0,0,0.04)]">
        <Logo />
        <div className="flex items-center gap-2">
          {/* Save button — outlined secondary pill */}
          <button
            onClick={() => void handleSave()}
            className={`flex h-9 items-center gap-2 rounded-full border px-4 font-display text-sm font-bold transition-all active:scale-95 ${
              saveState === 'saved'
                ? 'border-wayfarer-primary bg-wayfarer-primary text-white'
                : saveState === 'error'
                  ? 'border-red-300 bg-red-50 text-red-500'
                  : 'border-wayfarer-primary/30 bg-transparent text-wayfarer-primary hover:border-wayfarer-primary hover:bg-wayfarer-surface'
            }`}
          >
            {saveState === 'saving' ? (
              <svg
                className="h-3.5 w-3.5 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            ) : saveState === 'saved' ? (
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5 3a2 2 0 0 0-2 2v16l9-4 9 4V5a2 2 0 0 0-2-2H5Z" />
              </svg>
            ) : (
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            )}
            {saveState === 'saved' ? 'Saved' : saveState === 'error' ? 'Failed' : 'Save'}
          </button>

          {/* Plan your own button — filled primary pill */}
          <Link
            href="/"
            className="flex h-9 items-center rounded-full bg-wayfarer-primary px-5 font-display text-sm font-bold text-white transition-opacity hover:opacity-90 active:scale-95"
          >
            Plan your own
          </Link>
        </div>
      </header>

      {/* Main split layout */}
      <main className="flex min-h-screen flex-col pt-[64px] md:h-screen md:flex-row md:overflow-hidden">
        {/* Map panel */}
        <section className="relative h-[45vw] min-h-[240px] max-h-[360px] shrink-0 overflow-hidden md:h-auto md:max-h-none md:flex-[3]">
          <div ref={mapRef} className="h-full w-full" />
          {!mapsReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-wayfarer-surface">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-wayfarer-primary border-t-transparent" />
            </div>
          )}
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

        {/* Itinerary panel */}
        <aside className="flex flex-col bg-wayfarer-bg md:min-h-0 md:flex-[2] md:overflow-hidden">
          {/* Panel header */}
          <div className="shrink-0 px-8 pb-4 pt-6">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-wayfarer-text-muted">
              ✦ A friend thinks you&rsquo;d love this
            </p>
            <h1 className="mb-1 font-display text-4xl font-extrabold leading-none tracking-tight text-wayfarer-primary">
              {plan.name}
            </h1>
            <p className="text-wayfarer-text-muted">
              {sorted.length} stop{sorted.length !== 1 ? 's' : ''}
              {totalDriveMin > 0 && ` • ${formatTotalTime(totalDriveMin)}`}
            </p>
            {plan.themes.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {plan.themes.map((theme) => (
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

          {plan.rationale && (
            <p className="shrink-0 px-8 pb-4 text-sm leading-relaxed text-wayfarer-text-muted italic">
              &ldquo;{plan.rationale}&rdquo;
            </p>
          )}

          {/* Scrollable stop list */}
          <div className="flex-1 overflow-y-auto px-8 py-4 md:overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <div className="space-y-0">
              {sorted.map((stop, idx) => {
                const isActive = activeIdx === idx;
                const isFirst = idx === 0;
                const isLast = idx === sorted.length - 1;
                const nextStop = sorted[idx + 1];
                const driveToNext = nextStop?.driveTimeMin ?? null;

                return (
                  <div key={stop.order}>
                    <div className="flex gap-6">
                      {/* Timeline column */}
                      <div className="flex flex-col items-center">
                        <div
                          className={`flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full font-display text-sm font-bold text-white shadow-md transition-transform ${isActive ? 'scale-110' : ''}`}
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
                        className={`mb-4 flex-1 cursor-pointer rounded-3xl p-5 transition-colors group ${isActive ? 'bg-wayfarer-surface-deep' : 'bg-wayfarer-surface hover:bg-wayfarer-surface-deep'}`}
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
                              href={`/s/${shareToken}/stops/${stop.id}`}
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

                    {/* Drive-time row */}
                    {!isLast && driveToNext && (
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

            {/* Actions */}
            <div className="flex items-center gap-4 pb-10 pt-4">
              <a
                href={buildGoogleMapsUrl(plan.stops)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-1 items-center justify-center gap-3 rounded-2xl bg-wayfarer-primary py-4 font-display font-bold text-white shadow-wayfarer-ambient transition-opacity hover:opacity-95"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Start Trip
              </a>
              <Link
                href="/"
                className="flex items-center gap-2 rounded-2xl px-6 py-4 font-display font-bold text-wayfarer-primary transition-colors hover:bg-wayfarer-surface-deep text-sm"
              >
                Plan your own →
              </Link>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
