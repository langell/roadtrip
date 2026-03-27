import { describe, expect, it, vi } from 'vitest';
import { GooglePlacesService } from './google-places-service.js';

describe('GooglePlacesService', () => {
  it('returns normalized real-api style suggestions', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'OK',
          results: [{ geometry: { location: { lat: 47.6062, lng: -122.3321 } } }],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          places: [
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
          ],
        }),
      } as Response);

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
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'OK',
          results: [{ geometry: { location: { lat: 30, lng: -97 } } }],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          places: [
            {
              id: 'place-a',
              displayName: { text: 'Stop A' },
              shortFormattedAddress: 'Austin',
              location: { latitude: 30.1, longitude: -97.1 },
            },
          ],
        }),
      } as Response);

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
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'OK',
          results: [{ geometry: { location: { lat: 47.6062, lng: -122.3321 } } }],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          places: [
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
          ],
        }),
      } as Response);

    const service = new GooglePlacesService(fetchMock, () => 0);

    const suggestions = await service.findStops({
      location: 'Seattle, WA',
      radiusKm: 120,
      themes: ['foodie', 'culture'],
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
      expect.arrayContaining(['restaurant', 'cafe', 'museum', 'art_gallery']),
    );
  });
});
