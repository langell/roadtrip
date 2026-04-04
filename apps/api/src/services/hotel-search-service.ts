import { env } from '../config/env.js';

export type HotelResult = {
  placeId: string;
  name: string;
  vicinity: string;
  lat: number;
  lng: number;
  rating: number | null;
  reviewCount: number | null;
  priceLevel: 1 | 2 | 3 | 4 | null;
  photoUrl: string | null;
  expediaUrl: string;
  bookingUrl: string;
};

type PlacesNearbyHotelResponse = {
  places?: Array<{
    id?: string;
    displayName?: { text?: string };
    shortFormattedAddress?: string;
    location?: { latitude?: number; longitude?: number };
    photos?: Array<{ name?: string }>;
    rating?: number;
    userRatingCount?: number;
    priceLevel?: string;
  }>;
  error?: { status?: string; message?: string };
};

type PhotoMediaResponse = {
  photoUri?: string;
};

const PRICE_LEVEL_MAP: Record<string, 1 | 2 | 3 | 4> = {
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

export class HotelSearchService {
  constructor(private readonly fetchFn: typeof fetch = fetch) {}

  async searchNearby(params: {
    lat: number;
    lng: number;
    radiusKm: number;
  }): Promise<HotelResult[]> {
    const radiusMeters = Math.round(Math.min(params.radiusKm, 50) * 1000);

    const placesUrl = new URL('/v1/places:searchNearby', 'https://places.googleapis.com');
    const response = await this.fetchFn(placesUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': env.GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.shortFormattedAddress,places.location,places.photos,places.rating,places.userRatingCount,places.priceLevel',
      },
      body: JSON.stringify({
        includedTypes: ['lodging'],
        maxResultCount: 4,
        rankPreference: 'POPULARITY',
        locationRestriction: {
          circle: {
            center: { latitude: params.lat, longitude: params.lng },
            radius: radiusMeters,
          },
        },
      }),
    });

    if (!response.ok) return [];

    const data = (await response.json()) as PlacesNearbyHotelResponse;
    if (!data.places?.length) return [];

    const results = await Promise.all(
      data.places.map(async (place): Promise<HotelResult | null> => {
        const id = place.id;
        const name = place.displayName?.text;
        const lat = place.location?.latitude;
        const lng = place.location?.longitude;
        if (!id || !name || lat == null || lng == null) return null;

        const photoUrl = place.photos?.[0]?.name
          ? await this.resolvePhotoUrl(place.photos[0].name)
          : null;

        return {
          placeId: id,
          name,
          vicinity: place.shortFormattedAddress ?? '',
          lat,
          lng,
          rating: place.rating ?? null,
          reviewCount: place.userRatingCount ?? null,
          priceLevel: place.priceLevel
            ? (PRICE_LEVEL_MAP[place.priceLevel] ?? null)
            : null,
          photoUrl,
          expediaUrl: this.buildExpediaUrl(name, lat, lng),
          bookingUrl: this.buildBookingUrl(name, lat, lng),
        };
      }),
    );

    return results.filter((r): r is HotelResult => r !== null);
  }

  private async resolvePhotoUrl(photoName: string): Promise<string | null> {
    try {
      const url = new URL(`/v1/${photoName}/media`, 'https://places.googleapis.com');
      url.searchParams.set('key', env.GOOGLE_MAPS_API_KEY);
      url.searchParams.set('maxWidthPx', '600');
      url.searchParams.set('skipHttpRedirect', 'true');
      const res = await this.fetchFn(url.toString());
      if (!res.ok) return null;
      const data = (await res.json()) as PhotoMediaResponse;
      return data.photoUri ?? null;
    } catch {
      return null;
    }
  }

  private buildExpediaUrl(name: string, lat: number, lng: number): string {
    const params = new URLSearchParams({
      destination: name,
      latLong: `${lat},${lng}`,
      radius: '5',
    });
    if (env.EXPEDIA_AFFILIATE_ID) {
      params.set('affcid', `US.DIRECT.PHG.${env.EXPEDIA_AFFILIATE_ID}`);
    }
    return `https://www.expedia.com/Hotel-Search?${params.toString()}`;
  }

  private buildBookingUrl(name: string, lat: number, lng: number): string {
    const params = new URLSearchParams({
      ss: name,
      latitude: String(lat),
      longitude: String(lng),
    });
    if (env.BOOKING_AFFILIATE_ID) {
      params.set('aid', env.BOOKING_AFFILIATE_ID);
    }
    return `https://www.booking.com/searchresults.html?${params.toString()}`;
  }
}

export const hotelSearchService = new HotelSearchService();
