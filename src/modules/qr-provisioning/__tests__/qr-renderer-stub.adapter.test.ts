import { describe, expect, it } from '@jest/globals';

import { QrRendererStubAdapter } from '../adapters/qr-renderer-stub.adapter.js';

describe('QrRendererStubAdapter', () => {
  it('should return a Buffer of a valid PNG (starts with the PNG magic signature)', async () => {
    const adapter = new QrRendererStubAdapter();
    const bytes = await adapter.render({ payload: 'https://wa.me/62800001111', size: 1024 });
    expect(Buffer.isBuffer(bytes)).toBe(true);
    expect(bytes.length).toBeGreaterThan(0);
    // PNG magic number: 89 50 4E 47 0D 0A 1A 0A
    expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  });

  it('should return the same placeholder regardless of payload / size', async () => {
    const adapter = new QrRendererStubAdapter();
    const first = await adapter.render({ payload: 'a', size: 1024 });
    const second = await adapter.render({ payload: 'b', size: 1024 });
    expect(first).toEqual(second);
  });
});
