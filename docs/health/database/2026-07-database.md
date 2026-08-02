# Database Audit — 2026-07

**Review type:** Database Audit
**Cadence:** Monthly
**Cycle:** 2026-07
**Date:** 2026-08-02
**Reviewer:** Database (Automated)
**Baseline:** true
**Status:** Cycle report — remediations update this file; one cycle = one report (do not create separate closeout reports).

> Baseline Database Health Check under Framework v1.2. No prior Database report existed, so this run is Baseline. Cadence is **Monthly** per `docs/health/README.md` / `audit-catalog.md` (requested cycle token `2026-07` retained). New Findings: `DB-001`…`DB-003`. Topics already owned by Architecture, Security, Data Quality, or Scalability are cross-referenced, not duplicated.

---

## Executive summary

First Database cycle for EventPixels. Methods: read-only review of `supabase/migrations/` (68 files), live catalog checks via linked Supabase (RPC privileges, FK definitions, legacy table presence/counts), and cross-check against product design docs for roster join delete semantics.

Net change: **3 new** Findings (`DB-001`…`DB-003`). **0 resolved**. Highest risk: `exhibitor_import_publish_batch` reintroduced the known SECURITY DEFINER grant bug (anon/authenticated EXECUTE) after the July 18 service-role restriction hotfix. Additional integrity/maintainability gaps: `event_sponsors` edition FK uses `ON DELETE CASCADE` while sibling roster joins use `RESTRICT`; rejected legacy `organizers` / `event_organizers` tables still exist outside the migration chain.

Strengths: join UNIQUEs on sponsors/exhibitors/organizers/PA version members; consistent `SET search_path = public` on SECURITY DEFINER functions; admin RPCs covered by `__restrict_rpc_execute_to_service_role` (sponsor publish, merge, set primary) remain service-role-only in live catalog.

---

## Surfaces in scope

| Surface | Notes |
|---|---|
| Migrations | `supabase/migrations/` chain (through `20260801120000_…`) |
| Live catalog | RPC EXECUTE privileges; `event_sponsors` FKs; legacy organizer tables |
| Core joins | `event_sponsors`, `event_exhibitors`, `event_edition_organizers`, PA version companies |
| Admin DEFINER RPCs | publish/merge/primary-domain helpers vs grant helper |
| Derived | `company_sponsor_stats` (VIEW — not a stored aggregate) |

**Exclusions:** App-layer service-role fail-open (`ARC-001`); unbounded import match / job queue (`ARC-003`/`ARC-010`); dirty-row populations (`DQ-*`); SQL style / alternative schema taste; implementing migrations in this review.

---

## Cross-audit references (existing Findings — not duplicated)

| ID | Topic | DB note (observation only) |
|---|---|---|
| `ARC-001` | Service-role bypass / fail-open on public reads | Resolved 2026-08-02 — Architecture Resolution History; not refiled as DB |
| `ARC-009` | No RLS/grant regression-test harness | Would have caught `DB-001` reintroduction; keep under ARC |
| `SEC-003` | SSRF on logo/website ingest | Not a schema modeling Finding |
| `DQ-001`–`DQ-003` | Stored-data trust / incompleteness / shells | Values, not missing constraints (join UNIQUEs healthy) |
| `ARC-002`/`ARC-003`/`ARC-010` | Hot-path scans / full-directory match / no durable jobs | App/scale — not DB constraint craft |
| `ARC-006` | Untyped DB access | Client typing — not schema integrity |

---

## Findings

### DB-001 — `exhibitor_import_publish_batch` executable by anon/authenticated after grant hotfix

