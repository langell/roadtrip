import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

vi.mock('./config/env.js', () => ({
  env: {
    LOG_LEVEL: 'info',
    PORT: 0,
    ANON_SUGGESTIONS_RATE_LIMIT_WINDOW_MS: 60000,
    ANON_SUGGESTIONS_RATE_LIMIT_MAX: 2,
    TRIP_PLAN_CACHE_TTL_DAYS: 30,
  },
}));

vi.mock('./types/context.js', () => ({
  createContext: () => ({ prisma: {}, userId: undefined }),
}));

const prismaMock = {
  trip: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  tripPlanCache: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
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
    generatePlans.mockReset();
    prismaMock.trip.findMany.mockReset();
    prismaMock.trip.create.mockReset();
    prismaMock.tripPlanCache.findMany.mockReset();
    prismaMock.tripPlanCache.create.mockReset();
    prismaMock.tripPlanCache.update.mockReset();
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
          stops: ['Bixby Bridge', 'Monterey Bay Aquarium'],
        },
        {
          title: 'Scenic Food Loop',
          rationale: 'Mix of food and viewpoints.',
          stops: ['Carmel Mission', 'Point Lobos'],
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
          stops: ['Stop One', 'Stop Two'],
        },
        {
          title: 'Partial Route',
          rationale: 'One unresolved stop.',
          stops: ['Stop Three'],
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
          stops: ['Nearby Stop'],
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
});
