'use client';

import { useMemo, useState } from 'react';
import type { TripFilters } from '@roadtrip/types';
import { TripThemeSchema } from '@roadtrip/types';
import { Button } from '@roadtrip/ui';
import { fetchTripIdeas, type TripIdea } from '../lib/api-client';

const TripPlanner = () => {
  const [filters, setFilters] = useState<TripFilters>({
    radiusKm: 150,
    theme: 'scenic',
    maxStops: 6,
  });
  const [location, setLocation] = useState('Los Angeles, CA');
  const [loading, setLoading] = useState(false);
  const [ideas, setIdeas] = useState<TripIdea[]>([]);

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
            value={location}
            onChange={(event) => setLocation(event.target.value)}
          />
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
