// Domain types for T22 QR provisioning primitive (spec §3.4 + §4.3).
// Wire types (QrRegenerateRequestSchema + QrRegenerateResponseSchema)
// live in qr-provisioning.schema.ts (zod, source of truth).

export interface QrDomain {
  readonly hotelId: string;
  readonly waLink: string;
  readonly pngUrl: string;
  readonly generatedAt: Date;
}

/** Input consumed by `QrService.regenerate`. Route layer composes
 *  `phoneNumber` from `wa_configs` lookup (per PM C ACK T22 binding #5:
 *  primitive is decoupled from the WA-config module). */
export interface QrRegenerateInput {
  readonly hotelId: string;
  readonly phoneNumber: string;
  readonly greetingText?: string;
}

/** Result surfaced by the service on successful regenerate. Route layer
 *  maps to the wire response via QrRegenerateResponseSchema. */
export interface QrRegenerateResult {
  readonly url: string;
  readonly pngUrl: string;
  readonly generatedAt: Date;
}

/** Minimal shape returned by `ObjectStoragePort.uploadPng` (PM C ACK T22
 *  binding #3). Adapter-side implementations may extend with signed-URL
 *  TTL or CDN metadata later; primitive persists `publicUrl` as
 *  `qr_state.png_url`. */
export interface ObjectStoreLocation {
  readonly key: string;
  readonly publicUrl: string;
}

/** Payload returned by `QrService.getForDownload` — enough for the
 *  route-layer stream composer to fetch the PNG from storage. Service does
 *  NOT stream bytes itself (per PM C ACK binding: primitive has no HTTP
 *  surface). */
export interface QrDownloadDescriptor {
  readonly hotelId: string;
  readonly pngUrl: string;
  readonly generatedAt: Date;
}
