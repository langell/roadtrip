'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { TripFilters } from '@roadtrip/types';
import { TripThemeSchema } from '@roadtrip/types';
import { Button } from '@roadtrip/ui';
import { fetchTripIdeas, type TripIdea } from '../lib/api-client';

const AUTO_LOCATION_DENIED_STORAGE_KEY = 'hoptrip:auto-location-denied';

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

const reverseGeocodeLocation = async (
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

    return formatNearestCity(data.results?.[0]?.address_components);
  } catch {
    return null;
  }
};

const TripPlanner = () => {
  const [filters, setFilters] = useState<TripFilters>({
    radiusKm: 150,
    theme: 'scenic',
    maxStops: 6,
  });
  const [location, setLocation] = useState('Carmel By The Sea, CA');
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState<string | null>(null);
  const [ideas, setIdeas] = useState<TripIdea[]>([]);
  const hasRequestedInitialLocation = useRef(false);

  const themeOptions = useMemo(() => TripThemeSchema.options, []);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const data = await fetchTripIdeas({
        location,
        radiusKm: filters.radiusKm,
        theme: filters.theme,
      });
      setIdeas(data);
    } finally {
      setLoading(false);
    }
  };

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
      <form
        className="grid gap-4 rounded-3xl bg-wayfarer-bg p-5 md:grid-cols-6 md:gap-5 md:p-6"
        onSubmit={(event) => {
          event.preventDefault();
          void handleGenerate();
        }}
      >
        <label className="space-y-2 md:col-span-2">
          <span className="font-body text-xs uppercase tracking-[0.18em] text-wayfarer-text-muted">
            Origin
          </span>
          <input
            className="w-full rounded-xl bg-white px-4 py-3 font-body text-wayfarer-text-main placeholder:text-wayfarer-text-muted focus:outline-none focus:ring-2 focus:ring-wayfarer-primary-light"
            placeholder="Carmel By The Sea, CA"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
          />
          <div className="flex flex-wrap items-center gap-3 pt-1">
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
        </label>

        <label className="space-y-2 md:col-span-2">
          <span className="font-body text-xs uppercase tracking-[0.18em] text-wayfarer-text-muted">
            Radius (KM)
          </span>
          <input
            type="number"
            min={25}
            max={500}
            className="w-full rounded-xl bg-white px-4 py-3 font-body text-wayfarer-text-main placeholder:text-wayfarer-text-muted focus:outline-none focus:ring-2 focus:ring-wayfarer-primary-light"
            value={filters.radiusKm}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, radiusKm: Number(event.target.value) }))
            }
          />
        </label>

        <label className="space-y-2 md:col-span-2">
          <span className="font-body text-xs uppercase tracking-[0.18em] text-wayfarer-text-muted">
            Theme
          </span>
          <select
            className="w-full rounded-xl bg-white px-4 py-3 font-body text-wayfarer-text-main focus:outline-none focus:ring-2 focus:ring-wayfarer-primary-light"
            value={filters.theme}
            onChange={(event) =>
              setFilters((prev) => ({
                ...prev,
                theme: event.target.value as TripFilters['theme'],
              }))
            }
          >
            {themeOptions.map((theme) => (
              <option key={theme} value={theme} className="text-wayfarer-text-main">
                {theme}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 md:col-span-3">
          <span className="font-body text-xs uppercase tracking-[0.18em] text-wayfarer-text-muted">
            Max stops
          </span>
          <input
            type="number"
            min={1}
            max={12}
            className="w-full rounded-xl bg-white px-4 py-3 font-body text-wayfarer-text-main placeholder:text-wayfarer-text-muted focus:outline-none focus:ring-2 focus:ring-wayfarer-primary-light"
            value={filters.maxStops}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, maxStops: Number(event.target.value) }))
            }
          />
        </label>
        <div className="flex items-end md:col-span-3">
          <Button tone="primary" loading={loading} type="submit" className="w-full">
            Generate trip
          </Button>
        </div>
      </form>

      <section className="space-y-4">
        <p className="font-body text-xs uppercase tracking-[0.18em] text-wayfarer-text-muted">
          Suggested experiences
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          {loading
            ? Array.from({ length: 3 }).map((_, index) => (
                <article
                  key={`loading-${index}`}
                  className="animate-pulse rounded-card bg-white p-5 shadow-wayfarer-soft"
                >
                  <div className="mb-3 h-3 w-1/3 rounded bg-wayfarer-surface" />
                  <div className="mb-3 h-40 w-full rounded-xl bg-wayfarer-surface" />
                  <div className="mb-2 h-5 w-3/4 rounded bg-wayfarer-surface" />
                  <div className="mb-2 h-4 w-full rounded bg-wayfarer-surface" />
                  <div className="h-3 w-1/2 rounded bg-wayfarer-surface" />
                </article>
              ))
            : null}

          {ideas.map((idea) => (
            <article
              key={idea.id}
              className="rounded-card bg-white p-5 shadow-wayfarer-soft"
            >
              {idea.imageUrl ? (
                <img
                  src={idea.imageUrl}
                  alt={idea.title}
                  className="mb-3 h-40 w-full rounded-xl object-cover"
                />
              ) : null}
              <p className="mb-2 font-body text-[11px] uppercase tracking-[0.14em] text-wayfarer-secondary">
                Suggested stop
              </p>
              <h3 className="font-display text-lg font-semibold text-wayfarer-primary">
                {idea.title}
              </h3>
              <p className="font-body text-sm leading-relaxed text-wayfarer-text-muted">
                {idea.description}
              </p>
              <p className="mt-2 font-body text-xs uppercase tracking-[0.12em] text-wayfarer-secondary">
                {idea.distanceKm}km · curated sample
              </p>
            </article>
          ))}
          {!loading && !ideas.length && (
            <div className="rounded-card bg-white/70 p-8 font-body text-wayfarer-text-muted">
              Start by generating a route to see curated stops, sponsors, and detours.
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default TripPlanner;
