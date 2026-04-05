import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { withAsyncHandler } from '../lib/async-handler.js';
import { requireAdmin } from '../lib/require-admin.js';

export const adminRouter = Router();

const sponsorSchema = z.object({
  placeId: z.string().min(1).optional(),
  title: z.string().min(1),
  description: z.string().min(1),
  url: z.string().url().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
  active: z.boolean().optional(),
});

adminRouter.get(
  '/sponsors',
  requireAdmin,
  withAsyncHandler(async (_req, res) => {
    const sponsors = await prisma.sponsoredPlace.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(sponsors);
  }),
);

adminRouter.post(
  '/sponsors',
  requireAdmin,
  withAsyncHandler(async (req, res) => {
    const parsed = sponsorSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'INVALID_BODY' });
      return;
    }
    const {
      placeId: providedPlaceId,
      title,
      description,
      url,
      imageUrl,
      lat,
      lng,
      active,
    } = parsed.data;
    const sponsor = await prisma.sponsoredPlace.create({
      data: {
        placeId: providedPlaceId ?? randomBytes(8).toString('hex'),
        title,
        description,
        url: url ?? null,
        imageUrl: imageUrl ?? null,
        lat: lat ?? null,
        lng: lng ?? null,
        active: active ?? true,
      },
    });
    res.status(201).json(sponsor);
  }),
);

adminRouter.patch(
  '/sponsors/:id',
  requireAdmin,
  withAsyncHandler(async (req, res) => {
    const { id } = req.params;
    const parsed = sponsorSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'INVALID_BODY' });
      return;
    }
    const existing = await prisma.sponsoredPlace.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }
    const sponsor = await prisma.sponsoredPlace.update({
      where: { id },
      data: parsed.data,
    });
    res.json(sponsor);
  }),
);

adminRouter.delete(
  '/sponsors/:id',
  requireAdmin,
  withAsyncHandler(async (req, res) => {
    const { id } = req.params;
    const existing = await prisma.sponsoredPlace.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }
    await prisma.sponsoredPlace.delete({ where: { id } });
    res.status(204).send();
  }),
);
