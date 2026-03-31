'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import GooglePlacesAutocomplete from '../../components/GooglePlacesAutocomplete';
import { savePlanOption } from '../../lib/api-client';
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

const forwardGeocode = async (
  description: string,
): Promise<{ lat: number; lng: number } | null> => {
  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!mapsApiKey) return null;
  try {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', description);
    url.searchParams.set('key', mapsApiKey);
    const response = await fetch(url.toString(), { cache: 'no-store' });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      status?: string;
      results?: Array<{ geometry?: { location?: { lat: number; lng: number } } }>;
    };
    if (data.status !== 'OK') return null;
    const loc = data.results?.[0]?.geometry?.location;
    return loc ? { lat: loc.lat, lng: loc.lng } : null;
  } catch {
    return null;
  }
};

const resolvedStopsOnly = (stops: TripPlanOption['stops']): PlannedStopResolved[] =>
  stops.filter((s): s is PlannedStopResolved => s.status === 'resolved');

type PlanDetailProps = {
  draftKey: string | null;
};

// Bento card variant cycling: featured(8) + side(4) | horizontal(6) + accent(6) | detail(4) + wide(8) | repeat
const VARIANTS = ['featured', 'side', 'horizontal', 'accent', 'detail', 'wide'] as const;
type CardVariant = (typeof VARIANTS)[number];

const COL_SPAN: Record<CardVariant, string> = {
  featured: 'md:col-span-8',
  side: 'md:col-span-4',
  horizontal: 'md:col-span-6',
  accent: 'md:col-span-6',
  detail: 'md:col-span-4',
  wide: 'md:col-span-8',
};

