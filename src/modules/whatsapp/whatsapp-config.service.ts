/**
 * `wa_configs` service — GET (masked read) + upsert (encrypt-at-rest).
 *
 * Pure-helper imports (crypto + masking) are direct per ADR-0001 (no
 * wrap-on-wrap ctor-inject). The service constructor takes the repository and
 * a `Logger` — the logger is a boundary dep and must be swappable in tests to
 * assert the PII-floor log payload never leaks plaintext (CLAUDE §6, spec §4.1
 * encryption-at-rest, PM B binding condition #4).
 */

import { NotFoundError } from '@core/errors/app-errors.js';
import type { Logger } from '@core/logger/logger.js';

import { decrypt, encrypt } from '@shared/utils/crypto.js';
import { maskTokenForLog, maskWaPhone } from '@shared/utils/masking.js';

import type { WhatsappConfigRepository } from './whatsapp-config.repository.js';
import type {
  WhatsappBspVendor,
  WhatsappConfigDomain,
  WhatsappConfigUpsertInput,
} from './whatsapp-config.types.js';

const DEFAULT_BSP: WhatsappBspVendor = '1engage';
const RESOURCE = 'WaConfig';
const LOG_MODULE = 'whatsapp';
const LOG_UPSERT = 'whatsapp_config.upsert';
const LOG_GET = 'whatsapp_config.get';

interface WaConfigRow {
  readonly hotelId: string;
  readonly bsp: string;
  readonly phoneNumberId: string;
  readonly phoneNumber: string;
  readonly accessTokenEnc: string;
  readonly webhookUrl: string;
  readonly webhookVerifyToken: string;
  readonly verifiedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class WhatsappConfigService {
  constructor(
    private readonly repo: WhatsappConfigRepository,
    private readonly logger: Logger,
  ) {}

  async getForHotel(hotelId: string): Promise<WhatsappConfigDomain> {
    const row = await this.repo.findByHotelId(hotelId);
    if (row === null) {
      throw new NotFoundError(RESOURCE, hotelId);
    }
    this.logger.info({ msg: LOG_GET, module: LOG_MODULE, hotelId });
    return this.toDomain(row);
  }

  async upsertForHotel(
    hotelId: string,
    input: WhatsappConfigUpsertInput,
  ): Promise<WhatsappConfigDomain> {
    const bsp = input.bsp ?? DEFAULT_BSP;

    this.logger.info({
      msg: LOG_UPSERT,
      module: LOG_MODULE,
      hotelId,
      bsp,
      phoneNumberId: input.phoneNumberId,
      phoneNumber: maskWaPhone(input.phoneNumber),
      accessToken: maskTokenForLog(input.accessToken),
      webhookUrl: input.webhookUrl,
      webhookVerifyToken: maskTokenForLog(input.webhookVerifyToken),
    });

    const accessTokenEnc = encrypt(input.accessToken);

    const row = await this.repo.upsert(hotelId, {
      bsp,
      phoneNumberId: input.phoneNumberId,
      phoneNumber: input.phoneNumber,
      accessTokenEnc,
      webhookUrl: input.webhookUrl,
      webhookVerifyToken: input.webhookVerifyToken,
    });

    return this.toDomain(row);
  }

  private toDomain(row: WaConfigRow): WhatsappConfigDomain {
    const plaintextAccessToken = decrypt(row.accessTokenEnc);
    return {
      hotelId: row.hotelId,
      bsp: row.bsp as WhatsappBspVendor,
      phoneNumberId: row.phoneNumberId,
      phoneNumber: row.phoneNumber,
      accessToken: maskTokenForLog(plaintextAccessToken),
      webhookUrl: row.webhookUrl,
      webhookVerifyToken: maskTokenForLog(row.webhookVerifyToken),
      verifiedAt: row.verifiedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
