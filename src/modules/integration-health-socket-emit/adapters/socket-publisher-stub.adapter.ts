// MVP stub adapter for `SocketPublisherPort` (T25-followup PLAN GAP #1).
// Q-C-12 (transport choice + package) unresolved at Parent PM — this
// stub emits a `warn` per publish with the event name + payload keys so
// operators can see the composition wired end-to-end without a running
// socket server.
//
// Swap this file for the real transport adapter once Q-C-12 lands +
// the socket-lib PO approval is granted.

import type { Logger } from '@core/logger/logger.js';

import type { SocketPublishRequest, SocketPublisherPort } from '../ports/socket-publisher.port.js';

export class SocketPublisherStubAdapter implements SocketPublisherPort {
  constructor(private readonly logger: Logger) {}

  async publish(input: SocketPublishRequest): Promise<void> {
    this.logger.warn({
      msg: 'integration_health_socket_emit.publish_stubbed',
      module: 'integration-health-socket-emit',
      event: input.event,
      hotelId: input.payload.hotel_id,
      provider: input.payload.provider,
      newStatus: input.payload.new_status,
    });
    return Promise.resolve();
  }
}
