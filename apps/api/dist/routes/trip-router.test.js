import { describe, expect, it } from 'vitest';
import { appRouter } from './index.js';
const caller = appRouter.createCaller({ prisma: {}, userId: 'user-1' });
describe('tripRouter', () => {
  it('returns placeholder suggestions', async () => {
    const suggestions = await caller.trip.suggestions({
      location: 'Austin, TX',
      radiusKm: 120,
      theme: 'foodie',
    });
    expect(suggestions[0].title).toContain('foodie');
  });
});
