import { metrics } from '@opentelemetry/api';
const otelEnabled = process.env.OTEL_ENABLED === 'true';
const meter = metrics.getMeter('roadtrip-api');
const requestCount = meter.createCounter('http.server.request.count', {
    description: 'Total HTTP requests handled by the API.',
});
const requestErrors = meter.createCounter('http.server.request.errors', {
    description: 'HTTP requests that resulted in server errors.',
});
const requestDuration = meter.createHistogram('http.server.request.duration', {
    description: 'Request duration in milliseconds.',
    unit: 'ms',
});
export const recordRequestMetrics = ({ method, route, status, durationMs, }) => {
    if (!otelEnabled) {
        return;
    }
    const attributes = {
        'http.method': method,
        'http.route': route,
        'http.status_code': status,
    };
    requestCount.add(1, attributes);
    requestDuration.record(durationMs, attributes);
    if (status >= 500) {
        requestErrors.add(1, attributes);
    }
};
