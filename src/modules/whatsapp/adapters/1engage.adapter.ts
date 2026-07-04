/**
 * `1engage` BSP adapter — implements WhatsappBspPort against the WhatsApp Cloud
 * API (Meta Graph) shape 1engage proxies. Endpoint (`baseUrl`/`apiVersion`) is
 * injected so it targets 1engage's gateway; HTTP goes through an injected narrow
 * `HttpPoster` (mockable, no direct axios). Upstream failures →
 * `ExternalServiceError` for Sentry.
 */

import { ExternalServiceError } from '@core/errors/app-errors.js';

import type {
  BspCredentials,
  BspSendResult,
  SendTemplateInput,
  SendTextInput,
  WhatsappBspPort,
} from '../ports/whatsapp-bsp.port.js';

export interface HttpPoster {
  post<T>(url: string, body?: unknown, opts?: unknown): Promise<{ data: T; status: number }>;
}

export interface OneEngageConfig {
  baseUrl: string;
  apiVersion: string;
}

export interface OneEngageAdapterDeps {
  http: HttpPoster;
  config: OneEngageConfig;
}

const SERVICE = '1engage';

interface CloudApiSendResponse {
  messages?: Array<{ id?: string }>;
}

export function create1engageAdapter(deps: OneEngageAdapterDeps): WhatsappBspPort {
  const { http, config } = deps;

  function messagesUrl(phoneNumberId: string): string {
    return `${config.baseUrl}/${config.apiVersion}/${phoneNumberId}/messages`;
  }

  function requestOptions(accessToken: string): { headers: Record<string, string> } {
    return {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    };
  }

  async function dispatch(
    credentials: BspCredentials,
    payload: Record<string, unknown>,
  ): Promise<BspSendResult> {
    let res: { data: CloudApiSendResponse; status: number };
    try {
      res = await http.post<CloudApiSendResponse>(
        messagesUrl(credentials.phoneNumberId),
        payload,
        requestOptions(credentials.accessToken),
      );
    } catch (err) {
      throw new ExternalServiceError(SERVICE, 'WhatsApp Cloud API request failed', {
        body: err instanceof Error ? err.message : String(err),
      });
    }

    if (res.status < 200 || res.status >= 300) {
      throw new ExternalServiceError(SERVICE, `WhatsApp Cloud API returned ${res.status}`, {
        status: res.status,
        body: res.data,
      });
    }

    const messageId = res.data.messages?.[0]?.id;
    if (messageId === undefined || messageId === '') {
      throw new ExternalServiceError(SERVICE, 'WhatsApp Cloud API response missing message id', {
        status: res.status,
        body: res.data,
      });
    }

    return { messageId };
  }

  return {
    sendText(input: SendTextInput): Promise<BspSendResult> {
      return dispatch(input.credentials, {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: input.to,
        type: 'text',
        text: { body: input.body },
      });
    },

    sendTemplate(input: SendTemplateInput): Promise<BspSendResult> {
      const hasVariables = input.variables !== undefined && input.variables.length > 0;
      const template: Record<string, unknown> = {
        name: input.templateName,
        language: { code: input.languageCode },
      };
      if (hasVariables) {
        template.components = [
          {
            type: 'body',
            parameters: (input.variables ?? []).map((value) => ({ type: 'text', text: value })),
          },
        ];
      }
      return dispatch(input.credentials, {
        messaging_product: 'whatsapp',
        to: input.to,
        type: 'template',
        template,
      });
    },
  };
}
