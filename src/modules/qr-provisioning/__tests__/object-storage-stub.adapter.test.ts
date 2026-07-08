import { describe, expect, it } from '@jest/globals';

import { ObjectStorageStubAdapter } from '../adapters/object-storage-stub.adapter.js';

describe('ObjectStorageStubAdapter', () => {
  it('should return { key, publicUrl } with the URL encoding the key on upload', async () => {
    const adapter = new ObjectStorageStubAdapter();
    const bytes = Buffer.from([1, 2, 3]);
    const result = await adapter.uploadPng({ key: 'qr/hotel-1.png', bytes });
    expect(result.key).toBe('qr/hotel-1.png');
    expect(result.publicUrl.startsWith('https://')).toBe(true);
    expect(result.publicUrl).toContain(encodeURIComponent('qr/hotel-1.png'));
  });

  it('should round-trip bytes: upload then download returns the same content', async () => {
    const adapter = new ObjectStorageStubAdapter();
    const bytes = Buffer.from([9, 8, 7, 6]);
    await adapter.uploadPng({ key: 'qr/hotel-2.png', bytes });
    const stream = await adapter.getPngStream({ key: 'qr/hotel-2.png' });
    expect(stream).not.toBeNull();
    if (stream === null) throw new Error('unreachable');
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
      chunks.push(buf);
    }
    const joined: Buffer = Buffer.concat(chunks as ReadonlyArray<Uint8Array>);
    expect(joined.equals(bytes)).toBe(true);
  });

  it('should return null when downloading an unknown key', async () => {
    const adapter = new ObjectStorageStubAdapter();
    const stream = await adapter.getPngStream({ key: 'qr/missing.png' });
    expect(stream).toBeNull();
  });
});
