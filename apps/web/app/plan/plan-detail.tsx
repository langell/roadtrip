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

// ── SVG icons ──────────────────────────────────────────────
const IconChevronUp = () => (
  <svg
    className="h-3.5 w-3.5"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.5}
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
  </svg>
);
const IconChevronDown = () => (
  <svg
    className="h-3.5 w-3.5"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.5}
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
  </svg>
);
const IconX = () => (
  <svg
    className="h-3.5 w-3.5"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);
const IconPin = () => (
  <svg className="h-3 w-3 shrink-0" fill="currentColor" viewBox="0 0 24 24">
    <path
      fillRule="evenodd"
      d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-2.006 3.699-4.92 3.699-8.327a8 8 0 10-16 0c0 3.407 1.755 6.321 3.7 8.327a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.144.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z"
      clipRule="evenodd"
    />
  </svg>
);
const IconPlus = () => (
  <svg
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.5}
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
);
const IconShare = () => (
  <svg
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z"
    />
  </svg>
);
const IconMap = () => (
  <svg
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z"
    />
  </svg>
);

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
          title: draft?.plan.title ?? 'My HipTrip',
          url: result.shareUrl,
        });
        return;
      } catch {
        // user cancelled — fall through to clipboard
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
      {/* ── Sticky header ──────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-wayfarer-bg/95 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-3 px-4">
          <Link
            href="/#route-planner"
            aria-label="Back to planner"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-wayfarer-text-muted transition-colors hover:bg-wayfarer-surface hover:text-wayfarer-primary"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
              />
            </svg>
          </Link>

          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-sm font-extrabold leading-none text-wayfarer-text-main">
              {draft.plan.title}
            </p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest text-wayfarer-text-muted">
              {draft.location} · {radiusMiles} mi
            </p>
          </div>

          <span className="shrink-0 rounded-full bg-wayfarer-surface px-2.5 py-1 text-[11px] font-bold text-wayfarer-primary">
            {stops.length} stop{stops.length !== 1 ? 's' : ''}
          </span>
        </div>
        {/* thin green rule */}
        <div className="h-px bg-gradient-to-r from-transparent via-wayfarer-primary/20 to-transparent" />
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-36 pt-5">
        {/* ── Trip meta ──────────────────────────────────── */}
        <div className="mb-6">
          {draft.themes.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {draft.themes.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-wayfarer-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-wayfarer-primary"
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

        {droppedCount > 0 && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
            {droppedCount} stop{droppedCount > 1 ? 's were' : ' was'} unavailable and
            removed from this plan.
          </div>
        )}

        {stops.length === 0 && (
          <div className="mb-4 rounded-2xl bg-wayfarer-surface p-10 text-center text-sm text-wayfarer-text-muted">
            No stops yet — add one below.
          </div>
        )}

        {/* ── Stop list ──────────────────────────────────── */}
        <div>
          {stops.map((stop, idx) => (
            <div key={stop.id}>
              {/* Connector between cards */}
              {idx > 0 && (
                <div className="ml-[35px] h-3 w-0.5 bg-gradient-to-b from-wayfarer-primary/30 to-wayfarer-primary/10" />
              )}

              <div className="group flex gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/[0.06]">
                {/* Number badge */}
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-wayfarer-primary font-display text-sm font-extrabold text-white shadow-sm">
                  {idx + 1}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-[15px] font-bold leading-snug text-wayfarer-text-main">
                        {stop.name}
                      </p>
                      {stop.description && (
                        <div className="mt-1 flex items-center gap-1 text-wayfarer-text-muted">
                          <IconPin />
                          <p className="truncate text-xs leading-relaxed">
                            {stop.description}
                          </p>
                        </div>
                      )}
                    </div>

                    {stop.imageUrl && (
                      <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-wayfarer-surface-deep">
                        <img
                          src={stop.imageUrl}
                          alt={stop.name}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                      </div>
                    )}
                  </div>

                  {/* Controls */}
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        aria-label="Move up"
                        disabled={idx === 0}
                        onClick={() => handleMoveUp(stop.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-wayfarer-text-muted transition-colors hover:bg-wayfarer-surface hover:text-wayfarer-primary disabled:opacity-20"
                      >
                        <IconChevronUp />
                      </button>
                      <button
                        type="button"
                        aria-label="Move down"
                        disabled={idx === stops.length - 1}
                        onClick={() => handleMoveDown(stop.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-wayfarer-text-muted transition-colors hover:bg-wayfarer-surface hover:text-wayfarer-primary disabled:opacity-20"
                      >
                        <IconChevronDown />
                      </button>
                    </div>

                    <button
                      type="button"
                      aria-label="Remove stop"
                      onClick={() => handleRemove(stop.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-wayfarer-text-muted transition-colors hover:bg-red-50 hover:text-red-500"
                    >
                      <IconX />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* ── Add a stop ─────────────────────────────── */}
          <div className={stops.length > 0 ? 'mt-3' : ''}>
            <div className="rounded-2xl border-2 border-dashed border-wayfarer-accent/50 p-4 transition-colors focus-within:border-wayfarer-primary/50">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-dashed border-wayfarer-accent text-wayfarer-text-muted">
                  <IconPlus />
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-wayfarer-text-muted">
                  Add a stop
                </p>
              </div>

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
                    locationBias={(() => {
                      // Centre search on the midpoint of existing stops, not the trip origin,
                      // and use a tighter radius so results are local to the actual route.
                      const pts =
                        stops.length > 0
                          ? stops
                          : [{ lat: draft.originLat, lng: draft.originLng }];
                      const lat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
                      const lng = pts.reduce((s, p) => s + p.lng, 0) / pts.length;
                      // Half the trip radius, capped at 60 km (~37 mi)
                      const radiusMeters = Math.min(draft.radiusKm * 500, 60_000);
                      return { lat, lng, radiusMeters };
                    })()}
                  />
                </div>
                <button
                  type="button"
                  disabled={!addQuery.trim() || !addPlaceId || addingStop}
                  onClick={() => void handleAddStop()}
                  className="shrink-0 rounded-xl bg-wayfarer-primary px-5 font-body text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40"
                >
                  {addingStop ? '…' : 'Add'}
                </button>
              </div>

              {addError && <p className="mt-2 text-xs text-red-500">{addError}</p>}
            </div>
          </div>
        </div>
      </main>

      {/* ── Save error toast ────────────────────────────── */}
      {saveError && (
        <div className="fixed bottom-28 left-1/2 z-40 -translate-x-1/2 whitespace-nowrap rounded-xl bg-red-50 px-5 py-3 font-body text-sm text-red-600 shadow-wayfarer-ambient ring-1 ring-red-100">
          {saveError}
        </div>
      )}

      {/* ── FAB ─────────────────────────────────────────── */}
      {savedTripId ? (
        <div className="fixed bottom-6 right-4 z-40 flex flex-col items-end gap-2 sm:right-6">
          <button
            type="button"
            disabled={sharing || isPending}
            onClick={() => void handleShare()}
            className="flex h-11 items-center gap-2 rounded-full bg-white px-5 font-body text-sm font-semibold text-wayfarer-primary shadow-wayfarer-ambient ring-1 ring-black/[0.06] transition hover:shadow-wayfarer-soft disabled:opacity-40"
          >
            <IconShare />
            <span>{sharing ? 'Sharing…' : 'Share'}</span>
          </button>

          {savedTripId !== 'pending' ? (
            <Link
              href={`/trips/${savedTripId}/map`}
              className="flex h-14 items-center gap-2 rounded-full bg-wayfarer-primary px-6 font-body text-sm font-bold text-white shadow-[0_8px_24px_rgba(27,67,50,0.35)] transition hover:opacity-90"
            >
              <IconMap />
              <span>View Map</span>
            </Link>
          ) : (
            <div className="flex h-14 items-center gap-2 rounded-full bg-wayfarer-primary px-6 font-body text-sm font-bold text-white opacity-80 shadow-[0_8px_24px_rgba(27,67,50,0.25)]">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              <span>Saving…</span>
            </div>
          )}

          {shareFeedback && (
            <p className="rounded-full bg-white px-4 py-2 text-center font-body text-xs text-wayfarer-text-muted shadow-wayfarer-soft ring-1 ring-black/[0.06]">
              {shareFeedback}
            </p>
          )}
        </div>
      ) : (
        <button
          type="button"
          disabled={stops.length === 0}
          onClick={() => handleSave()}
          className="fixed bottom-6 right-4 z-40 flex h-14 items-center gap-2 rounded-full bg-wayfarer-primary px-6 font-body text-sm font-bold text-white shadow-[0_8px_24px_rgba(27,67,50,0.35)] transition-all active:scale-95 hover:opacity-90 disabled:opacity-40 sm:right-6"
        >
          <IconMap />
          <span>Save trip</span>
        </button>
      )}

      {/* ── Sign-in modal ────────────────────────────────── */}
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
              Your trip is ready. Create a free account to keep it.
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
