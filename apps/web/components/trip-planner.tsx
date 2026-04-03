'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import MiniRouteMap from './MiniRouteMap';
import { useRouter } from 'next/navigation';
import GooglePlacesAutocomplete from './GooglePlacesAutocomplete';
import { TripThemeSchema } from '@roadtrip/types';
import { Button } from '@roadtrip/ui';
import {
  streamTripPlans,
  type TripPlanOption,
  type PlannedStopResolved,
} from '../lib/api-client';

const AUTO_LOCATION_DENIED_STORAGE_KEY = 'hiptrip:auto-location-denied';
const LOCATION_STORAGE_KEY = 'hiptrip:location';
const PLAN_RESULTS_STORAGE_KEY = 'hiptrip:last-plan-results';
const RECENT_SEARCHES_KEY = 'hiptrip:recent-searches';
const MAX_RECENT_SEARCHES = 5;

type RecentSearch = {
  location: string;
  themes: Array<(typeof TripThemeSchema.options)[number]>;
  radiusMiles: number;
  searchedAt: string;
};
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

const forwardGeocode = async (
  address: string,
): Promise<{ lat: number; lng: number } | null> => {
  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!mapsApiKey) return null;
  try {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', address);
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

type TripPlannerProps = {
  initialLocation?: string;
};

const TripPlanner = ({ initialLocation }: TripPlannerProps) => {
  const router = useRouter();
  const [filters, setFilters] = useState({
    radiusMiles: 100,
    maxStops: 6,
    smartPitstops: false,
    photoOps: false,
  });
  const [selectedThemes, setSelectedThemes] = useState<
    Array<(typeof TripThemeSchema.options)[number]>
  >(['scenic']);
  const [location, setLocation] = useState(initialLocation ?? 'Carmel By The Sea, CA');
  const isFirstLocationRender = useRef(true);

  const [loading, setLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [locating, setLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState<string | null>(null);
  const [planOptions, setPlanOptions] = useState<TripPlanOption[]>([]);
  const [planSource, setPlanSource] = useState<'cache' | 'ai' | null>(null);
  const [planDegraded, setPlanDegraded] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [lastUsedModifiers, setLastUsedModifiers] = useState<{
    smartPitstops: boolean;
    photoOps: boolean;
  } | null>(null);
  const [originCoords, setOriginCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const hasRequestedInitialLocation = useRef(false);

  // Restore saved location, last plan results, and recent searches on mount
  useEffect(() => {
    const savedLocation = localStorage.getItem(LOCATION_STORAGE_KEY);
    if (savedLocation && !initialLocation) setLocation(savedLocation);

    const savedResults = localStorage.getItem(PLAN_RESULTS_STORAGE_KEY);
    if (savedResults) {
      try {
        const parsed = JSON.parse(savedResults) as {
          options: TripPlanOption[];
          source: 'cache' | 'ai';
          degraded: boolean;
        };
        setPlanOptions(parsed.options);
        setPlanSource(parsed.source);
        setPlanDegraded(parsed.degraded);
      } catch {
        localStorage.removeItem(PLAN_RESULTS_STORAGE_KEY);
      }
    }

    const savedSearches = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (savedSearches) {
      try {
        setRecentSearches(JSON.parse(savedSearches) as RecentSearch[]);
      } catch {
        localStorage.removeItem(RECENT_SEARCHES_KEY);
      }
    }
  }, []);

  // Persist location changes (skip the initial default value)
  useEffect(() => {
    if (isFirstLocationRender.current) {
      isFirstLocationRender.current = false;
      return;
    }
    if (location) localStorage.setItem(LOCATION_STORAGE_KEY, location);
  }, [location]);

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

  const saveRecentSearch = (
    loc: string,
    themes: typeof selectedThemes,
    radiusMiles: number,
  ) => {
    const entry: RecentSearch = {
      location: loc,
      themes,
      radiusMiles,
      searchedAt: new Date().toISOString(),
    };
    setRecentSearches((prev) => {
      const deduped = prev.filter(
        (s) =>
          s.location !== loc ||
          s.themes.join() !== themes.join() ||
          s.radiusMiles !== radiusMiles,
      );
      const next = [entry, ...deduped].slice(0, MAX_RECENT_SEARCHES);
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const applyRecentSearch = (search: RecentSearch) => {
    setLocation(search.location);
    setSelectedThemes(search.themes);
    setFilters((f) => ({ ...f, radiusMiles: search.radiusMiles }));
  };

  const removeRecentSearch = (index: number) => {
    setRecentSearches((prev) => {
      const next = prev.filter((_, i) => i !== index);
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const handleGenerate = async () => {
    setLoading(true);
    setIsStreaming(false);
    setPlanError(null);
    setPlanSource(null);
    setPlanDegraded(false);
    setPlanOptions([]);
    localStorage.removeItem(PLAN_RESULTS_STORAGE_KEY);
    setLastUsedModifiers({
      smartPitstops: filters.smartPitstops,
      photoOps: filters.photoOps,
    });
    saveRecentSearch(location, selectedThemes, filters.radiusMiles);

    const modifiers =
      filters.smartPitstops || filters.photoOps
        ? {
            smartPitstops: filters.smartPitstops || undefined,
            photoOps: filters.photoOps || undefined,
          }
        : undefined;

    let streamedSource: 'cache' | 'ai' | null = null;
    const collectedOptions: TripPlanOption[] = [];

    try {
      await streamTripPlans(
        {
          location,
          radiusKm: Math.round(filters.radiusMiles * KM_PER_MILE),
          themes: selectedThemes,
          maxOptions: 3,
          modifiers,
        },
        {
          onHeader: ({ source }) => {
            streamedSource = source;
            setPlanSource(source);
            setIsStreaming(true);
          },
          onOption: (option) => {
            collectedOptions.push(option);
            setLoading(false);
            setPlanOptions((prev) => [...prev, option]);
          },
          onDone: ({ degraded }) => {
            setIsStreaming(false);
            setPlanDegraded(degraded);
            try {
              localStorage.setItem(
                PLAN_RESULTS_STORAGE_KEY,
                JSON.stringify({
                  options: collectedOptions,
                  source: streamedSource,
                  degraded,
                }),
              );
            } catch {
              // localStorage unavailable or full — results still shown in memory
            }
          },
          onError: () => {
            setPlanOptions([]);
            setPlanSource(null);
            setPlanError('We could not generate plans right now. Please try again.');
          },
        },
      );
    } finally {
      setLoading(false);
      setIsStreaming(false);
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
          setOriginCoords({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
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

  const handleSelectPlan = async (option: TripPlanOption) => {
    let coords = originCoords;
    if (!coords) {
      coords = await forwardGeocode(location);
    }

    const draft = {
      plan: option,
      location,
      radiusKm: Math.round(filters.radiusMiles * KM_PER_MILE),
      themes: selectedThemes as string[],
      originLat: coords?.lat ?? 0,
      originLng: coords?.lng ?? 0,
    };

    const key = `hiptrip:trip-draft:${Date.now()}`;
    try {
      localStorage.setItem(key, JSON.stringify(draft));
    } catch {
      // localStorage unavailable; proceed without it
    }
    router.push(`/plan?draft=${encodeURIComponent(key)}`);
  };

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
            aria-label={`Search radius: ${filters.radiusMiles} miles`}
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

      {recentSearches.length > 0 && (
        <section className="space-y-2">
          <p className="font-body text-xs font-bold uppercase tracking-[0.18em] text-wayfarer-text-muted">
            Recent Searches
          </p>
          <div className="flex flex-wrap gap-2">
            {recentSearches.map((search, i) => (
              <div
                key={`${search.location}-${search.searchedAt}`}
                className="flex items-center gap-1 rounded-full border border-wayfarer-accent/40 bg-wayfarer-surface pl-3 pr-1 py-1 text-xs"
              >
                <button
                  type="button"
                  className="flex items-center gap-1.5 font-semibold text-wayfarer-primary hover:text-wayfarer-secondary transition-colors"
                  onClick={() => applyRecentSearch(search)}
                  title={`${search.location} · ${search.radiusMiles}mi · ${search.themes.map((t) => themeLabelMap[t].label).join(', ')}`}
                >
                  <span>{search.location}</span>
                  <span className="text-wayfarer-text-muted">·</span>
                  <span className="text-wayfarer-text-muted">{search.radiusMiles}mi</span>
                  <span className="text-wayfarer-text-muted">·</span>
                  <span className="text-wayfarer-text-muted">
                    {search.themes.map((t) => themeLabelMap[t].icon).join('')}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label="Remove"
                  className="ml-0.5 flex h-5 w-5 items-center justify-center rounded-full text-wayfarer-text-muted hover:bg-wayfarer-surface-deep hover:text-wayfarer-primary transition-colors"
                  onClick={() => removeRecentSearch(i)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-body text-xs uppercase tracking-[0.18em] text-wayfarer-text-muted">
            Itinerary options
          </p>
          {showPlanSourceBadge && planSource ? (
            <span className="rounded-full bg-wayfarer-surface px-3 py-1 font-body text-[11px] font-semibold uppercase tracking-[0.12em] text-wayfarer-secondary">
              {planSource === 'cache' ? 'Loaded from cache' : 'Generated by AI'}
            </span>
          ) : null}
          {lastUsedModifiers?.smartPitstops && (
            <span className="rounded-full bg-wayfarer-secondary/10 px-3 py-1 font-body text-[11px] font-semibold uppercase tracking-[0.12em] text-wayfarer-secondary">
              ⛽ Pit-Stops active
            </span>
          )}
          {lastUsedModifiers?.photoOps && (
            <span className="rounded-full bg-wayfarer-secondary/10 px-3 py-1 font-body text-[11px] font-semibold uppercase tracking-[0.12em] text-wayfarer-secondary">
              📸 Photo Ops active
            </span>
          )}
        </div>
        {planError ? (
          <div className="rounded-card bg-white/80 p-5 font-body text-sm text-wayfarer-secondary flex items-center justify-between gap-4">
            <span>{planError}</span>
            <button
              type="button"
              className="shrink-0 rounded-lg bg-wayfarer-primary px-4 py-2 font-body text-xs font-bold text-white transition hover:opacity-90"
              onClick={() => void handleGenerate()}
            >
              Try again
            </button>
          </div>
        ) : null}
        {planDegraded ? (
          <div className="rounded-card bg-wayfarer-surface px-4 py-3 font-body text-xs text-wayfarer-text-muted">
            Some itinerary options were trimmed — not all themes could be fully covered.
            Try adjusting your themes or radius for more options.
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

              {(() => {
                const pts = option.stops
                  .filter((s): s is PlannedStopResolved => s.status === 'resolved')
                  .map((s) => ({ lat: s.suggestion.lat, lng: s.suggestion.lng }));
                return (
                  <MiniRouteMap
                    stops={pts}
                    mapsKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''}
                  />
                );
              })()}

              <ul className="mt-4 space-y-3">
                {option.stops.map((stop, stopIndex) => (
                  <li
                    key={`${stop.query}-${stopIndex}`}
                    className="rounded-xl border border-wayfarer-surface p-3"
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <p className="font-body text-xs uppercase tracking-[0.12em] text-wayfarer-secondary">
                        Stop {stopIndex + 1}
                      </p>
                      {stop.stopType === 'pit_stop' && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 font-body text-[10px] font-semibold uppercase tracking-[0.1em] text-amber-700">
                          ⛽ Pit Stop
                        </span>
                      )}
                      {stop.stopType === 'photo_op' && (
                        <span className="rounded-full bg-sky-50 px-2 py-0.5 font-body text-[10px] font-semibold uppercase tracking-[0.1em] text-sky-700">
                          📸 Photo Op
                        </span>
                      )}
                    </div>

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
                <button
                  type="button"
                  className="w-full rounded-xl bg-wayfarer-primary px-4 py-3 font-body text-sm font-bold text-white shadow-wayfarer-ambient transition hover:opacity-90"
                  onClick={() => void handleSelectPlan(option)}
                >
                  Select this trip →
                </button>
              </div>
            </article>
          ))}
          {isStreaming && (
            <article className="animate-pulse rounded-card bg-white p-5 shadow-wayfarer-soft">
              <div className="mb-3 h-3 w-1/3 rounded bg-wayfarer-surface" />
              <div className="mb-3 h-5 w-2/3 rounded bg-wayfarer-surface" />
              <div className="mb-2 h-5 w-3/4 rounded bg-wayfarer-surface" />
              <div className="mb-2 h-4 w-full rounded bg-wayfarer-surface" />
              <div className="h-3 w-2/3 rounded bg-wayfarer-surface" />
            </article>
          )}

          {!loading && !isStreaming && !planOptions.length && !planError && (
            <div className="rounded-card bg-white/70 p-8 font-body text-wayfarer-text-muted">
              Start by generating a route to see AI itinerary options.
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default TripPlanner;