- **Why it matters:** A SECURITY DEFINER publish RPC writes live `event_exhibitors` and mutates import batch status. After `20260718120000_revoke_admin_rpc_execute_from_public_roles.sql` documented that `REVOKE FROM PUBLIC` alone is insufficient and introduced `__restrict_rpc_execute_to_service_role`, the later exhibitor import migration created `exhibitor_import_publish_batch` with only `REVOKE … FROM PUBLIC` + `GRANT … TO service_role` — **without** explicit revoke from `anon`/`authenticated`. Live catalog shows `anon` and `authenticated` still have EXECUTE. PostgREST can therefore expose an admin publish path that sibling `sponsor_import_publish_batch` correctly closed.
- **Severity:** High · **Effort:** Small
- **Evidence:**
  - Migration `supabase/migrations/20260726120000_exhibitor_import_v1.sql` — `CREATE OR REPLACE FUNCTION public.exhibitor_import_publish_batch(uuid, uuid)` SECURITY DEFINER + `SET search_path = public`; grants at end: `REVOKE ALL … FROM PUBLIC` + `GRANT EXECUTE … TO service_role` only (no `__restrict_rpc_execute_to_service_role`, no `REVOKE … FROM anon, authenticated`)
  - Contrast: `supabase/migrations/20260718120000_revoke_admin_rpc_execute_from_public_roles.sql` — helper + hard-fix list including `sponsor_import_publish_batch`
  - Later migrations correctly call `__restrict_rpc_execute_to_service_role` for new admin RPCs (e.g. `20260731130000_admin_company_ids_matching_alias.sql`, exhibitor reorder helpers in `20260725130000_event_exhibitors_v1.sql`)
  - Live (2026-08-02): `has_function_privilege` — `exhibitor_import_publish_batch` anon_exec=true, auth_exec=true; `sponsor_import_publish_batch` / `merge_companies` / `set_company_primary_domain` anon_exec=false
- **Status:** Open
- **Recommended action:** Apply `__restrict_rpc_execute_to_service_role('public.exhibitor_import_publish_batch(uuid, uuid)')` (or equivalent explicit REVOKEs) in a new migration; make that helper mandatory in the exhibitor-import DEFINER template; keep `ARC-009` as the missing regression harness.
- **Scope:** `exhibitor_import_publish_batch` privileges; exhibitor import publish path.
- **Validation / acceptance criteria:** Live `has_function_privilege('anon'|'authenticated', exhibitor_import_publish_batch, 'EXECUTE') = false`; service_role retains EXECUTE; PostgREST anon/member cannot invoke publish; migration uses the shared restrict helper.
- **Uncertainty / false-positive risk:** Low on privileges (live-verified). App may already gate via `requireAdminApi` — does not remove PostgREST/RPC exposure.
- **Related:** `ARC-009` (harness); not a clone of `ARC-001`.

---

### DB-002 — `event_sponsors` edition FK uses `ON DELETE CASCADE` unlike sibling roster joins

- **Why it matters:** Deleting an `event_editions` row silently cascades away all sponsor links (~7.3k live rows class). Sibling roster tables introduced later (`event_exhibitors`, `event_edition_organizers`) use `ON DELETE RESTRICT` and design docs explicitly reject silent CASCADE for edition company joins. Asymmetric FK delete modeling makes edition deletion unsafe/surprising and can destroy sponsorship history without an application-level guard.
- **Severity:** Medium · **Effort:** Small
- **Evidence:**
  - Live: `event_sponsors_event_editions_id_fkey` → `FOREIGN KEY (event_editions_id) REFERENCES event_editions(id) ON DELETE CASCADE`; `event_sponsors_company_id_fkey` → `companies(id)` (no CASCADE)
  - `supabase/migrations/20260725130000_event_exhibitors_v1.sql` — `event_editions_id … ON DELETE RESTRICT`
  - `supabase/migrations/20260708120000_organizers_v1.sql` — `event_editions_id … ON DELETE RESTRICT`
  - `docs/organizer-design.md` / `docs/exhibitor-design.md` — RESTRICT for edition↔company joins
- **Status:** Open
- **Recommended action:** Migrate `event_sponsors.event_editions_id` FK to `ON DELETE RESTRICT` (or document an explicit product exception with compensating app/RPC guards); verify edition delete blocked while sponsors exist.
- **Scope:** `event_sponsors` → `event_editions` FK delete action.
- **Validation / acceptance criteria:** Constraint definition is `ON DELETE RESTRICT` (or approved documented exception); attempt to delete edition with sponsors fails at DB; exhibitors/organizers semantics remain RESTRICT.
- **Uncertainty / false-positive risk:** Low on asymmetry. CASCADE may be intentional legacy — still fails consistency with shipped sibling models and design docs without an explicit exception record.
- **Related:** None existing under DB; not DQ (constraint modeling, not dirty rows).

