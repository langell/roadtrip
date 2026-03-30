import type { Request, Response, NextFunction } from 'express';
import { getRequestUserId } from './request-auth.js';

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  void (async () => {
    const userId = await getRequestUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }
    res.locals.userId = userId;
    next();
  })();
};
