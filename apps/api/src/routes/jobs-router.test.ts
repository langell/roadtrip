import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

const { mockEnv } = vi.hoisted(() => {
  const mockEnv = {
    LOG_LEVEL: 'silent' as string,
    CRON_SECRET: 'test-secret' as string | undefined,
    TRIP_PLAN_CACHE_TTL_DAYS: 30,
    PREWARM_MAX_LOCATIONS: 10,
    PREWARM_MAX_THEME_COMBOS: 2,
    PREWARM_MAX_GENERATIONS: 30,
  };
  return { mockEnv };
});

vi.mock('../config/env.js', () => ({ env: mockEnv }));

const prismaMock = {
  tripPlanCache: {
    groupBy: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
  },
  analyticsEvent: {
    create: vi.fn(),
  },
};
vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }));

const generatePlans = vi.fn();
vi.mock('../services/ai-trip-planner-service.js', () => ({
  aiTripPlannerService: { generatePlans },
}));

vi.mock('../lib/request-logging.js', () => ({
  getRequestLogger: () => ({ info: vi.fn(), error: vi.fn() }),
  requestLoggingMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const { jobsRouter } = await import('./jobs-router.js');

const buildApp = () => {
  const app = express();
  app.use(express.json());
  // inject stub res.locals.requestId so getRequestLogger doesn't crash
  app.use((_, res, next) => {
    res.locals.requestId = 'test-id';
    next();
  });
  app.use('/jobs', jobsRouter);
  return app;
};

describe('GET /jobs/prewarm-cache', () => {
  beforeEach(() => {
    mockEnv.CRON_SECRET = 'test-secret';
    prismaMock.tripPlanCache.groupBy.mockReset();
    prismaMock.tripPlanCache.count.mockReset();
    prismaMock.tripPlanCache.create.mockReset();
    prismaMock.analyticsEvent.create.mockReset();
    generatePlans.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 401 without CRON_SECRET header', async () => {
    const app = buildApp();
    const res = await request(app).get('/jobs/prewarm-cache');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'UNAUTHORIZED' });
  });

  it('returns 401 with wrong CRON_SECRET', async () => {
    const app = buildApp();
    const res = await request(app)
      .get('/jobs/prewarm-cache')
      .set('Authorization', 'Bearer wrong-secret');
    expect(res.status).toBe(401);
  });

  it('skips auth check when CRON_SECRET is not configured', async () => {
    mockEnv.CRON_SECRET = undefined;
    prismaMock.tripPlanCache.groupBy.mockResolvedValue([]);
    const app = buildApp();
    const res = await request(app).get('/jobs/prewarm-cache');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ attempted: 0, skipped: 0, generated: 0, errors: 0 });
  });

  it('returns 200 with summary when no trending locations exist', async () => {
    prismaMock.tripPlanCache.groupBy.mockResolvedValue([]);
    const app = buildApp();
    const res = await request(app)
      .get('/jobs/prewarm-cache')
      .set('Authorization', 'Bearer test-secret');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ attempted: 0, skipped: 0, generated: 0, errors: 0 });
    expect(generatePlans).not.toHaveBeenCalled();
  });

  it('skips generation when valid cache entry already exists', async () => {
    prismaMock.tripPlanCache.groupBy
      .mockResolvedValueOnce([{ locationKey: 'key west', _sum: { engagementScore: 50 } }])
      .mockResolvedValueOnce([{ themesKey: 'scenic|nature', _count: { id: 5 } }]);
    prismaMock.tripPlanCache.count.mockResolvedValue(1); // entry exists
    prismaMock.analyticsEvent.create.mockResolvedValue({ id: 'evt-1' });

    const app = buildApp();
    const res = await request(app)
      .get('/jobs/prewarm-cache')
      .set('Authorization', 'Bearer test-secret');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ attempted: 1, skipped: 1, generated: 0, errors: 0 });
    expect(generatePlans).not.toHaveBeenCalled();
  });

  it('generates and caches plans for a trending location', async () => {
    prismaMock.tripPlanCache.groupBy
      .mockResolvedValueOnce([{ locationKey: 'key west', _sum: { engagementScore: 50 } }])
      .mockResolvedValueOnce([{ themesKey: 'scenic|nature', _count: { id: 5 } }]);
    prismaMock.tripPlanCache.count.mockResolvedValue(0); // no existing entry
    generatePlans.mockResolvedValue({
      options: [{ title: 'Scenic Route', rationale: 'Great views', stops: [] }],
    });
    prismaMock.tripPlanCache.create.mockResolvedValue({ id: 'cache-1' });
    prismaMock.analyticsEvent.create.mockResolvedValue({ id: 'evt-1' });

    const app = buildApp();
    const res = await request(app)
      .get('/jobs/prewarm-cache')
      .set('Authorization', 'Bearer test-secret');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ attempted: 1, skipped: 0, generated: 1, errors: 0 });
    expect(generatePlans).toHaveBeenCalledWith({
      location: 'key west',
      radiusKm: 120,
      themes: ['scenic', 'nature'],
      maxOptions: 3,
    });
    expect(prismaMock.tripPlanCache.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          locationKey: 'key west',
          themesKey: 'scenic|nature',
          validOptions: 1,
        }),
      }),
    );
    expect(prismaMock.analyticsEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'cache.prewarm' }),
      }),
    );
  });

  it('records error and continues when AI generation fails', async () => {
    prismaMock.tripPlanCache.groupBy
      .mockResolvedValueOnce([
        { locationKey: 'nashville', _sum: { engagementScore: 30 } },
      ])
      .mockResolvedValueOnce([{ themesKey: 'music|culture', _count: { id: 3 } }]);
    prismaMock.tripPlanCache.count.mockResolvedValue(0);
    generatePlans.mockRejectedValue(new Error('AI unavailable'));
    prismaMock.analyticsEvent.create.mockResolvedValue({ id: 'evt-1' });

    const app = buildApp();
    const res = await request(app)
      .get('/jobs/prewarm-cache')
      .set('Authorization', 'Bearer test-secret');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ attempted: 1, skipped: 0, generated: 0, errors: 1 });
    expect(prismaMock.tripPlanCache.create).not.toHaveBeenCalled();
  });

  it('respects PREWARM_MAX_GENERATIONS limit', async () => {
    mockEnv.PREWARM_MAX_GENERATIONS = 1;
    // Two locations each with one theme combo
    prismaMock.tripPlanCache.groupBy
      .mockResolvedValueOnce([
        { locationKey: 'sedona', _sum: { engagementScore: 40 } },
        { locationKey: 'nashville', _sum: { engagementScore: 30 } },
      ])
      .mockResolvedValueOnce([{ themesKey: 'scenic|nature', _count: { id: 2 } }])
      .mockResolvedValueOnce([{ themesKey: 'music|culture', _count: { id: 1 } }]);
    prismaMock.tripPlanCache.count.mockResolvedValue(0);
    generatePlans.mockResolvedValue([{ title: 'Route', rationale: 'OK', stops: [] }]);
    prismaMock.tripPlanCache.create.mockResolvedValue({ id: 'cache-1' });
    prismaMock.analyticsEvent.create.mockResolvedValue({ id: 'evt-1' });

    const app = buildApp();
    const res = await request(app)
      .get('/jobs/prewarm-cache')
      .set('Authorization', 'Bearer test-secret');

    expect(res.status).toBe(200);
    // Only 1 generation should have been attempted due to the limit
    expect(res.body.attempted).toBe(1);
    expect(generatePlans).toHaveBeenCalledTimes(1);

    // Restore default
    mockEnv.PREWARM_MAX_GENERATIONS = 30;
  });
});
