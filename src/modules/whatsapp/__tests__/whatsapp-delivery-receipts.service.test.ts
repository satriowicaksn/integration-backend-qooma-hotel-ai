/**
 * `WhatsappDeliveryReceiptsService` unit tests. Repo mocked at class-shape
 * level; T15 has no external RPCs (receiver-only, no ports).
 *
 * Discriminated-union outcome (`DeliveryReceiptIngestOutcome`) — TypeScript
 * proves `receiptId` present when `dispatched: true` and `error` present
 * when `dispatched: false`. No `as string` / `as X` casts anywhere.
 */

import { describe, expect, it, jest } from '@jest/globals';

import { ValidationError } from '@core/errors/app-errors.js';
import type { Logger } from '@core/logger/logger.js';

import { maskWaPhone } from '@shared/utils/masking.js';

import type { WhatsappDeliveryReceiptsRepository } from '../whatsapp-delivery-receipts.repository.js';
import { WhatsappDeliveryReceiptsService } from '../whatsapp-delivery-receipts.service.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';
const DISPATCH_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const DISPATCH_ID_2 = 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff';
const RECIPIENT = '628123456789';

const singleStatusEnvelope = {
  object: 'whatsapp_business_account' as const,
  entry: [
    {
      id: 'entry-1',
      changes: [
        {
          field: 'messages',
          value: {
            messaging_product: 'whatsapp' as const,
            metadata: { display_phone_number: '15551234567', phone_number_id: 'phone-123' },
            statuses: [
              {
                id: 'wamid.abc',
                status: 'delivered' as const,
                timestamp: '1728000000',
                recipient_id: RECIPIENT,
              },
            ],
          },
        },
      ],
    },
  ],
};

const multiStatusProgressionEnvelope = {
  object: 'whatsapp_business_account' as const,
  entry: [
    {
      id: 'entry-1',
      changes: [
        {
          field: 'messages',
          value: {
            messaging_product: 'whatsapp' as const,
            metadata: { display_phone_number: '15551234567', phone_number_id: 'phone-123' },
            statuses: [
              { id: 'wamid.abc', status: 'sent' as const, timestamp: '1728000000' },
              {
                id: 'wamid.abc',
                status: 'delivered' as const,
                timestamp: '1728000001',
                recipient_id: RECIPIENT,
              },
              {
                id: 'wamid.abc',
                status: 'read' as const,
                timestamp: '1728000002',
                recipient_id: RECIPIENT,
              },
            ],
          },
        },
      ],
    },
  ],
};

const mixedFoundOrphanEnvelope = {
  object: 'whatsapp_business_account' as const,
  entry: [
    {
      id: 'entry-1',
      changes: [
        {
          field: 'messages',
          value: {
            messaging_product: 'whatsapp' as const,
            metadata: { display_phone_number: '15551234567', phone_number_id: 'phone-123' },
            statuses: [
              {
                id: 'wamid.known-1',
                status: 'delivered' as const,
                timestamp: '1728000000',
                recipient_id: RECIPIENT,
              },
              { id: 'wamid.orphan', status: 'delivered' as const, timestamp: '1728000001' },
              {
                id: 'wamid.known-2',
                status: 'read' as const,
                timestamp: '1728000002',
                recipient_id: RECIPIENT,
              },
            ],
          },
        },
      ],
    },
  ],
};

interface RepoDouble {
  findDispatchByExternalId: jest.Mock;
  persist: jest.Mock;
}

function createRepoDouble(): { repo: WhatsappDeliveryReceiptsRepository; double: RepoDouble } {
  const double: RepoDouble = {
    findDispatchByExternalId: jest.fn(),
    persist: jest.fn(),
  };
  return { repo: double as unknown as WhatsappDeliveryReceiptsRepository, double };
}

function createLoggerSpy(): Logger & {
  info: jest.Mock;
  debug: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
} {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

describe('WhatsappDeliveryReceiptsService.ingestStatuses — happy path', () => {
  it('should persist a single correlated status and return a dispatched outcome with receiptId', async () => {
    const { repo, double } = createRepoDouble();
    double.findDispatchByExternalId.mockResolvedValue({ id: DISPATCH_ID });
    double.persist.mockResolvedValue({ id: 'receipt-1' });
    const service = new WhatsappDeliveryReceiptsService(repo, createLoggerSpy());

    const result = await service.ingestStatuses(HOTEL_ID, singleStatusEnvelope, true);

    expect(result.orphanCount).toBe(0);
    expect(result.receipts).toHaveLength(1);
    const receipt = result.receipts[0];
    expect(receipt?.dispatched).toBe(true);
    if (receipt?.dispatched === true) {
      expect(receipt.receiptId).toBe('receipt-1');
      expect(receipt.status).toBe('delivered');
      expect(receipt.externalId).toBe('wamid.abc');
    }
    expect(double.persist).toHaveBeenCalledWith({
      hotelId: HOTEL_ID,
      dispatchId: DISPATCH_ID,
      externalId: 'wamid.abc',
      status: 'delivered',
    });
  });

  it('should return an empty receipts array when the envelope carries no statuses (messages-only branch)', async () => {
    const { repo, double } = createRepoDouble();
    const service = new WhatsappDeliveryReceiptsService(repo, createLoggerSpy());
    const messagesOnly = {
      object: 'whatsapp_business_account' as const,
      entry: [
        {
          id: 'entry-1',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp' as const,
                metadata: { display_phone_number: '1', phone_number_id: '1' },
                messages: [{ id: 'wamid.msg' }],
              },
            },
          ],
        },
      ],
    };

    const result = await service.ingestStatuses(HOTEL_ID, messagesOnly, true);

    expect(result.receipts).toEqual([]);
    expect(result.orphanCount).toBe(0);
    expect(double.findDispatchByExternalId).not.toHaveBeenCalled();
    expect(double.persist).not.toHaveBeenCalled();
  });
});

