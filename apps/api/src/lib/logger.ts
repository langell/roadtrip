import pino from 'pino';
import type { Logger } from 'pino';
import { env } from '../config/env.js';

const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["set-cookie"]',
  'headers.authorization',
  'headers.cookie',
  'headers["set-cookie"]',
  'authorization',
  'cookie',
  '["set-cookie"]',
  'body.password',
  'body.token',
  'body.accessToken',
  'body.refreshToken',
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'apiKey',
];

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: redactPaths,
    censor: '[REDACTED]',
  },
});

export const createRequestLogger = (requestId: string) => logger.child({ requestId });

export const logError = (
  log: Logger,
  message: string,
  error: unknown,
  context?: Record<string, unknown>,
) => {
  log.error({ err: error, ...context }, message);
};
