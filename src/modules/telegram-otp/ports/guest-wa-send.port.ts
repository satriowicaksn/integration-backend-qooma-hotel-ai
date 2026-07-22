// Outbound WA send port for the OTP resend flow (ADD-24). The body handed to
// implementations CONTAINS the fresh code — implementations must never log
// it; the T28 dispatch pipeline already logs body length/mode only.

export interface GuestWaSendInput {
  readonly hotelId: string;
  readonly guestId: string;
  readonly recipientPhone: string;
  readonly body: string;
}

export interface GuestWaSendResult {
  readonly sent: boolean;
}

export interface GuestWaSendPort {
  sendText(input: GuestWaSendInput): Promise<GuestWaSendResult>;
}
