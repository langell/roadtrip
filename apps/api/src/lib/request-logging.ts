import type { Request, Response, NextFunction } from 'express';
import type { Logger } from 'pino';
import { randomUUID } from 'node:crypto';
import { context, trace } from '@opentelemetry/api';
import { createRequestLogger, logger } from './logger.js';
import { recordRequestMetrics } from './request-metrics.js';

export type RequestContext = {
  requestId: string;
  logger: Logger;
  startTime: bigint;
};

const getRouteLabel = (req: Request) => {
  if (req.route?.path) {
    return `${req.baseUrl}${req.route.path}`;
  }
  return `${req.baseUrl}${req.path}`;
};

export const requestLoggingMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const requestIdHeader = req.header('x-request-id');
  const requestId = requestIdHeader?.trim() || randomUUID();
  const startTime = process.hrtime.bigint();
  const requestLogger = createRequestLogger(requestId);

  res.setHeader('x-request-id', requestId);
  res.locals.requestContext = { requestId, logger: requestLogger, startTime };

  const span = trace.getSpan(context.active());
  if (span) {
    span.setAttribute('request.id', requestId);
  }

  res.on('finish', () => {
    const durationNs = process.hrtime.bigint() - startTime;
    const latencyMs = Number(durationNs) / 1_000_000;
    const route = getRouteLabel(req);

    requestLogger.info(
      {
        route,
        method: req.method,
        status: res.statusCode,
        latencyMs: Math.round(latencyMs),
      },
      'request.completed',
    );

    recordRequestMetrics({
      route,
      method: req.method,
      status: res.statusCode,
      durationMs: latencyMs,
    });
  });

  next();
};

export const getRequestContext = (res: Response): RequestContext | undefined =>
  res.locals.requestContext ?? undefined;

export const getRequestLogger = (res: Response): Logger =>
  getRequestContext(res)?.logger ?? logger;
