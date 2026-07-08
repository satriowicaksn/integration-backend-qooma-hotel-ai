// MVP stub adapters for T24 primitive's 3 probe ports
// (`WhatsappHealthProbePort` + `TelegramHealthProbePort` +
// `ClaudeApiHealthProbePort`).
//
// All 3 return `{ ok: true, latencyMs: <random 100-300> }` unconditionally
// so the debounce state machine sees a steady healthy signal and the
// cron composition is exercisable end-to-end.
//
// Swap the specific stub for each real provider once:
//   - WhatsApp: Meta health-endpoint contract lands
//   - Telegram: Bot API `getMe` adapter wires (can reuse T20-fu HTTP adapter)
//   - Claude API: `@anthropic-ai/sdk` PO approval lands + adapter authored

import type { ProbeResult } from '../channel-health.types.js';
import type { ClaudeApiHealthProbePort } from '../ports/claude-api-health-probe.port.js';
import type { TelegramHealthProbePort } from '../ports/telegram-health-probe.port.js';
import type { WhatsappHealthProbePort } from '../ports/whatsapp-health-probe.port.js';

const LATENCY_MIN_MS = 100;
const LATENCY_RANGE_MS = 200;

function stubResult(): ProbeResult {
  const latencyMs = Math.floor(Math.random() * LATENCY_RANGE_MS) + LATENCY_MIN_MS;
  return { ok: true, latencyMs };
}

export class WhatsappHealthProbeStubAdapter implements WhatsappHealthProbePort {
  async probe(_input: { hotelId: string }): Promise<ProbeResult> {
    return Promise.resolve(stubResult());
  }
}

export class TelegramHealthProbeStubAdapter implements TelegramHealthProbePort {
  async probe(_input: { hotelId: string }): Promise<ProbeResult> {
    return Promise.resolve(stubResult());
  }
}

export class ClaudeApiHealthProbeStubAdapter implements ClaudeApiHealthProbePort {
  async probe(_input: { hotelId: string }): Promise<ProbeResult> {
    return Promise.resolve(stubResult());
  }
}
