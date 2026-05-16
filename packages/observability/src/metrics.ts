import { metrics as otelMetrics } from '@opentelemetry/api';

const METER_NAME = '@saas/observability';

/** Static labels (or attributes) attached to a metric observation. */
export type MetricLabels = Readonly<Record<string, string | number>>;

/**
 * Monotonic counter — increments by a non-negative amount. Use for event
 * counts (`requests_total`, `errors_total`).
 */
export interface Counter {
  inc(amount?: number, attrs?: MetricLabels): void;
}

/**
 * Distribution of values (latency, payload sizes). Bucket boundaries are
 * the exporter's concern.
 */
export interface Histogram {
  observe(value: number, attrs?: MetricLabels): void;
}

/**
 * Point-in-time value (active connections, queue depth). The last `set`
 * wins; the exporter samples on its own cadence.
 */
export interface Gauge {
  set(value: number, attrs?: MetricLabels): void;
}

/**
 * Process-wide metrics registry. Each factory creates an OTel instrument
 * lazily on first call — with no SDK registered, the API returns no-op
 * instruments and the calls are cheap. The production exporter is wired
 * by the host app (Block 009 / Phase 3+).
 *
 * INVARIANT: instrument names are not reserved at registration time —
 * OTel allows the same name across `getMeter` calls. Consumers are
 * expected to keep names unique per semantic.
 */
export interface MetricsRegistry {
  counter(name: string, labels?: MetricLabels): Counter;
  histogram(name: string, labels?: MetricLabels): Histogram;
  gauge(name: string, labels?: MetricLabels): Gauge;
}

function mergeLabels(
  base: MetricLabels | undefined,
  extra: MetricLabels | undefined,
): MetricLabels | undefined {
  if (base === undefined && extra === undefined) return undefined;
  return { ...base, ...extra };
}

function createCounter(name: string, labels?: MetricLabels): Counter {
  const instrument = otelMetrics.getMeter(METER_NAME).createCounter(name);
  return {
    inc(amount = 1, attrs) {
      const merged = mergeLabels(labels, attrs);
      if (merged !== undefined) instrument.add(amount, merged);
      else instrument.add(amount);
    },
  };
}

function createHistogramInstrument(
  name: string,
  labels?: MetricLabels,
): Histogram {
  const instrument = otelMetrics.getMeter(METER_NAME).createHistogram(name);
  return {
    observe(value, attrs) {
      const merged = mergeLabels(labels, attrs);
      if (merged !== undefined) instrument.record(value, merged);
      else instrument.record(value);
    },
  };
}

function createGaugeInstrument(name: string, labels?: MetricLabels): Gauge {
  const instrument = otelMetrics.getMeter(METER_NAME).createGauge(name);
  return {
    set(value, attrs) {
      const merged = mergeLabels(labels, attrs);
      if (merged !== undefined) instrument.record(value, merged);
      else instrument.record(value);
    },
  };
}

export const metrics: MetricsRegistry = {
  counter: createCounter,
  histogram: createHistogramInstrument,
  gauge: createGaugeInstrument,
};
