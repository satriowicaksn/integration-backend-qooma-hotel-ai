// Barrel — per PM C ACK T22 binding #7: export types + service + repository +
// port types + `ObjectStoreLocation` (adapter-facing) + `objectKeyForHotel`
// helper (route-layer stream composer needs the same key contract).
// Do NOT export `buildWaMeLink` (pure module-private helper).

export type {
  ObjectStoreLocation,
  QrDomain,
  QrDownloadDescriptor,
  QrRegenerateInput,
  QrRegenerateResult,
} from './qr-provisioning.types.js';

export type { QrRegenerateRequestDto, QrRegenerateResponseDto } from './qr-provisioning.schema.ts';

export { QrRegenerateRequestSchema, QrRegenerateResponseSchema } from './qr-provisioning.schema.js';

export { QrStateRepository } from './qr-provisioning.repository.js';
export type { QrUpsertInput } from './qr-provisioning.repository.js';

export { QrService, objectKeyForHotel } from './qr-provisioning.service.js';
export type { QrServiceClock, QrServicePorts } from './qr-provisioning.service.js';

export type { QrRendererPort, QrRenderRequest } from './ports/qr-renderer.port.js';
export type { ObjectStoragePort } from './ports/object-storage.port.js';
