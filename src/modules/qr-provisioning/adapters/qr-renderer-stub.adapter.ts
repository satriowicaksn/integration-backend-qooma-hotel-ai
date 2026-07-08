// MVP stub adapter for `QrRendererPort` (T22-followup PLAN GAP #1).
// `qrcode` PO approval is pending — this stub returns a fixed 1×1
// transparent PNG so downstream storage + response shape are valid.
//
// Swap this file for the real qrcode-library adapter once the package
// lands.

import type { QrRendererPort, QrRenderRequest } from '../ports/qr-renderer.port.js';

/** 1×1 transparent PNG bytes — the smallest valid PNG payload. */
const PLACEHOLDER_PNG = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d494441545801630060000000000005000155a3d17d0000000049454e44ae426082',
  'hex',
);

export class QrRendererStubAdapter implements QrRendererPort {
  async render(_input: QrRenderRequest): Promise<Buffer> {
    return Promise.resolve(PLACEHOLDER_PNG);
  }
}
