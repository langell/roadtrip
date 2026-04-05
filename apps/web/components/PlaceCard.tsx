'use client';

import type { DiscoverStop } from '../lib/api-client';
import { recordEvent } from '../lib/analytics';

const GRADIENTS = [
  'from-[#1a3a2a] to-[#2d6a4f]',
  'from-[#1a2a3a] to-[#2a4a6a]',
  'from-[#3b2a1a] to-[#6b4c2a]',
  'from-[#2a1a3a] to-[#4a2a6a]',
  'from-wayfarer-primary to-wayfarer-primary-light',
  'from-[#1a3a35] to-[#2d5a52]',
];

type Props = {
  stop: DiscoverStop;
  gradientIndex: number;
};

const PlaceCard = ({ stop, gradientIndex }: Props) => {
  const gradient = GRADIENTS[gradientIndex % GRADIENTS.length];

  const inner = (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl bg-wayfarer-surface shadow-wayfarer-soft transition hover:shadow-wayfarer-ambient">
      <div className="relative h-40 w-full overflow-hidden">
        {stop.imageUrl ? (
          <img
            src={stop.imageUrl}
            alt={stop.title}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className={`h-full w-full bg-gradient-to-br ${gradient}`} />
        )}
        {stop.sponsored && (
          <span className="absolute right-2 top-2 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white/90 backdrop-blur-sm">
            Sponsored
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="font-display text-sm font-bold leading-snug text-wayfarer-primary line-clamp-2">
          {stop.title}
        </p>
        <p className="text-xs leading-relaxed text-wayfarer-text-muted line-clamp-2">
          {stop.description}
        </p>
        {stop.sponsored && stop.url && (
          <span className="mt-2 text-xs font-semibold text-wayfarer-primary">
            Learn more →
          </span>
        )}
      </div>
    </div>
  );

  if (stop.sponsored && stop.url) {
    return (
      <a
        href={stop.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() =>
          recordEvent('sponsored_click', {
            placeId: stop.placeId,
            position: String(gradientIndex),
          })
        }
      >
        {inner}
      </a>
    );
  }

  return inner;
};

export default PlaceCard;
