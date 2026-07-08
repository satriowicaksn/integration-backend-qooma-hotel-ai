# ADR-0009: WA integration = pure integration layer (DND + quota di Hotel Core)

- **Status**: accepted
- **Tanggal**: 2026-07-08
- **Pengambil keputusan**: PO + Planning agent
- **Konteks teknis**: PO ruling 2026-07-08 (planning session); amendment ke ADR-0008 §Cross-service boundary

## Konteks

H12 PO ruling (2026-06-29) memindahkan config CRUD `/api/integrations/*` dari Hotel Core ke Integration. Outbound dispatch juga ratified di Integration (Q-OPS-03 resolved). Namun H12 tidak mendefinisikan **who owns cross-cutting business checks** (DND + outbound quota) — spec §3.1 flow menempatkan check di Integration side dgn RPC ke Hotel Core untuk data lookup (Q-B-08 + Q-B-09 open).

Selama planning 2026-07-08, muncul kebutuhan CRM staff-triggered send message. Dua alternatif ratified oleh PO:

- (a) CRM → Integration langsung (bypass Hotel Core) — Integration wajib own DND + quota checks + local implementations atau feature-flag skip
- (b) CRM → Hotel Core (public API) → Integration (internal RPC) — Integration jadi pure integration layer, HC handles DND + quota + business audit

## Opsi yang dipertimbangkan

### Opsi A: CRM direct → Integration + DND/quota lokal
- Pros: Zero HC dependency untuk send, cepat ship
- Cons: Duplicate business logic (DND policy + quota accounting) di Integration; Integration jadi setengah-business setengah-integration; tech debt saat harmonisasi dgn HC nanti; audit trail "siapa staff yg trigger" di Integration = butuh user context yang bukan domain-nya

### Opsi B: HC sebagai orchestrator (pilihan)
- Pros: Boundary konsisten — Integration murni bicara dgn eksternal (Meta, Telegram, IMAP, S3); HC own semua business state (guests, DND policy, quota meter, audit); ADR-0008 boundary respected; Q-B-08 + Q-B-09 tidak relevan lagi untuk Integration (HC-side concern)
- Cons: Butuh HC service live sebelum CRM staff-trigger send jalan; tambah 1 hop untuk send

### Opsi C: Split — config CRUD public di Integration (H12 stand), outbound + inbound relay + conversation read via internal RPC (pilihan sub-decision)
- Pros: Token = infrastructure concern, cocok tetap di Integration; send + read = business concern, cocok di HC
- Cons: Slight inconsistency — dua pattern di satu service

## Keputusan

Ratify **Opsi B + Opsi C sub-decision**:

1. **Config CRUD (#1 store token, #2 get connected account)**: **tetap public `gm_admin` di Integration** (`GET, PUT /api/integrations/whatsapp`). H12 ruling stand — token = infrastructure/integration concern.
2. **Outbound send (#4 send message + template)**: **internal RPC only** di Integration (`POST /internal/wa/dispatch`). Dipanggil oleh HC setelah HC own DND + quota check. Tidak ada public `POST /api/integrations/whatsapp/messages`.
3. **Conversation + message read (#3)**: **internal RPC only** di Integration (`POST /internal/wa/conversations.list` + `messages.list`). Dipanggil HC yang expose public read ke CRM.
4. **Webhook receiver (#5)**: tetap public Meta-facing (`POST /webhook/whatsapp/:hotel_slug`). Persist ke `webhook_events` + `messages` (ADR-0010 baru) + forward event ke HC internal RPC (`upsert_guest_by_wa_phone`) + AI internal RPC (`inbound_wa_message`).

## Konsekuensi

### Positif
- Boundary Integration jadi konsisten dgn ADR-0008: pure integration layer, tidak duplicate business.
- DND + quota single source of truth di HC — 0 sync issue.
- Q-B-08 (HC quota RPC) + Q-B-09 (HC DND RPC) **tidak relevan** untuk Integration side (HC yang consume, bukan Integration yang RPC ke HC). Bisa closed dari Q-register Integration.
- Send + conversation feature bisa dibangun dgn zero business-logic tech debt di Integration.

### Negatif (yang kami terima)
- Send message via CRM bergantung pada HC service live. Dev/staging tanpa HC = send tidak bisa ditest end-to-end (harus mock HC caller side).
- 1 extra hop CRM → HC → Integration → Meta.
- Retrofit T13 (yang shipped dgn DND + quota port di service) — port bisa tetap ada, tapi adapter default = "always allow" karena HC yang sudah cek. Rekomendasi: **retain port + supply passthrough adapter** untuk backward compat, no primitive rework.

### Migrasi / rollout
1. Amendment `docs/spec/04-integration-channels.md §2.1` (batalkan public send + read endpoint), §2.4 (extend internal RPC catalog).
2. Q-B-08 + Q-B-09 di `PM-STATUS-PARENT.md §3` di-mark `resolved` dgn ref ke ADR ini — HC yang implement checks.
3. Task baru T26 (config CRUD route landing) + T27 (webhook route landing) + T28 (outbound dispatch internal RPC route) + T29 (conversation model + read internal RPC) — semua di-assign ke Slot C per PO ruling 2026-07-08.
4. Ownership WA transisi dari Slot B (Nanak) → Slot C (Satrio). Nanak effectively "done" untuk WA slot B primitive milestone.

## Trigger untuk revisit

- Kalau HC service ternyata tidak jadi expose DND / quota policy (mis. business decision ubah lokasi), revisit dan pertimbangkan Opsi A + local implementation.
- Kalau performance 1-hop CRM→HC→Integration jadi bottleneck real (>500ms p95 send latency), pertimbangkan direct path untuk hot-path saja.
