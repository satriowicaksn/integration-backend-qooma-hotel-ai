/**
 * `WhatsappTemplateService` unit tests.
 *
 * Both ports mocked at the class-shape level; no Prisma / no crypto / no
 * ephemeral env-key seeding is needed at this layer (T16 primitive is
 * signature-agnostic and helper-imports the pure masker only). Q-B-01/02/03
 * assumption paths are exercised through the schema-validated inputs.
 */

import { describe, expect, it, jest } from '@jest/globals';

import { ExternalServiceError, ValidationError } from '@core/errors/app-errors.js';
import type { Logger } from '@core/logger/logger.js';

import { maskTokenForLog } from '@shared/utils/masking.js';

import type { HotelCoreTemplateCallbackPort } from '../ports/hotel-core-template-callback.port.js';
import type { WhatsappTemplateManagementPort } from '../ports/whatsapp-template-management.port.js';
import { WhatsappTemplateService } from '../whatsapp-template.service.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';
const TEMPLATE_ID = '00000000-0000-0000-0000-000000000001';
const PLAINTEXT_ACCESS_TOKEN = 'super-secret-access-token-1234567';

const validSubmitPayload = {
  templateId: TEMPLATE_ID,
  wabaId: '9876543210',
  accessToken: PLAINTEXT_ACCESS_TOKEN,
  name: 'booking_confirmed',
  category: 'UTILITY' as const,
  language: 'en_US',
  components: [{ type: 'BODY' as const, text: 'Hello {{1}}, your booking {{2}} is confirmed.' }],
};

const validResubmitPayload = {
  ...validSubmitPayload,
  metaTemplateId: 'meta_tpl_abc123',
};

const validStatusEvent = {
  hotelId: HOTEL_ID,
  metaTemplateId: 'meta_tpl_abc123',
  templateName: 'booking_confirmed',
  status: 'APPROVED' as const,
} as const;

interface BspPortDouble {
  submitTemplate: jest.Mock;
  resubmitTemplate: jest.Mock;
}

interface HcCallbackDouble {
  updateWaTemplateStatus: jest.Mock;
}

function createBspDouble(): { port: WhatsappTemplateManagementPort; double: BspPortDouble } {
  const double: BspPortDouble = {
    submitTemplate: jest.fn(),
    resubmitTemplate: jest.fn(),
  };
  return { port: double as unknown as WhatsappTemplateManagementPort, double };
}

