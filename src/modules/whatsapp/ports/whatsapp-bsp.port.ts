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
