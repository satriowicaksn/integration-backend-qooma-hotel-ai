/**
 * API server factory — no side effects on import.
 *
 * The Fastify instance is assembled here so both the runtime entrypoint
 * (`api.ts`) and integration tests (`*.integration.test.ts`) can share
 * the exact same wiring without accidentally triggering
 * `app.listen()` / signal handlers when the module is imported.
 *
 * Route registrations grow one primitive at a time (T##-followup PRs).
 * Current: T17 telegram config CRUD.
 * Pending: T19 webhook, T20 RPC, T22 QR, T23 overview, T24 health GET.
 */

import { randomUUID } from 'node:crypto';

import axios from 'axios';
import Fastify, { type FastifyInstance } from 'fastify';

import { loadConfig } from '@core/config/env.js';
import { createLogger } from '@core/logger/logger.js';
import { db } from '@core/prisma/prisma-client.js';

import { ChannelHealthRepository } from '@modules/channel-health/channel-health.repository.js';
import { ChannelHealthReadAdapter } from '@modules/integration-overview/adapters/channel-health-read.adapter.js';
import { QrStateReadAdapter } from '@modules/integration-overview/adapters/qr-state-read.adapter.js';
import { TelegramConfigReadAdapter } from '@modules/integration-overview/adapters/telegram-config-read.adapter.js';
import { WhatsappConfigReadAdapter } from '@modules/integration-overview/adapters/whatsapp-config-read.adapter.js';
import { integrationOverviewRoutes } from '@modules/integration-overview/integration-overview.routes.js';
import { IntegrationOverviewService } from '@modules/integration-overview/integration-overview.service.js';
import { ObjectStorageStubAdapter } from '@modules/qr-provisioning/adapters/object-storage-stub.adapter.js';
import { QrRendererStubAdapter } from '@modules/qr-provisioning/adapters/qr-renderer-stub.adapter.js';
import { WhatsappPhoneLookupAdapter } from '@modules/qr-provisioning/adapters/whatsapp-phone-lookup.adapter.js';
import { QrStateRepository } from '@modules/qr-provisioning/qr-provisioning.repository.js';
import { qrProvisioningRoutes } from '@modules/qr-provisioning/qr-provisioning.routes.js';
import { QrService } from '@modules/qr-provisioning/qr-provisioning.service.js';
import { EnvHotelSlugLookup } from '@modules/telegram/adapters/hotel-slug-lookup.adapter.js';
import { StaffLookupStubAdapter } from '@modules/telegram/adapters/staff-lookup-stub.adapter.js';
import { TelegramWebhookSecretResolver } from '@modules/telegram/adapters/telegram-webhook-secret.adapter.js';
import { TicketActionStubAdapter } from '@modules/telegram/adapters/ticket-action-stub.adapter.js';
import { telegramInboundRoutes } from '@modules/telegram/telegram-inbound.routes.js';
import { TelegramInboundService } from '@modules/telegram/telegram-inbound.service.js';
import { TelegramWebhookEventsRepository } from '@modules/telegram/telegram-webhook-events.repository.js';
import { TelegramConfigRepository } from '@modules/telegram/telegram.repository.js';
import { telegramRoutes } from '@modules/telegram/telegram.routes.js';
import { TelegramConfigService } from '@modules/telegram/telegram.service.js';
import { DepartmentTelegramReadStubAdapter } from '@modules/telegram-dept-routing/adapters/department-telegram-read-stub.adapter.js';
import { DepartmentTelegramWriteStubAdapter } from '@modules/telegram-dept-routing/adapters/department-telegram-write-stub.adapter.js';
import { telegramDeptRoutingRoutes } from '@modules/telegram-dept-routing/telegram-dept-routing.routes.js';
import { TelegramDeptRoutingService } from '@modules/telegram-dept-routing/telegram-dept-routing.service.js';
import type { HttpPoster } from '@modules/whatsapp/adapters/1engage.adapter.js';
import { create1engageAdapter } from '@modules/whatsapp/adapters/1engage.adapter.js';
import { AiInboundStubAdapter } from '@modules/whatsapp/adapters/ai-inbound.stub-adapter.js';
import { HotelCoreDndPassthroughAdapter } from '@modules/whatsapp/adapters/hc-dnd-passthrough.adapter.js';
import { HotelCoreGuestUpsertStubAdapter } from '@modules/whatsapp/adapters/hc-guest-upsert.stub-adapter.js';
import { HotelCoreQuotaPassthroughAdapter } from '@modules/whatsapp/adapters/hc-quota-passthrough.adapter.js';
import { HttpAiInboundMessageAdapter } from '@modules/whatsapp/adapters/http-ai-inbound-message.adapter.js';
import { EnvWaHotelSlugLookup } from '@modules/whatsapp/adapters/wa-hotel-slug-lookup.adapter.js';
import { WhatsappWebhookSecretResolver } from '@modules/whatsapp/adapters/whatsapp-webhook-secret.adapter.js';
import { WhatsappConfigRepository } from '@modules/whatsapp/whatsapp-config.repository.js';
import { whatsappConfigRoutes } from '@modules/whatsapp/whatsapp-config.routes.js';
import { WhatsappConfigService } from '@modules/whatsapp/whatsapp-config.service.js';
import { WhatsappConversationsRepository } from '@modules/whatsapp/whatsapp-conversations.repository.js';
import { whatsappConversationsRoutes } from '@modules/whatsapp/whatsapp-conversations.routes.js';
import { WhatsappConversationsService } from '@modules/whatsapp/whatsapp-conversations.service.js';
import { whatsappDispatchRoutes } from '@modules/whatsapp/whatsapp-dispatch.routes.js';
import { WhatsappInboundIngestService } from '@modules/whatsapp/whatsapp-inbound-ingest.service.js';
import { WhatsappOutboundDispatchRepository } from '@modules/whatsapp/whatsapp-outbound-dispatch.repository.js';
import { WhatsappOutboundDispatchService } from '@modules/whatsapp/whatsapp-outbound-dispatch.service.js';
import { WhatsappWebhookEventsRepository } from '@modules/whatsapp/whatsapp-webhook-events.repository.js';
import { whatsappWebhookRoutes } from '@modules/whatsapp/whatsapp-webhook.routes.js';
import { registerErrorHandler } from '@plugins/error-handler.plugin.js';
import { registerWebhookRawBody, verifyWebhookSignature } from '@plugins/hmac-validator.plugin.js';
import { internalRpcAuthGuard } from '@plugins/internal-rpc-auth.plugin.js';
import { jwtAuthGuard, requireRole } from '@plugins/jwt-auth.plugin.js';
import { createSlugResolver, resolveTenantFromSlug } from '@plugins/tenant-resolver.plugin.js';

