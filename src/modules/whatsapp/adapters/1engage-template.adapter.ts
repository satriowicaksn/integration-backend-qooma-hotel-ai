/**
 * `1engage` BSP adapter for template CRUD — implements
 * `WhatsappTemplateManagementPort` against Meta's `/{waba_id}/message_templates`
 * surface via the 1engage gateway. Sibling to T06's `1engage.adapter.ts`
 * (message dispatch on `/messages`); T06 is preserved byte-for-byte.
 *
 * **`HttpPoster` narrow interface** is re-declared inline (matches T06
 * precedent at `1engage.adapter.ts:19-21`) so this adapter does NOT depend on
 * the still-stubbed `core/http/http-client.ts` — Q-C-02 wiring concern.
 *
 * **Resubmit strategy — PATCH-preferred with DELETE+POST fallback** (per PM B
 * ACK binding condition #14):
 *  1. Try `PATCH /{waba_id}/message_templates/{meta_template_id}` first —
 *     Meta added editing for `IN_REVIEW` / `REJECTED` templates in 2023,
 *     which is the modern preferred path. If Meta returns 2xx, we return
 *     directly.
 *  2. On non-2xx (Meta rejects with e.g. "template not editable in state
 *     APPROVED"), or on network error at the PATCH call, fall back to
 *     `DELETE /{waba_id}/message_templates/{meta_template_id}` then
 *     `POST /{waba_id}/message_templates` with the full payload — matches
 *     spec §3.1 "relay resubmit after edit" intent.
 *
 * Upstream failure translation — every non-2xx or thrown network error →
 * `ExternalServiceError` with `service: '1engage-template'` (disambiguates
 * from T06's `'1engage'` in log grep).
 */

import { ExternalServiceError } from '@core/errors/app-errors.js';

import type { WhatsappTemplateManagementPort } from '../ports/whatsapp-template-management.port.js';
import type {
  ResubmitTemplateInput,
  SubmitTemplateInput,
  TemplateManagementResult,
  WaTemplateStatus,
} from '../whatsapp-template.types.js';

export interface HttpPoster {
  post<T>(url: string, body?: unknown, opts?: unknown): Promise<{ data: T; status: number }>;
  patch<T>(url: string, body?: unknown, opts?: unknown): Promise<{ data: T; status: number }>;
  delete<T>(url: string, opts?: unknown): Promise<{ data: T; status: number }>;
}

export interface OneEngageTemplateConfig {
  baseUrl: string;
  apiVersion: string;
}

export interface OneEngageTemplateAdapterDeps {
  http: HttpPoster;
  config: OneEngageTemplateConfig;
}

const SERVICE = '1engage-template';

interface MessageTemplatesResponse {
  id?: string;
  status?: string;
}

const META_STATUS_ALIASES: Record<string, WaTemplateStatus> = {
  PENDING: 'IN_REVIEW',
  IN_REVIEW: 'IN_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  PAUSED: 'PAUSED',
  DISABLED: 'DISABLED',
};

function normalizeStatus(raw: string | undefined): WaTemplateStatus {
  if (raw !== undefined && raw in META_STATUS_ALIASES) {
    return META_STATUS_ALIASES[raw] as WaTemplateStatus;
  }
  return 'IN_REVIEW';
}

export function create1engageTemplateAdapter(
  deps: OneEngageTemplateAdapterDeps,
): WhatsappTemplateManagementPort {
  const { http, config } = deps;

  function collectionUrl(wabaId: string): string {
    return `${config.baseUrl}/${config.apiVersion}/${wabaId}/message_templates`;
  }

  function itemUrl(wabaId: string, metaTemplateId: string): string {
    return `${collectionUrl(wabaId)}/${metaTemplateId}`;
  }

  function requestOptions(accessToken: string): { headers: Record<string, string> } {
    return {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    };
  }

  function buildTemplatePayload(input: SubmitTemplateInput): Record<string, unknown> {
    return {
      name: input.name,
      category: input.category,
      language: input.language,
      components: input.components,
    };
  }

  function parseResult(
    res: { data: MessageTemplatesResponse; status: number },
    verb: string,
  ): TemplateManagementResult {
    if (res.status < 200 || res.status >= 300) {
      throw new ExternalServiceError(
        SERVICE,
        `Meta message_templates ${verb} returned ${res.status}`,
        {
          status: res.status,
          body: res.data,
        },
      );
    }
    const metaTemplateId = res.data.id;
    if (metaTemplateId === undefined || metaTemplateId === '') {
      throw new ExternalServiceError(
        SERVICE,
        `Meta message_templates ${verb} response missing template id`,
        { status: res.status, body: res.data },
      );
    }
    return { metaTemplateId, status: normalizeStatus(res.data.status) };
  }

  async function submitTemplate(input: SubmitTemplateInput): Promise<TemplateManagementResult> {
    let res: { data: MessageTemplatesResponse; status: number };
    try {
      res = await http.post<MessageTemplatesResponse>(
        collectionUrl(input.wabaId),
        buildTemplatePayload(input),
        requestOptions(input.accessToken),
      );
    } catch (err) {
      throw new ExternalServiceError(SERVICE, 'Meta message_templates POST failed', {
        body: err instanceof Error ? err.message : String(err),
      });
    }
    return parseResult(res, 'POST');
  }

  async function tryPatch(input: ResubmitTemplateInput): Promise<TemplateManagementResult | null> {
    let res: { data: MessageTemplatesResponse; status: number };
    try {
      res = await http.patch<MessageTemplatesResponse>(
        itemUrl(input.wabaId, input.metaTemplateId),
        buildTemplatePayload(input),
        requestOptions(input.accessToken),
      );
    } catch {
      return null;
    }
    if (res.status < 200 || res.status >= 300) {
      return null;
    }
    return parseResult(res, 'PATCH');
  }

  async function deleteThenPost(input: ResubmitTemplateInput): Promise<TemplateManagementResult> {
    try {
      await http.delete<MessageTemplatesResponse>(
        itemUrl(input.wabaId, input.metaTemplateId),
        requestOptions(input.accessToken),
      );
    } catch (err) {
      throw new ExternalServiceError(SERVICE, 'Meta message_templates DELETE failed', {
        body: err instanceof Error ? err.message : String(err),
      });
    }
    return submitTemplate(input);
  }

  async function resubmitTemplate(input: ResubmitTemplateInput): Promise<TemplateManagementResult> {
    const patched = await tryPatch(input);
    if (patched !== null) {
      return patched;
    }
    return deleteThenPost(input);
  }

  return { submitTemplate, resubmitTemplate };
}
