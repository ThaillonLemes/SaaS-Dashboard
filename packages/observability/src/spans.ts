import {
  trace,
  SpanStatusCode,
  type Span,
} from '@opentelemetry/api';

const TRACER_NAME = '@saas/observability';

export type { Span };

/** Attributes attached to a span at open time. */
export type SpanAttrs = Readonly<
  Record<string, string | number | boolean>
>;

/**
 * Open a span around `fn`, attach `attrs`, end the span on completion.
 * Records exceptions and sets ERROR status on throw before rethrowing —
 * the caller still observes the original error.
 *
 * INVARIANT: the span is always ended, even when `fn` throws.
 */
export async function withSpan<T>(
  name: string,
  attrs: SpanAttrs,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  const tracer = trace.getTracer(TRACER_NAME);
  return tracer.startActiveSpan(name, async (span) => {
    try {
      for (const [key, value] of Object.entries(attrs)) {
        span.setAttribute(key, value);
      }
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      throw err;
    } finally {
      span.end();
    }
  });
}

/**
 * Return the active span on the current OTel context, or `undefined` if
 * no span is open. Use to add events or attributes from deep call sites
 * without threading the span through the signature.
 */
export function getCurrentSpan(): Span | undefined {
  return trace.getActiveSpan();
}
