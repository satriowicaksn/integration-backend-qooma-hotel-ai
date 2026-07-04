/**
 * Fastify error handler → canonical error envelope.
 *
 * Envelope shape (docs/spec/README.md §2.3, every service/endpoint):
 *   `{ "error": { code, message, details } }`
 *
 * - `AppError` → `err.statusCode` + `{ error: err.toJson() }` (the code/details
 *   the frontend keys off).
 * - Any other error → 500 `INTERNAL` with a generic body — the internal message
 *   and stack are NEVER sent to the client, only logged.
 *
 * Errors are logged via `req.log` with the correlation id (CLAUDE §7); the
 * request body is not logged here, so no secret/PII leaks into logs.
 */

import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { AppError } from '@core/errors/app-errors.js';

const CORRELATION_HEADER = 'x-correlation-id';

function correlationIdOf(req: FastifyRequest): string {
  const header = req.headers[CORRELATION_HEADER];
  const value = Array.isArray(header) ? header[0] : header;
  return value ?? req.id;
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, req: FastifyRequest, reply: FastifyReply) => {
    const correlationId = correlationIdOf(req);

    if (error instanceof AppError) {
      req.log.warn({ correlationId, code: error.code, statusCode: error.statusCode }, 'app_error');
      void reply.code(error.statusCode).send({ error: error.toJson() });
      return;
    }

    req.log.error({ correlationId, err: error }, 'unhandled_error');
    void reply.code(500).send({
      error: {
        code: 'INTERNAL',
        message: 'Internal server error',
        details: { correlationId },
      },
    });
  });
}
