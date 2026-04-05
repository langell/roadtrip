import type { Request } from 'express';
import { env } from '../config/env.js';
import { logger } from './logger.js';

// ── In-memory fallback ────────────────────────────────────────────────────────

type RateLimitEntry = { count: number; resetAt: number };
type SyncLimiter = (ipAddress: string) => boolean;

const createInMemoryLimiter = (windowMs: number, max: number): SyncLimiter => {
  const hitsByIp = new Map<string, RateLimitEntry>();

  return (ipAddress: string): boolean => {
    const now = Date.now();
    const existing = hitsByIp.get(ipAddress);

    if (!existing || existing.resetAt <= now) {
      hitsByIp.set(ipAddress, { count: 1, resetAt: now + windowMs });
      return true;
    }

    if (existing.count >= max) return false;

    existing.count += 1;
    hitsByIp.set(ipAddress, existing);
    return true;
  };
};

// ── Redis-backed limiter (Upstash sliding window) ─────────────────────────────

const initRedisLimiter = async (
  windowMs: number,
  max: number,
): Promise<SyncLimiter | null> => {
  if (!env.REDIS_URL || !env.REDIS_TOKEN) return null;

  try {
    const [{ Redis }, { Ratelimit }] = await Promise.all([
      import('@upstash/redis'),
      import('@upstash/ratelimit'),
    ]);

    const redis = new Redis({ url: env.REDIS_URL, token: env.REDIS_TOKEN });
    const ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(max, `${windowMs} ms`),
      prefix: 'rl',
    });

    // Ratelimit.limit() is async; we maintain a result cache keyed by IP so the
    // public API stays synchronous. On first call per IP we optimistically allow
    // and kick off the check; subsequent calls see the result of the prior check.
    const results = new Map<string, { allow: boolean; checkedAt: number }>();
    const CHECK_STALENESS_MS = Math.min(windowMs / 10, 1000);

    return (ipAddress: string): boolean => {
      const cached = results.get(ipAddress);
      const now = Date.now();

      if (!cached || now - cached.checkedAt > CHECK_STALENESS_MS) {
        // Kick off async check; optimistically allow while in-flight
        void ratelimit
          .limit(ipAddress)
          .then(({ success }) => {
            results.set(ipAddress, { allow: success, checkedAt: Date.now() });
          })
          .catch(() => {
            // Redis error — fail open
            results.set(ipAddress, { allow: true, checkedAt: Date.now() });
          });
        return cached?.allow ?? true;
      }

      return cached.allow;
    };
  } catch (err) {
    logger.warn({ err }, 'rate-limiter: failed to initialize Redis — using in-memory');
    return null;
  }
};

// ── Public factory ────────────────────────────────────────────────────────────

export const createAnonymousRateLimiter = (
  windowMs: number,
  max: number,
): SyncLimiter => {
  const inMemory = createInMemoryLimiter(windowMs, max);
  let active: SyncLimiter = inMemory;

  if (env.REDIS_URL && env.REDIS_TOKEN) {
    void initRedisLimiter(windowMs, max).then((redisLimiter) => {
      if (redisLimiter) {
        active = redisLimiter;
        logger.info('rate-limiter: switched to Redis-backed distributed limiter');
      }
    });
  }

  return (ipAddress: string): boolean => active(ipAddress);
};

export const getRequesterIp = (req: Request): string => {
  const forwardedFor = req.header('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() ?? 'unknown';
  }
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
};
