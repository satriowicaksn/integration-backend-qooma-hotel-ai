import { describe, expect, it } from '@jest/globals';

import {
  ClaudeApiHealthProbeStubAdapter,
  TelegramHealthProbeStubAdapter,
  WhatsappHealthProbeStubAdapter,
} from '../adapters/health-probe-stub.adapter.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';

describe('Health probe stubs', () => {
  it.each([
    ['WhatsappHealthProbeStubAdapter', () => new WhatsappHealthProbeStubAdapter()],
    ['TelegramHealthProbeStubAdapter', () => new TelegramHealthProbeStubAdapter()],
    ['ClaudeApiHealthProbeStubAdapter', () => new ClaudeApiHealthProbeStubAdapter()],
  ])('should return { ok: true, latencyMs: 100-299 } from %s', async (_name, factory) => {
    const adapter = factory();
    const result = await adapter.probe({ hotelId: HOTEL_ID });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.latencyMs).toBeGreaterThanOrEqual(100);
      expect(result.latencyMs).toBeLessThan(300);
    }
  });
});
