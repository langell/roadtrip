'use client';
/* global google */

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import type { TripDetail, SponsoredStop, TripDetailStop } from '../lib/api-client';

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

type Props = {
  trip: TripDetail;
  sponsored: SponsoredStop | null;
};

const formatDrive = (min: number | null): string | null => {
  if (min === null) return null;
  if (min < 60) return `~${min} min drive`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `~${h}h drive` : `~${h}h ${m}m drive`;
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
  const markersRef = useRef<google.maps.Marker[]>([]);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [mapsReady, setMapsReady] = useState(false);
  const stopListRef = useRef<HTMLDivElement>(null);
  const stopCardRefs = useRef<(HTMLDivElement | null)[]>([]);

  const sorted = [...trip.stops].sort((a, b) => a.order - b.order);

  // Poll for google.maps to be available (script loaded by GoogleMapsScriptLoader or injected here)
  useEffect(() => {
    if (window.google?.maps) {
      setMapsReady(true);
      return;
    }
    if (!GOOGLE_MAPS_API_KEY) return;
    if (!document.getElementById('gmap-script-map')) {
      const s = document.createElement('script');
      s.id = 'gmap-script-map';
      s.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}`;
      s.async = true;
      s.onload = () => setMapsReady(true);
      document.head.appendChild(s);
    } else {
      const interval = setInterval(() => {
        if (window.google?.maps) {
          setMapsReady(true);
          clearInterval(interval);
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, []);

  const handleMarkerClick = useCallback((idx: number) => {
    setActiveIdx(idx);
    const card = stopCardRefs.current[idx];
    card?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

  useEffect(() => {
    if (!mapsReady || !mapRef.current || sorted.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    sorted.forEach((s) => bounds.extend({ lat: s.lat, lng: s.lng }));

    const map = new google.maps.Map(mapRef.current, {
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      styles: [
        { elementType: 'geometry', stylers: [{ color: '#1a2a1a' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#8ec89a' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#1a2a1a' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a4a2a' }] },
        {
          featureType: 'water',
          elementType: 'geometry',
          stylers: [{ color: '#0d1f0d' }],
        },
      ],
    });
    map.fitBounds(bounds);
    mapInstanceRef.current = map;

    // Draw polyline
    const path = sorted.map((s) => ({ lat: s.lat, lng: s.lng }));
    new google.maps.Polyline({
      path,
      map,
      strokeColor: '#4ade80',
      strokeOpacity: 0.9,
      strokeWeight: 3,
    });

    // Draw numbered markers
    markersRef.current = sorted.map((stop, i) => {
      const marker = new google.maps.Marker({
        position: { lat: stop.lat, lng: stop.lng },
        map,
        label: {
          text: String(i + 1),
          color: '#fff',
          fontWeight: 'bold',
          fontSize: '12px',
        },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 14,
          fillColor: '#22c55e',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2,
        },
        title: stop.name,
      });
      marker.addListener('click', () => handleMarkerClick(i));
      return marker;
    });

    return () => {
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
    };
  }, [mapsReady, sorted.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update marker appearance when activeIdx changes
  useEffect(() => {
    markersRef.current.forEach((marker, i) => {
      marker.setIcon({
        path: google.maps.SymbolPath.CIRCLE,
        scale: i === activeIdx ? 18 : 14,
        fillColor: i === activeIdx ? '#16a34a' : '#22c55e',
        fillOpacity: 1,
        strokeColor: '#fff',
        strokeWeight: 2,
      });
    });
  }, [activeIdx]);

  // Insert sponsored card between stop index 1 and 2 (after stop 2)
  const listItems: Array<
    { type: 'stop'; stop: TripDetailStop; idx: number } | { type: 'sponsored' }
  > = [];
  sorted.forEach((stop, i) => {
    listItems.push({ type: 'stop', stop, idx: i });
    if (i === 1 && sponsored) {
      listItems.push({ type: 'sponsored' });
    }
  });

  return (
    <div className="flex h-screen flex-col bg-wayfarer-bg font-body text-wayfarer-text-main antialiased">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-wayfarer-accent/30 bg-wayfarer-bg px-5">
        <Link
          href="/trips"
          className="flex items-center gap-2 text-sm font-semibold text-wayfarer-text-muted transition-colors hover:text-wayfarer-primary"
        >
          ← My Trips
        </Link>
        <p className="truncate px-4 font-display text-sm font-bold text-wayfarer-primary md:text-base">
          {trip.name}
        </p>
        <div className="w-20" />
      </header>

      {/* Body */}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* Map panel — 60% on desktop, full width collapsed on mobile */}
        <div className="relative h-64 shrink-0 md:h-auto md:flex-[3]">
          <div ref={mapRef} className="h-full w-full" />
          {!mapsReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-wayfarer-surface">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-wayfarer-primary border-t-transparent" />
            </div>
          )}
        </div>

        {/* Stop list panel — 40% on desktop */}
        <div
          ref={stopListRef}
          className="flex flex-col overflow-y-auto border-l border-wayfarer-accent/20 bg-wayfarer-bg md:flex-[2]"
        >
          <div className="space-y-3 p-4">
            {listItems.map((item) => {
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

              return (
                <div
                  key={stop.id}
                  ref={(el) => {
                    stopCardRefs.current[idx] = el;
                  }}
                  onClick={() => setActiveIdx(idx)}
                  className={`cursor-pointer rounded-2xl border p-4 transition ${
                    isActive
                      ? 'border-wayfarer-primary bg-wayfarer-surface shadow-wayfarer-ambient'
                      : 'border-wayfarer-accent/20 bg-wayfarer-surface hover:border-wayfarer-primary/40'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        isActive
                          ? 'bg-wayfarer-primary text-white'
                          : 'bg-wayfarer-primary/15 text-wayfarer-primary'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-sm font-bold leading-snug text-wayfarer-primary">
                        {stop.name}
                      </p>
                      {stop.driveTimeMin !== null && (
                        <p className="mt-0.5 text-xs text-wayfarer-text-muted">
                          {formatDrive(stop.driveTimeMin)}
                        </p>
                      )}
                      {stop.notes && (
                        <p className="mt-1 line-clamp-2 text-xs text-wayfarer-text-muted">
                          {stop.notes}
                        </p>
                      )}
                    </div>
                    {stop.imageUrl && (
                      <img
                        src={stop.imageUrl}
                        alt={stop.name}
                        className="h-14 w-14 shrink-0 rounded-xl object-cover"
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom CTAs */}
          <div className="sticky bottom-0 border-t border-wayfarer-accent/20 bg-wayfarer-bg p-4">
            <div className="flex gap-3">
              <a
                href={buildGoogleMapsUrl(trip)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 rounded-xl bg-wayfarer-primary py-3 text-center text-sm font-bold text-white shadow-wayfarer-ambient transition hover:opacity-90"
              >
                Start Trip
              </a>
              {trip.shareToken && <ShareButton tripId={trip.id} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SponsoredCard({
  sponsored,
  tripId,
}: {
  sponsored: SponsoredStop;
  tripId: string;
}) {
  const handleAddToTrip = () => {
    // Fire analytics event via tRPC — best-effort, no await
    void fetch('/api/trpc/analytics.record', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'sponsored_click',
        payload: { placeId: sponsored.placeId, tripId },
      }),
    });
    if (sponsored.url) {
      window.open(sponsored.url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="rounded-2xl border border-wayfarer-accent/30 bg-wayfarer-surface-deep p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-wayfarer-text-muted">
          Suggested stop along your route
        </p>
        <span className="rounded-full bg-wayfarer-accent/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-wayfarer-text-muted">
          Ad
        </span>
      </div>
      <div className="flex items-start gap-3">
        {sponsored.imageUrl ? (
          <img
            src={sponsored.imageUrl}
            alt={sponsored.title}
            className="h-14 w-14 shrink-0 rounded-xl object-cover"
          />
        ) : (
          <div className="h-14 w-14 shrink-0 rounded-xl bg-wayfarer-primary/20" />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-bold leading-snug text-wayfarer-primary">
            {sponsored.title}
          </p>
          <p className="mt-0.5 line-clamp-2 text-xs text-wayfarer-text-muted">
            {sponsored.description}
          </p>
        </div>
      </div>
      <button
        onClick={handleAddToTrip}
        className="mt-3 w-full rounded-xl border border-wayfarer-primary py-2 text-sm font-semibold text-wayfarer-primary transition hover:bg-wayfarer-primary hover:text-white"
      >
        Add to Trip
      </button>
    </div>
  );
}

function ShareButton({ tripId }: { tripId: string }) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001'}/trips/${encodeURIComponent(tripId)}/share`,
        {
          method: 'POST',
        },
      );
      if (!res.ok) return;
      const data = (await res.json()) as { shareUrl: string };
      await navigator.clipboard.writeText(data.shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <button
      onClick={() => {
        void handleShare();
      }}
      className="rounded-xl border border-wayfarer-primary px-5 py-3 text-sm font-bold text-wayfarer-primary transition hover:bg-wayfarer-primary hover:text-white"
    >
      {copied ? 'Copied!' : 'Share'}
    </button>
  );
}
