/**
 * `1engage-template` adapter tests — asserts:
 *  - URL structure `/{waba_id}/message_templates` (distinct from T06's
 *    `/{phone_number_id}/messages` surface — binding condition #11).
 *  - `ExternalServiceError` with `service: '1engage-template'` on failure
 *    (binding condition #12).
 *  - PATCH-preferred resubmit with DELETE+POST fallback (binding #14).
 */

import { describe, expect, it, jest } from '@jest/globals';

import { ExternalServiceError } from '@core/errors/app-errors.js';

import {
  create1engageTemplateAdapter,
  type HttpPoster,
} from '../adapters/1engage-template.adapter.js';

const CONFIG = { baseUrl: 'https://graph.facebook.com', apiVersion: 'v18.0' };

const SUBMIT_INPUT = {
  wabaId: '9876543210',
  accessToken: 'plain-token',
  name: 'booking_confirmed',
  category: 'UTILITY' as const,
  language: 'en_US',
  components: [{ type: 'BODY' as const, text: 'Hello {{1}}' }],
};

const RESUBMIT_INPUT = { ...SUBMIT_INPUT, metaTemplateId: 'meta_tpl_abc123' };

const COLLECTION_URL = 'https://graph.facebook.com/v18.0/9876543210/message_templates';
const ITEM_URL = `${COLLECTION_URL}/meta_tpl_abc123`;
const AUTH_OPTS = {
  headers: { Authorization: 'Bearer plain-token', 'Content-Type': 'application/json' },
};

function noopPost(): jest.Mock {
  return jest.fn(() => Promise.resolve({ data: {}, status: 200 }));
}
function noopPatch(): jest.Mock {
  return jest.fn(() => Promise.resolve({ data: {}, status: 200 }));
}
function noopDelete(): jest.Mock {
  return jest.fn(() => Promise.resolve({ data: {}, status: 200 }));
}

function buildAdapter(
  overrides: Partial<{ post: jest.Mock; patch: jest.Mock; delete: jest.Mock }>,
) {
  const post = overrides.post ?? noopPost();
  const patch = overrides.patch ?? noopPatch();
  const del = overrides.delete ?? noopDelete();
  const http = { post, patch, delete: del } as unknown as HttpPoster;
  return {
    adapter: create1engageTemplateAdapter({ http, config: CONFIG }),
    post,
    patch,
    delete: del,
  };
}

describe('create1engageTemplateAdapter.submitTemplate', () => {
  it('should POST to /{waba_id}/message_templates and return the parsed result', async () => {
    const post = jest.fn(() =>
      Promise.resolve({ data: { id: 'meta_tpl_abc123', status: 'PENDING' }, status: 200 }),
    );
    const { adapter } = buildAdapter({ post });

    const result = await adapter.submitTemplate(SUBMIT_INPUT);

    expect(result).toEqual({ metaTemplateId: 'meta_tpl_abc123', status: 'IN_REVIEW' });
    expect(post).toHaveBeenCalledWith(
      COLLECTION_URL,
      {
        name: SUBMIT_INPUT.name,
        category: SUBMIT_INPUT.category,
        language: SUBMIT_INPUT.language,
        components: SUBMIT_INPUT.components,
      },
      AUTH_OPTS,
    );
  });

  it('should normalize an APPROVED Meta status directly', async () => {
    const post = jest.fn(() =>
      Promise.resolve({ data: { id: 'meta_tpl_abc123', status: 'APPROVED' }, status: 200 }),
    );
    const { adapter } = buildAdapter({ post });

    const result = await adapter.submitTemplate(SUBMIT_INPUT);

    expect(result.status).toBe('APPROVED');
  });

  it('should default to IN_REVIEW when Meta omits the status field', async () => {
    const post = jest.fn(() => Promise.resolve({ data: { id: 'meta_tpl_abc123' }, status: 200 }));
    const { adapter } = buildAdapter({ post });

    const result = await adapter.submitTemplate(SUBMIT_INPUT);

    expect(result.status).toBe('IN_REVIEW');
  });

  it('should throw ExternalServiceError on a non-2xx submit status', async () => {
    const post = jest.fn(() =>
      Promise.resolve({ data: { error: 'invalid category' }, status: 400 }),
    );
    const { adapter } = buildAdapter({ post });

    await expect(adapter.submitTemplate(SUBMIT_INPUT)).rejects.toMatchObject({
      code: 'EXTERNAL_SERVICE_ERROR',
    });
  });

  it('should throw ExternalServiceError when the submit response has no template id', async () => {
    const post = jest.fn(() => Promise.resolve({ data: { status: 'PENDING' }, status: 200 }));
    const { adapter } = buildAdapter({ post });

    await expect(adapter.submitTemplate(SUBMIT_INPUT)).rejects.toBeInstanceOf(ExternalServiceError);
  });

  it('should throw ExternalServiceError when the submit response has an empty template id', async () => {
    const post = jest.fn(() =>
      Promise.resolve({ data: { id: '', status: 'PENDING' }, status: 200 }),
    );
    const { adapter } = buildAdapter({ post });

    await expect(adapter.submitTemplate(SUBMIT_INPUT)).rejects.toBeInstanceOf(ExternalServiceError);
  });

  it('should throw ExternalServiceError when the http call rejects with an Error', async () => {
    const post = jest.fn(() => Promise.reject(new Error('network down')));
    const { adapter } = buildAdapter({ post });

    await expect(adapter.submitTemplate(SUBMIT_INPUT)).rejects.toBeInstanceOf(ExternalServiceError);
  });

  it('should wrap a non-Error http rejection as ExternalServiceError', async () => {
    const post = jest.fn(() => Promise.reject('boom'));
    const { adapter } = buildAdapter({ post });

    await expect(adapter.submitTemplate(SUBMIT_INPUT)).rejects.toBeInstanceOf(ExternalServiceError);
  });
});

