import { describe, expect, it } from 'vitest';
import { GooglePlacesService } from './google-places-service.js';

const service = new GooglePlacesService();

describe('GooglePlacesService', () => {
  it('returns deterministic placeholder suggestions', async () => {
    const suggestions = await service.findStops({
      location: 'Seattle, WA',
      radiusKm: 120,
      theme: 'foodie',
    });

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({
      title: 'foodie waypoint',
      description: expect.stringContaining('Seattle'),
      distanceKm: Math.round(120 * 0.4),
    });

    const secondCall = await service.findStops({
      location: 'Seattle, WA',
      radiusKm: 120,
      theme: 'foodie',
    });

    expect(secondCall[0].id).toBe(suggestions[0].id);
  });
});
