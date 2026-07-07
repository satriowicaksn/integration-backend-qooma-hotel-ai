// Reader port for the health-pill subsystem view. TYPE-ONLY. Adapter
// wires against `@modules/channel-health` barrel (T24 primitive) in
// T23-followup.
//
// Unlike the other three reader ports, health is **never null** on the
// overview response (PM C ACK T23 binding #3). The service applies a
// synthetic-down snapshot fallback if this port throws (binding #11).

import type { HealthOverviewView } from '../integration-overview.types.js';

export interface ChannelHealthReadPort {
  getSnapshot(input: { hotelId: string }): Promise<HealthOverviewView>;
}
