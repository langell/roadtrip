import type { Request, Response, NextFunction } from 'express';
import { getRequestUserId } from './request-auth.js';
import { prisma } from './prisma.js';

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  void (async () => {
    const userId = await getRequestUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== 'ADMIN') {
      res.status(403).json({ error: 'FORBIDDEN' });
      return;
    }
    res.locals.userId = userId;
    next();
  })();
};
