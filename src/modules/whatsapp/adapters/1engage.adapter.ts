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
    const url = messagesUrl(credentials.phoneNumberId);
    // Dev-diagnostic pre-request stderr log (winston is no-op stub per Q-C-14,
    // so a direct stderr write gives immediate terminal visibility during
    // `make dev-api`). PII: access_token last-4 suffix only; body content
    // NOT included, only payload keys.
    /* eslint-disable-next-line no-console */
    console.error(
      `[BSP→Meta] POST ${url} | tokenLast4=${credentials.accessToken.slice(-4)} | payloadKeys=[${Object.keys(payload).join(',')}]`,
    );
    let res: { data: CloudApiSendResponse; status: number };
    try {
      res = await http.post<CloudApiSendResponse>(
        url,
        payload,
        requestOptions(credentials.accessToken),
      );
    } catch (err) {
      // Network / DNS / timeout error path (axios.validateStatus=()=>true
      // means we don't get here for HTTP status codes anymore).
      const message = err instanceof Error ? err.message : String(err);
      /* eslint-disable-next-line no-console */
      console.error(`[BSP←Meta] NETWORK ERROR: ${message}`);
      throw new ExternalServiceError(SERVICE, 'WhatsApp Cloud API request failed', {
        body: message,
      });
    }

    if (res.status < 200 || res.status >= 300) {
      // Non-2xx from Meta — res.data contains Meta's real error envelope:
      // { error: { message, type, code, error_subcode?, fbtrace_id, ... } }
      /* eslint-disable-next-line no-console */
      console.error(`[BSP←Meta] status=${res.status} body=${JSON.stringify(res.data)}`);
      throw new ExternalServiceError(SERVICE, `WhatsApp Cloud API returned ${res.status}`, {
        status: res.status,
        body: res.data,
      });
    }

    const messageId = res.data.messages?.[0]?.id;
    if (messageId === undefined || messageId === '') {
      /* eslint-disable-next-line no-console */
      console.error(
        `[BSP←Meta] status=${res.status} MISSING message_id body=${JSON.stringify(res.data)}`,
      );
      throw new ExternalServiceError(SERVICE, 'WhatsApp Cloud API response missing message id', {
        status: res.status,
        body: res.data,
      });
    }

    /* eslint-disable-next-line no-console */
    console.error(`[BSP←Meta] status=${res.status} messageId=${messageId}`);
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
