import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import type { TripCreateRequest, TripUpdateRequest } from '@roadtrip/types';
import { TripRepository } from './trip-repository.js';

const createPrismaMock = () => ({
  trip: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
});

describe('TripRepository', () => {
  let prismaMock: ReturnType<typeof createPrismaMock>;
  let repository: TripRepository;

  beforeEach(() => {
    prismaMock = createPrismaMock();
    repository = new TripRepository(prismaMock as unknown as PrismaClient);
  });

  it('lists trips scoped to the user', async () => {
    const expected = [{ id: 'trip-1' }];
    prismaMock.trip.findMany.mockResolvedValue(expected);

    const result = await repository.listByUser('user-42');

    expect(prismaMock.trip.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-42' },
      include: { stops: { orderBy: { order: 'asc' } } },
    });
    expect(result).toBe(expected);
  });

  it('creates trips with normalized stop payloads', async () => {
    const input: TripCreateRequest = {
      name: 'Weekend Getaway',
      origin: { lat: 1, lng: 2 },
      filters: { radiusKm: 50, theme: 'scenic', maxStops: 4 },
      stops: [
        {
          id: 'stop-1',
          placeId: 'place-1',
          name: 'Cliff View',
          order: 0,
          location: { lat: 3, lng: 4 },
          notes: 'sunset photos',
        },
      ],
    };

    await repository.create('user-42', input);

    expect(prismaMock.trip.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-42',
        name: 'Weekend Getaway',
        originLat: 1,
        originLng: 2,
        filters: input.filters,
        stops: {
          create: [
            {
              placeId: 'place-1',
              name: 'Cliff View',
              order: 0,
              lat: 3,
              lng: 4,
              notes: 'sunset photos',
            },
          ],
        },
      },
      include: { stops: { orderBy: { order: 'asc' } } },
    });
  });

  it('updates trips with partial payloads', async () => {
    const input: TripUpdateRequest = {
      id: 'trip-9',
      name: 'Renamed',
      origin: { lat: 9, lng: 10 },
    };

    await repository.update('user-42', input);

    expect(prismaMock.trip.update).toHaveBeenCalledWith({
      where: { id: 'trip-9', userId: 'user-42' },
      data: {
        name: 'Renamed',
        originLat: 9,
        originLng: 10,
      },
      include: { stops: { orderBy: { order: 'asc' } } },
    });
  });
});
