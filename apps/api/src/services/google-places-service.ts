import { trace, SpanStatusCode } from '@opentelemetry/api';
import { env } from '../config/env.js';

const tracer = trace.getTracer('roadtrip-api');

export type PlaceSuggestion = {
  id: string;
  placeId: string;
  title: string;
  description: string;
  distanceKm: number;
  lat: number;
  lng: number;
  photoName?: string;
};

type GeocodeResponse = {
  status: string;
  error_message?: string;
  results: Array<{
    geometry?: {
      location?: {
        lat?: number;
        lng?: number;
      };
    };
  }>;
};

type PlacesTextSearchResponse = {
  places?: Array<{
    id?: string;
    displayName?: {
      text?: string;
    };
    formattedAddress?: string;
    shortFormattedAddress?: string;
    location?: {
      latitude?: number;
      longitude?: number;
    };
    photos?: Array<{
      name?: string;
    }>;
  }>;
  error?: {
    status?: string;
    message?: string;
  };
};

type CachedEntry = {
  expiresAt: number;
  data: PlaceSuggestion[];
};

type GooglePlacesErrorStage = 'request' | 'geocode' | 'nearby';

type GooglePlacesUpstreamErrorOptions = {
  stage: GooglePlacesErrorStage;
  details?: Record<string, unknown>;
};

export class GooglePlacesUpstreamError extends Error {
  readonly stage: GooglePlacesErrorStage;
  readonly details: Record<string, unknown>;

  constructor(code: string, options: GooglePlacesUpstreamErrorOptions) {
    super(code);
    this.name = 'GooglePlacesUpstreamError';
    this.stage = options.stage;
    this.details = options.details ?? {};
  }
}

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
      throw new GooglePlacesUpstreamError('GOOGLE_GEOCODE_FAILED', {
        stage: 'geocode',
        details: {
          googleStatus: geocode.status,
          googleMessage: geocode.error_message,
          location: params.location,
        },
      });
    }

    const origin = geocode.results[0].geometry?.location;
    if (!origin || typeof origin.lat !== 'number' || typeof origin.lng !== 'number') {
      throw new GooglePlacesUpstreamError('GOOGLE_GEOCODE_INVALID_LOCATION', {
        stage: 'geocode',
        details: {
          location: params.location,
        },
      });
    }
    const originLat = origin.lat;
    const originLng = origin.lng;

    const nearbyRadiusMeters = Math.max(
      1000,
      Math.min(Math.round(params.radiusKm * 1000), 50000),
    );
    const placesUrl = new URL('/v1/places:searchText', 'https://places.googleapis.com');
    const placesResponse = await this.fetchWithRetry<PlacesTextSearchResponse>(
      placesUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': env.GOOGLE_MAPS_API_KEY,
          'X-Goog-FieldMask':
            'places.id,places.displayName,places.formattedAddress,places.shortFormattedAddress,places.location,places.photos',
        },
        body: JSON.stringify({
          textQuery: this.toThemeKeyword(params.theme),
          maxResultCount: env.GOOGLE_PLACES_RESULT_LIMIT,
          locationBias: {
            circle: {
              center: {
                latitude: originLat,
                longitude: originLng,
              },
              radius: nearbyRadiusMeters,
            },
          },
        }),
      },
    );

    if (placesResponse.error) {
      throw new GooglePlacesUpstreamError('GOOGLE_PLACES_FAILED', {
        stage: 'nearby',
        details: {
          googleStatus: placesResponse.error.status,
          googleMessage: placesResponse.error.message,
          location: params.location,
          theme: params.theme,
          radiusKm: params.radiusKm,
        },
      });
    }

    const suggestions = (placesResponse.places ?? [])
      .flatMap((result): PlaceSuggestion[] => {
        const location = result.location;
        if (
          !result.id ||
          !result.displayName?.text ||
          !location ||
          typeof location.latitude !== 'number' ||
          typeof location.longitude !== 'number'
        ) {
          return [];
        }

        return [
          {
            id: result.id,
            placeId: result.id,
            title: result.displayName.text,
            description:
              result.shortFormattedAddress ?? result.formattedAddress ?? params.location,
            distanceKm: Math.max(
              1,
              Math.round(
                this.haversineKm(
                  originLat,
                  originLng,
                  location.latitude,
                  location.longitude,
                ),
              ),
            ),
            lat: location.latitude,
            lng: location.longitude,
            photoName: result.photos?.[0]?.name,
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

  private async fetchWithRetry<T>(url: URL, init?: RequestInit): Promise<T> {
    const sanitizedUrl = this.sanitizeUrl(url);
    let lastError: unknown;

    for (let attempt = 0; attempt <= env.GOOGLE_PLACES_RETRY_COUNT; attempt += 1) {
      const abortController = new AbortController();
      const timeout = setTimeout(
        () => abortController.abort(),
        env.GOOGLE_PLACES_TIMEOUT_MS,
      );

      try {
        const response = await tracer.startActiveSpan(
          'google.places.request',
          {
            attributes: {
              'http.method': init?.method ?? 'GET',
              'http.url': sanitizedUrl,
              'google.places.attempt': attempt + 1,
            },
          },
          async (span) => {
            try {
              const response = await this.fetchFn(url, {
                ...init,
                signal: abortController.signal,
              });
              span.setAttribute('http.status_code', response.status);
              if (!response.ok) {
                span.setStatus({ code: SpanStatusCode.ERROR, message: 'HTTP_ERROR' });
              }
              return response;
            } catch (error) {
              span.recordException(error as Error);
              span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
              throw error;
            } finally {
              span.end();
            }
          },
        );
        if (!response.ok) {
          throw new GooglePlacesUpstreamError('GOOGLE_REQUEST_HTTP_ERROR', {
            stage: 'request',
            details: {
              httpStatus: response.status,
              url: sanitizedUrl,
              attempt: attempt + 1,
              maxAttempts: env.GOOGLE_PLACES_RETRY_COUNT + 1,
            },
          });
        }

        const payload = (await response.json()) as T;
        clearTimeout(timeout);
        return payload;
      } catch (error) {
        clearTimeout(timeout);

        if (error instanceof GooglePlacesUpstreamError) {
          lastError = error;
          continue;
        }

        if (error instanceof Error && error.name === 'AbortError') {
          lastError = new GooglePlacesUpstreamError('GOOGLE_REQUEST_TIMEOUT', {
            stage: 'request',
            details: {
              timeoutMs: env.GOOGLE_PLACES_TIMEOUT_MS,
              url: sanitizedUrl,
              attempt: attempt + 1,
              maxAttempts: env.GOOGLE_PLACES_RETRY_COUNT + 1,
            },
          });
          continue;
        }

        lastError = new GooglePlacesUpstreamError('GOOGLE_REQUEST_FAILED', {
          stage: 'request',
          details: {
            url: sanitizedUrl,
            attempt: attempt + 1,
            maxAttempts: env.GOOGLE_PLACES_RETRY_COUNT + 1,
            reason: String(error),
          },
        });
      }
    }

    if (lastError instanceof GooglePlacesUpstreamError) {
      throw lastError;
    }

    throw new GooglePlacesUpstreamError('GOOGLE_REQUEST_FAILED', {
      stage: 'request',
      details: {
        url: sanitizedUrl,
        reason: String(lastError),
      },
    });
  }

  private sanitizeUrl(url: URL) {
    const sanitized = new URL(url.toString());
    if (sanitized.searchParams.has('key')) {
      sanitized.searchParams.set('key', '[REDACTED]');
    }
    return sanitized.toString();
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
