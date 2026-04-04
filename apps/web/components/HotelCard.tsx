import type { HotelResult } from '../lib/api-client';

const PRICE_LABELS: Record<number, string> = { 1: '$', 2: '$$', 3: '$$$', 4: '$$$$' };

const StarRating = ({ rating }: { rating: number }) => {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return (
    <span className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: full }).map((_, i) => (
        <svg
          key={`f${i}`}
          className="h-3 w-3 fill-amber-400 text-amber-400"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      {half && (
        <svg className="h-3 w-3 text-amber-400" viewBox="0 0 20 20">
          <defs>
            <linearGradient id="half">
              <stop offset="50%" stopColor="currentColor" />
              <stop offset="50%" stopColor="#d1d5db" />
            </linearGradient>
          </defs>
          <path
            fill="url(#half)"
            d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
          />
        </svg>
      )}
      {Array.from({ length: empty }).map((_, i) => (
        <svg
          key={`e${i}`}
          className="h-3 w-3 fill-gray-200 text-gray-200"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </span>
  );
};

export const HotelCard = ({ hotel }: { hotel: HotelResult }) => {
  return (
    <article className="flex w-72 shrink-0 flex-col overflow-hidden rounded-2xl bg-wayfarer-surface shadow-wayfarer-soft transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-wayfarer-ambient">
      {/* Photo */}
      <div className="relative aspect-[4/3] overflow-hidden bg-wayfarer-surface-deep">
        {hotel.photoUrl ? (
          <img
            src={hotel.photoUrl}
            alt={hotel.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-wayfarer-surface-deep">
            <svg
              className="h-10 w-10 text-wayfarer-accent"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
            >
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
        )}

        {/* Badges overlaid on photo */}
        <div className="absolute left-3 top-3 flex items-center gap-1.5">
          <span className="rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
            Partner
          </span>
        </div>
        {hotel.priceLevel && (
          <div className="absolute right-3 top-3">
            <span className="rounded-full bg-wayfarer-bg/90 px-2.5 py-0.5 text-xs font-bold text-wayfarer-text-main backdrop-blur-sm">
              {PRICE_LABELS[hotel.priceLevel]}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="space-y-1">
          <h3 className="line-clamp-1 font-display text-sm font-bold leading-tight text-wayfarer-text-main">
            {hotel.name}
          </h3>

          {hotel.rating !== null && (
            <div className="flex items-center gap-2">
              <StarRating rating={hotel.rating} />
              <span className="text-xs font-semibold text-wayfarer-text-main">
                {hotel.rating.toFixed(1)}
              </span>
              {hotel.reviewCount !== null && (
                <span className="text-xs text-wayfarer-text-muted">
                  ({hotel.reviewCount.toLocaleString()})
                </span>
              )}
            </div>
          )}

          {hotel.vicinity && (
            <p className="flex items-center gap-1 text-xs text-wayfarer-text-muted">
              <svg
                className="h-3 w-3 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span className="truncate">{hotel.vicinity}</span>
            </p>
          )}
        </div>

        {/* CTA buttons */}
        <div className="mt-auto flex gap-2">
          <a
            href={hotel.expediaUrl}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#FFD700]/10 py-2.5 text-xs font-bold text-[#c8920a] transition-colors hover:bg-[#FFD700]/20"
          >
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            Expedia
          </a>
          <a
            href={hotel.bookingUrl}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#003580]/8 py-2.5 text-xs font-bold text-[#003580] transition-colors hover:bg-[#003580]/15"
          >
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            Booking.com
          </a>
        </div>
      </div>
    </article>
  );
};
