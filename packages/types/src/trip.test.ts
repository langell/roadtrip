import { describe, expect, it } from 'vitest';
import { TripCreateRequestSchema } from './schemas/trip';

describe('Trip Schemas', () => {
  it('validates a correct create payload', () => {
    const result = TripCreateRequestSchema.safeParse({
      name: 'Weekend Explorer',
      origin: { lat: 34.05, lng: -118.25 },
      filters: { radiusKm: 150, theme: 'scenic', maxStops: 8 },
      stops: [
        {
          id: '8d6d46d0-98e0-41c4-a5a9-9c53d5d1f600',
          placeId: 'place_1',
          name: 'Beach Lookout',
          location: { lat: 34.1, lng: -118.3 },
          order: 0
        }
      ]
    });

    expect(result.success).toBe(true);
  });
});
