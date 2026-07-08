// MVP stub adapter for `ObjectStoragePort` (T22-followup PLAN GAP #1/#2).
// `@aws-sdk/client-s3` PO approval + Q-C-10 (bucket / region / URL
// contract) are pending — this stub keeps bytes in an in-memory
// `Map<key, Buffer>` and returns a synthetic HTTPS URL that the download
// route resolves back to the same map.
//
// Lifecycle: ephemeral per-process; lost on restart. Acceptable for
// composition testing. Swap this file for the real S3 adapter once
// Q-C-10 lands + the SDK is approved.

import { Readable } from 'node:stream';

import type { ObjectStoragePort } from '../ports/object-storage.port.js';
import type { ObjectStoreLocation } from '../qr-provisioning.types.js';

const STUB_BASE_URL = 'https://stub.qooma.local/qr';

export class ObjectStorageStubAdapter implements ObjectStoragePort {
  private readonly store = new Map<string, Buffer>();

  async uploadPng(input: { key: string; bytes: Buffer }): Promise<ObjectStoreLocation> {
    this.store.set(input.key, Buffer.from(input.bytes));
    return Promise.resolve({
      key: input.key,
      publicUrl: `${STUB_BASE_URL}/${encodeURIComponent(input.key)}`,
    });
  }

  async getPngStream(input: { key: string }): Promise<Readable | null> {
    const bytes = this.store.get(input.key);
    if (bytes === undefined) return Promise.resolve(null);
    return Promise.resolve(Readable.from(bytes));
  }
}
