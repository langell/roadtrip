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
    <div className="space-y-8 text-stone-900">
      <form
        className="grid gap-4 md:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault();
          void handleGenerate();
        }}
      >
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.18em] text-stone-500">
            Origin
          </span>
          <input
            className="w-full rounded-xl bg-white px-4 py-3 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#a5d0b9]"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
          />
        </label>

        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.18em] text-stone-500">
            Radius (KM)
          </span>
          <input
            type="number"
            min={25}
            max={500}
            className="w-full rounded-xl bg-white px-4 py-3 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#a5d0b9]"
            value={filters.radiusKm}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, radiusKm: Number(event.target.value) }))
            }
          />
        </label>

        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.18em] text-stone-500">
            Theme
          </span>
          <select
            className="w-full rounded-xl bg-white px-4 py-3 text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#a5d0b9]"
            value={filters.theme}
            onChange={(event) =>
              setFilters((prev) => ({
                ...prev,
                theme: event.target.value as TripFilters['theme'],
              }))
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
          <span className="text-xs uppercase tracking-[0.18em] text-stone-500">
            Max stops
          </span>
          <input
            type="number"
            min={1}
            max={12}
            className="w-full rounded-xl bg-white px-4 py-3 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#a5d0b9]"
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
        <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
          Suggested experiences
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          {ideas.map((idea) => (
            <article
              key={idea.id}
              className="rounded-2xl bg-white p-5 shadow-[0_8px_20px_rgba(0,0,0,0.05)]"
            >
              {idea.imageUrl ? (
                <img
                  src={idea.imageUrl}
                  alt={idea.title}
                  className="mb-3 h-40 w-full rounded-xl object-cover"
                />
              ) : null}
              <h3 className="text-lg font-semibold text-[#1B4332]">{idea.title}</h3>
              <p className="text-sm text-stone-600">{idea.description}</p>
              <p className="text-xs uppercase tracking-[0.12em] text-[#3b6090]">
                {idea.distanceKm}km · curated sample
              </p>
            </article>
          ))}
          {!ideas.length && (
            <div className="rounded-2xl bg-white/70 p-8 text-stone-500">
              Start by generating a route to see curated stops, sponsors, and detours.
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default TripPlanner;
