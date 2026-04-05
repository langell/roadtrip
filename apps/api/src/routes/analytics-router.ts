import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { withAsyncHandler } from '../lib/async-handler.js';
import { requireAdmin } from '../lib/require-admin.js';
import { getRequestUserId } from '../lib/request-auth.js';

export const analyticsRouter = Router();

// Canonical event types and their payload schemas
export const EventTypeSchema = z.enum([
  'trip_generate',
  'trip_save',
  'trip_open',
  'sponsored_click',
  'sponsored_impression',
]);

export type EventType = z.infer<typeof EventTypeSchema>;

const recordEventSchema = z.object({
  type: EventTypeSchema,
  payload: z.record(z.unknown()).default({}),
});

// POST /analytics/events — public, fire-and-forget
analyticsRouter.post(
  '/events',
  withAsyncHandler(async (req, res) => {
    const parsed = recordEventSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'INVALID_BODY' });
      return;
    }

    const userId = await getRequestUserId(req);

    // Fire-and-forget — do not await, do not block the response
    void prisma.analyticsEvent
      .create({
        data: {
          type: parsed.data.type,
          payload: parsed.data.payload as object,
          ...(userId ? { userId } : {}),
        },
      })
      .catch(() => {
        // Swallow — analytics writes must never break user flows
      });

    res.status(202).json({ recorded: true });
  }),
);

// GET /analytics/events — admin only, for basic reporting
analyticsRouter.get(
  '/events',
  requireAdmin,
  withAsyncHandler(async (req, res) => {
    const querySchema = z.object({
      type: EventTypeSchema.optional(),
      limit: z.coerce.number().int().min(1).max(500).default(100),
      offset: z.coerce.number().int().min(0).default(0),
    });

    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'INVALID_QUERY' });
      return;
    }

    const { type, limit, offset } = parsed.data;

    const events = await prisma.analyticsEvent.findMany({
      where: type ? { type } : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    res.json({ events, limit, offset });
  }),
);
