import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getUserPreferences } from './user-preferences.js';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    trip: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('./prisma.js', () => ({ prisma: mockPrisma }));

const makeTrip = (
  themes: string[] = [],
  stopCount = 0,
  radiusKm: number | null = null,
) => ({
  filters: { themes, ...(radiusKm !== null ? { radiusKm } : {}) },
  stops: Array.from({ length: stopCount }, (_, i) => ({ order: i })),
});

describe('getUserPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when user has fewer than 2 trips', async () => {
    mockPrisma.trip.findMany.mockResolvedValueOnce([makeTrip(['scenic'], 3, 100)]);
    const result = await getUserPreferences('user-1');
    expect(result).toBeNull();
  });

  it('returns null when user has 0 trips', async () => {
    mockPrisma.trip.findMany.mockResolvedValueOnce([]);
    const result = await getUserPreferences('user-1');
    expect(result).toBeNull();
  });

  it('returns preference string with themes, stops, and radius', async () => {
    mockPrisma.trip.findMany.mockResolvedValueOnce([
      makeTrip(['scenic', 'foodie'], 4, 120),
      makeTrip(['scenic', 'culture'], 2, 80),
    ]);

    const result = await getUserPreferences('user-1');
    expect(result).not.toBeNull();
    expect(result).toContain('scenic');
    expect(result).toContain('typically');
    expect(result).toContain('km radius');
  });

  it('includes top 3 themes by frequency', async () => {
    mockPrisma.trip.findMany.mockResolvedValueOnce([
      makeTrip(['scenic', 'foodie', 'culture'], 3, 100),
      makeTrip(['scenic', 'foodie', 'adventure'], 3, 100),
      makeTrip(['scenic', 'adventure', 'culture'], 3, 100),
    ]);

    const result = await getUserPreferences('user-1');
    expect(result).toContain('scenic');
    // scenic appears 3x (most frequent)
  });

  it('returns string with only stop count when no themes or radius', async () => {
    mockPrisma.trip.findMany.mockResolvedValueOnce([makeTrip([], 4), makeTrip([], 2)]);

    const result = await getUserPreferences('user-1');
    expect(result).not.toBeNull();
    expect(result).toContain('typically');
    expect(result).not.toContain('radius'); // no radiusKm
  });

  it('omits stop count when all trips have 0 stops', async () => {
    mockPrisma.trip.findMany.mockResolvedValueOnce([
      makeTrip(['scenic'], 0, 100),
      makeTrip(['foodie'], 0, 120),
    ]);

    const result = await getUserPreferences('user-1');
    expect(result).not.toBeNull();
    expect(result).not.toContain('stop');
  });

  it('omits radius when no trips have radiusKm', async () => {
    mockPrisma.trip.findMany.mockResolvedValueOnce([
      makeTrip(['scenic'], 3),
      makeTrip(['foodie'], 5),
    ]);

    const result = await getUserPreferences('user-1');
    expect(result).not.toContain('km radius');
  });

  it('returns null when trips have no themes, stops, or radius', async () => {
    mockPrisma.trip.findMany.mockResolvedValueOnce([makeTrip(), makeTrip()]);
    const result = await getUserPreferences('user-1');
    expect(result).toBeNull();
  });

  it('calculates average stop count correctly', async () => {
    mockPrisma.trip.findMany.mockResolvedValueOnce([
      makeTrip(['scenic'], 4, 100),
      makeTrip(['scenic'], 6, 100),
    ]);

    const result = await getUserPreferences('user-1');
    // avg 5 stops
    expect(result).toContain('5 stops');
  });

  it('calculates average radius correctly', async () => {
    mockPrisma.trip.findMany.mockResolvedValueOnce([
      makeTrip(['scenic'], 3, 100),
      makeTrip(['scenic'], 3, 200),
    ]);

    const result = await getUserPreferences('user-1');
    // avg 150km
    expect(result).toContain('~150km radius');
  });

  it('queries with userId and correct options', async () => {
    mockPrisma.trip.findMany.mockResolvedValueOnce([]);
    await getUserPreferences('user-abc');

    expect(mockPrisma.trip.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-abc' },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    );
  });

  it('handles exactly 2 trips (minimum threshold)', async () => {
    mockPrisma.trip.findMany.mockResolvedValueOnce([
      makeTrip(['scenic'], 3, 100),
      makeTrip(['scenic'], 3, 100),
    ]);

    const result = await getUserPreferences('user-1');
    expect(result).not.toBeNull();
  });

  it('returns singular "stop" for average of 1', async () => {
    mockPrisma.trip.findMany.mockResolvedValueOnce([
      makeTrip(['scenic'], 1, 100),
      makeTrip(['scenic'], 1, 100),
    ]);

    const result = await getUserPreferences('user-1');
    expect(result).toContain('typically 1 stop');
    expect(result).not.toContain('1 stops');
  });
});
