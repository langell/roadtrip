import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { withAsyncHandler } from '../lib/async-handler.js';
import { requireAuth } from '../lib/require-auth.js';

export const usersRouter = Router();

usersRouter.put(
  '/me',
  requireAuth,
  withAsyncHandler(async (req, res) => {
    const userId = res.locals.userId as string;
    const schema = z.object({
      email: z.string().email().nullable().optional(),
      name: z.string().nullable().optional(),
      image: z.string().nullable().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'INVALID_BODY' });
      return;
    }
    await prisma.user.upsert({
      where: { id: userId },
      update: parsed.data,
      create: { id: userId, ...parsed.data },
    });
    res.status(204).send();
  }),
);

usersRouter.get(
  '/me',
  requireAuth,
  withAsyncHandler(async (_req, res) => {
    const userId = res.locals.userId as string;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      role: user.role,
    });
  }),
);
