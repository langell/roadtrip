import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const { mockEnv } = vi.hoisted(() => {
  const mockEnv = {
    LOG_LEVEL: 'info',
    PORT: 0,
    ANON_SUGGESTIONS_RATE_LIMIT_WINDOW_MS: 60000,
    ANON_SUGGESTIONS_RATE_LIMIT_MAX: 2,
    ANON_PHOTO_RATE_LIMIT_WINDOW_MS: 60000,
    ANON_PHOTO_RATE_LIMIT_MAX: 10,
    TRIP_PLAN_CACHE_TTL_DAYS: 30,
    ADMIN_USER_IDS: undefined as string | undefined,
  };
  return { mockEnv };
});

vi.mock('./config/env.js', () => ({ env: mockEnv }));

vi.mock('./types/context.js', () => ({
  createContext: () => ({ prisma: {}, userId: undefined }),
}));

const prismaMock = {
  $queryRaw: vi.fn(),
  trip: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  tripPlanCache: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  sponsoredPlace: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
};
vi.mock('./lib/prisma.js', () => ({
  prisma: prismaMock,
}));

const findStops = vi.fn();
const resolvePlannedStops = vi.fn();
const geocodeLocation = vi.fn();
vi.mock('./services/google-places-service.js', () => ({
  GooglePlacesUpstreamError: class GooglePlacesUpstreamError extends Error {
    constructor(
      code: string,
      readonly options: { stage: string; details?: Record<string, unknown> },
    ) {
      super(code);
      this.name = 'GooglePlacesUpstreamError';
    }

    get stage() {
      return this.options.stage;
    }

    get details() {
      return this.options.details ?? {};
    }
  },
  googlePlacesService: {
    findStops,
    resolvePlannedStops,
    geocodeLocation,
  },
}));

const generatePlans = vi.fn();
const generatePlansStream = vi.fn();
const refinePlan = vi.fn();
vi.mock('./services/ai-trip-planner-service.js', () => ({
  AiTripPlannerError: class AiTripPlannerError extends Error {
    constructor(
      code: string,
      readonly stage: string,
      readonly details: Record<string, unknown> = {},
    ) {
      super(code);
      this.name = 'AiTripPlannerError';
    }
  },
  aiTripPlannerService: {
    generatePlans,
    generatePlansStream,
    refinePlan,
  },
}));

const generateDescriptions = vi.fn();
vi.mock('./services/ai-stop-description-service.js', () => ({
  AiStopDescriptionError: class AiStopDescriptionError extends Error {
    constructor(
      code: string,
      readonly stage: string,
    ) {
      super(code);
      this.name = 'AiStopDescriptionError';
    }
  },
  aiStopDescriptionService: {
    generateDescriptions,
  },
}));

const { createApp, startServer, registerSignalHandlers } = await import('./server.js');

