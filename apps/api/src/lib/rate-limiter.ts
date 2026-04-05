import type { Request } from 'express';

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

export const createAnonymousRateLimiter = (windowMs: number, max: number) => {
  const hitsByIp = new Map<string, RateLimitEntry>();

  return (ipAddress: string): boolean => {
    const now = Date.now();
    const existing = hitsByIp.get(ipAddress);

    if (!existing || existing.resetAt <= now) {
      hitsByIp.set(ipAddress, { count: 1, resetAt: now + windowMs });
      return true;
    }

    if (existing.count >= max) {
      return false;
    }

    existing.count += 1;
    hitsByIp.set(ipAddress, existing);
    return true;
  };
};

export const getRequesterIp = (req: Request): string => {
  const forwardedFor = req.header('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() ?? 'unknown';
  }
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
};
