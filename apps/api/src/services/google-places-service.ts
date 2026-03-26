import { env } from '../config/env.js';

export type PlaceSuggestion = {
  id: string;
  placeId: string;
  title: string;
  description: string;
  distanceKm: number;
  lat: number;
  lng: number;
};

type GeocodeResponse = {
  status: string;
  results: Array<{
    geometry?: {
      location?: {
        lat?: number;
        lng?: number;
      };
    };
  }>;
};

type NearbySearchResponse = {
  status: string;
  results: Array<{
    place_id?: string;
    name?: string;
    vicinity?: string;
    formatted_address?: string;
    geometry?: {
      location?: {
        lat?: number;
        lng?: number;
      };
    };
  }>;
};

type CachedEntry = {
  expiresAt: number;
  data: PlaceSuggestion[];
};

export class GooglePlacesService {
  private readonly cache = new Map<string, CachedEntry>();

  constructor(
    private readonly fetchFn: typeof fetch = fetch,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async findStops(params: {
    location: string;
    radiusKm: number;
    theme: string;
  }): Promise<PlaceSuggestion[]> {
    const cacheKey =
      `${params.location}:${params.radiusKm}:${params.theme}`.toLowerCase();
    const cached = this.cache.get(cacheKey);
    const now = this.now();
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }

    const geocodeUrl = new URL('/maps/api/geocode/json', env.GOOGLE_MAPS_API_BASE_URL);
    geocodeUrl.searchParams.set('address', params.location);
    geocodeUrl.searchParams.set('key', env.GOOGLE_MAPS_API_KEY);

    const geocode = await this.fetchWithRetry<GeocodeResponse>(geocodeUrl);
    if (geocode.status !== 'OK' || !geocode.results.length) {
      throw new Error('GOOGLE_GEOCODE_FAILED');
    }

    const origin = geocode.results[0].geometry?.location;
    if (!origin || typeof origin.lat !== 'number' || typeof origin.lng !== 'number') {
      throw new Error('GOOGLE_GEOCODE_INVALID_LOCATION');
    }
    const originLat = origin.lat;
    const originLng = origin.lng;

    const nearbyUrl = new URL(
      '/maps/api/place/nearbysearch/json',
      env.GOOGLE_MAPS_API_BASE_URL,
    );
    nearbyUrl.searchParams.set('location', `${originLat},${originLng}`);
    nearbyUrl.searchParams.set(
      'radius',
      String(Math.max(1000, Math.min(Math.round(params.radiusKm * 1000), 50000))),
    );
    nearbyUrl.searchParams.set('keyword', this.toThemeKeyword(params.theme));
    nearbyUrl.searchParams.set('key', env.GOOGLE_MAPS_API_KEY);

    const nearby = await this.fetchWithRetry<NearbySearchResponse>(nearbyUrl);
    if (!['OK', 'ZERO_RESULTS'].includes(nearby.status)) {
      throw new Error('GOOGLE_PLACES_FAILED');
    }

    const suggestions = nearby.results
      .flatMap((result): PlaceSuggestion[] => {
        const location = result.geometry?.location;
        if (
          !result.place_id ||
          !result.name ||
          !location ||
          typeof location.lat !== 'number' ||
          typeof location.lng !== 'number'
        ) {
          return [];
        }

        return [
          {
            id: result.place_id,
            placeId: result.place_id,
            title: result.name,
            description: result.vicinity ?? result.formatted_address ?? params.location,
            distanceKm: Math.max(
              1,
              Math.round(
                this.haversineKm(originLat, originLng, location.lat, location.lng),
              ),
            ),
            lat: location.lat,
            lng: location.lng,
          },
        ];
      })
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, env.GOOGLE_PLACES_RESULT_LIMIT);

    this.cache.set(cacheKey, {
      expiresAt: now + env.GOOGLE_PLACES_CACHE_TTL_SECONDS * 1000,
      data: suggestions,
    });

    return suggestions;
  }

  private async fetchWithRetry<T>(url: URL): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= env.GOOGLE_PLACES_RETRY_COUNT; attempt += 1) {
      const abortController = new AbortController();
      const timeout = setTimeout(
        () => abortController.abort(),
        env.GOOGLE_PLACES_TIMEOUT_MS,
      );

      try {
        const response = await this.fetchFn(url, { signal: abortController.signal });
        if (!response.ok) {
          throw new Error(`HTTP_${response.status}`);
        }

        const payload = (await response.json()) as T;
        clearTimeout(timeout);
        return payload;
      } catch (error) {
        clearTimeout(timeout);
        lastError = error;
      }
    }

    throw new Error(`GOOGLE_REQUEST_FAILED: ${String(lastError)}`);
  }

  private toThemeKeyword(theme: string) {
    const normalized = theme.toLowerCase();
    if (normalized === 'scenic') return 'scenic viewpoint';
    if (normalized === 'foodie') return 'local food';
    if (normalized === 'culture') return 'museum local culture';
    if (normalized === 'adventure') return 'outdoor adventure';
    if (normalized === 'family') return 'family friendly';
    return normalized;
  }

  private haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return 6371 * c;
  }
}

export const googlePlacesService = new GooglePlacesService();
void env.GOOGLE_MAPS_API_KEY; // ensures env is referenced until integration lands.
