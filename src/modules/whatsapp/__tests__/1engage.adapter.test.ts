import { describe, it, expect, jest } from '@jest/globals';

import { ExternalServiceError } from '@core/errors/app-errors.js';

import { create1engageAdapter, type HttpPoster } from '../adapters/1engage.adapter.js';

const CONFIG = { baseUrl: 'https://graph.facebook.com', apiVersion: 'v18.0' };
const CREDS = { phoneNumberId: '123456', accessToken: 'plain-token' };
const MESSAGES_URL = 'https://graph.facebook.com/v18.0/123456/messages';
const AUTH_OPTS = {
  headers: { Authorization: 'Bearer plain-token', 'Content-Type': 'application/json' },
};

function resolvingPoster(data: unknown, status: number) {
  const post = jest.fn(() => Promise.resolve({ data, status }));
  const poster = { post } as unknown as HttpPoster;
  return { adapter: create1engageAdapter({ http: poster, config: CONFIG }), post };
}

function rejectingPoster() {
  const post = jest.fn(() => Promise.reject(new Error('network down')));
  const poster = { post } as unknown as HttpPoster;
  return { adapter: create1engageAdapter({ http: poster, config: CONFIG }), post };
}

describe('create1engageAdapter.sendText', () => {
  it('should POST a Cloud API text payload and return the message id', async () => {
    const { adapter, post } = resolvingPoster({ messages: [{ id: 'wamid.TEXT' }] }, 200);
    const result = await adapter.sendText({ credentials: CREDS, to: '628123', body: 'hello' });
    expect(result).toEqual({ messageId: 'wamid.TEXT' });
    expect(post).toHaveBeenCalledWith(
      MESSAGES_URL,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: '628123',
        type: 'text',
        text: { body: 'hello' },
      },
      AUTH_OPTS,
    );
  });

  it('should throw ExternalServiceError on a non-2xx status', async () => {
    const { adapter } = resolvingPoster({ error: 'bad' }, 400);
    await expect(
      adapter.sendText({ credentials: CREDS, to: '628123', body: 'x' }),
    ).rejects.toMatchObject({ code: 'EXTERNAL_SERVICE_ERROR' });
  });

  it('should throw ExternalServiceError when the response has no message id', async () => {
    const { adapter } = resolvingPoster({ messages: [] }, 200);
    await expect(
      adapter.sendText({ credentials: CREDS, to: '628123', body: 'x' }),
    ).rejects.toBeInstanceOf(ExternalServiceError);
  });

  it('should throw ExternalServiceError when the http call rejects', async () => {
    const { adapter } = rejectingPoster();
    await expect(
      adapter.sendText({ credentials: CREDS, to: '628123', body: 'x' }),
    ).rejects.toBeInstanceOf(ExternalServiceError);
  });

  it('should wrap a non-Error http rejection as ExternalServiceError', async () => {
    const post = jest.fn(() => Promise.reject('boom'));
    const poster = { post } as unknown as HttpPoster;
    const adapter = create1engageAdapter({ http: poster, config: CONFIG });
    await expect(
      adapter.sendText({ credentials: CREDS, to: '628123', body: 'x' }),
    ).rejects.toBeInstanceOf(ExternalServiceError);
  });
});

describe('create1engageAdapter.sendTemplate', () => {
  it('should POST a template payload with mapped body parameters', async () => {
    const { adapter, post } = resolvingPoster({ messages: [{ id: 'wamid.TPL' }] }, 200);
    const result = await adapter.sendTemplate({
      credentials: CREDS,
      to: '628123',
      templateName: 'welcome',
      languageCode: 'id',
      variables: ['Nathan', 'Room 101'],
    });
    expect(result).toEqual({ messageId: 'wamid.TPL' });
    expect(post).toHaveBeenCalledWith(
      MESSAGES_URL,
      {
        messaging_product: 'whatsapp',
        to: '628123',
        type: 'template',
        template: {
          name: 'welcome',
          language: { code: 'id' },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: 'Nathan' },
                { type: 'text', text: 'Room 101' },
              ],
            },
          ],
        },
      },
      AUTH_OPTS,
    );
  });

  it('should omit components when the template has no variables', async () => {
    const { adapter, post } = resolvingPoster({ messages: [{ id: 'wamid.NOVAR' }] }, 200);
    await adapter.sendTemplate({
      credentials: CREDS,
      to: '628123',
      templateName: 'ping',
      languageCode: 'en',
    });
    expect(post).toHaveBeenCalledWith(
      MESSAGES_URL,
      {
        messaging_product: 'whatsapp',
        to: '628123',
        type: 'template',
        template: { name: 'ping', language: { code: 'en' } },
      },
      AUTH_OPTS,
    );
  });
});