describe('WhatsappDeliveryReceiptsService.ingestStatuses — multi-row status progression', () => {
  it('should persist all three status transitions of the same externalId (sent → delivered → read)', async () => {
    const { repo, double } = createRepoDouble();
    double.findDispatchByExternalId.mockResolvedValue({ id: DISPATCH_ID });
    double.persist
      .mockResolvedValueOnce({ id: 'receipt-1' })
      .mockResolvedValueOnce({ id: 'receipt-2' })
      .mockResolvedValueOnce({ id: 'receipt-3' });
    const service = new WhatsappDeliveryReceiptsService(repo, createLoggerSpy());

    const result = await service.ingestStatuses(HOTEL_ID, multiStatusProgressionEnvelope, true);

    expect(result.orphanCount).toBe(0);
    expect(result.receipts).toHaveLength(3);
    expect(double.persist).toHaveBeenCalledTimes(3);
    const statuses = result.receipts.map((r) => r.status);
    expect(statuses).toEqual(['sent', 'delivered', 'read']);
    expect(result.receipts.every((r) => r.dispatched === true)).toBe(true);
  });
});

describe('WhatsappDeliveryReceiptsService.ingestStatuses — orphan handling', () => {
  it('should skip persist + log warn + increment orphanCount when the dispatch is not found', async () => {
    const { repo, double } = createRepoDouble();
    double.findDispatchByExternalId.mockResolvedValue(null);
    const logger = createLoggerSpy();
    const service = new WhatsappDeliveryReceiptsService(repo, logger);

    const result = await service.ingestStatuses(HOTEL_ID, singleStatusEnvelope, true);

    expect(result.orphanCount).toBe(1);
    expect(result.receipts).toHaveLength(1);
    const receipt = result.receipts[0];
    expect(receipt?.dispatched).toBe(false);
    if (receipt?.dispatched === false) {
      expect(receipt.error).toBe('orphan_no_dispatch');
    }
    expect(double.persist).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('should reflect mixed found+orphan in per-status outcomes when the envelope carries 3 status entries', async () => {
    const { repo, double } = createRepoDouble();
    double.findDispatchByExternalId
      .mockResolvedValueOnce({ id: DISPATCH_ID })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: DISPATCH_ID_2 });
    double.persist
      .mockResolvedValueOnce({ id: 'receipt-1' })
      .mockResolvedValueOnce({ id: 'receipt-3' });
    const service = new WhatsappDeliveryReceiptsService(repo, createLoggerSpy());

    const result = await service.ingestStatuses(HOTEL_ID, mixedFoundOrphanEnvelope, true);

    expect(result.receipts).toHaveLength(3);
    expect(result.orphanCount).toBe(1);
    expect(result.receipts[0]?.dispatched).toBe(true);
    expect(result.receipts[1]?.dispatched).toBe(false);
    expect(result.receipts[2]?.dispatched).toBe(true);
    expect(double.persist).toHaveBeenCalledTimes(2);
  });

  it('should NEVER throw when the correlation lookup itself rejects — records outcome error', async () => {
    const { repo, double } = createRepoDouble();
    double.findDispatchByExternalId.mockRejectedValue(new Error('DB timeout'));
    const service = new WhatsappDeliveryReceiptsService(repo, createLoggerSpy());

    const result = await service.ingestStatuses(HOTEL_ID, singleStatusEnvelope, true);

    expect(result.receipts).toHaveLength(1);
    const receipt = result.receipts[0];
    expect(receipt?.dispatched).toBe(false);
    if (receipt?.dispatched === false) {
      expect(receipt.error).toContain('dispatch_lookup');
    }
    expect(result.orphanCount).toBe(0);
  });
});

