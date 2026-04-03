'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import GooglePlacesAutocomplete from '../../components/GooglePlacesAutocomplete';
import { savePlanOption, shareTrip } from '../../lib/api-client';
import type { PlannedStopResolved, TripPlanOption } from '../../lib/api-client';

type TripDraft = {
  plan: TripPlanOption;
  location: string;
  radiusKm: number;
  themes: string[];
  originLat: number;
  originLng: number;
};

type EditableStop = {
  id: string;
  placeId: string;
  name: string;
  description: string;
  lat: number;
  lng: number;
  imageUrl?: string;
};

const KM_PER_MILE = 1.60934;

/** Resolve lat/lng from a placeId using the Places Details API — more accurate than text geocoding. */
const getPlaceCoords = (
  placeId: string,
): Promise<{ lat: number; lng: number } | null> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.google?.maps?.places) {
      resolve(null);
      return;
    }
    // PlacesService requires a DOM element
    const el = document.createElement('div');
    const service = new window.google.maps.places.PlacesService(el);
    service.getDetails(
      { placeId, fields: ['geometry'] },
      (
        result: {
          geometry?: { location?: { lat: () => number; lng: () => number } };
        } | null,
        status: string,
      ) => {
        if (status === 'OK' && result?.geometry?.location) {
          resolve({
            lat: result.geometry.location.lat(),
            lng: result.geometry.location.lng(),
          });
        } else {
          resolve(null);
        }
      },
    );
  });
};

const resolvedStopsOnly = (stops: TripPlanOption['stops']): PlannedStopResolved[] =>
  stops.filter((s): s is PlannedStopResolved => s.status === 'resolved');

type PlanDetailProps = {
  draftKey: string | null;
};

const THEME_LABELS: Record<string, string> = {
  nature: 'Nature',
  history: 'History',
  food: 'Food & Drink',
  adventure: 'Adventure',
  art: 'Arts & Culture',
  family: 'Family',
  scenic: 'Scenic',
  quirky: 'Quirky',
};

