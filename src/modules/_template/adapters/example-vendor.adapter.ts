// Adapter = implementasi port konkret untuk 1 vendor / 1 strategi.
// Service tidak boleh import adapter langsung (ESLint enforce).

import type { ExampleExternalPort } from '../ports/example-external.port.js';

export class ExampleVendorAdapter implements ExampleExternalPort {
  // TODO(boilerplate): ganti dengan `private readonly httpClient: HttpClient, private readonly config: { baseUrl: string }`
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(_httpClient: any /* HttpClient */, _config: { baseUrl: string }) {}

  async notify(input: { id: string }): Promise<{ acknowledged: boolean }> {
    // TODO(qooma): const res = await this.httpClient.post(`${this.config.baseUrl}/notify`, { id: input.id });
    // return { acknowledged: res.status === 200 };
    input; // suppress
    return { acknowledged: false };
  }
}