describe('create1engageTemplateAdapter.resubmitTemplate — PATCH branch', () => {
  it('should PATCH /{waba_id}/message_templates/{id} first and return its result', async () => {
    const patch = jest.fn(() =>
      Promise.resolve({ data: { id: 'meta_tpl_abc123', status: 'PENDING' }, status: 200 }),
    );
    const del = noopDelete();
    const post = noopPost();
    const { adapter } = buildAdapter({ patch, delete: del, post });

    const result = await adapter.resubmitTemplate(RESUBMIT_INPUT);

    expect(result).toEqual({ metaTemplateId: 'meta_tpl_abc123', status: 'IN_REVIEW' });
    expect(patch).toHaveBeenCalledWith(
      ITEM_URL,
      {
        name: RESUBMIT_INPUT.name,
        category: RESUBMIT_INPUT.category,
        language: RESUBMIT_INPUT.language,
        components: RESUBMIT_INPUT.components,
      },
      AUTH_OPTS,
    );
    expect(del).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });
});

describe('create1engageTemplateAdapter.resubmitTemplate — DELETE+POST fallback', () => {
  it('should fall back to DELETE+POST when the PATCH returns non-2xx', async () => {
    const patch = jest.fn(() => Promise.resolve({ data: { error: 'not editable' }, status: 409 }));
    const del = jest.fn(() => Promise.resolve({ data: { success: true }, status: 200 }));
    const post = jest.fn(() =>
      Promise.resolve({ data: { id: 'meta_tpl_new456', status: 'PENDING' }, status: 200 }),
    );
    const { adapter } = buildAdapter({ patch, delete: del, post });

    const result = await adapter.resubmitTemplate(RESUBMIT_INPUT);

    expect(result).toEqual({ metaTemplateId: 'meta_tpl_new456', status: 'IN_REVIEW' });
    expect(patch).toHaveBeenCalledTimes(1);
    expect(del).toHaveBeenCalledWith(ITEM_URL, AUTH_OPTS);
    expect(post).toHaveBeenCalledWith(
      COLLECTION_URL,
      {
        name: RESUBMIT_INPUT.name,
        category: RESUBMIT_INPUT.category,
        language: RESUBMIT_INPUT.language,
        components: RESUBMIT_INPUT.components,
      },
      AUTH_OPTS,
    );
  });

  it('should fall back to DELETE+POST when the PATCH http call rejects', async () => {
    const patch = jest.fn(() => Promise.reject(new Error('patch network down')));
    const del = jest.fn(() => Promise.resolve({ data: { success: true }, status: 200 }));
    const post = jest.fn(() =>
      Promise.resolve({ data: { id: 'meta_tpl_new456', status: 'APPROVED' }, status: 200 }),
    );
    const { adapter } = buildAdapter({ patch, delete: del, post });

    const result = await adapter.resubmitTemplate(RESUBMIT_INPUT);

    expect(result.metaTemplateId).toBe('meta_tpl_new456');
    expect(result.status).toBe('APPROVED');
    expect(del).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('should throw ExternalServiceError when the fallback DELETE rejects', async () => {
    const patch = jest.fn(() => Promise.resolve({ data: {}, status: 500 }));
    const del = jest.fn(() => Promise.reject(new Error('delete network down')));
    const { adapter } = buildAdapter({ patch, delete: del });

    await expect(adapter.resubmitTemplate(RESUBMIT_INPUT)).rejects.toBeInstanceOf(
      ExternalServiceError,
    );
  });

  it('should wrap a non-Error DELETE rejection as ExternalServiceError', async () => {
    const patch = jest.fn(() => Promise.resolve({ data: {}, status: 500 }));
    const del = jest.fn(() => Promise.reject('boom'));
    const { adapter } = buildAdapter({ patch, delete: del });

    await expect(adapter.resubmitTemplate(RESUBMIT_INPUT)).rejects.toBeInstanceOf(
      ExternalServiceError,
    );
  });

  it('should throw ExternalServiceError when the fallback POST returns non-2xx', async () => {
    const patch = jest.fn(() => Promise.resolve({ data: {}, status: 500 }));
    const del = jest.fn(() => Promise.resolve({ data: {}, status: 200 }));
    const post = jest.fn(() =>
      Promise.resolve({ data: { error: 'invalid category' }, status: 400 }),
    );
    const { adapter } = buildAdapter({ patch, delete: del, post });

    await expect(adapter.resubmitTemplate(RESUBMIT_INPUT)).rejects.toBeInstanceOf(
      ExternalServiceError,
    );
  });
});