describe('HTTP server', () => {
  beforeEach(() => {
    // Ensure test-mode auth bypass (bare bearer strings) by removing secrets
    // that may have been loaded from .env via dotenv/config in server.ts.
    delete process.env.AUTH_SECRET;
    delete process.env.NEXTAUTH_SECRET;

    findStops.mockReset();
    resolvePlannedStops.mockReset();
    geocodeLocation.mockReset();
    mockEnv.ADMIN_USER_IDS = undefined;
    prismaMock.user.findUnique.mockReset();
    generatePlans.mockReset();
    generatePlansStream.mockReset();
    refinePlan.mockReset();
    generateDescriptions.mockReset();
    prismaMock.trip.findMany.mockReset();
    prismaMock.trip.findFirst.mockReset();
    prismaMock.trip.findUnique.mockReset();
    prismaMock.trip.create.mockReset();
    prismaMock.trip.update.mockReset();
    prismaMock.tripPlanCache.findMany.mockReset();
    prismaMock.tripPlanCache.findUnique.mockReset();
    prismaMock.tripPlanCache.create.mockReset();
    prismaMock.tripPlanCache.update.mockReset();
    prismaMock.$queryRaw.mockReset();
    prismaMock.sponsoredPlace.findMany.mockReset();
    prismaMock.sponsoredPlace.findUnique.mockReset();
    prismaMock.sponsoredPlace.create.mockReset();
    prismaMock.sponsoredPlace.update.mockReset();
    prismaMock.sponsoredPlace.delete.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes a health endpoint', async () => {
    const app = createApp();

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('starts listening and registers shutdown handlers', async () => {
    const onceSpy = vi.spyOn(process, 'once').mockImplementation(() => process);

    const server = startServer();
    await new Promise((resolve) => server.once('listening', resolve));
    server.close();

    expect(onceSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    expect(onceSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
  });

  it('registers handlers that close the server', () => {
    const close = vi.fn();
    const server = {
      close,
    } as unknown as Parameters<typeof registerSignalHandlers>[0];
    const handlers: Array<() => void> = [];
    vi.spyOn(process, 'once').mockImplementation((event, handler: () => void) => {
      void event;
      handlers.push(handler);
      return process;
    });

    registerSignalHandlers(server);

    expect(close).not.toHaveBeenCalled();
    handlers.forEach((handler) => handler());
    expect(close).toHaveBeenCalledTimes(2);
  });

  it('returns suggestions for authenticated requests', async () => {
    findStops.mockResolvedValue([{ id: 'stop-1' }]);
    const app = createApp();

    const response = await request(app)
      .get('/suggestions')
      .set('authorization', 'Bearer user-1')
      .query({ location: 'Portland, OR', theme: 'scenic', radiusKm: '150' });

    expect(findStops).toHaveBeenCalledWith({
      location: 'Portland, OR',
      themes: ['scenic'],
      radiusKm: 150,
    });
    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ id: 'stop-1' }]);
  });

  it('adds imageUrl when suggestion has a Places photo name', async () => {
    findStops.mockResolvedValue([
      {
        id: 'stop-1',
        placeId: 'place-1',
        title: 'Overlook',
        description: 'Scenic point',
        distanceKm: 10,
        lat: 30,
        lng: -97,
        photoName: 'places/place-1/photos/photo-1',
      },
    ]);
    const app = createApp();

    const response = await request(app)
      .get('/suggestions')
      .query({ location: 'Portland, OR', theme: 'scenic', radiusKm: '150' });

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({
      id: 'stop-1',
      imageUrl: expect.stringContaining(
        '/places/photo?name=places%2Fplace-1%2Fphotos%2Fphoto-1',
      ),
    });
  });

  it('allows unauthenticated suggestions requests within rate limits', async () => {
    findStops.mockResolvedValue([{ id: 'stop-1' }]);
    const app = createApp();

    const response = await request(app)
      .get('/suggestions')
      .query({ location: 'Portland, OR', theme: 'scenic', radiusKm: '150' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ id: 'stop-1' }]);
  });

  it('rate limits unauthenticated suggestions requests by ip', async () => {
    findStops.mockResolvedValue([{ id: 'stop-1' }]);
    const app = createApp();

    await request(app)
      .get('/suggestions')
      .set('x-forwarded-for', '1.2.3.4')
      .query({ location: 'Portland, OR', theme: 'scenic', radiusKm: '150' });
    await request(app)
      .get('/suggestions')
      .set('x-forwarded-for', '1.2.3.4')
      .query({ location: 'Portland, OR', theme: 'scenic', radiusKm: '150' });

    const response = await request(app)
      .get('/suggestions')
      .set('x-forwarded-for', '1.2.3.4')
      .query({ location: 'Portland, OR', theme: 'scenic', radiusKm: '150' });

    expect(response.status).toBe(429);
    expect(response.body).toEqual({ error: 'RATE_LIMITED' });
  });

  it('rejects invalid suggestions query params', async () => {
    const app = createApp();

    const response = await request(app)
      .get('/suggestions')
      .set('x-user-id', 'user-1')
      .query({ location: 'Portland, OR', theme: 'scenic', radiusKm: 'invalid' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'INVALID_QUERY' });
  });

  it('accepts repeated theme query params', async () => {
    findStops.mockResolvedValue([{ id: 'stop-1' }]);
    const app = createApp();

    const response = await request(app)
      .get('/suggestions')
      .query({ location: 'Portland, OR', radiusKm: '150', theme: ['scenic', 'foodie'] });

    expect(findStops).toHaveBeenCalledWith({
      location: 'Portland, OR',
      themes: ['scenic', 'foodie'],
      radiusKm: 150,
    });
    expect(response.status).toBe(200);
  });

  it('rejects invalid photo proxy params', async () => {
    const app = createApp();

    const response = await request(app).get('/places/photo').query({ name: 'invalid' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'INVALID_PHOTO_NAME' });
  });

  it('includes diagnostics for upstream suggestion failures in non-production', async () => {
    findStops.mockRejectedValue(new Error('GOOGLE_PLACES_FAILED'));
    const app = createApp();

    const response = await request(app)
      .get('/suggestions')
      .query({ location: 'Portland, OR', theme: 'scenic', radiusKm: '150' });

    expect(response.status).toBe(502);
    expect(response.body).toEqual({
      error: 'UPSTREAM_PLACES_ERROR',
      diagnosticCode: 'UNKNOWN_PLACES_ERROR',
      diagnosticStage: 'unknown',
    });
  });

  it('returns 401 for unauthenticated GET /trips', async () => {
    const app = createApp();
    const response = await request(app).get('/trips');
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'UNAUTHORIZED' });
    expect(prismaMock.trip.findMany).not.toHaveBeenCalled();
  });

  it('returns 401 for unauthenticated POST /trips/save-generated', async () => {
    const app = createApp();
    const response = await request(app)
      .post('/trips/save-generated')
      .send({ location: 'Austin, TX', radiusKm: 120, theme: 'scenic' });
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'UNAUTHORIZED' });
    expect(prismaMock.trip.create).not.toHaveBeenCalled();
  });

  it('lists saved trips for authenticated users', async () => {
    prismaMock.trip.findMany.mockResolvedValue([{ id: 'trip-1' }]);
    const app = createApp();

    const response = await request(app)
      .get('/trips')
      .set('authorization', 'Bearer user-1');

    expect(prismaMock.trip.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      include: { stops: { orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ id: 'trip-1' }]);
  });

  it('saves generated trips from suggestions', async () => {
    findStops.mockResolvedValue([
      {
        id: 'stop-1',
        placeId: 'place-1',
        title: 'scenic waypoint 1',
        description: 'desc 1',
        distanceKm: 10,
        lat: 30,
        lng: -97,
      },
      {
        id: 'stop-2',
        placeId: 'place-2',
        title: 'scenic waypoint 2',
        description: 'desc 2',
        distanceKm: 18,
        lat: 30.1,
        lng: -97.1,
      },
    ]);
    prismaMock.trip.create.mockResolvedValue({ id: 'trip-new' });
    const app = createApp();

    const response = await request(app)
      .post('/trips/save-generated')
      .set('authorization', 'Bearer user-1')
      .send({ location: 'Austin, TX', radiusKm: 120, theme: 'scenic' });

    expect(response.status).toBe(201);
    expect(prismaMock.trip.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        name: 'scenic trip from Austin, TX',
        originLat: 30,
        originLng: -97,
        filters: {
          radiusKm: 120,
          theme: 'scenic',
          maxStops: 2,
        },
        stops: {
          create: [
            {
              placeId: 'place-1',
              name: 'scenic waypoint 1',
              order: 0,
              lat: 30,
              lng: -97,
              notes: 'desc 1',
            },
            {
              placeId: 'place-2',
              name: 'scenic waypoint 2',
              order: 1,
              lat: 30.1,
              lng: -97.1,
              notes: 'desc 2',
            },
          ],
        },
      },
      include: { stops: { orderBy: { order: 'asc' } } },
    });
    expect(response.body).toEqual({ id: 'trip-new' });
  });

  it('returns AI trip plan options with enriched stops', async () => {
    geocodeLocation.mockResolvedValue({ lat: 36.5552, lng: -121.9233 });
    prismaMock.tripPlanCache.findMany.mockResolvedValue([]);
    generatePlans.mockResolvedValue({
      options: [
        {
          title: 'Coastal Highlights',
          rationale: 'Great ocean views and local culture.',
          stops: [
            { name: 'Bixby Bridge', stopType: 'attraction' },
            { name: 'Monterey Bay Aquarium', stopType: 'attraction' },
          ],
        },
        {
          title: 'Scenic Food Loop',
          rationale: 'Mix of food and viewpoints.',
          stops: [
            { name: 'Carmel Mission', stopType: 'attraction' },
            { name: 'Point Lobos', stopType: 'attraction' },
          ],
        },
      ],
    });

    resolvePlannedStops
      .mockResolvedValueOnce([
        {
          query: 'Bixby Bridge',
          suggestion: {
            id: 'stop-a',
            placeId: 'place-a',
            title: 'Bixby Bridge',
            description: 'Big Sur, CA',
            distanceKm: 12,
            lat: 36.3715,
            lng: -121.9013,
            photoName: 'places/place-a/photos/photo-a',
          },
        },
        { query: 'Monterey Bay Aquarium', errorCode: 'NOT_FOUND' },
      ])
      .mockResolvedValueOnce([
        {
          query: 'Carmel Mission',
          suggestion: {
            id: 'stop-b',
            placeId: 'place-b',
            title: 'Carmel Mission',
            description: 'Carmel, CA',
            distanceKm: 5,
            lat: 36.5397,
            lng: -121.9249,
          },
        },
        {
          query: 'Point Lobos',
          suggestion: {
            id: 'stop-c',
            placeId: 'place-c',
            title: 'Point Lobos State Natural Reserve',
            description: 'Carmel, CA',
            distanceKm: 4,
            lat: 36.5152,
            lng: -121.9433,
          },
        },
      ]);

    const app = createApp();
    const response = await request(app)
      .post('/trips/plan')
      .send({
        location: 'Carmel By The Sea, CA',
        radiusKm: 120,
        themes: ['scenic', 'culture'],
        maxOptions: 2,
      });

    expect(generatePlans).toHaveBeenCalledWith({
      location: 'Carmel By The Sea, CA',
      radiusKm: 120,
      themes: ['scenic', 'culture'],
      maxOptions: 2,
    });
    expect(response.body.source).toBe('ai');
    expect(response.status).toBe(200);
    expect(response.body.options).toHaveLength(2);
    expect(response.body.options[0].stops[0]).toMatchObject({
      query: 'Bixby Bridge',
      status: 'resolved',
      suggestion: {
        title: 'Bixby Bridge',
      },
    });
    expect(response.body.options[0].stops[1]).toMatchObject({
      query: 'Monterey Bay Aquarium',
      status: 'unresolved',
      errorCode: 'NOT_FOUND',
    });
    expect(prismaMock.tripPlanCache.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        validOptions: 1,
      }),
    });
  });

  it('returns cached trip plan when nearby match exists and tracks engagement', async () => {
    geocodeLocation.mockResolvedValue({ lat: 36.5552, lng: -121.9233 });
    prismaMock.tripPlanCache.findMany.mockResolvedValue([
      {
        id: 'cache-1',
        centerLat: 36.56,
        centerLng: -121.92,
        radiusKm: 120,
        themesKey: 'culture|scenic',
        maxOptions: 2,
        options: [
          {
            title: 'Cached Coastal Highlights',
            rationale: 'Previously generated.',
            stops: [
              {
                query: 'Bixby Bridge',
                status: 'resolved',
                suggestion: {
                  id: 'stop-a',
                  placeId: 'place-a',
                  title: 'Bixby Bridge',
                  description: 'Big Sur, CA',
                  distanceKm: 12,
                  lat: 36.3715,
                  lng: -121.9013,
                },
              },
            ],
          },
        ],
        validOptions: 1,
        engagementScore: 7,
        updatedAt: new Date('2026-03-27T00:00:00.000Z'),
        expiresAt: new Date('2026-04-10T00:00:00.000Z'),
      },
    ]);

    const app = createApp();
    const response = await request(app)
      .post('/trips/plan')
      .send({
        location: 'Carmel By The Sea, CA',
        radiusKm: 120,
        themes: ['scenic', 'culture'],
        maxOptions: 2,
      });

    expect(response.status).toBe(200);
    expect(response.body.source).toBe('cache');
    expect(response.body.options).toHaveLength(1);
    expect(generatePlans).not.toHaveBeenCalled();
    expect(prismaMock.tripPlanCache.update).toHaveBeenCalledWith({
      where: { id: 'cache-1' },
      data: {
        engagementScore: { increment: 1 },
        lastServedAt: expect.any(Date),
      },
    });
  });

  it('saves only fully resolved options into cache when AI generation succeeds', async () => {
    geocodeLocation.mockResolvedValue({ lat: 36.5552, lng: -121.9233 });
    prismaMock.tripPlanCache.findMany.mockResolvedValue([]);
    generatePlans.mockResolvedValue({
      options: [
        {
          title: 'Valid Route',
          rationale: 'All resolved.',
          stops: [
            { name: 'Stop One', stopType: 'attraction' },
            { name: 'Stop Two', stopType: 'attraction' },
          ],
        },
        {
          title: 'Partial Route',
          rationale: 'One unresolved stop.',
          stops: [{ name: 'Stop Three', stopType: null }],
        },
      ],
    });

    resolvePlannedStops
      .mockResolvedValueOnce([
        {
          query: 'Stop One',
          suggestion: {
            id: 'stop-1',
            placeId: 'place-1',
            title: 'Stop One',
            description: 'Desc 1',
            distanceKm: 10,
            lat: 1,
            lng: 1,
          },
        },
        {
          query: 'Stop Two',
          suggestion: {
            id: 'stop-2',
            placeId: 'place-2',
            title: 'Stop Two',
            description: 'Desc 2',
            distanceKm: 11,
            lat: 2,
            lng: 2,
          },
        },
      ])
      .mockResolvedValueOnce([{ query: 'Stop Three', errorCode: 'NOT_FOUND' }]);

    const app = createApp();
    const response = await request(app)
      .post('/trips/plan')
      .send({
        location: 'Carmel By The Sea, CA',
        radiusKm: 120,
        themes: ['scenic', 'culture'],
        maxOptions: 2,
      });

    expect(response.status).toBe(200);
    expect(response.body.source).toBe('ai');
    expect(prismaMock.tripPlanCache.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.tripPlanCache.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        location: 'Carmel By The Sea, CA',
        locationKey: 'carmel by the sea',
        radiusKm: 120,
        themesKey: 'culture|scenic',
        maxOptions: 2,
        validOptions: 1,
        engagementScore: 1,
        expiresAt: expect.any(Date),
      }),
    });
  });

  it('treats cache entries beyond 10 miles as misses', async () => {
    geocodeLocation.mockResolvedValue({ lat: 36.5552, lng: -121.9233 });
    prismaMock.tripPlanCache.findMany.mockResolvedValue([
      {
        id: 'cache-far',
        centerLat: 36.81,
        centerLng: -121.9233,
        radiusKm: 120,
        themesKey: 'culture|scenic',
        maxOptions: 2,
        options: [
          {
            title: 'Far cache entry',
            rationale: 'Should not be used.',
            stops: [
              {
                query: 'Far Stop',
                status: 'resolved',
                suggestion: {
                  id: 'far-1',
                  placeId: 'far-1',
                  title: 'Far Stop',
                  description: 'Far away',
                  distanceKm: 40,
                  lat: 36.81,
                  lng: -121.9233,
                },
              },
            ],
          },
        ],
        validOptions: 1,
        engagementScore: 100,
        updatedAt: new Date('2026-03-27T00:00:00.000Z'),
        expiresAt: new Date('2026-04-10T00:00:00.000Z'),
      },
    ]);

    generatePlans.mockResolvedValue({
      options: [
        {
          title: 'Fresh generation',
          rationale: 'Used when far cache misses.',
          stops: [{ name: 'Nearby Stop', stopType: 'attraction' }],
        },
      ],
    });

    resolvePlannedStops.mockResolvedValue([
      {
        query: 'Nearby Stop',
        suggestion: {
          id: 'near-1',
          placeId: 'near-1',
          title: 'Nearby Stop',
          description: 'Nearby',
          distanceKm: 5,
          lat: 36.56,
          lng: -121.92,
        },
      },
    ]);

    const app = createApp();
    const response = await request(app)
      .post('/trips/plan')
      .send({
        location: 'Carmel By The Sea, CA',
        radiusKm: 120,
        themes: ['scenic', 'culture'],
        maxOptions: 2,
      });

    expect(response.status).toBe(200);
    expect(response.body.source).toBe('ai');
    expect(generatePlans).toHaveBeenCalledTimes(1);
    expect(prismaMock.tripPlanCache.update).not.toHaveBeenCalled();
  });

  it('serves cache hit when stored radiusKm is within ±25% of requested radius', async () => {
    geocodeLocation.mockResolvedValue({ lat: 36.5552, lng: -121.9233 });
    prismaMock.tripPlanCache.findMany.mockResolvedValue([
      {
        id: 'cache-radius',
        centerLat: 36.56,
        centerLng: -121.92,
        radiusKm: 100, // stored radius — 100 is within ±25% of requested 120 (range: 90–150)
        themesKey: 'culture|scenic',
        maxOptions: 2,
        options: [
          {
            title: 'Radius Fuzzy Hit',
            rationale: 'Should be served despite different radius.',
            stops: [
              {
                query: 'Point Lobos',
                status: 'resolved',
                suggestion: {
                  id: 'stop-pl',
                  placeId: 'place-pl',
                  title: 'Point Lobos',
                  description: 'Carmel, CA',
                  distanceKm: 5,
                  lat: 36.52,
                  lng: -121.94,
                },
              },
            ],
          },
        ],
        validOptions: 1,
        engagementScore: 3,
        updatedAt: new Date('2026-03-27T00:00:00.000Z'),
        expiresAt: new Date('2026-04-10T00:00:00.000Z'),
      },
    ]);

    const app = createApp();
    const response = await request(app)
      .post('/trips/plan')
      .send({
        location: 'Carmel By The Sea, CA',
        radiusKm: 120,
        themes: ['scenic', 'culture'],
        maxOptions: 2,
      });

    expect(response.status).toBe(200);
    expect(response.body.source).toBe('cache');
    expect(generatePlans).not.toHaveBeenCalled();
  });

  it('queries cache with radius range (±25%) rather than exact match', async () => {
    geocodeLocation.mockResolvedValue({ lat: 36.5552, lng: -121.9233 });
    prismaMock.tripPlanCache.findMany.mockResolvedValue([]);
    generatePlans.mockResolvedValue({ options: [] });

    const app = createApp();
    await request(app)
      .post('/trips/plan')
      .send({
        location: 'Carmel By The Sea, CA',
        radiusKm: 120,
        themes: ['scenic', 'culture'],
        maxOptions: 2,
      });

    expect(prismaMock.tripPlanCache.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          radiusKm: { gte: 90, lte: 150 },
        }),
      }),
    );
  });

  describe('SSE streaming (Accept: text/event-stream)', () => {
    function parseSseEvents(text: string): Array<{ event: string; data: unknown }> {
      return text
        .split('\n\n')
        .filter((block) => block.trim())
        .map((block) => {
          const lines = block.split('\n');
          let event = '';
          let data = '';
          for (const line of lines) {
            if (line.startsWith('event: ')) event = line.slice(7).trim();
            else if (line.startsWith('data: ')) data = line.slice(6).trim();
          }
          return { event, data: data ? (JSON.parse(data) as unknown) : null };
        })
        .filter((e) => e.event);
    }

    it('streams cache hit as SSE header + option + done events', async () => {
      geocodeLocation.mockResolvedValue({ lat: 36.5552, lng: -121.9233 });
      prismaMock.tripPlanCache.findMany.mockResolvedValue([
        {
          id: 'cache-sse',
          centerLat: 36.56,
          centerLng: -121.92,
          radiusKm: 120,
          themesKey: 'culture|scenic',
          maxOptions: 2,
          options: [
            {
              title: 'Streamed Cache Hit',
              rationale: 'From cache via SSE.',
              stops: [
                {
                  query: 'Bixby Bridge',
                  status: 'resolved',
                  suggestion: {
                    id: 'stop-a',
                    placeId: 'place-a',
                    title: 'Bixby Bridge',
                    description: 'Big Sur, CA',
                    distanceKm: 12,
                    lat: 36.3715,
                    lng: -121.9013,
                  },
                },
              ],
            },
          ],
          validOptions: 1,
          engagementScore: 5,
          updatedAt: new Date('2026-03-27T00:00:00.000Z'),
          expiresAt: new Date('2026-04-10T00:00:00.000Z'),
        },
      ]);

      const app = createApp();
      const response = await request(app)
        .post('/trips/plan')
        .set('Accept', 'text/event-stream')
        .send({
          location: 'Carmel By The Sea, CA',
          radiusKm: 120,
          themes: ['scenic', 'culture'],
          maxOptions: 2,
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/event-stream');

      const events = parseSseEvents(response.text);
      expect(events[0]).toMatchObject({ event: 'header', data: { source: 'cache' } });
      expect(events[1]).toMatchObject({
        event: 'option',
        data: { title: 'Streamed Cache Hit' },
      });
      expect(events[2]).toMatchObject({ event: 'done', data: { degraded: false } });
      expect(generatePlans).not.toHaveBeenCalled();
    });

    it('streams AI generation as SSE header + options + done events', async () => {
      geocodeLocation.mockResolvedValue({ lat: 36.5552, lng: -121.9233 });
      prismaMock.tripPlanCache.findMany.mockResolvedValue([]);
      generatePlansStream.mockImplementation(async function* () {
        yield {
          title: 'SSE Route A',
          rationale: 'First streamed option.',
          stops: [{ name: 'Stop One', stopType: 'attraction' }],
        };
        yield {
          title: 'SSE Route B',
          rationale: 'Second streamed option.',
          stops: [{ name: 'Stop Two', stopType: 'attraction' }],
        };
      });
      resolvePlannedStops
        .mockResolvedValueOnce([
          {
            query: 'Stop One',
            suggestion: {
              id: 's1',
              placeId: 'p1',
              title: 'Stop One',
              description: 'Desc',
              distanceKm: 5,
              lat: 1,
              lng: 1,
            },
          },
        ])
        .mockResolvedValueOnce([
          {
            query: 'Stop Two',
            suggestion: {
              id: 's2',
              placeId: 'p2',
              title: 'Stop Two',
              description: 'Desc',
              distanceKm: 6,
              lat: 2,
              lng: 2,
            },
          },
        ]);

      const app = createApp();
      const response = await request(app)
        .post('/trips/plan')
        .set('Accept', 'text/event-stream')
        .send({
          location: 'Carmel By The Sea, CA',
          radiusKm: 120,
          themes: ['scenic', 'culture'],
          maxOptions: 2,
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/event-stream');

      const events = parseSseEvents(response.text);
      const types = events.map((e) => e.event);
      expect(types[0]).toBe('header');
      expect(types.filter((t) => t === 'option')).toHaveLength(2);
      expect(types.at(-1)).toBe('done');
      expect((events[0].data as Record<string, unknown>).source).toBe('ai');
    });

    it('streams error event when AI generation fails', async () => {
      geocodeLocation.mockResolvedValue({ lat: 36.5552, lng: -121.9233 });
      prismaMock.tripPlanCache.findMany.mockResolvedValue([]);
      generatePlansStream.mockImplementation(async function* () {
        yield* []; // satisfy require-yield; throws before yielding anything
        throw new Error('AI unavailable');
      });

      const app = createApp();
      const response = await request(app)
        .post('/trips/plan')
        .set('Accept', 'text/event-stream')
        .send({
          location: 'Carmel By The Sea, CA',
          radiusKm: 120,
          themes: ['scenic', 'culture'],
          maxOptions: 2,
        });

      expect(response.status).toBe(200);
      const events = parseSseEvents(response.text);
      expect(events.some((e) => e.event === 'error')).toBe(true);
    });
  });

  it('rejects invalid trip plan payloads', async () => {
    const app = createApp();
    const response = await request(app).post('/trips/plan').send({
      location: 'Carmel By The Sea, CA',
      radiusKm: 120,
      themes: [],
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'INVALID_BODY' });
  });

  it('uses authorization header over x-user-id fallback', async () => {
    prismaMock.trip.findMany.mockResolvedValue([{ id: 'trip-1' }]);
    const app = createApp();

    await request(app)
      .get('/trips')
      .set('authorization', 'Bearer bearer-user')
      .set('x-user-id', 'legacy-user');

    expect(prismaMock.trip.findMany).toHaveBeenCalledWith({
      where: { userId: 'bearer-user' },
      include: { stops: { orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  });

  describe('GET /discover', () => {
    const mockCacheWithStops = [
      {
        id: 'cache-1',
        location: 'Portland, OR',
        radiusKm: 100,
        themesKey: 'scenic|adventure',
        engagementScore: 42,
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
        options: [
          {
            title: 'Pacific Loop',
            stops: [
              {
                status: 'resolved',
                suggestion: {
                  id: 'stop-1',
                  placeId: 'place-abc',
                  title: 'Crater Lake',
                  description: 'Beautiful volcanic lake',
                  distanceKm: 50,
                  lat: 42.9,
                  lng: -122.1,
                  imageUrl: 'http://api/places/photo?name=abc',
                },
              },
            ],
          },
        ],
      },
    ];

    it('returns trending routes, popular stops, and sponsored stops', async () => {
      prismaMock.tripPlanCache.findMany.mockResolvedValue(mockCacheWithStops);
      prismaMock.sponsoredPlace.findMany.mockResolvedValue([
        {
          id: 'sp-1',
          placeId: 'place-123',
          title: 'Crater Lake Lodge',
          description: 'Iconic volcanic caldera lodge',
          imageUrl: 'https://example.com/crater.jpg',
          url: 'https://craterlake.com',
        },
      ]);

      const app = createApp();
      const response = await request(app).get('/discover');

      expect(response.status).toBe(200);
      expect(response.body.trendingRoutes).toHaveLength(1);
      expect(response.body.trendingRoutes[0]).toMatchObject({
        cacheId: 'cache-1',
        location: 'Portland, OR',
        themes: ['scenic', 'adventure'],
        previewTitle: 'Pacific Loop',
        previewImageUrl: expect.stringContaining('/places/photo?name=abc'),
      });
      expect(response.body.nearbyStops).toHaveLength(1);
      expect(response.body.nearbyStops[0]).toMatchObject({
        id: 'stop-1',
        title: 'Crater Lake',
        sponsored: false,
      });
      expect(response.body.sponsoredStops).toHaveLength(1);
      expect(response.body.sponsoredStops[0]).toMatchObject({
        id: 'sp-1',
        title: 'Crater Lake Lodge',
        sponsored: true,
      });
      expect(response.body.locationContext).toBeUndefined();
    });

    it('ranks stops by weighted engagement score across cache entries', async () => {
      prismaMock.tripPlanCache.findMany.mockResolvedValue([
        {
          ...mockCacheWithStops[0],
          engagementScore: 10,
          options: [
            {
              stops: [
                {
                  status: 'resolved',
                  suggestion: {
                    id: 'a',
                    placeId: 'place-A',
                    title: 'Stop A',
                    description: '',
                    distanceKm: 1,
                    lat: 0,
                    lng: 0,
                  },
                },
                {
                  status: 'resolved',
                  suggestion: {
                    id: 'b',
                    placeId: 'place-B',
                    title: 'Stop B',
                    description: '',
                    distanceKm: 1,
                    lat: 0,
                    lng: 0,
                  },
                },
              ],
            },
          ],
        },
        {
          ...mockCacheWithStops[0],
          id: 'cache-2',
          engagementScore: 100,
          options: [
            {
              stops: [
                {
                  status: 'resolved',
                  suggestion: {
                    id: 'b2',
                    placeId: 'place-B',
                    title: 'Stop B',
                    description: '',
                    distanceKm: 1,
                    lat: 0,
                    lng: 0,
                  },
                },
              ],
            },
          ],
        },
      ]);
      prismaMock.sponsoredPlace.findMany.mockResolvedValue([]);

      const app = createApp();
      const response = await request(app).get('/discover');

      expect(response.status).toBe(200);
      // place-B appears in both entries (scores: 11 + 101 = 112), place-A only once (score: 11)
      expect(response.body.nearbyStops[0].placeId).toBe('place-B');
      expect(response.body.nearbyStops[1].placeId).toBe('place-A');
    });

    it('returns empty nearbyStops when cache is empty', async () => {
      prismaMock.tripPlanCache.findMany.mockResolvedValue([]);
      prismaMock.sponsoredPlace.findMany.mockResolvedValue([]);

      const app = createApp();
      const response = await request(app).get('/discover');

      expect(response.status).toBe(200);
      expect(response.body.nearbyStops).toEqual([]);
    });

    describe('GET /trips/:id', () => {
      const mockTrip = {
        id: 'trip-abc',
        userId: 'user-1',
        name: 'Oregon Coast',
        originLat: 45.52,
        originLng: -122.68,
        shareToken: null,
        filters: {
          location: 'Portland, OR',
          themes: ['scenic'],
          rationale: 'Coastal beauty',
        },
        stops: [
          {
            id: 's1',
            placeId: 'p1',
            name: 'Cannon Beach',
            order: 1,
            lat: 45.88,
            lng: -123.96,
            notes: null,
            imageUrl: null,
          },
          {
            id: 's2',
            placeId: 'p2',
            name: 'Haystack Rock',
            order: 2,
            lat: 45.89,
            lng: -123.97,
            notes: 'Great view',
            imageUrl: 'https://img.example.com/rock.jpg',
          },
        ],
      };

      it('returns trip with drive-time legs for authenticated owner', async () => {
        prismaMock.trip.findUnique.mockResolvedValue(mockTrip);
        const app = createApp();
        const response = await request(app)
          .get('/trips/trip-abc')
          .set('authorization', 'Bearer user-1');

        expect(response.status).toBe(200);
        expect(response.body.id).toBe('trip-abc');
        expect(response.body.location).toBe('Portland, OR');
        expect(response.body.stops).toHaveLength(2);
        expect(response.body.stops[0].driveTimeMin).toBeNull();
        expect(response.body.stops[1].driveTimeMin).toBeGreaterThan(0);
        expect(response.body.stops[1].imageUrl).toBe('https://img.example.com/rock.jpg');
      });

      it('returns 401 for unauthenticated GET /trips/:id', async () => {
        const app = createApp();
        const response = await request(app).get('/trips/trip-abc');
        expect(response.status).toBe(401);
        expect(prismaMock.trip.findUnique).not.toHaveBeenCalled();
      });

      it('returns 404 when trip does not belong to user', async () => {
        prismaMock.trip.findUnique.mockResolvedValue({
          ...mockTrip,
          userId: 'other-user',
        });
        const app = createApp();
        const response = await request(app)
          .get('/trips/trip-abc')
          .set('authorization', 'Bearer user-1');

        expect(response.status).toBe(404);
        expect(response.body).toEqual({ error: 'NOT_FOUND' });
      });

      it('returns 404 when trip does not exist', async () => {
        prismaMock.trip.findUnique.mockResolvedValue(null);
        const app = createApp();
        const response = await request(app)
          .get('/trips/trip-abc')
          .set('authorization', 'Bearer user-1');

        expect(response.status).toBe(404);
      });
    });

    describe('GET /trips/:id/sponsored-stop', () => {
      const mockTrip = {
        id: 'trip-abc',
        userId: 'user-1',
        name: 'Oregon Coast',
        originLat: 45.52,
        originLng: -122.68,
        filters: {},
        stops: [
          {
            id: 's1',
            placeId: 'p1',
            name: 'Cannon Beach',
            order: 1,
            lat: 45.88,
            lng: -123.96,
          },
        ],
      };

      it('returns the nearest active sponsored place via geo query', async () => {
        prismaMock.trip.findUnique.mockResolvedValue(mockTrip);
        prismaMock.$queryRaw.mockResolvedValue([
          {
            id: 'sp-1',
            placeId: 'place-x',
            title: 'Crater Lodge',
            description: 'Nice',
            imageUrl: null,
            url: 'https://lodge.example.com',
            lat: 45.88,
            lng: -123.96,
          },
        ]);

        const app = createApp();
        const response = await request(app)
          .get('/trips/trip-abc/sponsored-stop')
          .set('authorization', 'Bearer user-1');

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          id: 'sp-1',
          title: 'Crater Lodge',
          placeId: 'place-x',
        });
        expect(prismaMock.$queryRaw).toHaveBeenCalled();
      });

      it('returns null when no sponsored places are active', async () => {
        prismaMock.trip.findUnique.mockResolvedValue(mockTrip);
        prismaMock.$queryRaw.mockResolvedValue([]);

        const app = createApp();
        const response = await request(app)
          .get('/trips/trip-abc/sponsored-stop')
          .set('authorization', 'Bearer user-1');

        expect(response.status).toBe(200);
        expect(response.body).toBeNull();
      });

      it('returns 401 for unauthenticated request', async () => {
        const app = createApp();
        const response = await request(app).get('/trips/trip-abc/sponsored-stop');
        expect(response.status).toBe(401);
      });

      it('returns 404 when trip does not belong to user', async () => {
        prismaMock.trip.findUnique.mockResolvedValue({
          ...mockTrip,
          userId: 'other-user',
        });
        const app = createApp();
        const response = await request(app)
          .get('/trips/trip-abc/sponsored-stop')
          .set('authorization', 'Bearer user-1');

        expect(response.status).toBe(404);
      });

      it('returns the closest sponsor (DB-ordered by ST_Distance)', async () => {
        // PostGIS returns rows already sorted by distance — nearest first.
        prismaMock.trip.findUnique.mockResolvedValue(mockTrip);
        prismaMock.$queryRaw.mockResolvedValue([
          // nearest (Oregon coast ~2 km from stop)
          {
            id: 'sp-near',
            placeId: 'place-or',
            title: 'Seaside Inn',
            description: 'Right on the Oregon coast',
            imageUrl: null,
            url: null,
            lat: 45.99,
            lng: -123.93,
          },
          // farther (Florida)
          {
            id: 'sp-far',
            placeId: 'place-fl',
            title: 'Florida Resort',
            description: 'Sun and sand',
            imageUrl: null,
            url: null,
            lat: 27.9,
            lng: -82.5,
          },
        ]);

        const app = createApp();
        const response = await request(app)
          .get('/trips/trip-abc/sponsored-stop')
          .set('authorization', 'Bearer user-1');

        expect(response.status).toBe(200);
        expect(response.body.id).toBe('sp-near');
      });

      it('skips a sponsor whose placeId is already a trip stop and returns the next', async () => {
        // mockTrip has stop with placeId 'p1'
        prismaMock.trip.findUnique.mockResolvedValue(mockTrip);
        prismaMock.$queryRaw.mockResolvedValue([
          // nearest — but already in trip
          {
            id: 'sp-in-trip',
            placeId: 'p1',
            title: 'Cannon Beach Lodge',
            description: 'Already a stop',
            imageUrl: null,
            url: null,
            lat: 45.88,
            lng: -123.96,
          },
          // second nearest — not in trip
          {
            id: 'sp-other',
            placeId: 'place-other',
            title: 'Astoria Inn',
            description: 'Good alternative',
            imageUrl: null,
            url: null,
            lat: 46.18,
            lng: -123.83,
          },
        ]);

        const app = createApp();
        const response = await request(app)
          .get('/trips/trip-abc/sponsored-stop')
          .set('authorization', 'Bearer user-1');

        expect(response.status).toBe(200);
        expect(response.body.id).toBe('sp-other');
      });

      it('falls back to a sponsor without lat/lng when it is the only result', async () => {
        prismaMock.trip.findUnique.mockResolvedValue(mockTrip);
        prismaMock.$queryRaw.mockResolvedValue([
          {
            id: 'sp-untagged',
            placeId: 'place-u',
            title: 'Generic Sponsor',
            description: 'No location set',
            imageUrl: null,
            url: null,
            lat: null,
            lng: null,
          },
        ]);

        const app = createApp();
        const response = await request(app)
          .get('/trips/trip-abc/sponsored-stop')
          .set('authorization', 'Bearer user-1');

        expect(response.status).toBe(200);
        expect(response.body.id).toBe('sp-untagged');
      });
    });

    describe('GET /sponsored-stop/nearby', () => {
      it('returns the nearest sponsored place within radius', async () => {
        prismaMock.$queryRaw.mockResolvedValue([
          {
            id: 'sp-close',
            placeId: 'place-close',
            title: 'Nearby Lodge',
            description: 'Close by',
            imageUrl: null,
            url: null,
            lat: 45.52,
            lng: -122.68,
          },
        ]);

        const app = createApp();
        const response = await request(app)
          .get('/sponsored-stop/nearby?lat=45.52&lng=-122.68')
          .set('authorization', 'Bearer user-1');

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({ id: 'sp-close', title: 'Nearby Lodge' });
        expect(prismaMock.$queryRaw).toHaveBeenCalled();
      });

      it('returns null when no sponsors are within radius', async () => {
        prismaMock.$queryRaw.mockResolvedValue([]);

        const app = createApp();
        const response = await request(app)
          .get('/sponsored-stop/nearby?lat=45.52&lng=-122.68')
          .set('authorization', 'Bearer user-1');

        expect(response.status).toBe(200);
        expect(response.body).toBeNull();
      });

      it('returns the closer of two sponsors (nearest first from DB)', async () => {
        // DB returns rows already ordered by ST_Distance
        prismaMock.$queryRaw.mockResolvedValue([
          {
            id: 'sp-near',
            placeId: 'place-near',
            title: 'Close Spot',
            description: '10 km away',
            imageUrl: null,
            url: null,
            lat: 45.6,
            lng: -122.7,
          },
          {
            id: 'sp-far',
            placeId: 'place-far',
            title: 'Distant Spot',
            description: '150 km away',
            imageUrl: null,
            url: null,
            lat: 44.0,
            lng: -121.0,
          },
        ]);

        const app = createApp();
        const response = await request(app)
          .get('/sponsored-stop/nearby?lat=45.52&lng=-122.68')
          .set('authorization', 'Bearer user-1');

        expect(response.status).toBe(200);
        expect(response.body.id).toBe('sp-near');
      });

      it('returns 400 for missing coordinates', async () => {
        const app = createApp();
        const response = await request(app)
          .get('/sponsored-stop/nearby')
          .set('authorization', 'Bearer user-1');
        expect(response.status).toBe(400);
      });

      it('returns 401 for unauthenticated request', async () => {
        const app = createApp();
        const response = await request(app).get(
          '/sponsored-stop/nearby?lat=45.52&lng=-122.68',
        );
        expect(response.status).toBe(401);
      });
    });

    describe('GET /trips/cache/:id', () => {
      const mockCacheEntry = {
        id: 'cache-abc',
        location: 'Portland, OR',
        radiusKm: 100,
        themesKey: 'scenic|adventure',
        options: [
          {
            title: 'Pacific Loop',
            rationale: 'A great route',
            stops: [
              {
                query: 'Crater Lake',
                status: 'resolved',
                suggestion: {
                  id: 'place-1',
                  placeId: 'ChIJ1',
                  title: 'Crater Lake',
                  description: 'Beautiful lake',
                  distanceKm: 50,
                  lat: 42.9,
                  lng: -122.1,
                  imageUrl: 'http://localhost:3001/places/photo?name=abc',
                },
              },
            ],
          },
        ],
      };

      it('returns the first option from a cache entry', async () => {
        prismaMock.tripPlanCache.findUnique.mockResolvedValue(mockCacheEntry);
        const app = createApp();
        const response = await request(app).get('/trips/cache/cache-abc');

        expect(response.status).toBe(200);
        expect(response.body.location).toBe('Portland, OR');
        expect(response.body.radiusKm).toBe(100);
        expect(response.body.themes).toEqual(['scenic', 'adventure']);
        expect(response.body.source).toBe('cache');
        expect(response.body.options).toHaveLength(1);
        expect(response.body.options[0].title).toBe('Pacific Loop');
        expect(prismaMock.tripPlanCache.findUnique).toHaveBeenCalledWith({
          where: { id: 'cache-abc' },
        });
      });

      it('rewrites photo proxy URLs to the current host', async () => {
        prismaMock.tripPlanCache.findUnique.mockResolvedValue(mockCacheEntry);
        const app = createApp();
        const response = await request(app).get('/trips/cache/cache-abc');

        expect(response.status).toBe(200);
        const stop = response.body.options[0].stops[0];
        expect(stop.suggestion.imageUrl).toMatch(/\/places\/photo\?name=abc$/);
      });

      it('returns 404 for unknown cache id', async () => {
        prismaMock.tripPlanCache.findUnique.mockResolvedValue(null);
        const app = createApp();
        const response = await request(app).get('/trips/cache/unknown');

        expect(response.status).toBe(404);
      });
    });

    it('deduplicates trending routes by location', async () => {
      prismaMock.tripPlanCache.findMany.mockResolvedValue([
        {
          id: 'cache-1',
          location: 'Portland, OR',
          radiusKm: 100,
          themesKey: 'scenic',
          engagementScore: 10,
          options: [{ title: 'Route A', stops: [] }],
        },
        {
          id: 'cache-2',
          location: 'Portland, OR',
          radiusKm: 150,
          themesKey: 'adventure',
          engagementScore: 5,
          options: [{ title: 'Route B', stops: [] }],
        },
      ]);
      prismaMock.sponsoredPlace.findMany.mockResolvedValue([]);

      const app = createApp();
      const response = await request(app).get('/discover');

      expect(response.status).toBe(200);
      expect(response.body.trendingRoutes).toHaveLength(1);
      expect(response.body.trendingRoutes[0].cacheId).toBe('cache-1');
    });
  });

  describe('POST /trips/save-plan', () => {
    const savePlanBody = {
      title: 'Big Sur Loop',
      rationale: 'Coastal beauty',
      location: 'Carmel, CA',
      originLat: 36.55,
      originLng: -121.92,
      radiusKm: 100,
      themes: ['scenic', 'nature'],
      stops: [
        { placeId: 'p1', name: 'Bixby Bridge', lat: 36.37, lng: -121.9, order: 0 },
        { placeId: 'p2', name: 'Point Lobos', lat: 36.51, lng: -121.94, order: 1 },
      ],
    };

    it('writes AI-generated descriptions to stop notes on save', async () => {
      generateDescriptions.mockResolvedValue({
        'Bixby Bridge': 'A soaring arch over a rugged canyon.',
        'Point Lobos': 'Twisted cypress trees frame the Pacific.',
      });
      prismaMock.trip.create.mockResolvedValue({ id: 'trip-new', stops: [] });

      const app = createApp();
      const response = await request(app)
        .post('/trips/save-plan')
        .set('authorization', 'Bearer user-1')
        .send(savePlanBody);

      expect(response.status).toBe(201);
      expect(generateDescriptions).toHaveBeenCalledWith({
        stops: ['Bixby Bridge', 'Point Lobos'],
        location: 'Carmel, CA',
        themes: ['scenic', 'nature'],
      });
      expect(prismaMock.trip.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            stops: {
              create: expect.arrayContaining([
                expect.objectContaining({
                  name: 'Bixby Bridge',
                  notes: 'A soaring arch over a rugged canyon.',
                }),
                expect.objectContaining({
                  name: 'Point Lobos',
                  notes: 'Twisted cypress trees frame the Pacific.',
                }),
              ]),
            },
          }),
        }),
      );
    });

    it('saves trip successfully even when AI description service throws', async () => {
      generateDescriptions.mockRejectedValue(new Error('AI_REQUEST_FAILED'));
      prismaMock.trip.create.mockResolvedValue({ id: 'trip-new', stops: [] });

      const app = createApp();
      const response = await request(app)
        .post('/trips/save-plan')
        .set('authorization', 'Bearer user-1')
        .send(savePlanBody);

      expect(response.status).toBe(201);
      expect(prismaMock.trip.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            stops: {
              create: expect.arrayContaining([
                expect.objectContaining({ name: 'Bixby Bridge', notes: undefined }),
                expect.objectContaining({ name: 'Point Lobos', notes: undefined }),
              ]),
            },
          }),
        }),
      );
    });

    it('returns 401 for unauthenticated POST /trips/save-plan', async () => {
      const app = createApp();
      const response = await request(app).post('/trips/save-plan').send(savePlanBody);
      expect(response.status).toBe(401);
      expect(generateDescriptions).not.toHaveBeenCalled();
    });
  });

  describe('POST /trips/refine-plan', () => {
    const refinePlanBody = {
      location: 'Big Sur, CA',
      themes: ['scenic', 'foodie'],
      instruction: 'swap the brewery for a coffee shop',
      planOption: {
        title: 'Coastal Loop',
        rationale: 'Scenic coastal drive.',
        stops: [{ name: 'Bixby Bridge' }, { name: 'Nepenthe Restaurant' }],
      },
    };

    const rawRefined = {
      title: 'Coastal Loop',
      rationale: 'Scenic coastal drive with coffee.',
      stops: [
        { name: 'Bixby Bridge', stopType: 'attraction' },
        { name: 'Henry Miller Library', stopType: 'attraction' },
      ],
    };

    const resolvedStops = [
      {
        query: 'Bixby Bridge',
        suggestion: {
          id: 'p1',
          placeId: 'place-1',
          title: 'Bixby Bridge',
          description: 'Iconic arch bridge.',
          distanceKm: 20,
          lat: 36.37,
          lng: -121.9,
        },
      },
      {
        query: 'Henry Miller Library',
        suggestion: {
          id: 'p2',
          placeId: 'place-2',
          title: 'Henry Miller Memorial Library',
          description: 'Quirky arts gathering spot.',
          distanceKm: 30,
          lat: 36.16,
          lng: -121.67,
        },
      },
    ];

    it('returns 200 with refined option on success', async () => {
      geocodeLocation.mockResolvedValue({ lat: 36.27, lng: -121.81 });
      refinePlan.mockResolvedValue(rawRefined);
      resolvePlannedStops.mockResolvedValue(resolvedStops);

      const app = createApp();
      const response = await request(app)
        .post('/trips/refine-plan')
        .set('authorization', 'Bearer user-1')
        .send(refinePlanBody);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        title: 'Coastal Loop',
        stops: expect.arrayContaining([expect.objectContaining({ status: 'resolved' })]),
      });
      expect(refinePlan).toHaveBeenCalledWith(
        expect.objectContaining({ instruction: 'swap the brewery for a coffee shop' }),
      );
    });

    it('returns 400 for missing instruction', async () => {
      const app = createApp();
      const response = await request(app)
        .post('/trips/refine-plan')
        .set('authorization', 'Bearer user-1')
        .send({ ...refinePlanBody, instruction: '' });

      expect(response.status).toBe(400);
      expect(refinePlan).not.toHaveBeenCalled();
    });

    it('returns 400 for instruction over 200 chars', async () => {
      const app = createApp();
      const response = await request(app)
        .post('/trips/refine-plan')
        .set('authorization', 'Bearer user-1')
        .send({ ...refinePlanBody, instruction: 'x'.repeat(201) });

      expect(response.status).toBe(400);
    });

    it('returns 502 when AI service throws', async () => {
      geocodeLocation.mockResolvedValue({ lat: 36.27, lng: -121.81 });
      refinePlan.mockRejectedValue(new Error('AI_REQUEST_FAILED'));

      const app = createApp();
      const response = await request(app)
        .post('/trips/refine-plan')
        .set('authorization', 'Bearer user-1')
        .send(refinePlanBody);

      expect(response.status).toBe(502);
      expect(response.body).toMatchObject({ error: 'AI_PLANNER_ERROR' });
    });

    it('returns 200 with unresolved stops when Places API fails', async () => {
      geocodeLocation.mockResolvedValue({ lat: 36.27, lng: -121.81 });
      refinePlan.mockResolvedValue(rawRefined);
      resolvePlannedStops.mockRejectedValue(new Error('PLACES_ERROR'));

      const app = createApp();
      const response = await request(app)
        .post('/trips/refine-plan')
        .set('authorization', 'Bearer user-1')
        .send(refinePlanBody);

      expect(response.status).toBe(200);
      expect(response.body.stops[0]).toMatchObject({ status: 'unresolved' });
    });

    it('allows unauthenticated requests within the anonymous limit', async () => {
      geocodeLocation.mockResolvedValue({ lat: 36.27, lng: -121.81 });
      refinePlan.mockResolvedValue(rawRefined);
      resolvePlannedStops.mockResolvedValue(resolvedStops);

      const app = createApp();
      const response = await request(app)
        .post('/trips/refine-plan')
        .set('x-forwarded-for', '10.0.0.1')
        .send(refinePlanBody);

      expect(response.status).toBe(200);
    });
  });

  describe('Admin sponsor endpoints', () => {
    const mockSponsor = {
      id: 'sp-1',
      placeId: 'abc123',
      title: 'Seaside Inn',
      description: 'Right on the coast',
      url: 'https://seaside.example.com',
      imageUrl: null,
      lat: 45.9,
      lng: -123.9,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('returns 401 for unauthenticated admin requests', async () => {
      const app = createApp();
      const res = await request(app).get('/admin/sponsors');
      expect(res.status).toBe(401);
    });

    it('returns 403 when user does not have ADMIN role', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1', role: 'USER' });
      const app = createApp();
      const res = await request(app)
        .get('/admin/sponsors')
        .set('authorization', 'Bearer user-1');
      expect(res.status).toBe(403);
    });

    it('GET /admin/sponsors lists all sponsors for admin', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1', role: 'ADMIN' });
      prismaMock.sponsoredPlace.findMany.mockResolvedValue([mockSponsor]);
      const app = createApp();

      const res = await request(app)
        .get('/admin/sponsors')
        .set('authorization', 'Bearer user-1');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].title).toBe('Seaside Inn');
    });

    it('POST /admin/sponsors creates a new sponsor', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1', role: 'ADMIN' });
      prismaMock.sponsoredPlace.create.mockResolvedValue(mockSponsor);
      const app = createApp();

      const res = await request(app)
        .post('/admin/sponsors')
        .set('authorization', 'Bearer user-1')
        .send({
          title: 'Seaside Inn',
          description: 'Right on the coast',
          url: 'https://seaside.example.com',
          lat: 45.9,
          lng: -123.9,
        });

      expect(res.status).toBe(201);
      expect(prismaMock.sponsoredPlace.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ title: 'Seaside Inn', lat: 45.9, lng: -123.9 }),
        }),
      );
    });

    it('PATCH /admin/sponsors/:id updates a sponsor', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1', role: 'ADMIN' });
      prismaMock.sponsoredPlace.findUnique.mockResolvedValue(mockSponsor);
      prismaMock.sponsoredPlace.update.mockResolvedValue({
        ...mockSponsor,
        active: false,
      });
      const app = createApp();

      const res = await request(app)
        .patch('/admin/sponsors/sp-1')
        .set('authorization', 'Bearer user-1')
        .send({ active: false });

      expect(res.status).toBe(200);
      expect(res.body.active).toBe(false);
    });

    it('PATCH /admin/sponsors/:id returns 404 for unknown sponsor', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1', role: 'ADMIN' });
      prismaMock.sponsoredPlace.findUnique.mockResolvedValue(null);
      const app = createApp();

      const res = await request(app)
        .patch('/admin/sponsors/bad-id')
        .set('authorization', 'Bearer user-1')
        .send({ active: false });

      expect(res.status).toBe(404);
    });

    it('DELETE /admin/sponsors/:id removes a sponsor', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1', role: 'ADMIN' });
      prismaMock.sponsoredPlace.findUnique.mockResolvedValue(mockSponsor);
      prismaMock.sponsoredPlace.delete.mockResolvedValue(mockSponsor);
      const app = createApp();

      const res = await request(app)
        .delete('/admin/sponsors/sp-1')
        .set('authorization', 'Bearer user-1');

      expect(res.status).toBe(204);
      expect(prismaMock.sponsoredPlace.delete).toHaveBeenCalledWith({
        where: { id: 'sp-1' },
      });
    });

    it('DELETE /admin/sponsors/:id returns 404 for unknown sponsor', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1', role: 'ADMIN' });
      prismaMock.sponsoredPlace.findUnique.mockResolvedValue(null);
      const app = createApp();

      const res = await request(app)
        .delete('/admin/sponsors/bad-id')
        .set('authorization', 'Bearer user-1');

      expect(res.status).toBe(404);
    });
  });
});
