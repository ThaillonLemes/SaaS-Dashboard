import { createHash } from 'node:crypto';

import pino, { type DestinationStream, type LoggerOptions } from 'pino';

/**
 * Structured fields attached to a log record. Tenant context propagation
 * is encouraged via `tenantId` / `userId` per protocols/TENANT.md.
 *
 * INVARIANT: callers that pass an `email` field have its value SHA-256
 * hashed before serialization — raw email values never appear in output.
 */
export interface LogFields {
  readonly tenantId?: string;
  readonly userId?: string;
  readonly email?: string;
  readonly [key: string]: unknown;
}

/**
 * Newline-delimited JSON logger. Every method emits exactly one record
 * (`packageName`, `level`, `time`, `message`, plus user fields) to the
 * configured destination stream.
 */
export interface Logger {
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
  debug(message: string, fields?: LogFields): void;
}

/** Optional construction parameters for `createLogger`. */
export interface CreateLoggerOptions {
  readonly destination?: DestinationStream;
  readonly level?: 'debug' | 'info' | 'warn' | 'error';
}

const PII_HASH_PREFIX = 'sha256:';
const PII_HASH_BYTES = 12;

/**
 * Build a `Logger` bound to the given package name. Output is
 * newline-delimited JSON with `packageName`, `level`, `time` (ISO),
 * `message`, and the caller's structured fields.
 *
 * INVARIANT: PII fields (`email`) are SHA-256 hashed before serialization,
 * recursively across nested objects. Consumers do not need to redact
 * before calling.
 */
export function createLogger(
  packageName: string,
  options?: CreateLoggerOptions,
): Logger {
  const pinoOptions: LoggerOptions = {
    base: { packageName },
    messageKey: 'message',
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level(label) {
        return { level: label };
      },
      log(record) {
        return redactPii(record);
      },
    },
    ...(options?.level !== undefined ? { level: options.level } : {}),
  };

  const pinoLogger =
    options?.destination !== undefined
      ? pino(pinoOptions, options.destination)
      : pino(pinoOptions);

  return {
    info(msg, fields) {
      pinoLogger.info(fields ?? {}, msg);
    },
    warn(msg, fields) {
      pinoLogger.warn(fields ?? {}, msg);
    },
    error(msg, fields) {
      pinoLogger.error(fields ?? {}, msg);
    },
    debug(msg, fields) {
      pinoLogger.debug(fields ?? {}, msg);
    },
  };
}

function redactPii(
  record: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (key === 'email' && typeof value === 'string') {
      out[key] = hashPii(value);
    } else if (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value)
    ) {
      out[key] = redactPii(value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function hashPii(input: string): string {
  return `${PII_HASH_PREFIX}${createHash('sha256').update(input).digest('hex').slice(0, PII_HASH_BYTES)}`;
}
