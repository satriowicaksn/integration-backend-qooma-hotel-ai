// Renders a `wa.me` URL as a 1024×1024 PNG (spec §3.4 step 2).
// TYPE-ONLY per PM C ACK T22 binding.
//
// Adapter deferred to T22-followup pending PO approval on `pnpm add qrcode`
// (or equivalent). The adapter invokes the QR library with
// `errorCorrectionLevel: 'M'` (library default; fine for the short URLs
// produced by `qr-url-builder.buildWaMeLink`).

export interface QrRenderRequest {
  readonly payload: string;
  readonly size: 1024;
}

export interface QrRendererPort {
  render(input: QrRenderRequest): Promise<Buffer>;
}
