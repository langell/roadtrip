'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import GooglePlacesAutocomplete from './GooglePlacesAutocomplete';
import { TripThemeSchema } from '@roadtrip/types';
import { Button } from '@roadtrip/ui';
import {
  streamTripPlans,
  getNearbySponsored,
  refinePlan,
  type TripPlanOption,
  type PlannedStopResolved,
  type SponsoredStop,
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
// Max distance a sponsor can be from the search origin before we suppress the card
const MAX_SPONSOR_RADIUS_KM = 200;

const LOADING_MESSAGES = [
  'Scanning local standouts and hidden gems…',
  'Balancing your selected themes into unique route options…',
  'Resolving places and enriching each stop with details…',
];

type InfoCard = { icon: string; title: string; body: string; highlight: string };
const INFO_CARDS: InfoCard[] = [
  {
    icon: '🧠',
    title: 'AI-Curated Routes',
    body: 'HipTrip uses AI to build itineraries tailored to your themes — scenic drives, foodie stops, hidden gems — not just whatever ranks highest on a search engine.',
    highlight:
      'Routes are generated fresh for your exact location and radius, every time.',
  },
  {
    icon: '📍',
    title: 'Every Stop Has a Story',
    body: 'Each place comes with curated descriptions and real photos so you know exactly what to expect before you arrive — no surprises, just great experiences.',
    highlight:
      'Tap any stop on your saved trip to see full details, directions, and photos.',
  },
  {
    icon: '🎯',
    title: 'Themes That Actually Match',
    body: "Whether you want scenic overlooks, craft breweries, family-friendly stops, or local sports venues — HipTrip matches places to what you actually care about, not just what's most popular.",
    highlight: 'Mix multiple themes to find stops that check more than one box.',
  },
  {
    icon: '🗺️',
    title: 'Plan Once, Go Anywhere',
    body: 'Save your favorite option, share a link with travel companions, and pull up the full itinerary at any point during your trip — all from your phone.',
    highlight:
      'Share a trip link and your travel companions get the full route, no app needed.',
  },
  {
    icon: '⛽',
    title: 'Smart Pit-Stops Built In',
    body: 'Enable Smart Pit-Stops to automatically weave in fuel, restrooms, and snack breaks at logical points along the route — no more mid-trip scrambles.',
    highlight: 'Toggle "Smart Pit-Stops" in the filter panel before you search.',
  },
  {
    icon: '📸',
    title: 'Never Miss the Shot',
    body: 'Photo Ops mode surfaces the most photogenic pullouts, overlooks, and landmarks along your route — ideal when the journey matters as much as the destination.',
    highlight: 'Enable "Photo Ops" in filters to add camera-ready stops to your plan.',
  },
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

const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

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
  const [loadingCardIndex, setLoadingCardIndex] = useState(0);
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
  // stopSwapIndex[`${optionIdx}-${stopIdx}`] = which suggestion is shown (0 = primary)
  const [stopSwapIndex, setStopSwapIndex] = useState<Record<string, number>>({});

  const getActiveStopSuggestion = (
    stop: PlannedStopResolved,
    optionIdx: number,
    stopIdx: number,
  ) => {
    const key = `${optionIdx}-${stopIdx}`;
    const swapIdx = stopSwapIndex[key] ?? 0;
    if (swapIdx === 0) return stop.suggestion;
    return stop.alternatives?.[swapIdx - 1] ?? stop.suggestion;
  };

  const cycleStopAlternative = (
    optionIdx: number,
    stopIdx: number,
    totalAlts: number,
  ) => {
    const key = `${optionIdx}-${stopIdx}`;
    setStopSwapIndex((prev) => ({
      ...prev,
      [key]: ((prev[key] ?? 0) + 1) % (totalAlts + 1),
    }));
  };

  const [refineStates, setRefineStates] = useState<
    Record<
      number,
      {
        open: boolean;
        instruction: string;
        loading: boolean;
        prev: TripPlanOption | null;
      }
    >
  >({});
  const [originCoords, setOriginCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [sponsored, setSponsored] = useState<SponsoredStop | null>(null);
  const hasRequestedInitialLocation = useRef(false);
  const loadingHeroRef = useRef<HTMLDivElement>(null);

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
    setSponsored(null);
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
            // Fetch nearest sponsored stop in background once we have coords
            const coords = originCoords;
            if (coords && coords.lat !== 0 && coords.lng !== 0) {
              void getNearbySponsored(coords.lat, coords.lng).then((stop) => {
                if (!stop) return;
                if (
                  stop.lat != null &&
                  stop.lng != null &&
                  haversineKm(coords.lat, coords.lng, stop.lat, stop.lng) >
                    MAX_SPONSOR_RADIUS_KM
                ) {
                  return;
                }
                setSponsored(stop);
              });
            }
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

  useEffect(() => {
    if (!loading) {
      setLoadingCardIndex(0);
      return;
    }

    const intervalId = window.setInterval(() => {
      setLoadingCardIndex((current) => (current + 1) % INFO_CARDS.length);
    }, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loading]);

  useEffect(() => {
    if (loading && loadingHeroRef.current) {
      loadingHeroRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
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

  const handleRefineSubmit = async (index: number) => {
    const state = refineStates[index];
    if (!state?.instruction.trim()) return;
    const currentOption = planOptions[index];
    if (!currentOption) return;

    setRefineStates((prev) => ({
      ...prev,
      [index]: { ...prev[index], loading: true },
    }));

    const stopNames = currentOption.stops.map((s) =>
      s.status === 'resolved' ? s.suggestion.title : s.query,
    );

    const refined = await refinePlan({
      location,
      themes: selectedThemes,
      instruction: state.instruction,
      planOption: {
        title: currentOption.title,
        rationale: currentOption.rationale,
        stops: stopNames.map((name) => ({ name })),
      },
    });

    if (refined) {
      setPlanOptions((prev) => prev.map((opt, i) => (i === index ? refined : opt)));
      setRefineStates((prev) => ({
        ...prev,
        [index]: { open: false, instruction: '', loading: false, prev: currentOption },
      }));
    } else {
      setRefineStates((prev) => ({
        ...prev,
        [index]: { ...prev[index], loading: false },
      }));
    }
  };

  const handleRefineUndo = (index: number) => {
    const prev = refineStates[index]?.prev;
    if (!prev) return;
    setPlanOptions((opts) => opts.map((opt, i) => (i === index ? prev : opt)));
    setRefineStates((s) => ({
      ...s,
      [index]: { open: false, instruction: '', loading: false, prev: null },
    }));
  };

  const handleSelectPlan = async (option: TripPlanOption, optionIdx: number) => {
    let coords = originCoords;
    if (!coords) {
      coords = await forwardGeocode(location);
    }

    // Apply any active stop swaps before saving
    const resolvedOption: TripPlanOption = {
      ...option,
      stops: option.stops.map((stop, stopIdx) => {
        if (stop.status !== 'resolved') return stop;
        const activeSuggestion = getActiveStopSuggestion(stop, optionIdx, stopIdx);
        if (activeSuggestion === stop.suggestion) return stop;
        return { ...stop, suggestion: activeSuggestion };
      }),
    };

    const draft = {
      plan: resolvedOption,
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

        <div ref={loadingHeroRef} className="grid gap-4 md:grid-cols-2">
          {loading
            ? [
                <article
                  key="loading-hero"
                  className="md:col-span-2 rounded-card bg-white shadow-wayfarer-ambient overflow-hidden flex flex-col"
                  style={{ minHeight: '420px' }}
                >
                  <style>{`@keyframes cardFadeSlide { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }`}</style>

                  {/* Top status bar */}
                  <div className="flex items-center justify-between border-b border-wayfarer-surface px-6 py-4">
                    <div className="flex items-center gap-2.5">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-wayfarer-primary opacity-60" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-wayfarer-primary" />
                      </span>
                      <p className="font-body text-[11px] font-semibold uppercase tracking-[0.16em] text-wayfarer-primary">
                        Building your journey
                      </p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {selectedThemes.map((theme) => (
                        <span
                          key={`loading-theme-${theme}`}
                          className="rounded-full bg-wayfarer-surface px-2.5 py-1 font-body text-[11px] font-semibold text-wayfarer-secondary"
                        >
                          {themeLabelMap[theme].icon} {themeLabelMap[theme].label}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Card content — slides on change */}
                  <div className="flex flex-1 flex-col px-6 py-8">
                    <div
                      key={loadingCardIndex}
                      className="flex flex-1 flex-col"
                      style={{ animation: 'cardFadeSlide 0.45s ease forwards' }}
                    >
                      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-wayfarer-surface text-3xl">
                        {INFO_CARDS[loadingCardIndex].icon}
                      </div>
                      <h3 className="font-display text-2xl font-extrabold leading-snug text-wayfarer-primary">
                        {INFO_CARDS[loadingCardIndex].title}
                      </h3>
                      <p
                        className="mt-3 font-body text-sm leading-relaxed text-wayfarer-text-muted"
                        style={{ maxWidth: '56ch' }}
                      >
                        {INFO_CARDS[loadingCardIndex].body}
                      </p>
                      <div className="mt-5 inline-flex items-start gap-2 rounded-xl bg-wayfarer-surface px-4 py-3">
                        <span className="mt-0.5 text-sm">💡</span>
                        <p className="font-body text-xs font-semibold leading-relaxed text-wayfarer-text-main">
                          {INFO_CARDS[loadingCardIndex].highlight}
                        </p>
                      </div>
                    </div>

                    {/* Progress + status */}
                    <div className="mt-8 flex items-center gap-3">
                      {INFO_CARDS.map((_, i) => (
                        <span
                          key={i}
                          className="rounded-full bg-wayfarer-primary transition-all duration-500"
                          style={{
                            height: '5px',
                            width: i === loadingCardIndex ? '28px' : '5px',
                            opacity: i === loadingCardIndex ? 1 : 0.2,
                          }}
                        />
                      ))}
                      <span className="ml-1 animate-pulse font-body text-xs text-wayfarer-text-muted">
                        {LOADING_MESSAGES[loadingMessageIndex]}
                      </span>
                    </div>
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

          {sponsored && planOptions.length > 0 && (
            <div className="rounded-card border border-wayfarer-tertiary-fixed/40 bg-wayfarer-tertiary-fixed/10 p-5">
              <div className="mb-3 flex items-center justify-between">
                <span className="rounded bg-wayfarer-tertiary-fixed px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-wayfarer-tertiary-fixed-dark">
                  Sponsored
                </span>
                <span className="font-body text-xs text-wayfarer-text-muted">
                  Along your route
                </span>
              </div>
              <div className="flex items-center gap-4">
                {sponsored.imageUrl ? (
                  <img
                    src={sponsored.imageUrl}
                    alt={sponsored.title}
                    className="h-14 w-14 shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-wayfarer-tertiary-fixed/30 text-wayfarer-tertiary-fixed-dark">
                    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z" />
                    </svg>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-display text-base font-extrabold text-wayfarer-primary">
                    {sponsored.title}
                  </p>
                  <p className="text-xs leading-relaxed text-wayfarer-text-muted">
                    {sponsored.description}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                {sponsored.url && (
                  <a
                    href={sponsored.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 rounded-xl border border-wayfarer-primary py-2 text-center text-sm font-semibold text-wayfarer-primary transition hover:bg-wayfarer-primary hover:text-white"
                  >
                    Learn More
                  </a>
                )}
                <button
                  type="button"
                  className="flex-1 rounded-xl bg-wayfarer-primary py-2 text-sm font-bold text-white transition hover:opacity-90"
                  onClick={() => {
                    if (!sponsored.lat || !sponsored.lng) return;
                    const syntheticStop = {
                      query: sponsored.title,
                      status: 'resolved' as const,
                      stopType: 'attraction' as const,
                      suggestion: {
                        id: sponsored.placeId,
                        placeId: sponsored.placeId,
                        title: sponsored.title,
                        description: sponsored.description,
                        distanceKm: 0,
                        lat: sponsored.lat,
                        lng: sponsored.lng,
                        imageUrl: sponsored.imageUrl,
                      },
                    };
                    setPlanOptions((prev) =>
                      prev.map((opt) => ({
                        ...opt,
                        stops: [syntheticStop, ...opt.stops],
                      })),
                    );
                    setSponsored(null);
                  }}
                >
                  + Add to Plan
                </button>
              </div>
            </div>
          )}

          {planOptions.map((option, index) => {
            const rs = refineStates[index] ?? {
              open: false,
              instruction: '',
              loading: false,
              prev: null,
            };
            return (
              <article
                key={`${option.title}-${index}`}
                className="rounded-card bg-white p-5 shadow-wayfarer-soft"
              >
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-body text-[11px] uppercase tracking-[0.14em] text-wayfarer-secondary">
                    Option {index + 1}
                  </p>
                  <div className="flex items-center gap-2">
                    {rs.prev && (
                      <button
                        type="button"
                        onClick={() => handleRefineUndo(index)}
                        className="font-body text-[11px] text-wayfarer-text-muted underline hover:text-wayfarer-primary"
                      >
                        Undo
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setRefineStates((s) => ({
                          ...s,
                          [index]: { ...rs, open: !rs.open },
                        }))
                      }
                      title="Refine this plan"
                      className="rounded-lg border border-wayfarer-surface px-2 py-1 font-body text-[11px] text-wayfarer-text-muted transition hover:border-wayfarer-primary hover:text-wayfarer-primary"
                    >
                      ✏️ Refine
                    </button>
                  </div>
                </div>
                <h3 className="font-display text-lg font-semibold text-wayfarer-primary">
                  {option.title}
                </h3>
                <p className="font-body text-sm leading-relaxed text-wayfarer-text-muted">
                  {option.rationale}
                </p>

                {rs.open && (
                  <div className="mt-3 rounded-xl border border-wayfarer-surface bg-wayfarer-surface p-3">
                    <p className="mb-2 font-body text-xs text-wayfarer-text-muted">
                      What would you like to change?
                    </p>
                    <textarea
                      className="w-full resize-none rounded-lg border border-wayfarer-surface bg-white px-3 py-2 font-body text-sm text-wayfarer-text-main placeholder-wayfarer-text-muted focus:outline-none focus:ring-1 focus:ring-wayfarer-primary"
                      rows={2}
                      maxLength={200}
                      placeholder="e.g. swap the brewery for a coffee shop"
                      value={rs.instruction}
                      onChange={(e) =>
                        setRefineStates((s) => ({
                          ...s,
                          [index]: { ...rs, instruction: e.target.value },
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          void handleRefineSubmit(index);
                        }
                      }}
                    />
                    <div className="mt-2 flex items-center justify-between">
                      <span className="font-body text-[10px] text-wayfarer-text-muted">
                        {rs.instruction.length}/200
                      </span>
                      <button
                        type="button"
                        disabled={rs.loading || !rs.instruction.trim()}
                        onClick={() => void handleRefineSubmit(index)}
                        className="rounded-lg bg-wayfarer-primary px-3 py-1.5 font-body text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                      >
                        {rs.loading ? 'Refining…' : 'Apply'}
                      </button>
                    </div>
                  </div>
                )}

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
                        (() => {
                          const activeSuggestion = getActiveStopSuggestion(
                            stop,
                            index,
                            stopIndex,
                          );
                          const altCount = stop.alternatives?.length ?? 0;
                          const swapKey = `${index}-${stopIndex}`;
                          const swapIdx = stopSwapIndex[swapKey] ?? 0;
                          const isSwapped = swapIdx > 0;
                          return (
                            <div className="space-y-1">
                              {activeSuggestion.imageUrl ? (
                                <img
                                  src={activeSuggestion.imageUrl}
                                  alt={activeSuggestion.title}
                                  className="mb-2 h-28 w-full rounded-lg object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="mb-2 flex h-28 w-full items-center justify-center rounded-lg bg-wayfarer-surface font-body text-xs uppercase tracking-[0.12em] text-wayfarer-text-muted">
                                  No image available
                                </div>
                              )}
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p
                                    className={`font-body text-sm font-semibold ${isSwapped ? 'text-wayfarer-secondary' : 'text-wayfarer-primary'}`}
                                  >
                                    {activeSuggestion.title}
                                    {isSwapped && (
                                      <span className="ml-1 text-[10px] font-normal opacity-70">
                                        alt
                                      </span>
                                    )}
                                  </p>
                                  <p className="font-body text-sm text-wayfarer-text-muted">
                                    {activeSuggestion.description}
                                  </p>
                                  <p className="font-body text-xs uppercase tracking-[0.12em] text-wayfarer-secondary">
                                    {Math.max(
                                      1,
                                      Math.round(
                                        activeSuggestion.distanceKm / KM_PER_MILE,
                                      ),
                                    )}
                                    mi away
                                  </p>
                                </div>
                                {altCount > 0 && (
                                  <button
                                    type="button"
                                    title="Try an alternative stop"
                                    onClick={() =>
                                      cycleStopAlternative(index, stopIndex, altCount)
                                    }
                                    className="mt-0.5 shrink-0 rounded-lg border border-wayfarer-surface p-1.5 text-wayfarer-text-muted transition hover:border-wayfarer-primary hover:text-wayfarer-primary"
                                  >
                                    ⇄
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })()
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
                    onClick={() => void handleSelectPlan(option, index)}
                  >
                    Select this trip →
                  </button>
                </div>
              </article>
            );
          })}
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
