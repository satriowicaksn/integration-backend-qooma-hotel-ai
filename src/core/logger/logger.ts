/**
 * Structured logger via winston.
 *
 * Convention: setiap log line wajib punya correlationId (per request).
 * Sensitive fields auto-redact via format.
 *
 * Usage:
 *   import { createLogger } from '@core/logger/logger.js';
 *   const logger = createLogger({ service: 'api', level: 'info' });
 *   logger.info({ correlationId, msg: 'foo.created', fooId });
 */

// TODO(boilerplate): install winston, implementasi factory dengan:
// - JSON format di production
// - Pretty print di development
// - Redact paths: **/password, **/token, **/apiKey, **/wa_phone (mask), **/email (mask)
// - Default meta: service, version, env

export type LoggerOptions = {
  service: string;
  level?: 'debug' | 'info' | 'warn' | 'error';
};

export type Logger = {
  debug: (obj: Record<string, unknown> | string) => void;
  info: (obj: Record<string, unknown> | string) => void;
  warn: (obj: Record<string, unknown> | string) => void;
  error: (obj: Record<string, unknown> | string) => void;
};

export function createLogger(_opts: LoggerOptions): Logger {
  // TODO(boilerplate): return winston.createLogger({ ... })
  return {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  };
}
