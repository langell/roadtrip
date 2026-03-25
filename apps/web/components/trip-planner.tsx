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
    maxStops: 6
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
        theme: filters.theme
      });
      setIdeas(data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <form
        className="grid gap-6 md:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault();
          void handleGenerate();
        }}
      >
        <label className="space-y-2">
          <span className="text-sm uppercase tracking-wide text-white/60">Origin</span>
          <input
            className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-emerald-400 focus:outline-none"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm uppercase tracking-wide text-white/60">Radius (KM)</span>
          <input
            type="number"
            min={25}
            max={500}
            className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-emerald-400 focus:outline-none"
            value={filters.radiusKm}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, radiusKm: Number(event.target.value) }))
            }
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm uppercase tracking-wide text-white/60">Theme</span>
          <select
            className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white focus:border-emerald-400 focus:outline-none"
            value={filters.theme}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, theme: event.target.value as TripFilters['theme'] }))
            }
          >
            {themeOptions.map((theme) => (
              <option key={theme} value={theme} className="text-slate-900">
                {theme}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm uppercase tracking-wide text-white/60">Max stops</span>
          <input
            type="number"
            min={1}
            max={12}
            className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-emerald-400 focus:outline-none"
            value={filters.maxStops}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, maxStops: Number(event.target.value) }))
            }
          />
        </label>
        <div className="flex items-end">
          <Button tone="primary" loading={loading} type="submit" className="w-full">
            Generate trip
          </Button>
        </div>
      </form>

      <section className="space-y-4">
        <p className="text-sm uppercase tracking-widest text-white/50">
          Suggested experiences
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          {ideas.map((idea) => (
            <article
              key={idea.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white"
            >
              <h3 className="text-lg font-semibold">{idea.title}</h3>
              <p className="text-sm text-white/70">{idea.description}</p>
              <p className="text-xs uppercase text-emerald-300">
                {idea.distanceKm}km · curated sample
              </p>
            </article>
          ))}
          {!ideas.length && (
            <div className="rounded-2xl border border-dashed border-white/10 p-8 text-white/60">
              Start by generating a route to see curated stops, sponsors, and detours.
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default TripPlanner;
