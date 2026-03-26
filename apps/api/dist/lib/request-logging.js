import { randomUUID } from 'node:crypto';
import { context, trace } from '@opentelemetry/api';
import { createRequestLogger, logger } from './logger.js';
import { recordRequestMetrics } from './request-metrics.js';
const getRouteLabel = (req) => {
    if (req.route?.path) {
        return `${req.baseUrl}${req.route.path}`;
    }
    return `${req.baseUrl}${req.path}`;
};
export const requestLoggingMiddleware = (req, res, next) => {
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
        const latencyMs = Number(durationNs) / 1000000;
        const route = getRouteLabel(req);
        requestLogger.info({
            route,
            method: req.method,
            status: res.statusCode,
            latencyMs: Math.round(latencyMs),
        }, 'request.completed');
        recordRequestMetrics({
            route,
            method: req.method,
            status: res.statusCode,
            durationMs: latencyMs,
        });
    });
    next();
};
export const getRequestContext = (res) => res.locals.requestContext ?? undefined;
export const getRequestLogger = (res) => getRequestContext(res)?.logger ?? logger;
