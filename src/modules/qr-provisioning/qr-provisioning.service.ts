// QR provisioning orchestrator (spec §3.4 5-step pipeline). For each
// `regenerate` call: build the `wa.me` URL → validate URL length against
// the DDL `wa_link VARCHAR(500)` ceiling → render PNG via port → upload
// PNG via storage port → upsert `qr_state` row → return the shape the
// route layer surfaces to the FE.
//
// Error mapping (PM C ACK T22 binding #6):
// - URL too long → `ValidationError` (400)
// - Renderer / storage failure → `ExternalServiceError` (502/503, spec §9)
// - Missing state on `getForDownload` → `NotFoundError('qr_state', ...)`.

import { ExternalServiceError, NotFoundError, ValidationError } from '@core/errors/app-errors.js';
import type { Logger } from '@core/logger/logger.js';

import type { ObjectStoragePort } from './ports/object-storage.port.js';
import type { QrRendererPort } from './ports/qr-renderer.port.js';
import type { QrStateRepository } from './qr-provisioning.repository.js';
import type {
  QrDownloadDescriptor,
  QrRegenerateInput,
  QrRegenerateResult,
} from './qr-provisioning.types.js';
import { buildWaMeLink } from './qr-url-builder.js';

const WA_LINK_MAX_LENGTH = 500;
const RENDER_SIZE = 1024;

export interface QrServicePorts {
  readonly renderer: QrRendererPort;
  readonly storage: ObjectStoragePort;
}

export interface QrServiceClock {
  now(): Date;
}

const SYSTEM_CLOCK: QrServiceClock = { now: () => new Date() };

export class QrService {
  private readonly clock: QrServiceClock;

  constructor(
    private readonly repository: QrStateRepository,
    private readonly ports: QrServicePorts,
    private readonly logger: Logger,
    clock?: QrServiceClock,
  ) {
    this.clock = clock ?? SYSTEM_CLOCK;
  }

  async regenerate(input: QrRegenerateInput): Promise<QrRegenerateResult> {
    const waLink = buildWaMeLink({
      phoneNumber: input.phoneNumber,
      ...(input.greetingText !== undefined ? { greetingText: input.greetingText } : {}),
    });
    if (waLink.length > WA_LINK_MAX_LENGTH) {
      throw new ValidationError(
        `wa.me link exceeds ${WA_LINK_MAX_LENGTH} chars (got ${waLink.length})`,
        { hotelId: input.hotelId, length: waLink.length },
      );
    }

    const key = objectKeyForHotel(input.hotelId);
    let pngBytes: Buffer;
    try {
      pngBytes = await this.ports.renderer.render({ payload: waLink, size: RENDER_SIZE });
    } catch (err) {
      throw new ExternalServiceError('qr_renderer', errorMessage(err));
    }

    let location;
    try {
      location = await this.ports.storage.uploadPng({ key, bytes: pngBytes });
    } catch (err) {
      throw new ExternalServiceError('object_storage', errorMessage(err));
    }

    const generatedAt = this.clock.now();
    const domain = await this.repository.upsert({
      hotelId: input.hotelId,
      waLink,
      pngUrl: location.publicUrl,
      generatedAt,
    });

    this.logger.info({
      msg: 'qr_provisioning.regenerated',
      module: 'qr-provisioning',
      hotelId: input.hotelId,
      objectKey: key,
      waLinkLength: waLink.length,
      generatedAt: domain.generatedAt.toISOString(),
    });

    return {
      url: domain.waLink,
      pngUrl: domain.pngUrl,
      generatedAt: domain.generatedAt,
    };
  }

  async getForDownload(hotelId: string): Promise<QrDownloadDescriptor> {
    const domain = await this.repository.findByHotelId(hotelId);
    if (domain === null) {
      throw new NotFoundError('qr_state', hotelId);
    }
    return {
      hotelId: domain.hotelId,
      pngUrl: domain.pngUrl,
      generatedAt: domain.generatedAt,
    };
  }
}

/** Deterministic per-hotel key — spec §3.4 GAP #4 default: overwrite,
 *  no versioned history. */
export function objectKeyForHotel(hotelId: string): string {
  return `qr/${hotelId}.png`;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
