# Scalability Audit — 2026-07

**Review type:** Scalability Audit
**Cadence:** Quarterly
**Cycle:** 2026-07
**Date:** 2026-07-31
**Reviewer:** Scalability (Automated)
**Baseline:** true
**Status:** Cycle report — remediations update this file; one cycle = one report (do not create separate closeout reports).

> Baseline Scalability Health Check under Framework v1.1 (lifecycle clarified under Framework v1.2). No prior Scalability report existed, so this run is Baseline. Cadence is **Quarterly** per `docs/health/README.md` / `audit-catalog.md` (requested cycle token `2026-07` retained). New Finding: `SCALE-001` (later remediated — see **Resolution History**). Growth ceilings already tracked under Architecture (`ARC-002`, `ARC-003`, `ARC-004`, `ARC-010`, `ARC-011`, and related) are cross-referenced, not duplicated.

---

## Executive summary

First Scalability cycle for EventPixels. Methods: read-only magnitude counts (companies, domains, sponsors, Storage logos); inspect growth-sensitive mechanisms (fetch-all helpers, import match/materialize, `force-dynamic` public SSR, admin search); reconcile against open ARC/PERF/DB IDs before minting SCALE.

Current approximate magnitudes: **~4,583 companies** (~4,561 active), **~6,409 company_domains**, **~7,286 event_sponsors**, **~4,493 company_sponsor_stats**, **~4,136** `company-logos` Storage objects, **93** editions / **38** series. At these sizes, several ceilings already matter operationally; at **10×–100×** they become hard stoppers.

**At publication (2026-07-31):** **1 new** Finding (`SCALE-001`). **0 resolved**. Primary growth risks remain owned by existing Architecture IDs (`ARC-002`/`003`/`004`/`010`/`011`) — referenced only. Strengths: derived `company_sponsor_stats` exists and is populated near company count; import materialization is already chunked (though still client-orchestrated — `ARC-010`); sitemap uses ranged fetch-all with `revalidate = 3600`.

**After remediation (2026-08-02):** `SCALE-001` **Resolved** (alias search via `admin_company_ids_matching_alias` RPC — no full active-company load). Closing evidence in **Resolution History**. Architecture-owned growth ceilings unchanged.

---

## Cross-audit references (existing Findings — not duplicated)

| ID | Topic | 10×–100× growth note (observation only) |
|---|---|---|
| `ARC-002` | Hot-path full-table sponsor counts | Linear DB/SSR cost per anonymous view collapses under traffic × catalog growth |
| `ARC-003` | Import match loads full `companies` / `company_domains` | Match memory/time grows with directory size; already multi-thousand rows |
| `ARC-004` | Public `force-dynamic`; no ISR / request cache | Read traffic growth has no cache absorption layer |
| `ARC-010` | Client-orchestrated chunk materialization; no durable job queue | Larger batches / concurrent importers hit browser + Function duration ceilings |
| `ARC-011` | Three parallel import trees | Ops and capacity work multiplies per pipeline at volume |
| `ARC-008` | No observability | Capacity incidents harder to detect as load grows |
| `ARC-017` | Middleware `getUser()` broadly | Auth overhead scales with request volume (PERF/ARC-primary) |

No `PERF` or `DB` Findings exist yet in the register; measured “slow today” follow-ups should cite these ARC IDs rather than cloning under PERF when the root is unchanged.

---

## Findings

### SCALE-001 — Admin company alias search loads all active companies without pagination

- **Why it matters:** Alias matching in admin company search selects every `status = active` company into the Node process with **no `.range()` / keyset pagination** (`fetchAliasSearchCandidates` in `src/features/companies/server/companyAdminSearch.ts`). PostgREST’s default page cap (~1,000 rows) already silently truncates relative to **~4,561** active companies — alias hits beyond the first page are missed today. At **10×–100×** catalog size the path becomes both incorrect and untenable (memory, latency, Function limits) for a core operator identity workflow (merge/search/pickers).
- **Severity:** High · **Effort:** Medium
- **Evidence (at discovery, 2026-07-31):**
  - `fetchAliasSearchCandidates` — `.from("companies").select(...).eq("status", "active")` with in-memory alias filter; no pagination
  - Contrast: domain branch uses `fetchAllPaginatedSupabaseRows` (unbounded but paged); primary name/slug/domain branch uses filtered `.or(ilike…)` (bounded by match set, still subject to default max rows)
  - Magnitude: ~4,561 active companies (read-only count, 2026-07-31)
