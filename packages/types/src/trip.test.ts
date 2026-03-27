import { describe, expect, it } from 'vitest';
import {
  TripCreateRequestSchema,
  TripUpdateRequestSchema,
  TripThemeSchema,
} from './schemas/trip';

describe('Trip Schemas', () => {
  const validStop = {
    id: '8d6d46d0-98e0-41c4-a5a9-9c53d5d1f600',
    placeId: 'place_1',
    name: 'Beach Lookout',
    location: { lat: 34.1, lng: -118.3 },
    order: 0,
  };

  it('validates a correct create payload', () => {
    const result = TripCreateRequestSchema.safeParse({
      name: 'Weekend Explorer',
      origin: { lat: 34.05, lng: -118.25 },
      filters: { radiusKm: 150, theme: 'scenic', maxStops: 8 },
      stops: [validStop],
    });

    expect(result.success).toBe(true);
  });

  it('rejects invalid coordinates and filters', () => {
    const result = TripCreateRequestSchema.safeParse({
      name: '',
      origin: { lat: 123, lng: -200 },
      filters: { radiusKm: 0, theme: 'unknown', maxStops: 40 },
      stops: [{ ...validStop, order: -1 }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path.join('.'))).toContain(
        'origin.lat',
      );
    }
  });

  it('allows partial updates with TripUpdateRequestSchema', () => {
    const result = TripUpdateRequestSchema.safeParse({
      id: '8d6d46d0-98e0-41c4-a5a9-9c53d5d1f600',
      name: 'Renamed Adventure',
      filters: { radiusKm: 80, theme: 'foodie', maxStops: 6 },
    });

    expect(result.success).toBe(true);
  });

  it('enumerates the supported trip themes', () => {
    expect(TripThemeSchema.options).toContain('scenic');
    expect(TripThemeSchema.options).toContain('sports');
    expect(() => TripThemeSchema.parse('antarctic')).toThrowError();
  });
});
