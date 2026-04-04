import { getNearbyHotelsServer } from '../lib/server-api-client';
import { HotelCard } from './HotelCard';

type Props = {
  lat: number;
  lng: number;
  stopName: string;
};

export const NearbyHotels = async ({ lat, lng, stopName }: Props) => {
  const hotels = await getNearbyHotelsServer(lat, lng, 15);
  if (!hotels.length) return null;

  return (
    <section className="mt-10">
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <h3 className="font-display text-lg font-bold text-wayfarer-text-main">
            Places to Stay Nearby
          </h3>
          <p className="mt-0.5 text-xs text-wayfarer-text-muted">
            Hotels &amp; lodging near {stopName}
          </p>
        </div>
      </div>

      {/* Horizontal scroll strip */}
      <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-4 md:-mx-0 md:px-0">
        {hotels.map((hotel) => (
          <HotelCard key={hotel.placeId} hotel={hotel} />
        ))}
      </div>

      <p className="mt-1 text-[10px] text-wayfarer-text-muted">
        Powered by Google Places &middot; We earn a commission when you book via these
        links
      </p>
    </section>
  );
};