const PlanDetail = ({ draftKey }: PlanDetailProps) => {
  const [draft, setDraft] = useState<TripDraft | null>(null);
  const [stops, setStops] = useState<EditableStop[]>([]);
  const [droppedCount, setDroppedCount] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [savedTripId, setSavedTripId] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  const [addQuery, setAddQuery] = useState('');
  const [addPlaceId, setAddPlaceId] = useState<string | null>(null);
  const [addingStop, setAddingStop] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    if (!draftKey) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as TripDraft;
      setDraft(parsed);

      const resolved = resolvedStopsOnly(parsed.plan.stops);
      setDroppedCount(parsed.plan.stops.length - resolved.length);
      setStops(
        resolved.map((s, i) => ({
          id: `${s.suggestion.placeId}-${i}`,
          placeId: s.suggestion.placeId,
          name: s.suggestion.title,
          description: s.suggestion.description,
          lat: s.suggestion.lat,
          lng: s.suggestion.lng,
          imageUrl: s.suggestion.imageUrl,
        })),
      );
    } catch {
      // localStorage unavailable or corrupt
    }
  }, [draftKey]);

  const handleRemove = (id: string) => {
    setStops((prev) => prev.filter((s) => s.id !== id));
  };

  const handleMoveUp = (id: string) => {
    setStops((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx <= 0) return prev;
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  };

  const handleMoveDown = (id: string) => {
    setStops((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  };

  const handleAddStop = async () => {
    if (!addQuery.trim() || !addPlaceId) return;
    setAddingStop(true);
    setAddError(null);

    const coords = await getPlaceCoords(addPlaceId);
    if (!coords) {
      setAddError('Could not resolve location. Try a more specific place name.');
      setAddingStop(false);
      return;
    }

    const newStop: EditableStop = {
      id: `added-${addPlaceId}-${Date.now()}`,
      placeId: addPlaceId,
      name: addQuery,
      description: '',
      lat: coords.lat,
      lng: coords.lng,
    };

    setStops((prev) => [...prev, newStop]);
    setAddQuery('');
    setAddPlaceId(null);
    setAddingStop(false);
  };

  const handleSave = () => {
    if (!draft || stops.length === 0) return;
    setSaveError(null);
    // Show the post-save UI immediately; action buttons are disabled until tripId resolves
    setSavedTripId('pending');

    void savePlanOption({
      title: draft.plan.title,
      rationale: draft.plan.rationale,
      location: draft.location,
      originLat: draft.originLat,
      originLng: draft.originLng,
      radiusKm: draft.radiusKm,
      themes: draft.themes,
      stops: stops.map((s, i) => ({
        placeId: s.placeId,
        name: s.name,
        lat: s.lat,
        lng: s.lng,
        imageUrl: s.imageUrl,
        order: i,
      })),
    }).then((result) => {
      if (result.saved) {
        try {
          if (draftKey) localStorage.removeItem(draftKey);
        } catch {
          // ignore
        }
        setSavedTripId(result.tripId);
      } else if (result.requiresAuth) {
        setSavedTripId(null);
        setShowSignInModal(true);
      } else {
        setSavedTripId(null);
        setSaveError(result.error ?? 'Save failed. Please try again.');
      }
    });
  };

  const handleShare = async () => {
    if (!savedTripId || savedTripId === 'pending') return;
    setSharing(true);
    setShareFeedback(null);

    const result = await shareTrip(savedTripId);
    setSharing(false);

    if (!result) {
      setShareFeedback('Could not generate share link. Try again.');
      return;
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: draft?.plan.title ?? 'My Road Trip',
          url: result.shareUrl,
        });
        return;
      } catch {
        // user cancelled or share failed — fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(result.shareUrl);
      setShareFeedback('Link copied!');
    } catch {
      setShareFeedback(result.shareUrl);
    }
  };

  if (!draft) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-wayfarer-bg font-body text-wayfarer-text-muted">
        <p>
          No trip plan found.{' '}
          <Link href="/" className="text-wayfarer-primary underline">
            Go back
          </Link>{' '}
          and select a plan first.
        </p>
      </div>
    );
  }

  const signInCallbackUrl = draftKey
    ? `/plan?draft=${encodeURIComponent(draftKey)}`
    : '/';

  const radiusMiles = Math.round(draft.radiusKm / KM_PER_MILE);
  const isPending = savedTripId === 'pending';

  return (
    <div className="min-h-screen bg-wayfarer-bg font-body text-wayfarer-text-main antialiased">
      {/* ── Header ─────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-wayfarer-accent/10 bg-wayfarer-bg/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-2xl items-center gap-4 px-4">
          <Link
            href="/#route-planner"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-wayfarer-surface"
            aria-label="Back to planner"
          >
            <span className="text-lg leading-none text-wayfarer-primary">←</span>
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-base font-extrabold leading-tight text-wayfarer-primary">
              {draft.plan.title}
            </p>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-wayfarer-text-muted">
              {draft.location} · {radiusMiles} mi
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-32 pt-6">
        {/* ── Theme + rationale ──────────────────────── */}
        {(draft.themes.length > 0 || draft.plan.rationale) && (
          <div className="mb-6 space-y-3">
            {draft.themes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {draft.themes.map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-wayfarer-surface px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-wayfarer-primary"
                  >
                    {THEME_LABELS[t] ?? t}
                  </span>
                ))}
              </div>
            )}
            {draft.plan.rationale && (
              <p className="text-sm leading-relaxed text-wayfarer-text-muted">
                {draft.plan.rationale}
              </p>
            )}
          </div>
        )}

        {droppedCount > 0 && (
          <div className="mb-4 rounded-2xl bg-wayfarer-surface px-4 py-3 text-xs text-wayfarer-text-muted">
            {droppedCount} stop{droppedCount > 1 ? 's were' : ' was'} unavailable and
            removed.
          </div>
        )}

        {/* ── Stop list ──────────────────────────────── */}
        {stops.length === 0 && (
          <div className="mb-4 rounded-2xl bg-wayfarer-surface p-8 text-center text-sm text-wayfarer-text-muted">
            No stops yet — add some below.
          </div>
        )}

        <div className="space-y-3">
          {stops.map((stop, idx) => (
            <div key={stop.id} className="flex gap-4 rounded-2xl bg-wayfarer-surface p-4">
              {/* Stop number */}
              <div className="flex shrink-0 flex-col items-center gap-1.5 pt-0.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-wayfarer-primary font-display text-sm font-extrabold text-white">
                  {idx + 1}
                </div>
                {/* Vertical connector line */}
                {idx < stops.length - 1 && (
                  <div
                    className="w-px flex-1 bg-wayfarer-accent/20"
                    style={{ minHeight: '12px' }}
                  />
                )}
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-3">
                  {/* Text */}
                  <div className="min-w-0 flex-1">
                    <p className="font-display font-bold leading-snug text-wayfarer-text-main">
                      {stop.name}
                    </p>
                    {stop.description && (
                      <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-wayfarer-text-muted">
                        {stop.description}
                      </p>
                    )}
                  </div>

                  {/* Thumbnail */}
                  {stop.imageUrl && (
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-wayfarer-surface-deep">
                      <img
                        src={stop.imageUrl}
                        alt={stop.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  )}
                </div>

                {/* Controls */}
                <div className="mt-3 flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Move up"
                    disabled={idx === 0}
                    onClick={() => handleMoveUp(stop.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-sm text-wayfarer-text-muted transition-colors hover:bg-wayfarer-surface-deep hover:text-wayfarer-primary disabled:opacity-25"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label="Move down"
                    disabled={idx === stops.length - 1}
                    onClick={() => handleMoveDown(stop.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-sm text-wayfarer-text-muted transition-colors hover:bg-wayfarer-surface-deep hover:text-wayfarer-primary disabled:opacity-25"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    aria-label="Remove stop"
                    onClick={() => handleRemove(stop.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-sm text-wayfarer-text-muted transition-colors hover:bg-red-50 hover:text-red-500"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* ── Add a stop ─────────────────────────────── */}
          <div className="rounded-2xl border-2 border-dashed border-wayfarer-accent/30 p-4 transition-colors focus-within:border-wayfarer-primary/40">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-wayfarer-text-muted">
              Add a stop
            </p>
            <div className="flex gap-2">
              <div className="flex-1">
                <GooglePlacesAutocomplete
                  value={addQuery}
                  onChange={(val) => {
                    setAddQuery(val);
                    setAddPlaceId(null);
                  }}
                  onSelect={(val) => setAddQuery(val)}
                  onSelectWithPlaceId={(description, placeId) => {
                    setAddQuery(description);
                    setAddPlaceId(placeId);
                  }}
                  placeholder="Search for a place…"
                  placeTypes={[]}
                  locationBias={{
                    lat: draft.originLat,
                    lng: draft.originLng,
                    radiusMeters: draft.radiusKm * 1000,
                  }}
                />
              </div>
              <button
                type="button"
                disabled={!addQuery.trim() || !addPlaceId || addingStop}
                onClick={() => void handleAddStop()}
                className="shrink-0 rounded-xl bg-wayfarer-primary px-5 py-2 font-body text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40"
              >
                {addingStop ? '…' : 'Add'}
              </button>
            </div>
            {addError && <p className="mt-2 text-xs text-red-500">{addError}</p>}
          </div>
        </div>
      </main>

      {/* ── Save error toast ────────────────────────── */}
      {saveError && (
        <div className="fixed bottom-28 left-1/2 z-40 -translate-x-1/2 whitespace-nowrap rounded-2xl bg-red-50 px-5 py-3 font-body text-sm text-red-600 shadow-wayfarer-ambient">
          {saveError}
        </div>
      )}

      {/* ── FAB — save / post-save actions ─────────── */}
      {savedTripId ? (
        <div className="fixed bottom-8 right-4 z-40 flex flex-col items-end gap-2 sm:right-8">
          <button
            type="button"
            disabled={sharing || isPending}
            onClick={() => void handleShare()}
            className="h-12 px-5 rounded-full bg-wayfarer-surface text-wayfarer-primary shadow-wayfarer-soft flex items-center gap-2 font-body font-semibold text-sm transition hover:opacity-80 disabled:opacity-40"
          >
            <span>↗</span>
            <span>{sharing ? 'Sharing…' : 'Share'}</span>
          </button>
          {savedTripId !== 'pending' ? (
            <Link
              href={`/trips/${savedTripId}/map`}
              className="h-12 px-5 rounded-full bg-wayfarer-primary text-white shadow-[0_8px_24px_rgba(27,67,50,0.35)] flex items-center gap-2 font-body font-bold text-sm hover:opacity-90 transition-opacity"
            >
              <span>🗺</span>
              <span>View Map</span>
            </Link>
          ) : (
            <div className="h-12 px-5 rounded-full bg-wayfarer-primary text-white shadow-[0_8px_24px_rgba(27,67,50,0.35)] flex items-center gap-2 font-body font-bold text-sm opacity-70">
              <span className="animate-pulse">⏳</span>
              <span>Saving…</span>
            </div>
          )}
          {shareFeedback && (
            <p className="rounded-full bg-wayfarer-surface px-4 py-2 text-center font-body text-xs text-wayfarer-text-muted shadow-wayfarer-soft">
              {shareFeedback}
            </p>
          )}
        </div>
      ) : (
        <button
          type="button"
          disabled={stops.length === 0}
          onClick={() => handleSave()}
          className="fixed bottom-8 right-4 z-40 h-14 px-6 sm:right-8 bg-wayfarer-primary text-white rounded-full shadow-[0_8px_24px_rgba(27,67,50,0.35)] flex items-center gap-2 font-body font-bold text-sm active:scale-95 transition-all hover:opacity-90 disabled:opacity-40"
        >
          <span className="text-base leading-none">🗺</span>
          <span>Save trip</span>
        </button>
      )}

      {/* ── Sign-in modal ──────────────────────────── */}
      {showSignInModal && (
        <div
          role="dialog"
          aria-modal
          aria-labelledby="signin-modal-title"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowSignInModal(false);
          }}
        >
          <div className="w-full max-w-sm rounded-t-3xl bg-wayfarer-bg p-8 shadow-wayfarer-ambient sm:rounded-3xl">
            <p
              className="mb-1 font-display text-xl font-bold text-wayfarer-primary"
              id="signin-modal-title"
            >
              Sign in to save
            </p>
            <p className="mb-6 font-body text-sm text-wayfarer-text-muted">
              Your trip is ready to save. Create a free account to keep it.
            </p>
            <Link
              href={`/sign-in?callbackUrl=${encodeURIComponent(signInCallbackUrl)}`}
              className="block w-full rounded-xl bg-wayfarer-primary px-4 py-3 text-center font-body text-sm font-bold text-white shadow-wayfarer-ambient transition hover:opacity-90"
            >
              Sign in with Google
            </Link>
            <button
              type="button"
              onClick={() => setShowSignInModal(false)}
              className="mt-3 w-full rounded-xl px-4 py-3 font-body text-sm font-semibold text-wayfarer-text-muted transition-colors hover:text-wayfarer-primary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanDetail;
