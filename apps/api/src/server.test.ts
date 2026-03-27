import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

vi.mock('./config/env.js', () => ({
  env: {
    LOG_LEVEL: 'info',
    PORT: 0,
    ANON_SUGGESTIONS_RATE_LIMIT_WINDOW_MS: 60000,
    ANON_SUGGESTIONS_RATE_LIMIT_MAX: 2,
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
};
vi.mock('./lib/prisma.js', () => ({
  prisma: prismaMock,
}));

const findStops = vi.fn();
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
  },
}));

const { createApp, startServer, registerSignalHandlers } = await import('./server.js');

describe('HTTP server', () => {
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
