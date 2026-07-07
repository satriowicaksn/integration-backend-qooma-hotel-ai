// Reader port for the QR state subsystem view. TYPE-ONLY. Adapter wires
// against `@modules/qr-provisioning` barrel (T22 primitive) in
// T23-followup.

import type { QrOverviewView } from '../integration-overview.types.js';

export interface QrStateReadPort {
  getForHotel(input: { hotelId: string }): Promise<QrOverviewView | null>;
}
