'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchCachedTripPlan } from '../lib/api-client';
import type { TrendingRoute } from '../lib/api-client';

const GRADIENTS = [
  'from-wayfarer-primary to-wayfarer-primary-light',
  'from-wayfarer-secondary to-wayfarer-primary',
  'from-[#1a3a2a] to-[#2d6a4f]',
  'from-[#3b2a1a] to-[#6b4c2a]',
  'from-[#1a2a3a] to-[#2a4a6a]',
  'from-[#2a1a3a] to-[#4a2a6a]',
];

type Props = {
  route: TrendingRoute;
  index: number;
};

const KM_PER_MILE = 1.60934;

const TrendingRouteCard = ({ route, index }: Props) => {
  const router = useRouter();
  const gradient = GRADIENTS[index % GRADIENTS.length];
  const radiusMiles = Math.round(route.radiusKm / KM_PER_MILE);
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const result = await fetchCachedTripPlan(route.cacheId);

      const option = result?.options[0];
      if (!option) {
        // Fallback to planner pre-filled with the location
        router.push(`/planner?location=${encodeURIComponent(route.location)}`);
        return;
      }

      const draft = {
        plan: option,
        location: route.location,
        radiusKm: route.radiusKm,
        themes: route.themes,
        originLat: 0,
        originLng: 0,
      };

      const key = `hiptrip:trip-draft:${Date.now()}`;
      try {
        localStorage.setItem(key, JSON.stringify(draft));
      } catch {
        // localStorage unavailable
      }
      router.push(`/plan?draft=${encodeURIComponent(key)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={loading}
      className="group relative flex min-w-[260px] snap-start flex-col overflow-hidden rounded-2xl bg-wayfarer-surface shadow-wayfarer-soft transition hover:shadow-wayfarer-ambient md:min-w-0 text-left disabled:opacity-70"
    >
      <div className="relative h-36 w-full overflow-hidden">
        {route.previewImageUrl ? (
          <img
            src={route.previewImageUrl}
            alt={route.previewTitle}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className={`h-full w-full bg-gradient-to-br ${gradient}`} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          </div>
        ) : (
          <span className="absolute bottom-2 left-3 rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold text-white backdrop-blur-sm">
            {radiusMiles} mi radius
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="font-display text-sm font-bold leading-snug text-wayfarer-primary line-clamp-2">
          {route.previewTitle}
        </p>
        <p className="text-xs text-wayfarer-text-muted">{route.location}</p>
        <div className="mt-auto flex flex-wrap gap-1">
          {route.themes.slice(0, 3).map((theme) => (
            <span
              key={theme}
              className="rounded-full bg-wayfarer-primary/10 px-2 py-0.5 text-xs font-medium capitalize text-wayfarer-primary"
            >
              {theme}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
};

export default TrendingRouteCard;
