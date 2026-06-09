# Phase 3 — Sponsor Import API

**Status:** Implemented  
**Version:** v1  

Admin-only API for full sponsor import batch lifecycle. No UI (Phase 4).

**Locked decisions:** D1–D6 from architecture review (bulk accept before draft, max tier wins, atomic publish RPC, skip resolved/excluded on re-match, 500 row cap, private `sponsor-imports` bucket).

---

## API base

`/api/admin/sponsor-imports/*` — all routes require `requireAdminApi()` (401/403 otherwise).

Writes use `createAdminClient()` (service role).

---

## Lifecycle (call order)

1. `POST /batches` — upload file + `event_edition_id`
2. `PATCH /batches/[id]/column-mapping` — optional re-parse
3. `POST /batches/[id]/validate`
4. `POST /batches/[id]/match`
5. `POST /batches/[id]/rows/bulk-accept-domains` — **required** before draft (D1)
6. `PATCH /batches/[id]/rows/[rowId]` — resolve remaining rows / duplicates
7. `POST /batches/[id]/import-to-draft`
8. `GET /batches/[id]/draft-links` — diff vs live
9. `POST /batches/[id]/acknowledge-review`
10. `POST /batches/[id]/publish` — atomic via `sponsor_import_publish_batch` RPC

Discard anytime from `uploaded|review|draft`: `POST /batches/[id]/discard`

---

## Migrations

| File | Purpose |
|------|---------|
| `20260610120000_sponsor_import_phase2.sql` | Import tables (Phase 2) |
| `20260611120000_sponsor_import_publish_rpc.sql` | Atomic publish RPC (Phase 3) |

---

## Modules

`src/features/sponsor-import/server/`
