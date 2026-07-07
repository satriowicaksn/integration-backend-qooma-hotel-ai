// Publishes an event to whichever socket transport the adapter wires
// (spec §5 socket events). TYPE-ONLY per PM C ACK T25 binding.
//
// Adapter (`socket.io` / `@fastify/websocket` / SSE / Redis pub/sub
// bridge) deferred to T25-followup pending Q-C-12 socket-infra
// ratification + `pnpm add` PO approval. The primitive can be unit-
// tested with a plain jest fake.

import type { HealthChangedEventWirePayload } from '../integration-health-socket-emit.types.js';

export interface SocketPublishRequest {
  readonly event: string;
  readonly payload: HealthChangedEventWirePayload;
}

export interface SocketPublisherPort {
  publish(input: SocketPublishRequest): Promise<void>;
}
