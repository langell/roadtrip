import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../server.js';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    analyticsEvent: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ 1: 1 }]),
  },
}));

vi.mock('../lib/prisma.js', () => ({ prisma: mockPrisma }));

vi.mock('../lib/require-admin.js', () => ({
  requireAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const app = createApp();

describe('POST /analytics/events', () => {
  beforeEach(() => {
    mockPrisma.analyticsEvent.create.mockReset();
    mockPrisma.analyticsEvent.create.mockResolvedValue({ id: 'evt-1' });
  });

  it('accepts a valid event and returns 202', async () => {
    const res = await request(app)
      .post('/analytics/events')
      .send({ type: 'trip_generate', payload: { location: 'Denver, CO' } });
    expect(res.status).toBe(202);
    expect(res.body).toEqual({ recorded: true });
  });

  it('rejects unknown event types', async () => {
    const res = await request(app)
      .post('/analytics/events')
      .send({ type: 'unknown_event', payload: {} });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'INVALID_BODY' });
  });

  it('defaults payload to empty object when omitted', async () => {
    const res = await request(app).post('/analytics/events').send({ type: 'trip_save' });
    expect(res.status).toBe(202);
  });

  it('returns 202 even if DB write fails (resilient)', async () => {
    mockPrisma.analyticsEvent.create.mockRejectedValue(new Error('DB down'));
    const res = await request(app)
      .post('/analytics/events')
      .send({ type: 'sponsored_click', payload: { placeId: 'p1' } });
    // 202 response is sent before the async DB write resolves
    expect(res.status).toBe(202);
  });

  it('accepts all canonical event types', async () => {
    const types = [
      'trip_generate',
      'trip_save',
      'trip_open',
      'sponsored_click',
      'sponsored_impression',
    ] as const;
    for (const type of types) {
      const res = await request(app)
        .post('/analytics/events')
        .send({ type, payload: {} });
      expect(res.status).toBe(202);
    }
  });
});

describe('GET /analytics/events', () => {
  beforeEach(() => {
    mockPrisma.analyticsEvent.findMany.mockReset();
    mockPrisma.analyticsEvent.findMany.mockResolvedValue([
      {
        id: 'e1',
        type: 'trip_generate',
        payload: {},
        userId: null,
        createdAt: new Date(),
      },
    ]);
  });

  it('returns paginated events for admin', async () => {
    const res = await request(app).get('/analytics/events');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('events');
    expect(Array.isArray(res.body.events)).toBe(true);
  });

  it('filters by type when provided', async () => {
    const res = await request(app).get('/analytics/events?type=trip_generate');
    expect(res.status).toBe(200);
    expect(mockPrisma.analyticsEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { type: 'trip_generate' } }),
    );
  });

  it('rejects invalid type filter', async () => {
    const res = await request(app).get('/analytics/events?type=bad_type');
    expect(res.status).toBe(400);
  });
});
