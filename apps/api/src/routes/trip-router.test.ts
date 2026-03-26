import { describe, expect, it, vi } from 'vitest';
import type { TripCreateRequest, TripUpdateRequest } from '@roadtrip/types';
import { tripRouter } from './trip-router.js';

const buildPrisma = () => ({
  trip: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
});

const buildCaller = () => {
  const prisma = buildPrisma();
  const caller = tripRouter.createCaller({ prisma: prisma as never, userId: 'user-1' });
  return { prisma, caller };
};

describe('tripRouter', () => {
  it('returns placeholder suggestions', async () => {
    const caller = tripRouter.createCaller({ prisma: {} as never, userId: 'user-1' });
    const suggestions = await caller.suggestions({
      location: 'Austin, TX',
      radiusKm: 120,
      theme: 'foodie',
    });
    expect(suggestions[0].title).toContain('foodie');
  });

  it('lists trips per user', async () => {
    const { prisma, caller } = buildCaller();
    prisma.trip.findMany.mockResolvedValue([{ id: 'trip-a' }]);

    const result = await caller.list();

    expect(prisma.trip.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      include: { stops: { orderBy: { order: 'asc' } } },
    });
    expect(result).toEqual([{ id: 'trip-a' }]);
  });

  it('creates trips with normalized stops', async () => {
    const { prisma, caller } = buildCaller();
    prisma.trip.create.mockResolvedValue({ id: 'trip-new' });
    const input: TripCreateRequest = {
      name: 'Food Crawl',
      origin: { lat: 30.26, lng: -97.74 },
      filters: { radiusKm: 25, theme: 'foodie', maxStops: 5 },
      stops: [
        {
          id: '11111111-1111-1111-1111-111111111111',
          placeId: 'place-123',
          name: 'Taco Spot',
          order: 0,
          location: { lat: 30.27, lng: -97.73 },
        },
      ],
    };

    const result = await caller.create(input);

    expect(prisma.trip.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        name: 'Food Crawl',
        originLat: 30.26,
        originLng: -97.74,
        filters: input.filters,
        stops: {
          create: [
            {
              placeId: 'place-123',
              name: 'Taco Spot',
              lat: 30.27,
              lng: -97.73,
              order: 0,
              notes: undefined,
            },
          ],
        },
      },
      include: { stops: { orderBy: { order: 'asc' } } },
    });
    expect(result).toEqual({ id: 'trip-new' });
  });

  it('updates trips with provided fields', async () => {
    const { prisma, caller } = buildCaller();
    prisma.trip.update.mockResolvedValue({ id: 'trip-update' });
    const input: TripUpdateRequest = {
      id: '22222222-2222-2222-2222-222222222222',
      name: 'New Name',
      origin: { lat: 40, lng: -105 },
    };

    const result = await caller.update(input);

    expect(prisma.trip.update).toHaveBeenCalledWith({
      where: { id: '22222222-2222-2222-2222-222222222222', userId: 'user-1' },
      data: {
        name: 'New Name',
        originLat: 40,
        originLng: -105,
      },
      include: { stops: { orderBy: { order: 'asc' } } },
    });
    expect(result).toEqual({ id: 'trip-update' });
  });
});