const PlanDetail = ({ draftKey }: PlanDetailProps) => {
  const router = useRouter();

  const [draft, setDraft] = useState<TripDraft | null>(null);
  const [stops, setStops] = useState<EditableStop[]>([]);
  const [droppedCount, setDroppedCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showSignInModal, setShowSignInModal] = useState(false);

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
      // sessionStorage unavailable or corrupt
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

    const coords = await forwardGeocode(addQuery);
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

  const handleSave = async () => {
    if (!draft || stops.length === 0) return;
    setSaving(true);
    setSaveError(null);

    const result = await savePlanOption({
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
        order: i,
      })),
    });

    setSaving(false);

    if (result.saved) {
      try {
        if (draftKey) localStorage.removeItem(draftKey);
      } catch {
        // ignore
      }
      router.push('/account');
    } else if (result.requiresAuth) {
      setShowSignInModal(true);
    } else {
      setSaveError(result.error);
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

  return (
    <div className="min-h-screen bg-wayfarer-bg font-body text-wayfarer-text-main antialiased">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 h-20 bg-wayfarer-bg/80 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <Link
            href="/#route-planner"
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-wayfarer-surface transition-colors active:scale-95 duration-200"
            aria-label="Back to planner"
          >
            <span className="text-wayfarer-primary text-lg leading-none">←</span>
          </Link>
          <p className="text-[11px] font-body font-semibold text-wayfarer-secondary uppercase tracking-widest leading-none">
            Suggested Stops
          </p>
        </div>
      </header>

      <main className="pt-24 pb-36 px-6 max-w-4xl mx-auto">
        {/* Route context */}
        <section className="mb-10">
          <h2 className="font-display text-3xl font-extrabold text-wayfarer-primary mb-2 leading-tight">
            {draft.plan.title}
          </h2>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-wayfarer-text-muted font-body text-sm">
            <span className="text-base">📍</span>
            <span>{draft.location}</span>
            <span className="opacity-40">•</span>
            <span>{radiusMiles} mi radius</span>
            <span className="opacity-40">•</span>
            <span>
              {stops.length} Stop{stops.length !== 1 ? 's' : ''}
            </span>
          </div>
          {draft.plan.rationale && (
            <p className="mt-3 font-body text-sm leading-relaxed text-wayfarer-text-muted max-w-2xl">
              {draft.plan.rationale}
            </p>
          )}
        </section>

        {droppedCount > 0 && (
          <div className="mb-8 rounded-2xl bg-wayfarer-surface px-5 py-4 font-body text-sm text-wayfarer-text-muted">
            {droppedCount} stop{droppedCount > 1 ? 's were' : ' was'} unavailable and
            removed from this plan.
          </div>
        )}

        {stops.length === 0 ? (
          <div className="rounded-3xl bg-wayfarer-surface p-10 text-center font-body text-sm text-wayfarer-text-muted mb-10">
            No stops yet. Add some below or go back and choose a different plan.
          </div>
        ) : (
          /* Bento grid */
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-10">
            {stops.map((stop, idx) => {
              const variant: CardVariant = VARIANTS[idx % VARIANTS.length];
              const isFirst = idx === 0;
              const isLast = idx === stops.length - 1;

              const lightControls = (
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    aria-label="Move up"
                    disabled={isFirst}
                    onClick={() => handleMoveUp(stop.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-sm text-wayfarer-text-muted transition-colors hover:bg-wayfarer-surface-deep hover:text-wayfarer-primary disabled:opacity-25"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label="Move down"
                    disabled={isLast}
                    onClick={() => handleMoveDown(stop.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-sm text-wayfarer-text-muted transition-colors hover:bg-wayfarer-surface-deep hover:text-wayfarer-primary disabled:opacity-25"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    aria-label="Remove stop"
                    onClick={() => handleRemove(stop.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-sm text-wayfarer-text-muted transition-colors hover:bg-red-50 hover:text-red-500"
                  >
                    ✕
                  </button>
                </div>
              );

              const darkControls = (
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    aria-label="Move up"
                    disabled={isFirst}
                    onClick={() => handleMoveUp(stop.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-sm text-white/70 transition-colors hover:bg-white/20 disabled:opacity-25"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label="Move down"
                    disabled={isLast}
                    onClick={() => handleMoveDown(stop.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-sm text-white/70 transition-colors hover:bg-white/20 disabled:opacity-25"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    aria-label="Remove stop"
                    onClick={() => handleRemove(stop.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-sm text-white/70 transition-colors hover:bg-white/20 hover:text-red-300"
                  >
                    ✕
                  </button>
                </div>
              );

              if (variant === 'featured') {
                return (
                  <div
                    key={stop.id}
                    className={`${COL_SPAN.featured} group bg-wayfarer-surface rounded-3xl overflow-hidden`}
                  >
                    <div className="relative h-60 overflow-hidden bg-wayfarer-surface-deep">
                      {stop.imageUrl ? (
                        <img
                          src={stop.imageUrl}
                          alt={stop.name}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-wayfarer-primary/20 to-wayfarer-secondary/10" />
                      )}
                      <div className="absolute top-4 left-4 flex gap-2">
                        <span className="px-3 py-1 bg-wayfarer-primary text-white font-body text-[10px] font-bold uppercase tracking-wider rounded-full">
                          Stop {idx + 1}
                        </span>
                        {draft.themes[0] && (
                          <span className="px-3 py-1 bg-white/90 backdrop-blur-md text-wayfarer-primary font-body text-[10px] font-bold uppercase tracking-wider rounded-full">
                            {draft.themes[0]}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="p-6">
                      <h3 className="font-display text-2xl font-bold text-wayfarer-primary mb-2">
                        {stop.name}
                      </h3>
                      {stop.description && (
                        <p className="text-wayfarer-text-muted font-body text-sm leading-relaxed">
                          {stop.description}
                        </p>
                      )}
                      <div className="mt-5 flex items-center justify-between">
                        {lightControls}
                      </div>
                    </div>
                  </div>
                );
              }

              if (variant === 'side') {
                return (
                  <div
                    key={stop.id}
                    className={`${COL_SPAN.side} bg-white rounded-3xl p-6 flex flex-col justify-between`}
                  >
                    <div>
                      <span className="px-2 py-0.5 bg-wayfarer-surface text-wayfarer-primary font-body text-[10px] font-bold uppercase tracking-wider rounded-md">
                        Stop {idx + 1}
                      </span>
                      <h3 className="font-display text-xl font-bold text-wayfarer-primary mt-3 leading-tight">
                        {stop.name}
                      </h3>
                      {stop.description && (
                        <p className="text-wayfarer-text-muted text-sm mt-2 leading-snug line-clamp-3">
                          {stop.description}
                        </p>
                      )}
                    </div>
                    <div className="mt-6">
                      {stop.imageUrl && (
                        <div className="w-full h-24 rounded-2xl overflow-hidden mb-4 bg-wayfarer-surface-deep">
                          <img
                            src={stop.imageUrl}
                            alt={stop.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>
                      )}
                      {lightControls}
                    </div>
                  </div>
                );
              }

              if (variant === 'horizontal') {
                return (
                  <div
                    key={stop.id}
                    className={`${COL_SPAN.horizontal} bg-wayfarer-surface rounded-3xl p-6`}
                  >
                    <div className="flex gap-4">
                      <div className="w-24 h-24 rounded-2xl overflow-hidden shrink-0 bg-wayfarer-surface-deep">
                        {stop.imageUrl && (
                          <img
                            src={stop.imageUrl}
                            alt={stop.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        )}
                      </div>
                      <div className="flex flex-col justify-between flex-1 min-w-0">
                        <div>
                          <span className="text-[10px] font-bold text-wayfarer-secondary uppercase tracking-widest font-body">
                            Stop {idx + 1}
                          </span>
                          <h3 className="font-display text-lg font-bold text-wayfarer-primary leading-tight">
                            {stop.name}
                          </h3>
                          {stop.description && (
                            <p className="text-sm text-wayfarer-text-muted mt-1 leading-relaxed line-clamp-2">
                              {stop.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end">{lightControls}</div>
                  </div>
                );
              }

              if (variant === 'accent') {
                return (
                  <div
                    key={stop.id}
                    className={`${COL_SPAN.accent} bg-wayfarer-primary text-white rounded-3xl p-6 flex flex-col justify-between relative overflow-hidden`}
                  >
                    <div className="absolute inset-0 opacity-10 pointer-events-none bg-gradient-to-br from-white via-transparent to-transparent" />
                    <div className="relative z-10">
                      <span className="px-2 py-0.5 bg-white/20 backdrop-blur-md text-white font-body text-[10px] font-bold uppercase tracking-wider rounded-md">
                        Stop {idx + 1}
                      </span>
                      <h3 className="font-display text-xl font-bold mt-3">{stop.name}</h3>
                      {stop.description && (
                        <p className="text-white/70 text-sm mt-2 leading-snug line-clamp-3">
                          {stop.description}
                        </p>
                      )}
                    </div>
                    <div className="relative z-10 mt-6 flex items-center justify-between">
                      {darkControls}
                    </div>
                  </div>
                );
              }

              if (variant === 'detail') {
                return (
                  <div
                    key={stop.id}
                    className={`${COL_SPAN.detail} bg-wayfarer-surface rounded-3xl p-5`}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-wayfarer-surface-deep flex items-center justify-center font-display text-sm font-bold text-wayfarer-primary shrink-0">
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-display font-bold text-wayfarer-primary leading-tight truncate">
                          {stop.name}
                        </h4>
                      </div>
                    </div>
                    {stop.description && (
                      <p className="text-xs text-wayfarer-text-muted leading-relaxed mb-4 line-clamp-2">
                        {stop.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between bg-wayfarer-bg px-3 py-2 rounded-xl">
                      <span className="text-xs font-bold text-wayfarer-text-muted uppercase tracking-wider">
                        Stop {idx + 1}
                      </span>
                      {lightControls}
                    </div>
                  </div>
                );
              }

              // wide (variant === 'wide')
              return (
                <div
                  key={stop.id}
                  className={`${COL_SPAN.wide} bg-wayfarer-surface rounded-3xl overflow-hidden flex flex-col md:flex-row`}
                >
                  <div className="md:w-1/2 p-8 flex flex-col justify-center">
                    <span className="text-[10px] font-bold text-wayfarer-secondary uppercase tracking-widest font-body mb-2">
                      Stop {idx + 1}
                    </span>
                    <h3 className="font-display text-2xl font-extrabold text-wayfarer-primary mb-3 leading-tight">
                      {stop.name}
                    </h3>
                    {stop.description && (
                      <p className="text-wayfarer-text-muted text-sm leading-relaxed mb-6">
                        {stop.description}
                      </p>
                    )}
                    <div className="mt-auto">{lightControls}</div>
                  </div>
                  <div className="md:w-1/2 h-52 md:h-auto overflow-hidden bg-wayfarer-surface-deep">
                    {stop.imageUrl && (
                      <img
                        src={stop.imageUrl}
                        alt={stop.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add a stop */}
        <section className="rounded-2xl bg-wayfarer-surface p-6">
          <p className="mb-4 font-body text-xs font-bold uppercase tracking-[0.18em] text-wayfarer-primary">
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
              className="flex-shrink-0 rounded-xl bg-wayfarer-primary px-5 py-2 font-body text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {addingStop ? 'Adding…' : 'Add'}
            </button>
          </div>
          {addError && <p className="mt-2 font-body text-xs text-red-500">{addError}</p>}
        </section>
      </main>

      {/* Save error toast */}
      {saveError && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-40 bg-red-50 text-red-600 px-5 py-3 rounded-2xl font-body text-sm shadow-wayfarer-ambient whitespace-nowrap">
          {saveError}
        </div>
      )}

      {/* FAB */}
      <button
        type="button"
        disabled={saving || stops.length === 0}
        onClick={() => void handleSave()}
        className="fixed bottom-8 right-8 z-40 h-14 px-6 bg-wayfarer-primary text-white rounded-full shadow-[0_8px_24px_rgba(27,67,50,0.35)] flex items-center gap-2 font-body font-bold text-sm active:scale-95 transition-all hover:opacity-90 disabled:opacity-40"
      >
        <span className="text-base leading-none">🗺</span>
        <span>{saving ? 'Saving…' : 'Save trip'}</span>
      </button>

      {/* Sign-in modal */}
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
