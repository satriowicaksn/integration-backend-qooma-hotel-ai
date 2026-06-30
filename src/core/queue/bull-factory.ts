/**
 * Bull queue factory dengan default config sesuai best practice.
 *
 * Convention queue naming:
 *   <module>:<job-type>   contoh: foo:process_async, journey:dispatch
 *
 * Convention job data:
 *   Carry minimal context (ID, correlation ID) — bukan full domain object.
 *   Service yang butuh data lengkap hydrate sendiri dari DB.
 */

// TODO(boilerplate): import Bull, setup factory dengan Redis connection, default
// removeOnComplete/removeOnFail, attempts + backoff.

export const queueFactory = {} as unknown as Record<string, unknown>; // placeholder
