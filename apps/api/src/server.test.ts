import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

vi.mock('./config/env.js', () => ({
  env: {
    PORT: 0,
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
      theme: 'scenic',
      radiusKm: 150,
    });
    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ id: 'stop-1' }]);
  });

  it('rejects unauthenticated suggestions requests', async () => {
    const app = createApp();

    const response = await request(app)
      .get('/suggestions')
      .query({ location: 'Portland, OR', theme: 'scenic', radiusKm: '150' });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'UNAUTHORIZED' });
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
