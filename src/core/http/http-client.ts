/**
 * Wrapper axios untuk external HTTP call.
 *
 * Fitur:
 * - Default timeout 10s
 * - Retry 2x dengan exponential backoff (untuk GET, idempotent POST)
 * - Logging: external_call event dengan duration_ms + status
 * - Correlation ID propagation (X-Correlation-Id header)
 * - Translate axios error → ExternalServiceError
 *
 * Adapter port pakai HttpClient ini, BUKAN axios langsung.
 */

// TODO(qooma): import axios, implementasi class dengan instance per service.

export class HttpClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async get<T = any>(_url: string, _opts?: unknown): Promise<{ data: T; status: number }> {
    throw new Error('HttpClient not implemented');
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async post<T = any>(
    _url: string,
    _body?: unknown,
    _opts?: unknown,
  ): Promise<{ data: T; status: number }> {
    throw new Error('HttpClient not implemented');
  }
}
