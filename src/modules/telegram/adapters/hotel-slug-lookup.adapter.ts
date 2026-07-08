// MVP env-based hotel-slug → hotel_id lookup (T19-followup PLAN GAP #3).
// Spec §2.3 says "lookup against Auth's hotels.code" but this repo has no
// `hotels` table and no Auth-service RPC client yet. This adapter parses
// a JSON `{ "slug": "<uuid>", ... }` map from `TELEGRAM_WEBHOOK_HOTEL_SLUG_MAP`
// at boot; unknown slugs return `null` → `resolveTenantFromSlug` throws
// `NotFoundError` → 404.
//
// Swap this file for a real Auth-service RPC adapter when that contract
// lands.

export class EnvHotelSlugLookup {
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
      'TELEGRAM_WEBHOOK_HOTEL_SLUG_MAP must be a JSON object of { slug: hotelId }',
    );
  }
  const entries: [string, string][] = [];
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof v !== 'string' || v === '') {
      throw new TypeError(
        `TELEGRAM_WEBHOOK_HOTEL_SLUG_MAP value for slug "${k}" must be a non-empty string`,
      );
    }
    entries.push([k, v]);
  }
  return new Map(entries);
}
