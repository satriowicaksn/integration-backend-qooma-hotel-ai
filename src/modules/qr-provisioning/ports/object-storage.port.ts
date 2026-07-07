// Uploads a QR PNG to object storage and hands back a public URL that the
// route layer stores in `qr_state.png_url` (spec §3.4 step 3). Also
// exposes a download-stream fetch for `GET /qr/download`.
//
// TYPE-ONLY per PM C ACK T22 binding #3. Adapter (S3-compatible SDK)
// deferred to T22-followup pending Q-C-10 (bucket naming, region,
// retention, public-vs-signed URL, CDN convention) + PO approval on
// `pnpm add @aws-sdk/client-s3`.
//
// Object key strategy: single deterministic key `qr/{hotelId}.png` per
// hotel, overwritten on each regenerate (PM C ACK T22 GAP #4 default).

import type { Readable } from 'node:stream';

import type { ObjectStoreLocation } from '../qr-provisioning.types.js';

export interface ObjectStoragePort {
  uploadPng(input: { key: string; bytes: Buffer }): Promise<ObjectStoreLocation>;
  getPngStream(input: { key: string }): Promise<Readable | null>;
}
