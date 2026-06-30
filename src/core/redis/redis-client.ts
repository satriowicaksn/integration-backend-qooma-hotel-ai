/**
 * Redis client (ioredis) singleton.
 *
 * Key namespacing convention:
 *   <module>:<purpose>:<key>     contoh: foo:cache:user-123, auth:rate:login
 *
 * Hindari kunci tanpa namespace — risk collision antar modul.
 */

// TODO(boilerplate): import Redis from 'ioredis'; setup connection dari config.

export const redisClient = {} as unknown as Record<string, unknown>; // placeholder
