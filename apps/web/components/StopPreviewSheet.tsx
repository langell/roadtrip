'use client';

import { useEffect } from 'react';

const KM_PER_MILE = 1.60934;

export type PreviewStop = {
  title: string;
  description: string;
  imageUrl?: string;
  distanceKm: number;
  lat: number;
  lng: number;
  placeId: string;
};

type Props = {
  stop: PreviewStop | null;
  onClose: () => void;
};

export default function StopPreviewSheet({ stop, onClose }: Props) {
  // Close on Escape
  useEffect(() => {
    if (!stop) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [stop, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (stop) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [stop]);

  if (!stop) return null;

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${stop.lat},${stop.lng}&query_place_id=${stop.placeId}`;
  const distanceMi = Math.max(1, Math.round(stop.distanceKm / KM_PER_MILE));

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Sheet — bottom on mobile, centered on md+ */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={stop.title}
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-white shadow-2xl md:inset-x-auto md:left-1/2 md:top-1/2 md:bottom-auto md:w-full md:max-w-md md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl"
      >
        {/* Handle bar (mobile) */}
        <div className="flex justify-center pt-3 md:hidden">
          <div className="h-1 w-10 rounded-full bg-wayfarer-surface" />
        </div>

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          className="absolute right-4 top-4 rounded-full bg-wayfarer-surface p-1.5 text-wayfarer-text-muted hover:text-wayfarer-primary"
        >
          ✕
        </button>

        {/* Photo */}
        {stop.imageUrl ? (
          <img
            src={stop.imageUrl}
            alt={stop.title}
            className="mt-4 h-48 w-full object-cover md:mt-0 md:h-56 md:rounded-t-3xl"
          />
        ) : (
          <div className="mt-4 flex h-48 w-full items-center justify-center bg-wayfarer-surface font-body text-xs uppercase tracking-[0.12em] text-wayfarer-text-muted md:mt-0 md:h-56 md:rounded-t-3xl">
            No image available
          </div>
        )}

        {/* Content */}
        <div className="space-y-3 p-5">
          <div>
            <h2 className="font-display text-xl font-bold text-wayfarer-primary">
              {stop.title}
            </h2>
            <p className="font-body text-xs uppercase tracking-[0.12em] text-wayfarer-secondary">
              {distanceMi} mi away
            </p>
          </div>

          <p className="font-body text-sm leading-relaxed text-wayfarer-text-muted">
            {stop.description}
          </p>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 rounded-xl border border-wayfarer-surface py-2.5 text-center font-body text-sm font-semibold text-wayfarer-text-main transition hover:border-wayfarer-primary hover:text-wayfarer-primary"
            >
              Open in Maps ↗
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
