/**
 * Domain types for the `wa_configs` primitive (spec 04-integration-channels §4.1).
 *
 * `WhatsappConfigDomain` is the read-side projection returned by
 * `WhatsappConfigService.getForHotel` — sensitive fields (`accessToken`,
 * `webhookVerifyToken`) arrive already masked via `maskTokenForLog`, never
 * plaintext. `WhatsappConfigUpsertInput` is the write-side plaintext-token DTO
 * accepted by `upsertForHotel`; the service encrypts before persisting.
 */

export type WhatsappBspVendor = '1engage';

export interface WhatsappConfigDomain {
  readonly hotelId: string;
  readonly bsp: WhatsappBspVendor;
  readonly phoneNumberId: string;
  readonly phoneNumber: string;
  readonly accessToken: string;
  readonly webhookUrl: string;
  readonly webhookVerifyToken: string;
  readonly verifiedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface WhatsappConfigUpsertInput {
  readonly bsp?: WhatsappBspVendor;
  readonly phoneNumberId: string;
  readonly phoneNumber: string;
  readonly accessToken: string;
  readonly wabaId?: string | undefined;
  readonly webhookUrl?: string | undefined;
  readonly webhookVerifyToken?: string | undefined;
}

export interface WhatsappConfigPersistenceInput {
  readonly bsp: WhatsappBspVendor;
  readonly phoneNumberId: string;
  readonly phoneNumber: string;
  readonly accessTokenEnc: string;
  readonly wabaId?: string | undefined;
  readonly webhookUrl?: string | undefined;
  readonly webhookVerifyToken?: string | undefined;
}
