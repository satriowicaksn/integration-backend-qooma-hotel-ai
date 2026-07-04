/**
 * Vendor-agnostic BSP ABI for outbound WhatsApp (ADR-0001 / Q-OPS-04).
 * `1engage` is the v1 adapter; swapping BSPs is a one-adapter change.
 * Credentials arrive already decrypted — the caller decrypts
 * `wa_configs.access_token_enc` via the crypto helper before dispatch.
 */
export interface BspCredentials {
  phoneNumberId: string;
  accessToken: string;
}

export interface SendTextInput {
  credentials: BspCredentials;
  to: string;
  body: string;
}

export interface SendTemplateInput {
  credentials: BspCredentials;
  to: string;
  templateName: string;
  languageCode: string;
  variables?: string[];
}

export interface BspSendResult {
  messageId: string;
}

export interface WhatsappBspPort {
  sendText(input: SendTextInput): Promise<BspSendResult>;
  sendTemplate(input: SendTemplateInput): Promise<BspSendResult>;
}
