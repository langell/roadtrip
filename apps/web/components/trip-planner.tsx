'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import GooglePlacesAutocomplete from './GooglePlacesAutocomplete';
import { TripThemeSchema } from '@roadtrip/types';
import { Button } from '@roadtrip/ui';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { fetchTripPlans, savePlanOption, type TripPlanOption } from '../lib/api-client';

const AUTO_LOCATION_DENIED_STORAGE_KEY = 'hiptrip:auto-location-denied';
const KM_PER_MILE = 1.60934;
const MIN_RADIUS_MILES = 10;
const MAX_RADIUS_MILES = 300;
const LOADING_MESSAGES = [
  'Scanning local standouts and hidden gems…',
  'Balancing your selected themes into unique route options…',
  'Resolving places and enriching each stop with details…',
];

const planSourceBadgeMode = process.env.NEXT_PUBLIC_TRIP_PLAN_SOURCE_BADGE ?? 'dev';
const showPlanSourceBadge =
  planSourceBadgeMode === 'always' ||
  (planSourceBadgeMode === 'dev' && process.env.NODE_ENV !== 'production');

type GeocodeComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

const findGeocodeComponent = (
  components: GeocodeComponent[] | undefined,
  ...types: string[]
) =>
  components?.find((component) => types.some((type) => component.types.includes(type)));

const formatNearestCity = (components: GeocodeComponent[] | undefined): string | null => {
  const city = findGeocodeComponent(
    components,
    'locality',
    'postal_town',
    'administrative_area_level_2',
    'sublocality_level_1',
  )?.long_name;

  if (!city) {
    return null;
  }

  const region =
    findGeocodeComponent(components, 'administrative_area_level_1')?.short_name ??
    findGeocodeComponent(components, 'country')?.short_name;

  return region ? `${city}, ${region}` : city;
};

const reverseGeocodeWithGoogle = async (
  latitude: number,
  longitude: number,
): Promise<string | null> => {
  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!mapsApiKey) {
    return null;
  }

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('latlng', `${latitude},${longitude}`);
    url.searchParams.set('key', mapsApiKey);

    const response = await fetch(url.toString(), { cache: 'no-store' });
    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      status?: string;
      results?: Array<{ address_components?: GeocodeComponent[] }>;
    };

    if (data.status !== 'OK') {
      return null;
    }

    for (const result of data.results ?? []) {
      const nearestCity = formatNearestCity(result.address_components);
      if (nearestCity) {
        return nearestCity;
      }
    }

    return null;
  } catch {
    return null;
  }
};

const reverseGeocodeWithFallback = async (
  latitude: number,
  longitude: number,
): Promise<string | null> => {
  try {
    const url = new URL('https://api.bigdatacloud.net/data/reverse-geocode-client');
    url.searchParams.set('latitude', String(latitude));
    url.searchParams.set('longitude', String(longitude));
    url.searchParams.set('localityLanguage', 'en');

    const response = await fetch(url.toString(), { cache: 'no-store' });
    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      city?: string;
      locality?: string;
      principalSubdivisionCode?: string;
      principalSubdivision?: string;
      countryCode?: string;
    };

    const city = data.city ?? data.locality;
    if (!city) {
      return null;
    }

    const region =
      data.principalSubdivisionCode ?? data.principalSubdivision ?? data.countryCode;
    return region ? `${city}, ${region}` : city;
  } catch {
    return null;
  }
};

const reverseGeocodeLocation = async (
  latitude: number,
  longitude: number,
): Promise<string | null> => {
  const googleNearestCity = await reverseGeocodeWithGoogle(latitude, longitude);
  if (googleNearestCity) {
    return googleNearestCity;
  }

  return reverseGeocodeWithFallback(latitude, longitude);
};

const toTitleCase = (value: string) =>
  value.replace(/\b\w/g, (char) => char.toUpperCase());