const CORRELATION_HEADER = 'x-correlation-id';

export async function buildServer(): Promise<FastifyInstance> {
  const config = loadConfig();

  const app = Fastify({
    logger: { level: config.LOG_LEVEL },
    genReqId: (req) => {
      const header = req.headers[CORRELATION_HEADER];
      const inbound = Array.isArray(header) ? header[0] : header;
      return inbound ?? randomUUID();
    },
    trustProxy: true,
  });

  app.addHook('onSend', (req, reply, _payload, done) => {
    void reply.header(CORRELATION_HEADER, req.id);
    done();
  });

  registerErrorHandler(app);

  app.setNotFoundHandler((req, reply) => {
    void reply.code(404).send({
      error: {
        code: 'NOT_FOUND',
        message: `Route ${req.method}:${req.url} not found`,
        details: {},
      },
    });
  });

  app.get('/healthz', async (_req, reply) => {
    return reply.type('text/plain').send('OK');
  });

  // Manual DI wiring: repository ← db, service ← repo + logger.
  // Guards composed here so route plugins stay auth-agnostic.
  const logger = createLogger({ service: 'api', level: config.LOG_LEVEL });
  const gmAdminGuards = [
    jwtAuthGuard({ secret: config.JWT_ACCESS_SECRET }),
    requireRole('gm_admin'),
  ];

  const telegramRepo = new TelegramConfigRepository(db);
  const telegramService = new TelegramConfigService(telegramRepo, logger);
  await app.register(telegramRoutes, {
    service: telegramService,
    guards: gmAdminGuards,
  });

  // T19-followup: Telegram inbound webhook (spec §2.3 + §3.2 + §4.6-4.7).
  // Raw-body parser + tenant resolver + signature guard compose in order.
  // HC RPC adapters ship as stubs pending Q-C-06 + Q-C-07 (PLAN GAP #1).
  registerWebhookRawBody(app);
  const webhookRepo = new TelegramWebhookEventsRepository(db);
  const secretResolver = new TelegramWebhookSecretResolver(telegramRepo);
  const slugAdapter = new EnvHotelSlugLookup(config.TELEGRAM_WEBHOOK_HOTEL_SLUG_MAP ?? '');
  const slugResolver = createSlugResolver({ lookup: (slug) => slugAdapter.lookup(slug) });
  const inboundService = new TelegramInboundService(
    new StaffLookupStubAdapter(logger),
    new TicketActionStubAdapter(logger),
    logger,
  );
  await app.register(telegramInboundRoutes, {
    service: inboundService,
    repo: webhookRepo,
    tenantResolver: resolveTenantFromSlug({ resolver: slugResolver }),
    signatureGuard: verifyWebhookSignature({
      provider: 'telegram',
      resolveSecret: (req) =>
        secretResolver.resolveSecret({ hotelId: requireHotelIdForSecret(req.hotelId) }),
    }),
    logger,
  });

  // Loud startup signal: this deployment is running stubbed HC adapters.
  // Ops should see this on every boot until Q-C-06 + Q-C-07 land.
  logger.warn({
    msg: 'telegram_inbound.startup',
    module: 'telegram',
    hcAdapters: 'STUB',
    ratifyQs: 'Q-C-06,Q-C-07',
  });

  // T18-followup: Per-dept Telegram routing write-through (spec §2.1 row 30).
  // HC read/write adapters ship as stubs pending Q-OPS-06 + Q-CONTRACT-25
  // (PLAN GAP #1). Env `TELEGRAM_DEPT_ROUTING_MAP` seeds the dept→hotel
  // lookup; the write stub NEVER touches HC's `departments` table.
  const deptReadStub = new DepartmentTelegramReadStubAdapter(
    config.TELEGRAM_DEPT_ROUTING_MAP ?? '',
  );
  const deptWriteStub = new DepartmentTelegramWriteStubAdapter(logger);
  const deptRoutingService = new TelegramDeptRoutingService(
    { deptRead: deptReadStub, deptWrite: deptWriteStub },
    logger,
  );
  await app.register(telegramDeptRoutingRoutes, {
    service: deptRoutingService,
    guards: gmAdminGuards,
  });

  // Loud startup signal: this deployment carries stubbed HC adapters.
  // Ops should see this on every boot until Q-OPS-06 + Q-CONTRACT-25 land.
  logger.warn({
    msg: 'telegram_dept_routing.startup',
    module: 'telegram-dept-routing',
    hcAdapters: 'STUB',
    ratifyQs: 'Q-OPS-06,Q-CONTRACT-25',
  });

  // T22-followup: QR generation + download (spec §3.4).
  // Renderer + object-storage adapters ship as stubs pending
  // `qrcode` + `@aws-sdk/client-s3` PO approvals + Q-C-10.
  const qrRepo = new QrStateRepository(db);
  const qrStorageStub = new ObjectStorageStubAdapter();
  const qrRendererStub = new QrRendererStubAdapter();
  const qrService = new QrService(
    qrRepo,
    { renderer: qrRendererStub, storage: qrStorageStub },
    logger,
  );
  const waConfigRepo = new WhatsappConfigRepository(db);
  const waPhoneLookup = new WhatsappPhoneLookupAdapter(waConfigRepo);
  await app.register(qrProvisioningRoutes, {
    service: qrService,
    storage: qrStorageStub,
    waPhoneLookup,
    guards: gmAdminGuards,
  });
  logger.warn({
    msg: 'qr_provisioning.startup',
    module: 'qr-provisioning',
    ioAdapters: 'STUB',
    ratifyQs: 'Q-C-10',
    poPackages: 'qrcode,@aws-sdk/client-s3',
  });

  // T26 — WA config CRUD route landing (spec §2.1 row 28, ADR-0009).
  // Reuses `waConfigRepo` already instantiated by T22-fu wiring above.
  const waConfigService = new WhatsappConfigService(waConfigRepo, logger);
  await app.register(whatsappConfigRoutes, {
    service: waConfigService,
    guards: gmAdminGuards,
  });

  // T23-followup — aggregated integration overview (spec §2.1 row 27).
  // 4 reader-port adapters bridge to each subsystem's repository; the
  // service composes them via Promise.allSettled with per-subsystem
  // resilience (T23 primitive bindings #9-#11).
  const channelHealthRepo = new ChannelHealthRepository(db);
  const integrationOverviewService = new IntegrationOverviewService(
    {
      whatsapp: new WhatsappConfigReadAdapter(waConfigRepo),
      telegram: new TelegramConfigReadAdapter(telegramRepo),
      qr: new QrStateReadAdapter(qrRepo),
      health: new ChannelHealthReadAdapter(channelHealthRepo),
    },
    logger,
  );
  await app.register(integrationOverviewRoutes, {
    service: integrationOverviewService,
    guards: gmAdminGuards,
  });

  // T29 — WA conversation + message internal RPC (ADR-0010).
  // Behind `internalRpcAuthGuard` (T09; `X-Internal-Secret`), NOT JWT —
  // HC calls these on behalf of CRM per ADR-0009 boundary.
  if (config.INTERNAL_RPC_SECRET === undefined) {
    throw new Error(
      'INTERNAL_RPC_SECRET is required to register the WA conversations internal RPC (spec §4.11).',
    );
  }
  const conversationsRepo = new WhatsappConversationsRepository(db);
  const conversationsService = new WhatsappConversationsService(conversationsRepo, logger);
  await app.register(whatsappConversationsRoutes, {
    service: conversationsService,
    repository: conversationsRepo,
    guards: [internalRpcAuthGuard({ secret: config.INTERNAL_RPC_SECRET })],
  });

  // T28 — WA outbound dispatch service (ADR-0009, spec §2.4).
  // Created here (before T27) so it can be passed to the inbound webhook
  // route for fire-and-forget AI reply dispatch. Route registration is
  // env-gated on `WA_BSP_BASE_URL` (Q-C-16); without it the 1engage BSP
  // has no target and dispatch would immediately fail — we prefer NOT to
  // register the route so HC gets a clean 404 instead of a confusing 502.
  // HC quota + DND are **passthrough** per ADR-0009 (FINAL MVP, NOT stubs).
  let outboundDispatchService: WhatsappOutboundDispatchService | undefined;
  if (config.WA_BSP_BASE_URL !== undefined) {
    const bspHttpPoster = createBspHttpPoster();
    const bsp = create1engageAdapter({
      http: bspHttpPoster,
      config: { baseUrl: config.WA_BSP_BASE_URL, apiVersion: config.WA_BSP_API_VERSION },
    });
    const quotaAdapter = new HotelCoreQuotaPassthroughAdapter(logger);
    const dndAdapter = new HotelCoreDndPassthroughAdapter(logger);
    const outboundDispatchRepo = new WhatsappOutboundDispatchRepository(db);
    outboundDispatchService = new WhatsappOutboundDispatchService(
      outboundDispatchRepo,
      bsp,
      quotaAdapter,
      dndAdapter,
      logger,
    );
  }

  // T27 — WA inbound webhook (Meta-facing, spec §2.3 + §3.1).
  // Guard order: raw-body parser (registered above for telegram) →
  // resolveTenantFromSlug → verifyWebhookSignature. HC guest upsert is
  // still a STUB (Q-B-04). AI inbound uses HttpAiInboundMessageAdapter
  // when AI_BASE_URL + INTEGRATION_TO_AI_HMAC_SECRET are set, otherwise
  // falls back to stub. `dispatchService` wires AI reply → WA guest when
  // BSP is configured; undefined → reply dispatch skipped (stub/dev mode).
  const waWebhookEventsRepo = new WhatsappWebhookEventsRepository(db);
  const waGuestUpsertStub = new HotelCoreGuestUpsertStubAdapter(logger);
  const waAiInbound =
    config.AI_BASE_URL !== undefined && config.INTEGRATION_TO_AI_HMAC_SECRET !== undefined
      ? new HttpAiInboundMessageAdapter(
          { baseUrl: config.AI_BASE_URL, hmacSecret: config.INTEGRATION_TO_AI_HMAC_SECRET },
          logger,
        )
      : new AiInboundStubAdapter(logger);
  const waIngestService = new WhatsappInboundIngestService(
    waWebhookEventsRepo,
    waGuestUpsertStub,
    waAiInbound,
    logger,
  );
  const waSlugAdapter = new EnvWaHotelSlugLookup(config.WHATSAPP_WEBHOOK_HOTEL_SLUG_MAP ?? '');
  const waSlugResolver = createSlugResolver({ lookup: (slug) => waSlugAdapter.lookup(slug) });
  const waSecretResolver = new WhatsappWebhookSecretResolver(waConfigRepo);
  await app.register(whatsappWebhookRoutes, {
    ingestService: waIngestService,
    conversationsService,
    dispatchService: outboundDispatchService,
    tenantResolver: resolveTenantFromSlug({ resolver: waSlugResolver }),
    signatureGuard: verifyWebhookSignature({
      provider: 'whatsapp',
      resolveSecret: (req) =>
        waSecretResolver.resolveSecret({ hotelId: requireHotelIdForSecret(req.hotelId) }),
    }),
    logger,
  });

  logger.warn({
    msg: 'whatsapp_inbound.startup',
    module: 'whatsapp',
    hcGuestUpsert: 'STUB',
    aiAdapter: config.AI_BASE_URL !== undefined ? 'HTTP' : 'STUB',
    dispatchAdapter: outboundDispatchService !== undefined ? 'BSP' : 'SKIP',
    ratifyQs: config.AI_BASE_URL !== undefined ? 'Q-B-04' : 'Q-B-04,Q-B-05',
    hmacSecret: 'webhook_verify_token_per_Q-A-04',
  });

  // T28 — WA outbound dispatch internal RPC route (behind internalRpcAuthGuard).
  if (outboundDispatchService !== undefined) {
    await app.register(whatsappDispatchRoutes, {
      dispatchService: outboundDispatchService,
      conversationsService,
      guards: [internalRpcAuthGuard({ secret: config.INTERNAL_RPC_SECRET })],
      logger,
    });
    // Loud startup signal: passthroughs are the ADR-0009 FINAL MVP shape,
    // not stubs. Ops should see this on every boot as a semantic pointer.
    logger.warn({
      msg: 'whatsapp_dispatch.startup',
      module: 'whatsapp',
      passthroughAdapters: 'FINAL_MVP_PER_ADR_0009',
      ratifyQs: 'Q-B-08,Q-B-09',
    });
  } else {
    logger.warn({
      msg: 'whatsapp_dispatch.startup_skipped',
      module: 'whatsapp',
      reason: 'WA_BSP_BASE_URL is unset — /internal/wa/dispatch not registered',
    });
  }

  return app;
}

function requireHotelIdForSecret(candidate: string | undefined): string {
  if (candidate === undefined || candidate === '') {
    throw new Error('hotelId must be resolved before signature verification');
  }
  return candidate;
}

/** Minimal HttpPoster wrapping axios, used by the T13 1engage BSP
 *  adapter. Kept inline rather than routed through `core/http/HttpClient`
 *  because the wrapper is 4 lines and `HttpClient` is a TODO stub. */
function createBspHttpPoster(): HttpPoster {
  // `validateStatus: () => true` — accept ANY status without throwing so the
  // adapter's `if (res.status < 200 || res.status >= 300)` branch runs and
  // surfaces Meta's real error body (e.g. `{error:{message,type,code,...}}`)
  // instead of losing it to the axios AxiosError.message ("Request failed…").
  const instance = axios.create({ timeout: 10_000, validateStatus: () => true });
  return {
    async post<T>(
      url: string,
      body?: unknown,
      opts?: unknown,
    ): Promise<{ data: T; status: number }> {
      const res = await instance.post<T>(url, body, opts as never);
      return { data: res.data, status: res.status };
    },
  };
}

export async function shutdownServer(app: FastifyInstance): Promise<void> {
  await app.close();
  await db.$disconnect();
}