---

### DB-003 — Rejected legacy `organizers` / `event_organizers` tables remain outside the migration chain

- **Why it matters:** Product design rejects a separate `organizers` entity and `event_organizers` join in favor of `event_edition_organizers`. Live database still has `organizers` and `event_organizers` (~4 rows each) with no creating migration under `supabase/migrations/`, while the canonical table has ~87 rows. Schema drift outside the migration chain risks backup/restore confusion, accidental dual-model writes, and unsafe CASCADE FKs on a rejected shape.
- **Severity:** Medium · **Effort:** Medium
- **Evidence:**
  - Live: `to_regclass` resolves `organizers`, `event_organizers`, and `event_edition_organizers`; counts 4 / 4 / 87
  - `rg` over `supabase/migrations/` — no `CREATE TABLE` for `organizers` / `event_organizers`
  - `docs/organizer-design.md` — early `event_organizers` + `organizers` direction **rejected**; v1 is `event_edition_organizers` only
  - Data Quality 2026-07 noted non-public legacy organizer tables as handoff to DB/HYG (not filed as DQ)
- **Status:** Open
- **Recommended action:** Confirm no app path still reads/writes legacy tables; migrate any still-valid links into `event_edition_organizers` if needed; drop `organizers` / `event_organizers` via migration; align backup/docs inventories with live schema.
- **Scope:** Legacy organizer tables + migration chain completeness.
- **Validation / acceptance criteria:** Legacy tables absent (or archived with explicit migration); zero application references; `event_edition_organizers` remains the only organizer join; docs/backup lists match.
- **Uncertainty / false-positive risk:** Low on presence/drift. Row content may be obsolete stubs — still a maintainability defect while tables exist outside migrations.
- **Related:** Design docs; not `PROD` (capability exists via edition organizers).

---

## Observations (not tracked)

### Strengths

- Join uniqueness is enforced for sponsors (`event_sponsors_event_editions_id_company_id_unique`), exhibitors, organizers, and Partner Alumni version members.
- SECURITY DEFINER functions in the migration corpus consistently set `search_path = public`.
- Admin grant hotfix helper `__restrict_rpc_execute_to_service_role` correctly locked sponsor publish, merge, and set-primary (live-verified); pattern reused by later RPCs (alias search, exhibitor reorder).
- `company_domains` has global unique domain, one-primary partial unique, and FK RESTRICT.
- Import batches use partial unique “one active batch” indexes (sponsor / exhibitor / PA).
- `company_sponsor_stats` is a VIEW (not an unconstrained stored aggregate table) — no storage-drift Finding.

### Report-only notes

- **`companies` RLS `USING (true)` vs `restricted_at`:** Restriction is app/RPC-filtered today; public fail-open service-role reliance under `ARC-001` was resolved 2026-08-02 — not a separate DB constraint Finding this cycle (`companies_restricted_active_only` CHECK exists for active-only restriction).
- **Primary domain dual-store (`companies.domain` vs `company_domains`):** Sync is RPC-mediated; repair migrations exist; live drift was not filed (under-track vs opening a fourth Finding).
- **`__company_matches_verified_domain_search` / `handle_new_user` DEFINER EXECUTE for anon:** Intentional helpers (discovery / auth trigger) — not admin publish RPCs.
- **Import draft retention:** No archival model; live volumes small — speculative archival rejected without ops evidence.
- **Rejected without Finding:** further normalization of roster tables; renaming columns for taste; “add more CHECK constraints” without evidenced invalid writes.

### Limitations

- Did not re-read every historical migration line-by-line; focused on joins, DEFINER grants, FKs, derived objects, and live privilege verification.
- No EXPLAIN/perf work (PERF/ARC).
- Cadence Monthly; cycle token `2026-07` as requested (review date 2026-08-02).

---

## Change log

| Date | Note |
|------|------|
| 2026-08-02 | Baseline Database Audit published. Added `DB-001`…`DB-003` (all `Open`). Cross-referenced `ARC-001`/`009`, `SEC-003`, `DQ-001`–`003`, `ARC-002`/`003`/`006`/`010`. Cadence Monthly; cycle token `2026-07` as requested. |