const TripPlanner = () => {
  const [filters, setFilters] = useState({
    radiusMiles: 100,
    maxStops: 6,
    smartPitstops: false,
    photoOps: false,
  });
  const [selectedThemes, setSelectedThemes] = useState<
    Array<(typeof TripThemeSchema.options)[number]>
  >(['scenic']);
  const [location, setLocation] = useState('Carmel By The Sea, CA');

  const [loading, setLoading] = useState(false);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [locating, setLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState<string | null>(null);
  const [planOptions, setPlanOptions] = useState<TripPlanOption[]>([]);
  const [planSource, setPlanSource] = useState<'cache' | 'ai' | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [savedIndices, setSavedIndices] = useState<Set<number>>(new Set());
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const hasRequestedInitialLocation = useRef(false);
  const { data: session } = useSession();

  const themeOptions = useMemo(() => TripThemeSchema.options, []);
  const themeLabelMap: Record<
    (typeof TripThemeSchema.options)[number],
    { label: string; icon: string }
  > = {
    scenic: { label: 'Hidden Gems', icon: '🏔️' },
    foodie: { label: 'Foodie', icon: '🍴' },
    culture: { label: 'Cultural', icon: '🏛️' },
    adventure: { label: 'Adventure', icon: '🧗' },
    family: { label: 'Family Fun', icon: '👨‍👩‍👧' },
    sports: { label: 'Sports', icon: '🏟️' },
  };

  const handleGenerate = async () => {
    setLoading(true);
    setPlanError(null);
    setPlanSource(null);
    setSavedIndices(new Set());
    setSaveError(null);
    try {
      const modifiers =
        filters.smartPitstops || filters.photoOps
          ? {
              smartPitstops: filters.smartPitstops || undefined,
              photoOps: filters.photoOps || undefined,
            }
          : undefined;
      const data = await fetchTripPlans({
        location,
        radiusKm: Math.round(filters.radiusMiles * KM_PER_MILE),
        themes: selectedThemes,
        maxOptions: 3,
        modifiers,
      });

      if (!data) {
        setPlanOptions([]);
        setPlanSource(null);
        setPlanError('We could not generate plans right now. Please try again.');
        return;
      }

      setPlanOptions(data.options);
      setPlanSource(data.source);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (option: TripPlanOption, index: number) => {
    if (!session) {
      setShowSignInModal(true);
      return;
    }

    setSaveError(null);
    setSavingIndex(index);

    const resolvedStops = option.stops.filter((s) => s.status === 'resolved');
    if (!resolvedStops.length) {
      setSaveError('No resolved stops to save.');
      setSavingIndex(null);
      return;
    }

    const origin = resolvedStops[0].suggestion;
    const result = await savePlanOption({
      title: option.title,
      rationale: option.rationale,
      location,
      originLat: origin.lat,
      originLng: origin.lng,
      radiusKm: Math.round(filters.radiusMiles * KM_PER_MILE),
      themes: selectedThemes,
      stops: resolvedStops.map((s, i) => ({
        placeId: s.suggestion.placeId,
        name: s.suggestion.title,
        lat: s.suggestion.lat,
        lng: s.suggestion.lng,
        notes: s.suggestion.description,
        order: i,
      })),
    });

    setSavingIndex(null);

    if (result.saved) {
      setSavedIndices((prev) => new Set(prev).add(index));
    } else if (result.requiresAuth) {
      setShowSignInModal(true);
    } else {
      setSaveError(result.error);
    }
  };

  useEffect(() => {
    if (!loading) {
      setLoadingMessageIndex(0);
      return;
    }

    const intervalId = window.setInterval(() => {
      setLoadingMessageIndex((current) => (current + 1) % LOADING_MESSAGES.length);
    }, 1800);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loading]);

  const requestCurrentLocation = (mode: 'auto' | 'manual') => {
    if (!navigator.geolocation) {
      setLocationStatus('Location services are not supported in this browser.');
      return;
    }

    setLocating(true);
    setLocationStatus(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        void (async () => {
          const resolvedLocation = await reverseGeocodeLocation(
            position.coords.latitude,
            position.coords.longitude,
          );
          localStorage.removeItem(AUTO_LOCATION_DENIED_STORAGE_KEY);
          if (resolvedLocation) {
            setLocation(resolvedLocation);
            setLocationStatus('Using your nearest city.');
          } else {
            setLocationStatus(
              'Location found, but nearest city could not be resolved. Enter an origin manually.',
            );
          }
          setLocating(false);
        })();
      },
      () => {
        if (mode === 'auto') {
          localStorage.setItem(AUTO_LOCATION_DENIED_STORAGE_KEY, 'true');
        }
        setLocationStatus(
          mode === 'auto'
            ? 'Location permission denied. You can still use the button or enter an origin manually.'
            : 'Could not access your location. Check browser permissions.',
        );
        setLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      },
    );
  };

  const handleUseCurrentLocation = () => {
    requestCurrentLocation('manual');
  };

  useEffect(() => {
    if (hasRequestedInitialLocation.current) {
      return;
    }

    if (localStorage.getItem(AUTO_LOCATION_DENIED_STORAGE_KEY) === 'true') {
      hasRequestedInitialLocation.current = true;
      return;
    }

    hasRequestedInitialLocation.current = true;
    requestCurrentLocation('auto');
  }, []);

  return (
    <div className="space-y-8 text-wayfarer-text-main">
      <section className="space-y-3">
        <h3 className="font-display text-4xl font-extrabold leading-tight tracking-tight text-wayfarer-primary">
          Map your next
          <br />
          unseen path.
        </h3>
        <p className="max-w-md font-body text-lg text-wayfarer-text-muted">
          Tell us where you&apos;re starting, and we&apos;ll reveal hidden gems within
          reach.
        </p>
      </section>

      <form
        className="space-y-9 rounded-3xl bg-wayfarer-bg p-5 md:p-6"
        onSubmit={(event) => {
          event.preventDefault();
          void handleGenerate();
        }}
      >
        <div className="space-y-3">
          <span className="block px-1 font-body text-xs font-bold uppercase tracking-[0.18em] text-wayfarer-primary">
            Where are you starting?
          </span>
          <GooglePlacesAutocomplete
            value={location}
            onChange={(val) => setLocation(toTitleCase(val))}
            onSelect={setLocation}
            placeholder="City, State or region…"
          />
          <div className="flex flex-wrap items-center gap-3 pt-0.5">
            <button
              type="button"
              className="font-body text-xs font-semibold uppercase tracking-[0.14em] text-wayfarer-secondary hover:text-wayfarer-primary disabled:cursor-not-allowed disabled:opacity-60"
              onClick={handleUseCurrentLocation}
              disabled={locating}
            >
              {locating ? 'Locating…' : 'Use my location'}
            </button>
            {locationStatus ? (
              <span className="font-body text-xs text-wayfarer-text-muted">
                {locationStatus}
              </span>
            ) : null}
          </div>
        </div>

        <section className="space-y-3">
          <div className="flex items-end justify-between px-1">
            <span className="font-body text-xs font-bold uppercase tracking-[0.18em] text-wayfarer-primary">
              Search Radius
            </span>
            <p className="font-display text-2xl font-bold text-wayfarer-primary">
              {filters.radiusMiles}{' '}
              <span className="font-body text-sm font-medium text-wayfarer-text-muted">
                mi
              </span>
            </p>
          </div>
          <input
            type="range"
            min={MIN_RADIUS_MILES}
            max={MAX_RADIUS_MILES}
            step={5}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-wayfarer-surface-deep accent-wayfarer-primary"
            value={filters.radiusMiles}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, radiusMiles: Number(event.target.value) }))
            }
          />
          <div className="flex justify-between px-1 font-body text-[10px] font-bold uppercase tracking-tight text-wayfarer-text-muted">
            <span>{MIN_RADIUS_MILES} mi</span>
            <span>{MAX_RADIUS_MILES} mi</span>
          </div>
        </section>

        <section className="space-y-4">
          <span className="block px-1 font-body text-xs font-bold uppercase tracking-[0.18em] text-wayfarer-primary">
            Select Journey Theme
          </span>
          <div className="flex flex-wrap gap-3">
            {themeOptions.map((theme) => {
              const selected = selectedThemes.includes(theme);

              return (
                <button
                  key={theme}
                  type="button"
                  className={
                    selected
                      ? 'flex items-center gap-2 rounded-full bg-wayfarer-secondary px-5 py-3 font-body text-sm font-semibold text-white shadow-wayfarer-soft transition-all hover:brightness-110 active:scale-95'
                      : 'flex items-center gap-2 rounded-full bg-wayfarer-surface-deep px-5 py-3 font-body text-sm font-semibold text-wayfarer-text-muted transition-all hover:bg-wayfarer-surface active:scale-95'
                  }
                  onClick={() => {
                    setSelectedThemes((prev) => {
                      if (prev.includes(theme)) {
                        return prev.length === 1
                          ? prev
                          : prev.filter((value) => value !== theme);
                      }

                      return [...prev, theme];
                    });
                  }}
                >
                  <span aria-hidden>{themeLabelMap[theme].icon}</span>
                  {themeLabelMap[theme].label}
                </button>
              );
            })}
          </div>

          <div className="mt-5 space-y-2 border-t border-wayfarer-surface pt-5">
            <span className="block px-1 font-body text-xs font-bold uppercase tracking-[0.18em] text-wayfarer-primary">
              Add-Ons
            </span>
            <div className="flex flex-wrap gap-3">
              {(
                [
                  { key: 'smartPitstops', label: 'Pit-Stops', icon: '⛽' },
                  { key: 'photoOps', label: 'Photo Ops', icon: '📸' },
                ] as const
              ).map(({ key, label, icon }) => {
                const active = filters[key];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilters((f) => ({ ...f, [key]: !f[key] }))}
                    className={
                      active
                        ? 'flex items-center gap-2 rounded-full bg-wayfarer-secondary px-5 py-3 font-body text-sm font-semibold text-white shadow-wayfarer-soft transition-all hover:brightness-110 active:scale-95'
                        : 'flex items-center gap-2 rounded-full bg-wayfarer-surface-deep px-5 py-3 font-body text-sm font-semibold text-wayfarer-text-muted transition-all hover:bg-wayfarer-surface active:scale-95'
                    }
                  >
                    <span aria-hidden>{icon}</span>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <div className="pt-2">
          <Button
            tone="primary"
            loading={loading}
            type="submit"
            className="h-16 w-full rounded-xl bg-gradient-to-br from-wayfarer-primary to-wayfarer-secondary text-lg font-bold shadow-wayfarer-ambient"
          >
            Generate Ideas
          </Button>
        </div>
      </form>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-body text-xs uppercase tracking-[0.18em] text-wayfarer-text-muted">
            AI itinerary options
          </p>
          {showPlanSourceBadge && planSource ? (
            <span className="rounded-full bg-wayfarer-surface px-3 py-1 font-body text-[11px] font-semibold uppercase tracking-[0.12em] text-wayfarer-secondary">
              {planSource === 'cache' ? 'Loaded from cache' : 'Generated by AI'}
            </span>
          ) : null}
        </div>
        {planError ? (
          <div className="rounded-card bg-white/80 p-6 font-body text-sm text-wayfarer-secondary">
            {planError}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          {loading
            ? [
                <article
                  key="loading-hero"
                  className="md:col-span-2 rounded-card bg-white p-6 shadow-wayfarer-soft"
                >
                  <p className="mb-2 font-body text-[11px] uppercase tracking-[0.14em] text-wayfarer-secondary">
                    Building your journey
                  </p>
                  <h3 className="font-display text-xl font-semibold text-wayfarer-primary">
                    Crafting something special for you
                  </h3>
                  <p className="mt-2 font-body text-sm text-wayfarer-text-muted">
                    {LOADING_MESSAGES[loadingMessageIndex]}
                  </p>

                  <div className="mt-4 flex items-center gap-2" aria-hidden>
                    <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-wayfarer-primary" />
                    <span
                      className="h-2.5 w-2.5 animate-bounce rounded-full bg-wayfarer-secondary"
                      style={{ animationDelay: '120ms' }}
                    />
                    <span
                      className="h-2.5 w-2.5 animate-bounce rounded-full bg-wayfarer-primary-light"
                      style={{ animationDelay: '240ms' }}
                    />
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {selectedThemes.map((theme) => (
                      <span
                        key={`loading-theme-${theme}`}
                        className="rounded-full bg-wayfarer-surface px-3 py-1 font-body text-xs font-semibold text-wayfarer-secondary"
                      >
                        {themeLabelMap[theme].icon} {themeLabelMap[theme].label}
                      </span>
                    ))}
                  </div>
                </article>,
                ...Array.from({ length: 2 }).map((_, index) => (
                  <article
                    key={`loading-skeleton-${index}`}
                    className="animate-pulse rounded-card bg-white p-5 shadow-wayfarer-soft"
                  >
                    <div className="mb-3 h-3 w-1/3 rounded bg-wayfarer-surface" />
                    <div className="mb-3 h-5 w-2/3 rounded bg-wayfarer-surface" />
                    <div className="mb-2 h-5 w-3/4 rounded bg-wayfarer-surface" />
                    <div className="mb-2 h-4 w-full rounded bg-wayfarer-surface" />
                    <div className="h-3 w-2/3 rounded bg-wayfarer-surface" />
                  </article>
                )),
              ]
            : null}

          {planOptions.map((option, index) => (
            <article
              key={`${option.title}-${index}`}
              className="rounded-card bg-white p-5 shadow-wayfarer-soft"
            >
              <p className="mb-2 font-body text-[11px] uppercase tracking-[0.14em] text-wayfarer-secondary">
                Option {index + 1}
              </p>
              <h3 className="font-display text-lg font-semibold text-wayfarer-primary">
                {option.title}
              </h3>
              <p className="font-body text-sm leading-relaxed text-wayfarer-text-muted">
                {option.rationale}
              </p>

              <ul className="mt-4 space-y-3">
                {option.stops.map((stop, stopIndex) => (
                  <li
                    key={`${stop.query}-${stopIndex}`}
                    className="rounded-xl border border-wayfarer-surface p-3"
                  >
                    <p className="font-body text-xs uppercase tracking-[0.12em] text-wayfarer-secondary">
                      Stop {stopIndex + 1}
                    </p>

                    {stop.status === 'resolved' ? (
                      <div className="space-y-1">
                        {stop.suggestion.imageUrl ? (
                          <img
                            src={stop.suggestion.imageUrl}
                            alt={stop.suggestion.title}
                            className="mb-2 h-28 w-full rounded-lg object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="mb-2 flex h-28 w-full items-center justify-center rounded-lg bg-wayfarer-surface font-body text-xs uppercase tracking-[0.12em] text-wayfarer-text-muted">
                            No image available
                          </div>
                        )}
                        <p className="font-body text-sm font-semibold text-wayfarer-primary">
                          {stop.suggestion.title}
                        </p>
                        <p className="font-body text-sm text-wayfarer-text-muted">
                          {stop.suggestion.description}
                        </p>
                        <p className="font-body text-xs uppercase tracking-[0.12em] text-wayfarer-secondary">
                          {Math.max(
                            1,
                            Math.round(stop.suggestion.distanceKm / KM_PER_MILE),
                          )}
                          mi away
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="mb-2 flex h-28 w-full items-center justify-center rounded-lg bg-wayfarer-surface font-body text-xs uppercase tracking-[0.12em] text-wayfarer-text-muted">
                          Stop details pending
                        </div>
                        <p className="font-body text-sm font-semibold text-wayfarer-primary">
                          {stop.query}
                        </p>
                        <p className="font-body text-xs uppercase tracking-[0.12em] text-wayfarer-secondary">
                          Details unavailable ({stop.errorCode})
                        </p>
                      </div>
                    )}
                  </li>
                ))}
              </ul>

              <div className="mt-4 border-t border-wayfarer-surface pt-4">
                {savedIndices.has(index) ? (
                  <p className="text-center font-body text-sm font-semibold text-wayfarer-secondary">
                    ✓ Saved to your trips
                  </p>
                ) : (
                  <button
                    type="button"
                    disabled={savingIndex === index}
                    onClick={() => {
                      void handleSave(option, index);
                    }}
                    className="w-full rounded-xl bg-wayfarer-primary px-4 py-3 font-body text-sm font-bold text-white shadow-wayfarer-ambient transition hover:opacity-90 disabled:opacity-60"
                  >
                    {savingIndex === index ? 'Saving…' : 'Save this trip'}
                  </button>
                )}
              </div>
            </article>
          ))}
          {saveError ? (
            <p className="col-span-full text-center font-body text-sm text-wayfarer-secondary">
              {saveError}
            </p>
          ) : null}
          {!loading && !planOptions.length && !planError && (
            <div className="rounded-card bg-white/70 p-8 font-body text-wayfarer-text-muted">
              Start by generating a route to see AI itinerary options.
            </div>
          )}
        </div>
      </section>

      {showSignInModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="signin-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowSignInModal(false)}
          />
          <div className="relative w-full max-w-sm rounded-3xl bg-wayfarer-bg p-8 shadow-wayfarer-ambient">
            <h2
              id="signin-modal-title"
              className="mb-2 font-display text-2xl font-bold text-wayfarer-primary"
            >
              Save your trip
            </h2>
            <p className="mb-6 font-body text-sm text-wayfarer-text-muted">
              Sign in to save this itinerary and access it anytime.
            </p>
            <Link
              href="/sign-in"
              className="flex w-full items-center justify-center rounded-xl bg-wayfarer-primary px-6 py-3.5 font-body text-sm font-bold text-white shadow-wayfarer-ambient transition hover:opacity-90"
            >
              Sign in to save
            </Link>
            <button
              type="button"
              onClick={() => setShowSignInModal(false)}
              className="mt-3 w-full rounded-xl py-2 font-body text-sm font-semibold text-wayfarer-text-muted transition hover:text-wayfarer-primary"
            >
              Maybe later
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TripPlanner;
