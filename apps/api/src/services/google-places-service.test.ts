import { describe, expect, it, vi } from 'vitest';
import {
  GooglePlacesService,
  GooglePlacesUpstreamError,
} from './google-places-service.js';

const geocodeOk = (lat: number, lng: number) =>
  ({
    ok: true,
    json: async () => ({
      status: 'OK',
      results: [{ geometry: { location: { lat, lng } } }],
    }),
  }) as Response;

const placesOk = (
  places: Array<{
    id?: string;
    displayName?: { text?: string };
    shortFormattedAddress?: string;
    location?: { latitude?: number; longitude?: number };
    photos?: Array<{ name?: string }>;
  }>,
) =>
  ({
    ok: true,
    json: async () => ({ places }),
  }) as Response;

const placesError = (status: string, message: string) =>
  ({
    ok: true,
    json: async () => ({ error: { status, message } }),
  }) as Response;

const httpError = (statusCode: number) =>
  ({
    ok: false,
    status: statusCode,
    json: async () => ({}),
  }) as unknown as Response;

describe('GooglePlacesService', () => {
  it('returns normalized real-api style suggestions', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(geocodeOk(47.6062, -122.3321))
      .mockResolvedValueOnce(
        placesOk([
          {
            id: 'place-1',
            displayName: { text: 'Pike Place Market' },
            shortFormattedAddress: 'Seattle',
            location: { latitude: 47.6094, longitude: -122.3422 },
            photos: [{ name: 'places/place-1/photos/photo-1' }],
          },
          {
            id: 'place-2',
            displayName: { text: 'Kerry Park' },
            shortFormattedAddress: 'Queen Anne',
            location: { latitude: 47.6295, longitude: -122.3599 },
          },
        ]),
      );

    const service = new GooglePlacesService(fetchMock, () => 0);

    const suggestions = await service.findStops({
      location: 'Seattle, WA',
      radiusKm: 120,
      themes: ['foodie'],
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(suggestions).toHaveLength(2);
    expect(suggestions[0]).toMatchObject({
      id: 'place-1',
      placeId: 'place-1',
      title: 'Pike Place Market',
      description: 'Seattle',
      lat: 47.6094,
      lng: -122.3422,
      photoName: 'places/place-1/photos/photo-1',
      distanceKm: expect.any(Number),
    });
  });

  it('uses cache for repeat requests within ttl', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(geocodeOk(30, -97))
      .mockResolvedValueOnce(
        placesOk([
          {
            id: 'place-a',
            displayName: { text: 'Stop A' },
            shortFormattedAddress: 'Austin',
            location: { latitude: 30.1, longitude: -97.1 },
          },
        ]),
      );

    const service = new GooglePlacesService(fetchMock, () => 1000);

    const first = await service.findStops({
      location: 'Austin, TX',
      radiusKm: 80,
      themes: ['scenic'],
    });
    const second = await service.findStops({
      location: 'Austin, TX',
      radiusKm: 80,
      themes: ['scenic'],
    });

    expect(first).toEqual(second);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws normalized error when geocode fails', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'REQUEST_DENIED', results: [] }),
    } as Response);
    const service = new GooglePlacesService(fetchMock);

    await expect(
      service.findStops({
        location: 'Seattle, WA',
        radiusKm: 120,
        themes: ['foodie'],
      }),
    ).rejects.toThrow(/GOOGLE_GEOCODE_FAILED/);
  });

  it('aggregates and de-duplicates suggestions across multiple themes', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(geocodeOk(47.6062, -122.3321))
      .mockResolvedValueOnce(
        placesOk([
          {
            id: 'place-1',
            displayName: { text: 'Pike Place Market' },
            shortFormattedAddress: 'Seattle',
            location: { latitude: 47.6094, longitude: -122.3422 },
          },
          {
            id: 'place-1',
            displayName: { text: 'Pike Place Market' },
            shortFormattedAddress: 'Seattle',
            location: { latitude: 47.6094, longitude: -122.3422 },
          },
          {
            id: 'place-2',
            displayName: { text: 'Kerry Park' },
            shortFormattedAddress: 'Queen Anne',
            location: { latitude: 47.6295, longitude: -122.3599 },
          },
        ]),
      );

    const service = new GooglePlacesService(fetchMock, () => 0);

    const suggestions = await service.findStops({
      location: 'Seattle, WA',
      radiusKm: 120,
      themes: ['foodie', 'culture', 'sports'],
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(suggestions).toHaveLength(2);
    expect(suggestions.map((suggestion) => suggestion.placeId)).toEqual([
      'place-1',
      'place-2',
    ]);

    const nearbyCall = fetchMock.mock.calls[1];
    const body = JSON.parse(String(nearbyCall?.[1]?.body)) as {
      includedTypes?: string[];
      locationRestriction?: { circle?: { radius?: number } };
      rankPreference?: string;
    };

    expect(body.rankPreference).toBe('DISTANCE');
    expect(body.locationRestriction?.circle?.radius).toBe(50000);
    expect(body.includedTypes).toEqual(
      expect.arrayContaining([
        'restaurant',
        'cafe',
        'museum',
        'art_gallery',
        'stadium',
        'sports_activity_location',
      ]),
    );
  });

  // -------------------------------------------------------------------------
  // geocodeLocation
  // -------------------------------------------------------------------------

  describe('geocodeLocation', () => {
    it('throws GOOGLE_GEOCODE_INVALID_LOCATION when geometry has no coordinates', async () => {
      const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'OK',
          results: [{ geometry: { location: {} } }],
        }),
      } as Response);

      const service = new GooglePlacesService(fetchMock);
      await expect(service.geocodeLocation('Nowhere, XX')).rejects.toThrow(
        /GOOGLE_GEOCODE_INVALID_LOCATION/,
      );
    });

    it('throws GOOGLE_GEOCODE_INVALID_LOCATION when geometry is missing entirely', async () => {
      const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'OK',
          results: [{}],
        }),
      } as Response);

      const service = new GooglePlacesService(fetchMock);
      await expect(service.geocodeLocation('Nowhere, XX')).rejects.toThrow(
        /GOOGLE_GEOCODE_INVALID_LOCATION/,
      );
    });

    it('returns lat/lng on valid response', async () => {
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(geocodeOk(37.7749, -122.4194));

      const service = new GooglePlacesService(fetchMock);
      const result = await service.geocodeLocation('San Francisco, CA');
      expect(result).toEqual({ lat: 37.7749, lng: -122.4194 });
    });
  });

  // -------------------------------------------------------------------------
  // findStops — edge cases
  // -------------------------------------------------------------------------

  describe('findStops - edge cases', () => {
    it('returns empty array when themes list is empty', async () => {
      const fetchMock = vi.fn<typeof fetch>();
      const service = new GooglePlacesService(fetchMock);

      const results = await service.findStops({
        location: 'Seattle, WA',
        radiusKm: 50,
        themes: [],
      });

      expect(results).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns empty array when all themes are unrecognized', async () => {
      const fetchMock = vi.fn<typeof fetch>();
      const service = new GooglePlacesService(fetchMock);

      const results = await service.findStops({
        location: 'Seattle, WA',
        radiusKm: 50,
        themes: ['futuristic', 'underwater'],
      });

      expect(results).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('skips place entries missing required fields', async () => {
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(geocodeOk(47.6, -122.3))
        .mockResolvedValueOnce(
          placesOk([
            // missing id
            {
              displayName: { text: 'No ID Place' },
              location: { latitude: 47.61, longitude: -122.31 },
            },
            // missing displayName
            {
              id: 'place-no-name',
              location: { latitude: 47.62, longitude: -122.32 },
            },
            // missing location
            {
              id: 'place-no-location',
              displayName: { text: 'No Location' },
            },
            // valid
            {
              id: 'place-valid',
              displayName: { text: 'Valid Place' },
              shortFormattedAddress: 'Seattle',
              location: { latitude: 47.63, longitude: -122.33 },
            },
          ]),
        );

      const service = new GooglePlacesService(fetchMock, () => 0);
      const results = await service.findStops({
        location: 'Seattle, WA',
        radiusKm: 50,
        themes: ['scenic'],
      });

      expect(results).toHaveLength(1);
      expect(results[0].placeId).toBe('place-valid');
    });

    it('throws GOOGLE_PLACES_FAILED when places API returns an error object', async () => {
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(geocodeOk(47.6, -122.3))
        .mockResolvedValueOnce(placesError('PERMISSION_DENIED', 'API key invalid'));

      const service = new GooglePlacesService(fetchMock, () => 0);

      await expect(
        service.findStops({ location: 'Seattle, WA', radiusKm: 50, themes: ['foodie'] }),
      ).rejects.toThrow(/GOOGLE_PLACES_FAILED/);
    });

    it('uses description fallback when shortFormattedAddress and formattedAddress are absent', async () => {
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(geocodeOk(47.6, -122.3))
        .mockResolvedValueOnce(
          placesOk([
            {
              id: 'place-1',
              displayName: { text: 'Minimal Place' },
              location: { latitude: 47.61, longitude: -122.31 },
            },
          ]),
        );

      const service = new GooglePlacesService(fetchMock, () => 0);
      const results = await service.findStops({
        location: 'Seattle, WA',
        radiusKm: 50,
        themes: ['scenic'],
      });

      expect(results[0].description).toBe('Seattle, WA');
    });

    it('enforces minimum distanceKm of 1', async () => {
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(geocodeOk(47.6, -122.3))
        .mockResolvedValueOnce(
          placesOk([
            {
              id: 'place-nearby',
              displayName: { text: 'Right Next Door' },
              shortFormattedAddress: 'Seattle',
              // Very close coordinates — haversine would be < 1 km
              location: { latitude: 47.6001, longitude: -122.3001 },
            },
          ]),
        );

      const service = new GooglePlacesService(fetchMock, () => 0);
      const results = await service.findStops({
        location: 'Seattle, WA',
        radiusKm: 50,
        themes: ['scenic'],
      });

      expect(results[0].distanceKm).toBeGreaterThanOrEqual(1);
    });
  });

  // -------------------------------------------------------------------------
  // resolvePlannedStops
  // -------------------------------------------------------------------------

  describe('resolvePlannedStops', () => {
    it('resolves all stops successfully', async () => {
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(geocodeOk(47.6, -122.3))
        // Stop 1
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            places: [
              {
                id: 'place-1',
                displayName: { text: 'Pike Place Market' },
                shortFormattedAddress: 'Downtown Seattle',
                location: { latitude: 47.609, longitude: -122.342 },
                photos: [{ name: 'places/place-1/photos/p1' }],
              },
            ],
          }),
        } as Response)
        // Stop 2
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            places: [
              {
                id: 'place-2',
                displayName: { text: 'Kerry Park' },
                shortFormattedAddress: 'Queen Anne',
                location: { latitude: 47.629, longitude: -122.36 },
              },
            ],
          }),
        } as Response);

      const service = new GooglePlacesService(fetchMock, () => 0);
      const results = await service.resolvePlannedStops({
        location: 'Seattle, WA',
        radiusKm: 80,
        stopQueries: ['Pike Place Market', 'Kerry Park'],
      });

      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({
        query: 'Pike Place Market',
        suggestion: expect.objectContaining({
          placeId: 'place-1',
          title: 'Pike Place Market',
          photoName: 'places/place-1/photos/p1',
        }),
      });
      expect(results[1]).toMatchObject({
        query: 'Kerry Park',
        suggestion: expect.objectContaining({ placeId: 'place-2' }),
      });
    });

    it('returns NOT_FOUND when no places are returned for a query', async () => {
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(geocodeOk(47.6, -122.3))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ places: [] }),
        } as Response);

      const service = new GooglePlacesService(fetchMock, () => 0);
      const results = await service.resolvePlannedStops({
        location: 'Seattle, WA',
        radiusKm: 80,
        stopQueries: ['Totally Fictional Place'],
      });

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        query: 'Totally Fictional Place',
        errorCode: 'NOT_FOUND',
      });
    });

    it('returns NOT_FOUND when place result has missing required fields', async () => {
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(geocodeOk(47.6, -122.3))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            places: [{ id: 'p1' }], // missing displayName and location
          }),
        } as Response);

      const service = new GooglePlacesService(fetchMock, () => 0);
      const results = await service.resolvePlannedStops({
        location: 'Seattle, WA',
        radiusKm: 80,
        stopQueries: ['Incomplete Place'],
      });

      expect(results[0].errorCode).toBe('NOT_FOUND');
    });

    it('returns UPSTREAM_ERROR when places API returns an error object', async () => {
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(geocodeOk(47.6, -122.3))
        .mockResolvedValueOnce(placesError('PERMISSION_DENIED', 'Invalid API key'));

      const service = new GooglePlacesService(fetchMock, () => 0);
      const results = await service.resolvePlannedStops({
        location: 'Seattle, WA',
        radiusKm: 80,
        stopQueries: ['Some Place'],
      });

      expect(results[0]).toEqual({ query: 'Some Place', errorCode: 'UPSTREAM_ERROR' });
    });

    it('returns UPSTREAM_ERROR when fetchWithRetry throws after all retries', async () => {
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(geocodeOk(47.6, -122.3))
        // All retry attempts fail with HTTP error (GOOGLE_PLACES_RETRY_COUNT = 1 → 2 attempts)
        .mockResolvedValueOnce(httpError(500))
        .mockResolvedValueOnce(httpError(500));

      const service = new GooglePlacesService(fetchMock, () => 0);
      const results = await service.resolvePlannedStops({
        location: 'Seattle, WA',
        radiusKm: 80,
        stopQueries: ['Failing Place'],
      });

      expect(results[0]).toEqual({ query: 'Failing Place', errorCode: 'UPSTREAM_ERROR' });
    });

    it('handles mixed results across multiple queries', async () => {
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(geocodeOk(47.6, -122.3))
        // Query 1: success
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            places: [
              {
                id: 'found-1',
                displayName: { text: 'Found Place' },
                shortFormattedAddress: 'Seattle',
                location: { latitude: 47.61, longitude: -122.31 },
              },
            ],
          }),
        } as Response)
        // Query 2: not found
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ places: [] }),
        } as Response)
        // Query 3: API error
        .mockResolvedValueOnce(placesError('INVALID_REQUEST', 'bad request'));

      const service = new GooglePlacesService(fetchMock, () => 0);
      const results = await service.resolvePlannedStops({
        location: 'Seattle, WA',
        radiusKm: 80,
        stopQueries: ['Found Place', 'Missing Place', 'Error Place'],
      });

      expect(results).toHaveLength(3);
      expect(results[0].suggestion?.placeId).toBe('found-1');
      expect(results[1].errorCode).toBe('NOT_FOUND');
      expect(results[2].errorCode).toBe('UPSTREAM_ERROR');
    });

    it('builds the text query with location context', async () => {
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(geocodeOk(47.6, -122.3))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            places: [
              {
                id: 'p1',
                displayName: { text: 'Test Place' },
                shortFormattedAddress: 'Seattle',
                location: { latitude: 47.61, longitude: -122.31 },
              },
            ],
          }),
        } as Response);

      const service = new GooglePlacesService(fetchMock, () => 0);
      await service.resolvePlannedStops({
        location: 'Seattle, WA',
        radiusKm: 80,
        stopQueries: ['Pike Place Market'],
      });

      const textSearchCall = fetchMock.mock.calls[1];
      const body = JSON.parse(String(textSearchCall?.[1]?.body)) as {
        textQuery?: string;
        maxResultCount?: number;
      };
      expect(body.textQuery).toBe('Pike Place Market near Seattle, WA');
      expect(body.maxResultCount).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // fetchWithRetry — error handling
  // -------------------------------------------------------------------------

  describe('fetchWithRetry - error handling', () => {
    it('retries on HTTP error and returns result on second attempt', async () => {
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(geocodeOk(47.6, -122.3)) // geocode
        .mockResolvedValueOnce(httpError(503)) // places attempt 1: HTTP error
        .mockResolvedValueOnce(
          // places attempt 2: success
          placesOk([
            {
              id: 'place-retry',
              displayName: { text: 'Retry Place' },
              shortFormattedAddress: 'Seattle',
              location: { latitude: 47.61, longitude: -122.31 },
            },
          ]),
        );

      const service = new GooglePlacesService(fetchMock, () => 0);
      const results = await service.findStops({
        location: 'Seattle, WA',
        radiusKm: 50,
        themes: ['scenic'],
      });

      // 3 fetch calls: 1 geocode + 2 places (retry)
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(results).toHaveLength(1);
      expect(results[0].placeId).toBe('place-retry');
    });

    it('throws GOOGLE_REQUEST_TIMEOUT after all retries exhausted on AbortError', async () => {
      const abortError = Object.assign(new Error('The operation was aborted.'), {
        name: 'AbortError',
      });

      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(geocodeOk(47.6, -122.3)) // geocode succeeds
        .mockRejectedValue(abortError); // all places attempts time out

      const service = new GooglePlacesService(fetchMock, () => 0);

      await expect(
        service.findStops({ location: 'Seattle, WA', radiusKm: 50, themes: ['scenic'] }),
      ).rejects.toMatchObject({
        message: 'GOOGLE_REQUEST_TIMEOUT',
        name: 'GooglePlacesUpstreamError',
        stage: 'request',
      });
    });

    it('throws GOOGLE_REQUEST_FAILED after all retries exhausted on network error', async () => {
      const networkError = new Error('ECONNREFUSED');

      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(geocodeOk(47.6, -122.3)) // geocode succeeds
        .mockRejectedValue(networkError); // all places attempts fail

      const service = new GooglePlacesService(fetchMock, () => 0);

      await expect(
        service.findStops({ location: 'Seattle, WA', radiusKm: 50, themes: ['scenic'] }),
      ).rejects.toMatchObject({
        message: 'GOOGLE_REQUEST_FAILED',
        name: 'GooglePlacesUpstreamError',
        stage: 'request',
      });
    });

    it('throws GOOGLE_REQUEST_HTTP_ERROR when all retry attempts return HTTP errors', async () => {
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(geocodeOk(47.6, -122.3))
        .mockResolvedValue(httpError(503)); // every places attempt fails

      const service = new GooglePlacesService(fetchMock, () => 0);

      await expect(
        service.findStops({ location: 'Seattle, WA', radiusKm: 50, themes: ['scenic'] }),
      ).rejects.toMatchObject({
        message: 'GOOGLE_REQUEST_HTTP_ERROR',
        name: 'GooglePlacesUpstreamError',
        stage: 'request',
      });
    });
  });

  // -------------------------------------------------------------------------
  // GooglePlacesUpstreamError
  // -------------------------------------------------------------------------

  describe('GooglePlacesUpstreamError', () => {
    it('has the correct name, stage, and details', () => {
      const err = new GooglePlacesUpstreamError('TEST_CODE', {
        stage: 'geocode',
        details: { foo: 'bar' },
      });
      expect(err.name).toBe('GooglePlacesUpstreamError');
      expect(err.message).toBe('TEST_CODE');
      expect(err.stage).toBe('geocode');
      expect(err.details).toEqual({ foo: 'bar' });
      expect(err).toBeInstanceOf(Error);
    });

    it('defaults details to empty object when not provided', () => {
      const err = new GooglePlacesUpstreamError('TEST_CODE', { stage: 'nearby' });
      expect(err.details).toEqual({});
    });
  });
});