- **Status:** Resolved (2026-08-02) — see Resolution History
- **Recommended action:** Replace full-table alias scan with a scalable strategy (e.g. normalized alias table / GIN / RPC search; or server-side filtered query that never loads the full directory). Enforce explicit pagination or a hard candidate cap with deterministic ranking.
- **Scope:** Admin company identity search and any callers of `searchCompaniesAdmin` (merge pickers, drawers, admin company UI).
- **Validation / acceptance criteria:** Alias search never loads the full active companies set into memory; results remain correct as active companies grow past PostgREST default page size; paged or indexed path documented.
- **Uncertainty / false-positive risk:** Low on mechanism; exact PostgREST `max_rows` depends on project config (commonly 1,000). Distinct from `ARC-003` (import match loads full directories by design) — fixing import match does not fix this admin path.
- **Related:** `ARC-003` (same growth class, different call-site/root); future PERF may measure latency citing this ID.

---

## Observations (not tracked)

### Strengths

- `company_sponsor_stats` row count (~4,493) tracks near active companies — a usable derived-read path if hot routes actually use it (many still bypass — see `ARC-002`).
- Import materialization is chunked via admin API routes (capacity partial mitigation; durability still `ARC-010`).
- Sitemap generation uses `fetchAllPaginatedSupabaseRows` + hourly `revalidate` (`src/app/sitemap.ts`) — better than uncached per-hit full scans, though absolute sitemap build cost still grows with catalog size (SEO/PERF may revisit).

### Report-only notes

- **`fetchAllPaginatedSupabaseRows`** (`src/lib/supabase/fetchAllPaginatedRows.ts`) is the shared “load everything” primitive behind import match (`ARC-003`), sitemap, admin domain search, and other paths. Do not open a second Finding for the helper itself; remediate call-sites under their owning IDs.
- **Storage:** ~4,136 objects in `company-logos`. Growth is roughly linear with companies/logos; no lifecycle/retention Finding this cycle (under-track). Revisit if orphan objects or multi-extension churn dominate cost.
- **Exhibitors:** only ~56 `event_exhibitors` rows today — exhibitor import scale risk is structural (`ARC-011`/`010`) more than data volume yet.
- **Platform:** Vercel Function duration/payload and Supabase page size remain binding constraints for `ARC-010` chunk APIs and full-directory loads; no separate SCALE ID.
- **Cadence:** Framework schedules Scalability **Quarterly**; this baseline uses the requested cycle token `2026-07`.

### Limitations

- No Vercel/Supabase dashboard quota export this cycle; magnitudes from read-only SQL only.
- Did not load-test production; 10×–100× modes are mechanism extrapolations.
- Working-tree Architecture report path `architecture/2026-07-architecture.md` may be inconsistent with git history; ARC IDs cited from the Findings Register and known baseline content.

---

## Resolution History

### 2026-08-02 — SCALE-001 resolved

- **Acceptance criteria:** Alias search never loads the full active companies set into memory; results remain correct as active companies grow past PostgREST default page size; paged or indexed path documented.
- **Closing evidence (verified 2026-08-02):**
  - `fetchAliasSearchCandidates` (`companyAdminSearch.ts`) calls RPC `admin_company_ids_matching_alias`, then `.in("id", matchedIds)` — no select of all active companies.
  - Migration `supabase/migrations/20260731130000_admin_company_ids_matching_alias.sql` — SQL alias filter with `LIMIT` (capped at 1000); `service_role` execute only.
  - Guard test `companyAdminSearch.scale001.test.ts` asserts RPC usage and migration presence.
  - Commit: `a0419fb` (*fix: move admin alias search to database RPC*).
- **Why criteria pass:** Full active-company directory is never loaded into Node for alias search; matching is server-side with a hard candidate cap. Distinct from retired `ARC-003` (import full-directory match — resolved 2026-08-04).

---

## Change log

| Date | Note |
|------|------|
| 2026-07-31 | Baseline Scalability Audit published. Added `SCALE-001`. Cross-referenced `ARC-002/003/004/008/010/011/017` (no duplicates). No issues fixed during the review. |
| 2026-08-02 | Resolved `SCALE-001` after alias RPC shipped. Closing evidence in Resolution History. |
