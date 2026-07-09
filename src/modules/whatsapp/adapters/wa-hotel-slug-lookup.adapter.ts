// MVP env-based hotel-slug → hotel_id lookup for the T27 WA inbound
// webhook (`POST /webhook/whatsapp/:hotel_slug`). Mirrors the T19-fu
// Telegram slug adapter verbatim: parses a JSON `{ "slug": "<uuid>" }`
// blob from `WHATSAPP_WEBHOOK_HOTEL_SLUG_MAP` at boot. Unknown slugs
// return `null` → `resolveTenantFromSlug` throws `NotFoundError` → 404
// BEFORE HMAC verification (anti-enumeration).
//
// Swap for a real Auth-service RPC adapter once that contract lands.

export class EnvWaHotelSlugLookup {
  private readonly map: ReadonlyMap<string, string>;

  constructor(mapJson: string) {
    this.map = parseMap(mapJson);
  }

  async lookup(slug: string): Promise<string | null> {
    return Promise.resolve(this.map.get(slug) ?? null);
  }
}

function parseMap(json: string): ReadonlyMap<string, string> {
  if (json.trim() === '') return new Map();
  const parsed = JSON.parse(json) as unknown;
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new TypeError(
      'WHATSAPP_WEBHOOK_HOTEL_SLUG_MAP must be a JSON object of { slug: hotelId }',
    );
  }
  const entries: [string, string][] = [];
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof v !== 'string' || v === '') {
      throw new TypeError(
        `WHATSAPP_WEBHOOK_HOTEL_SLUG_MAP value for slug "${k}" must be a non-empty string`,
      );
    }
    entries.push([k, v]);
  }
  return new Map(entries);
}