describe('WhatsappDeliveryReceiptsService.ingestStatuses — repo persist failures (worker discipline)', () => {
  it('should record a failed outcome + log error + continue processing when a single persist fails', async () => {
    const { repo, double } = createRepoDouble();
    double.findDispatchByExternalId
      .mockResolvedValueOnce({ id: DISPATCH_ID })
      .mockResolvedValueOnce({ id: DISPATCH_ID })
      .mockResolvedValueOnce({ id: DISPATCH_ID });
    double.persist
      .mockResolvedValueOnce({ id: 'receipt-1' })
      .mockRejectedValueOnce(new Error('FK violation'))
      .mockResolvedValueOnce({ id: 'receipt-3' });
    const logger = createLoggerSpy();
    const service = new WhatsappDeliveryReceiptsService(repo, logger);

    const result = await service.ingestStatuses(HOTEL_ID, multiStatusProgressionEnvelope, true);

    expect(result.receipts).toHaveLength(3);
    expect(result.receipts[0]?.dispatched).toBe(true);
    expect(result.receipts[1]?.dispatched).toBe(false);
    if (result.receipts[1]?.dispatched === false) {
      expect(result.receipts[1].error).toContain('persist');
    }
    expect(result.receipts[2]?.dispatched).toBe(true);
    expect(logger.error).toHaveBeenCalled();
  });

  it('should wrap a non-Error persist rejection as a stable outcome error string', async () => {
    const { repo, double } = createRepoDouble();
    double.findDispatchByExternalId.mockResolvedValue({ id: DISPATCH_ID });
    double.persist.mockRejectedValue('boom');
    const service = new WhatsappDeliveryReceiptsService(repo, createLoggerSpy());

    const result = await service.ingestStatuses(HOTEL_ID, singleStatusEnvelope, true);

    const receipt = result.receipts[0];
    expect(receipt?.dispatched).toBe(false);
    if (receipt?.dispatched === false) {
      expect(receipt.error).toContain('persist: boom');
    }
  });
});

describe('WhatsappDeliveryReceiptsService.ingestStatuses — signature + validation', () => {
  it('should propagate signatureValid=false in the ingest-level log without gating persist', async () => {
    const { repo, double } = createRepoDouble();
    double.findDispatchByExternalId.mockResolvedValue({ id: DISPATCH_ID });
    double.persist.mockResolvedValue({ id: 'receipt-1' });
    const logger = createLoggerSpy();
    const service = new WhatsappDeliveryReceiptsService(repo, logger);

    const result = await service.ingestStatuses(HOTEL_ID, singleStatusEnvelope, false);

    expect(result.receipts).toHaveLength(1);
    expect(result.receipts[0]?.dispatched).toBe(true);
    const ingestLog = logger.info.mock.calls.find((c) => {
      const entry = c[0] as { msg?: string };
      return entry?.msg === 'whatsapp_delivery_receipts.ingest';
    });
    expect(ingestLog).toBeDefined();
    const logged = ingestLog?.[0] as { signatureValid: boolean };
    expect(logged.signatureValid).toBe(false);
  });

  it('should throw ValidationError when the envelope fails schema parse', async () => {
    const { repo } = createRepoDouble();
    const service = new WhatsappDeliveryReceiptsService(repo, createLoggerSpy());

    await expect(
      service.ingestStatuses(HOTEL_ID, { object: 'other' }, true),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('WhatsappDeliveryReceiptsService.ingestStatuses — PII floor', () => {
  it('should mask the recipientId in the per-receipt log and NOT leak the plaintext phone', async () => {
    const { repo, double } = createRepoDouble();
    double.findDispatchByExternalId.mockResolvedValue({ id: DISPATCH_ID });
    double.persist.mockResolvedValue({ id: 'receipt-1' });
    const logger = createLoggerSpy();
    const service = new WhatsappDeliveryReceiptsService(repo, logger);

    await service.ingestStatuses(HOTEL_ID, singleStatusEnvelope, true);

    const perReceipt = logger.info.mock.calls.find((c) => {
      const entry = c[0] as { msg?: string };
      return entry?.msg === 'whatsapp_delivery_receipts.receipt';
    });
    expect(perReceipt).toBeDefined();
    const logged = perReceipt?.[0] as Record<string, unknown>;
    expect(logged.recipientId).toBe(maskWaPhone(RECIPIENT));
    expect(JSON.stringify(logged)).not.toContain(RECIPIENT);
    expect(JSON.stringify(logged).length).toBeLessThan(500);
  });

  it('should omit recipientId from the log when the Meta status entry did not carry one (sent branch)', async () => {
    const { repo, double } = createRepoDouble();
    double.findDispatchByExternalId.mockResolvedValue({ id: DISPATCH_ID });
    double.persist.mockResolvedValue({ id: 'receipt-1' });
    const logger = createLoggerSpy();
    const service = new WhatsappDeliveryReceiptsService(repo, logger);

    const noRecipientEnvelope = {
      object: 'whatsapp_business_account' as const,
      entry: [
        {
          id: 'entry-1',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp' as const,
                metadata: { display_phone_number: '1', phone_number_id: '1' },
                statuses: [{ id: 'wamid.x', status: 'sent' as const, timestamp: '1728000000' }],
              },
            },
          ],
        },
      ],
    };
    await service.ingestStatuses(HOTEL_ID, noRecipientEnvelope, true);

    const perReceipt = logger.info.mock.calls.find((c) => {
      const entry = c[0] as { msg?: string };
      return entry?.msg === 'whatsapp_delivery_receipts.receipt';
    });
    const logged = perReceipt?.[0] as Record<string, unknown>;
    expect(Object.keys(logged)).not.toContain('recipientId');
  });
});
