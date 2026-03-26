import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION, } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { logger } from './lib/logger.js';
const otelEnabled = process.env.OTEL_ENABLED === 'true';
const serviceName = process.env.OTEL_SERVICE_NAME ?? 'roadtrip-api';
const serviceVersion = process.env.npm_package_version ?? '0.0.1';
if (process.env.OTEL_LOG_LEVEL) {
    const levelKey = process.env.OTEL_LOG_LEVEL.toUpperCase();
    const diagLevel = DiagLogLevel[levelKey] ?? DiagLogLevel.INFO;
    diag.setLogger(new DiagConsoleLogger(), diagLevel);
}
let shutdownObservability = async () => { };
if (otelEnabled && process.env.NODE_ENV !== 'test') {
    const traceEndpoint = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ??
        process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    const metricEndpoint = process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT ??
        process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    const metricReader = metricEndpoint
        ? new PeriodicExportingMetricReader({
            exporter: new OTLPMetricExporter({ url: metricEndpoint }),
            exportIntervalMillis: 60000,
        })
        : undefined;
    const sdk = new NodeSDK({
        resource: resourceFromAttributes({
            [SEMRESATTRS_SERVICE_NAME]: serviceName,
            [SEMRESATTRS_SERVICE_VERSION]: serviceVersion,
        }),
        traceExporter: traceEndpoint ? new OTLPTraceExporter({ url: traceEndpoint }) : undefined,
        metricReader,
        instrumentations: [
            getNodeAutoInstrumentations({
                '@opentelemetry/instrumentation-fs': { enabled: false },
            }),
        ],
    });
    try {
        sdk.start();
        logger.info({ serviceName }, 'observability.started');
    }
    catch (error) {
        logger.error({ err: error }, 'observability.start_failed');
    }
    shutdownObservability = async () => {
        try {
            await sdk.shutdown();
        }
        catch (error) {
            logger.error({ err: error }, 'observability.shutdown_failed');
        }
    };
}
export { shutdownObservability };
