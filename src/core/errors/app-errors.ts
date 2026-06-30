/**
 * AppError hierarchy.
 *
 * Service WAJIB throw AppError subclass (BUKAN raw Error).
 * Plugin error-handler translate ke HTTP response berdasarkan instance.
 *
 * Convention: error code SCREAMING_SNAKE_CASE, message human-readable.
 */

export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: string;
  readonly details: Record<string, unknown>;

  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = this.constructor.name;
    this.details = details;
    Error.captureStackTrace?.(this, this.constructor);
  }

  toJson(): { code: string; message: string; details: Record<string, unknown> } {
    return { code: this.code, message: this.message, details: this.details };
  }
}

export class ValidationError extends AppError {
  readonly statusCode = 400;
  readonly code = 'VALIDATION_ERROR';
}

export class AuthError extends AppError {
  readonly statusCode = 401;
  readonly code = 'AUTH_ERROR';
}

export class ForbiddenError extends AppError {
  readonly statusCode = 403;
  readonly code = 'FORBIDDEN';
}

export class NotFoundError extends AppError {
  readonly statusCode = 404;
  readonly code = 'NOT_FOUND';

  constructor(resource: string, id?: string) {
    super(`${resource} not found${id ? `: ${id}` : ''}`, { resource, id });
  }
}

export class ConflictError extends AppError {
  readonly statusCode = 409;
  readonly code = 'CONFLICT';
}

export class RateLimitError extends AppError {
  readonly statusCode = 429;
  readonly code = 'RATE_LIMIT_EXCEEDED';
}

export class ExternalServiceError extends AppError {
  readonly statusCode = 502;
  readonly code = 'EXTERNAL_SERVICE_ERROR';

  constructor(
    service: string,
    message: string,
    public readonly upstream?: { status?: number; body?: unknown },
  ) {
    super(`${service}: ${message}`, { service, upstream });
  }
}

/**
 * TenantError — khusus pelanggaran multi-tenancy guard.
 * Critical: log + alert Sentry sebagai security event.
 */
export class TenantError extends AppError {
  readonly statusCode = 500;
  readonly code = 'TENANT_VIOLATION';
}

export class BillingRequiredError extends AppError {
  readonly statusCode = 402;
  readonly code = 'BILLING_REQUIRED';
}