function createHcDouble(): { port: HotelCoreTemplateCallbackPort; double: HcCallbackDouble } {
  const double: HcCallbackDouble = {
    updateWaTemplateStatus: jest.fn(),
  };
  return { port: double as unknown as HotelCoreTemplateCallbackPort, double };
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

describe('WhatsappTemplateService.submit', () => {
  it('should call the BSP port with the payload projection and return its result', async () => {
    const { port: bsp, double: bspDouble } = createBspDouble();
    const { port: hc } = createHcDouble();
    bspDouble.submitTemplate.mockResolvedValue({
      metaTemplateId: 'meta_tpl_abc123',
      status: 'IN_REVIEW',
    });
    const service = new WhatsappTemplateService(bsp, hc, createLoggerSpy());

    const result = await service.submit(HOTEL_ID, validSubmitPayload);

    expect(result).toEqual({ metaTemplateId: 'meta_tpl_abc123', status: 'IN_REVIEW' });
    expect(bspDouble.submitTemplate).toHaveBeenCalledTimes(1);
    const passed = bspDouble.submitTemplate.mock.calls[0]?.[0] as {
      wabaId: string;
      accessToken: string;
    };
    expect(passed.wabaId).toBe(validSubmitPayload.wabaId);
    expect(passed.accessToken).toBe(PLAINTEXT_ACCESS_TOKEN);
  });

  it('should throw ValidationError when the submit payload fails schema parse', async () => {
    const { port: bsp } = createBspDouble();
    const { port: hc } = createHcDouble();
    const service = new WhatsappTemplateService(bsp, hc, createLoggerSpy());

    await expect(
      service.submit(HOTEL_ID, { ...validSubmitPayload, templateId: 'not-a-uuid' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('should NEVER include the plaintext accessToken in the log payload (PII floor)', async () => {
    const { port: bsp, double: bspDouble } = createBspDouble();
    const { port: hc } = createHcDouble();
    bspDouble.submitTemplate.mockResolvedValue({
      metaTemplateId: 'meta_tpl_abc123',
      status: 'IN_REVIEW',
    });
    const logger = createLoggerSpy();
    const service = new WhatsappTemplateService(bsp, hc, logger);

    await service.submit(HOTEL_ID, validSubmitPayload);

    expect(logger.info).toHaveBeenCalled();
    const serialized = JSON.stringify(logger.info.mock.calls[0]?.[0]);
    expect(serialized).not.toContain(PLAINTEXT_ACCESS_TOKEN);
    const loggedPayload = logger.info.mock.calls[0]?.[0] as { accessToken: string };
    expect(loggedPayload.accessToken).toBe(maskTokenForLog(PLAINTEXT_ACCESS_TOKEN));
  });

  it('should log the PII-floor line BEFORE calling the BSP port', async () => {
    const { port: bsp, double: bspDouble } = createBspDouble();
    const { port: hc } = createHcDouble();
    const events: string[] = [];
    const logger = createLoggerSpy();
    logger.info.mockImplementation(() => {
      events.push('log');
    });
    bspDouble.submitTemplate.mockImplementation(() => {
      events.push('bsp');
      return Promise.resolve({ metaTemplateId: 'meta_tpl_abc123', status: 'IN_REVIEW' });
    });
    const service = new WhatsappTemplateService(bsp, hc, logger);

    await service.submit(HOTEL_ID, validSubmitPayload);

    expect(events).toEqual(['log', 'bsp']);
  });

  it('should propagate an ExternalServiceError raised by the BSP port', async () => {
    const { port: bsp, double: bspDouble } = createBspDouble();
    const { port: hc } = createHcDouble();
    bspDouble.submitTemplate.mockRejectedValue(
      new ExternalServiceError('1engage-template', 'boom', { status: 500 }),
    );
    const service = new WhatsappTemplateService(bsp, hc, createLoggerSpy());

    await expect(service.submit(HOTEL_ID, validSubmitPayload)).rejects.toBeInstanceOf(
      ExternalServiceError,
    );
  });
});

describe('WhatsappTemplateService.resubmit', () => {
  it('should call the BSP port resubmit with metaTemplateId and return its result', async () => {
    const { port: bsp, double: bspDouble } = createBspDouble();
    const { port: hc } = createHcDouble();
    bspDouble.resubmitTemplate.mockResolvedValue({
      metaTemplateId: 'meta_tpl_abc123',
      status: 'IN_REVIEW',
    });
    const service = new WhatsappTemplateService(bsp, hc, createLoggerSpy());

    const result = await service.resubmit(HOTEL_ID, validResubmitPayload);

    expect(result.status).toBe('IN_REVIEW');
    const passed = bspDouble.resubmitTemplate.mock.calls[0]?.[0] as { metaTemplateId: string };
    expect(passed.metaTemplateId).toBe('meta_tpl_abc123');
  });

  it('should throw ValidationError when the resubmit payload is missing metaTemplateId', async () => {
    const { port: bsp } = createBspDouble();
    const { port: hc } = createHcDouble();
    const service = new WhatsappTemplateService(bsp, hc, createLoggerSpy());
    const { metaTemplateId: _drop, ...withoutMeta } = validResubmitPayload;

    await expect(
      service.resubmit(HOTEL_ID, withoutMeta as typeof validResubmitPayload),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('should mask the accessToken in the resubmit log payload (PII floor)', async () => {
    const { port: bsp, double: bspDouble } = createBspDouble();
    const { port: hc } = createHcDouble();
    bspDouble.resubmitTemplate.mockResolvedValue({
      metaTemplateId: 'meta_tpl_abc123',
      status: 'IN_REVIEW',
    });
    const logger = createLoggerSpy();
    const service = new WhatsappTemplateService(bsp, hc, logger);

    await service.resubmit(HOTEL_ID, validResubmitPayload);

    const serialized = JSON.stringify(logger.info.mock.calls[0]?.[0]);
    expect(serialized).not.toContain(PLAINTEXT_ACCESS_TOKEN);
  });
});

describe('WhatsappTemplateService.handleMetaStatusUpdate', () => {
  it('should call the HC callback port with the parsed status branch when APPROVED', async () => {
    const { port: bsp } = createBspDouble();
    const { port: hc, double: hcDouble } = createHcDouble();
    hcDouble.updateWaTemplateStatus.mockResolvedValue(undefined);
    const service = new WhatsappTemplateService(bsp, hc, createLoggerSpy());

    await service.handleMetaStatusUpdate(TEMPLATE_ID, validStatusEvent);

    expect(hcDouble.updateWaTemplateStatus).toHaveBeenCalledWith({
      templateId: TEMPLATE_ID,
      status: 'APPROVED',
      metaTemplateId: 'meta_tpl_abc123',
    });
  });

  it('should include the reason field when Meta sends REJECTED with a reason', async () => {
    const { port: bsp } = createBspDouble();
    const { port: hc, double: hcDouble } = createHcDouble();
    hcDouble.updateWaTemplateStatus.mockResolvedValue(undefined);
    const service = new WhatsappTemplateService(bsp, hc, createLoggerSpy());

    await service.handleMetaStatusUpdate(TEMPLATE_ID, {
      ...validStatusEvent,
      status: 'REJECTED',
      reason: 'Content violates policy',
    });

    expect(hcDouble.updateWaTemplateStatus).toHaveBeenCalledWith({
      templateId: TEMPLATE_ID,
      status: 'REJECTED',
      metaTemplateId: 'meta_tpl_abc123',
      reason: 'Content violates policy',
    });
  });

  it('should throw ValidationError when the status event fails structural parse', async () => {
    const { port: bsp } = createBspDouble();
    const { port: hc } = createHcDouble();
    const service = new WhatsappTemplateService(bsp, hc, createLoggerSpy());

    await expect(
      service.handleMetaStatusUpdate(TEMPLATE_ID, {
        ...validStatusEvent,
        status: 'FLAGGED' as never,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('should propagate an ExternalServiceError raised by the HC callback', async () => {
    const { port: bsp } = createBspDouble();
    const { port: hc, double: hcDouble } = createHcDouble();
    hcDouble.updateWaTemplateStatus.mockRejectedValue(
      new ExternalServiceError('hotel-core-template-callback', 'HC 502', { status: 502 }),
    );
    const service = new WhatsappTemplateService(bsp, hc, createLoggerSpy());

    await expect(
      service.handleMetaStatusUpdate(TEMPLATE_ID, validStatusEvent),
    ).rejects.toBeInstanceOf(ExternalServiceError);
  });

  it('should wrap a non-ExternalServiceError HC failure as ExternalServiceError', async () => {
    const { port: bsp } = createBspDouble();
    const { port: hc, double: hcDouble } = createHcDouble();
    hcDouble.updateWaTemplateStatus.mockRejectedValue(new Error('network down'));
    const service = new WhatsappTemplateService(bsp, hc, createLoggerSpy());

    await expect(
      service.handleMetaStatusUpdate(TEMPLATE_ID, validStatusEvent),
    ).rejects.toBeInstanceOf(ExternalServiceError);
  });

  it('should wrap a non-Error HC rejection as ExternalServiceError', async () => {
    const { port: bsp } = createBspDouble();
    const { port: hc, double: hcDouble } = createHcDouble();
    hcDouble.updateWaTemplateStatus.mockRejectedValue('boom');
    const service = new WhatsappTemplateService(bsp, hc, createLoggerSpy());

    await expect(
      service.handleMetaStatusUpdate(TEMPLATE_ID, validStatusEvent),
    ).rejects.toBeInstanceOf(ExternalServiceError);
  });
});
