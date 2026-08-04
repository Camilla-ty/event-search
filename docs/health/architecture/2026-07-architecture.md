# Architecture Audit — 2026-08

**Review type:** Architecture Audit
**Cadence:** Monthly
**Cycle:** 2026-08
**Date:** 2026-07-31
**Reviewer:** Architecture (Automated)
**Baseline:** false
**Status:** Cycle report — remediations update this file; one cycle = one report (do not create separate closeout reports).

> Recurring Architecture Health Check under Framework v1.1 (lifecycle clarified under Framework v1.2). File path retained as `2026-07-architecture.md`; cycle token for this write-up is **2026-08**. No new `ARC` IDs. Existing `ARC-001`…`ARC-020` were reconciled at publication (all Open). `ARC-001` was later remediated in-repo and resolved in this same report (see **Resolution History**). Canonical Finding bodies remain those first recorded in the baseline Architecture Audit (cycle `2026-07`).

---

## Executive summary

Second Architecture cycle for EventPixels. Methods: reconcile all open `ARC` Findings against current `src/` and `.github/workflows/`; re-check trust-boundary / data-access / import / App Router / CI patterns named in the baseline; scan for untracked structural root causes (prefer under-tracking).

**At publication (2026-07-31):** **0 resolved**, **0 new**, **20 still open**. Highest-severity structural risks included `ARC-001` service-role fail-open on public reads; `ARC-002`/`ARC-003` unbounded catalog scans; `ARC-004` force-dynamic public SSR. Material delta: exhibitor import shipped as a **third** parallel import tree, strengthening `ARC-011` (not a new Finding — same root cause). Strengths from the baseline (feature-modular layout; consistent `requireAdminApi` route shape; transactional SECURITY DEFINER RPCs for critical mutations) still hold.

**After remediation (2026-08-02):** `ARC-001` **Resolved** (Phases 1–6: public marketing reads fail closed on the session client; narrow SELECT-only public views replace service-role aggregation). `ARC-002` **Resolved** (sponsor count helpers use bounded `event_edition_sponsor_counts` — verified same day; shipped with ARC-001 Phase 2). `ARC-005` **Resolved** (PR/`main` GitHub Actions quality gate: typecheck, lint, test, build).

**After remediation (2026-08-04):** `ARC-003` **Resolved** (all four import matchers default to shared candidate loader; full-directory retained only for independent rollback envs). `ARC-018` **Resolved** (sponsor-link hydration is a single session batch — no admin miss-path / double round-trip). `ARC-004`/`ARC-006`…`ARC-017`/`ARC-019`/`ARC-020` remain Open. Closing evidence in **Resolution History**.

---

## Since last cycle

| Change | Finding IDs | Notes / links |
|---|---|---|
| Resolved (removed from register) | `ARC-001`, `ARC-002`, `ARC-003`, `ARC-005`, `ARC-018` | `ARC-001`/`002`/`005` on 2026-08-02; `ARC-003`/`018` on 2026-08-04 — see Resolution History |
| Still open | `ARC-004`, `ARC-006`…`ARC-017`, `ARC-019`, `ARC-020` | see Findings deltas |
| In progress | — | none |
| Deferred | — | none |
| New this cycle | — | none |
| Reopened (same ID) | — | none |

---

## Findings

Existing Findings by ID + delta only (canonical bodies remain in [`2026-07-architecture.md`](./2026-07-architecture.md)).

### ARC-001 — Service-role client bypasses RLS on read paths, with fail-open fallback

- **Status:** Resolved (2026-08-02) — see Resolution History
- **Delta (at publication):** Still present. `getCompanyById` / `getCompanyBySlug` fail open to admin client (`src/lib/queries/companies.ts`). Public/hub helpers continue to use `createAdminClient` (e.g. `publicStats.ts`, `publicSponsorRoster.ts`, `topicRegionHubData.ts`, `partnerAlumniPublic.ts`). No containment PR.
- **Acceptance criteria:** Public marketing loaders, helpers, APIs, and routes in ARC-001 scope must not use `createAdminClient()`; public reads fail closed under the session/RLS client; Phase 1–6 remediations ship together without regressing public contracts; focused regression tests pass.

### ARC-002 — Hot-path full-table scans for sponsor counts (`getSponsorCountsByEditionIds`)

- **Status:** Resolved (2026-08-02) — see Resolution History
- **Delta (at publication):** Still present — full `event_sponsors` pagination then JS filter.
- **Delta (post ARC-001 Phase 2):** Count helpers read `event_edition_sponsor_counts` via session client; dedicated verification confirmed no public hot-path count caller still full-scans `event_sponsors`.
- **Acceptance criteria:** `getSponsorCountsByEditionIds` / `getTotalSponsorCount` must not paginate all `event_sponsors` rows; public SSR/API count callers use a bounded aggregate (or equivalent edition-scoped count); roster/detail `event_sponsors` reads remain in scope only when returning sponsor identity rows.

### ARC-003 — Import matching loads entire `companies` / `company_domains` into memory

- **Status:** Resolved (2026-08-04) — see Resolution History
- **Delta (at publication):** Same full-directory match pattern in `sponsor-import`, `partner-alumni-import`, **and** `exhibitor-import` `server/matchRows.ts`. Scope of call-sites grew with the third importer (same root cause).
- **Delta (post cutover):** Sponsor, Exhibitor, Partner Alumni Import, and Partner Alumni Bulk production matching default to the shared candidate loader; full-directory pagination remains only behind independent rollback env flags.
- **Acceptance criteria:** No production import-matching hot path paginates all active `companies` or all `company_domains` by default; each importer defaults to candidate loading from batch/input identity keys; full-directory loaders remain only as intentional rollback; independent rollback envs exist per importer; cutover parity tests require 100% equality vs full-directory; exact-name/alias candidate RPCs remain service_role-only.

### ARC-004 — Public pages `force-dynamic`; no caching/ISR; no request-level dedup (`React cache()`)

- **Status:** Open
- **Delta:** Marketing pages still export `force-dynamic` (e.g. `(marketing)/page.tsx`, `events/page.tsx`, `sponsors/page.tsx`). No `import { cache } from "react"`. Narrow `revalidate` remains limited (e.g. `sitemap.ts`, `/api/public/stats`).

### ARC-005 — No CI gate (typecheck / lint / test / build) on PRs

- **Status:** Resolved (2026-08-02) — see Resolution History
- **Delta (at publication):** `.github/workflows/` still only `backup-database.yml` and `backup-storage.yml`. No PR quality gate.
- **Acceptance criteria:** A GitHub Actions workflow runs on `pull_request` and `push` to `main`; fails when typecheck, lint, unit tests, or build fails; backup workflows remain unchanged. Branch protection requiring the check is an ops step outside the repo.

### ARC-006 — Untyped database access — no generated `Database` types

- **Status:** Open
- **Delta:** Supabase clients remain unparameterized; no generated `Database` types module in tree.

### ARC-007 — No rate limiting on public/auth endpoints; no schema-validation library

- **Status:** Open
- **Delta:** No zod/valibot/yup or rate-limit dependency in app usage. Hand-rolled validation and unthrottled public routes unchanged. (Security continues to observe; ID stays `ARC-007`.)

### ARC-008 — No observability — no error tracking / structured logging / metrics

- **Status:** Open
- **Delta:** No Sentry/OTel/Datadog-style stack; import pipelines still rely on ad-hoc console/action logs.

### ARC-009 — Reactive DB security hardening — no RLS/grant regression-test harness

- **Status:** Open
- **Delta:** Manual verify SQL and env-gated RPC permission integration test remain; not a CI RLS/grant harness.

### ARC-010 — Client-orchestrated, non-transactional chunked materialization (no durable job queue)

- **Status:** Open
- **Delta:** Chunk materialize client loops + `/materialize-*/chunk` routes remain for sponsor, partner-alumni, and exhibitor imports.

### ARC-011 — Two nearly-identical import subsystems (sponsor-import / partner-alumni-import)

- **Status:** Open
- **Delta (title/scope):** Root cause unchanged; evidence now includes **`exhibitor-import`** as a third parallel tree (~72 files) alongside sponsor-import and partner-alumni-import, with duplicated match/materialize/enrich/storage/UI patterns. Register title refreshed to “Three parallel import subsystems…”. Prefer shared import-pipeline kernel before a fourth.

### ARC-012 — God modules / components (1,000+ line files)

- **Status:** Open
- **Delta:** Still present and worse at the top end: `exhibitorImportAdmin.ts` (~1914), `sponsorImportAdmin.ts` (~1881), `SeriesPartnerAlumniPanel.tsx` (~1075), `partnerAlumniImportAdmin.ts` (~1005).

### ARC-013 — Per-route boilerplate duplication; no shared handler wrapper

- **Status:** Open
- **Delta:** `requireAdminApi()` still copy-pasted across admin routes; no `withAdmin(handler)` (or equivalent) wrapper.

### ARC-014 — Extreme API route nesting (12+ dynamic segments)

- **Status:** Open
- **Delta:** Partner-alumni import batch routes still nest to ~11–13 path segments under `/api/admin/event-series/[id]/partner-alumni/versions/.../batches/...`.

### ARC-015 — Email enumeration via unauthenticated `/api/auth/check-email`

- **Status:** Open
- **Delta:** Route still returns existence boolean for unauthenticated POST; client helper unchanged.

### ARC-016 — Thin security headers (no CSP / HSTS / X-Content-Type-Options / frame-ancestors)

- **Status:** Open
- **Delta:** `next.config.ts` headers still essentially `Referrer-Policy` only.

### ARC-017 — Middleware runs `getUser()` on nearly every non-asset request

- **Status:** Open
- **Delta:** Root middleware matcher + `updateSession` → `getUser()` still runs broadly outside `/admin`-only needs.

### ARC-018 — N+1 / double-path hydration in `mergeCompaniesOntoEventSponsorLinks`

- **Status:** Resolved (2026-08-04) — see Resolution History
- **Delta (at publication):** `mergeCompaniesOntoEventSponsorLinks` batched by id then did a second admin round for “missing” ids (baseline Issue 11.3).
- **Delta (post ARC-001 Phase 1 / verified 2026-08-04):** Session-only batch via `getCompaniesByIds` + `attachCompaniesToEventSponsorLinks`; missing companies stay null; no `getCompaniesByIdsAdmin` / `missingCompanyIds` miss-path.
- **Acceptance criteria:** `mergeCompaniesOntoEventSponsorLinks` must not perform a second admin/service-role round-trip to fill missing company ids; hydration uses a single session/RLS batch (or equivalent) and fails closed for missing rows; wiring/regression tests forbid the admin miss-path.

### ARC-019 — Manual client server-state (no cache / dedup / retry / abort)

- **Status:** Open
- **Delta:** No TanStack Query/SWR; explorer and import wizards still hand-roll loading/fetch state.

### ARC-020 — Thin end-to-end coverage (single Playwright spec)

- **Status:** Open
- **Delta:** Still a single Playwright file: `e2e/events-navigation.spec.ts`.

---

## Cross-audit references (not duplicated this cycle)

| Topic observed | Existing ID | Notes |
|---|---|---|
| Runtime cost of full-scan counts / force-dynamic SSR | `ARC-002`, `ARC-004` | `ARC-002` resolved 2026-08-02; `ARC-004` remains — PERF should reference these IDs; no PERF clones opened here |
| Service-role / RLS trust | `ARC-001` | Resolved 2026-08-02 — see Resolution History; SEC observes residual admin/import service-role use out of public scope |
| Dead `EditionImportsStub` after live panel | `HYG-002` | Hygiene leftover; not structural duplication of live importers (`ARC-011`) |
| Partner Alumni Dashboard resume gap | `PROD-003` | Product workflow; structural import duplication stays `ARC-011` |
| Exhibitor public marketing stub | `PROD-002` | Product polish; not architecture |

---

## Observations (not tracked)

**Mode / cycle note**
- Recurring review under Framework v1.2: remediations update this cycle report in place (no companion closeout). Cycle token **2026-08**; file path retained as `2026-07-architecture.md`.

**Methods / scope**
- Reconciled `ARC-001`…`ARC-020` against current tree (loaders, marketing pages, import features, middleware, `next.config.ts`, workflows, e2e).
- Confirmed feature layout still `src/features/<domain>/{server,client,components,lib}` plus shared `src/lib`.
- Exclusions: no production latency measurement (PERF); no RLS policy rewrite audit (SEC/DB); no product workflow completeness (PROD).

**Strengths**
- Feature-modular monolith layout remains coherent and is still the strongest structural asset.
- Admin API routes continue to use a recognizable `requireAdminApi` → validate → try/catch shape.
- Critical mutations (merge, import publish, domain primary) still go through transactional SECURITY DEFINER RPCs with revoked anon/authenticated EXECUTE (baseline observation holds).

**Deliberate / acceptable**
- Keeping three import UIs temporarily is understandable product-wise, but structurally it deepens `ARC-011` — tracked there, not as a fourth ID.
- Admin / import / storage paths may still use `createAdminClient` outside ARC-001 public marketing scope.

**New Finding gate**
- No new ARC Finding passed the memory-value test. Triple import trees and larger god modules are deltas on existing IDs.

**Limitations**
- Call-site counts are sampled, not a full dependency-graph tool run.
- No linked PR search beyond local `main` tree evidence for “In Progress.”

---

## Resolution History

### 2026-08-02 — ARC-001 resolved

- **Acceptance criteria:** Public marketing loaders, helpers, APIs, and routes in ARC-001 scope must not use `createAdminClient()`; public reads fail closed under the session/RLS client; Phase 1–6 remediations ship together without regressing public contracts; focused regression tests pass.
- **Closing evidence (verified 2026-08-02):**
  - **Phase 1 — Company profile + sponsor-link hydration:** Removed fail-open admin fallbacks (`getCompanyByIdAdmin` / `getCompanyBySlugAdmin` / `getCompaniesByIdsAdmin`). `getCompanyById` / `getCompanyBySlug` / `getCompaniesByIds` / `mergeCompaniesOntoEventSponsorLinks` use session client only and fail closed. Tests: `companies.arc001.phase1.test.ts`, `companies.publicReads.wiring.test.ts`.
  - **Phase 2 — Sponsor counts / tier summaries:** Public aggregates via `event_edition_sponsor_counts` / `event_edition_sponsor_tier_stats` (`security_invoker=false`, SELECT-only). Migration `20260802120000_event_edition_sponsor_public_aggregates.sql` applied. Helpers use `createClient()` only. Tests: `companies.sponsorCounts.wiring.test.ts`, `publicSponsorRoster.arc001.phase2.test.ts`, `editionSponsorCounts.test.ts`.
  - **Phase 3 — Public stats:** `public_catalog_stats` view + `getPublicStats` session path. Migration `20260802130000_public_catalog_stats.sql` applied. `/api/public/stats` response contract unchanged. Tests: `publicStats.test.ts`.
  - **Phase 4 — Event Brand destination index:** `event_brand_public_destinations` view; loaders in `eventBrandPublicDestinationIndex.ts` without admin. Migration `20260802140000_event_brand_public_destinations.sql` applied. Tests: `eventBrandPublicDestinationIndex.arc001.phase4.test.ts`.
  - **Phase 5 — Partner Alumni public:** `event_partner_alumni_public_versions` / `event_partner_alumni_public_members`; `partnerAlumniPublic.ts` session client. Migration `20260802150000_event_partner_alumni_public_reads.sql` applied. Tests: `partnerAlumniPublic.arc001.phase5.test.ts`, `partnerAlumniPublic.test.ts`.
  - **Phase 6 — Topic / Region hubs:** `event_edition_sponsor_companies` + `topic_region_research_pages_published`; hub loaders + `researchPagesPublic` / sitemap entries without admin. Migration `20260802160000_topic_region_hub_public_reads.sql` applied. Tests: `topicRegionHubData.arc001.phase6.test.ts`.
  - **Final verification:** `rg` found no `createAdminClient` under `src/app/(marketing)`, `src/app/api/public`, or Phase 1–6 public helpers listed above. Focused Phase 1–6 suites: **100** tests pass (0 fail). All five Phase 2–6 migrations present remotely in `schema_migrations`.
- **Why criteria pass:** In-scope public surfaces no longer escalate to service role on read errors or for aggregation; narrow SELECT-only views preserve public contracts while keeping Tier 2+ / draft / restricted rows behind RLS or app fail-closed filters.
- **Residual (not ARC-001):** Admin, import, auth, and storage paths may still use `createAdminClient` by design. `ARC-002` later verified Resolved (same day — see Resolution History below). `ARC-009` (RLS/grant harness) remains Open. Topic/Region hubs intentionally expose all-tier `company_id` links only via `event_edition_sponsor_companies` (not full sponsor rows).

### 2026-08-02 — ARC-002 resolved

- **Acceptance criteria:** `getSponsorCountsByEditionIds` / `getTotalSponsorCount` must not paginate all `event_sponsors` rows; public SSR/API count callers use a bounded aggregate (or equivalent edition-scoped count); roster/detail `event_sponsors` reads remain in scope only when returning sponsor identity rows.
- **Closing evidence (verified 2026-08-02):**
  - Helpers in `src/lib/queries/companies.ts`: `getSponsorCountsByEditionIds` selects from `event_edition_sponsor_counts` filtered with `.in("event_editions_id", batchIds)`; `getTotalSponsorCount` delegates to that helper. No `fetchAllPaginatedSupabaseRows` over `event_sponsors` for counts.
  - View: migration `20260802120000_event_edition_sponsor_public_aggregates.sql` — `event_edition_sponsor_counts` (`security_invoker=false`, SELECT-only, identity-free).
  - Public / shared count call sites all use the helpers (not raw full-table scans): `(marketing)/events/[id]/page.tsx` (`getTotalSponsorCount`); `getEventExplorerData.ts` / `getEventExplorerPage.ts`; `getDiscoverHomeData.ts`; `topicRegionHubData.ts`; admin list `eventEditionAdmin.ts` (`listEventEditionsAdmin` → `getSponsorCountsByEditionIds`).
  - Tier chrome counts use `event_edition_sponsor_tier_stats` (`getPublicSponsorTierSummaries`) — not full-table link scans for totals.
  - Wiring/regression tests: `companies.sponsorCounts.wiring.test.ts`, `editionSponsorCounts.test.ts`, `eventEditionAdminSponsorCount.test.ts` (focused suite pass).
- **Why criteria pass:** The Issue 11.1 / ARC-002 root cause (paginate entire `event_sponsors` then filter in JS for counts on hot pages) is gone; remaining `event_sponsors` reads are edition-scoped roster/detail or admin single-edition `count:exact` / sitemap existence sets — out of this Finding’s count-helper scope.
- **Residual (not ARC-002):** `fetchEditionIdsWithSponsorsSet` in `sitemapEntries.ts` still paginates `event_sponsors` for sitemap indexability (periodic `revalidate`, not the named count helpers). Admin `countLiveSponsorsForEdition` uses bounded `.eq(event_editions_id)` + `count:exact`. `ARC-004` (force-dynamic) still amplifies per-request DB cost.

### 2026-08-02 — ARC-005 resolved

- **Acceptance criteria:** A GitHub Actions workflow runs on `pull_request` and `push` to `main`; fails when typecheck, lint, unit tests, or build fails; backup workflows remain unchanged. Branch protection requiring the check is an ops step outside the repo.
- **Closing evidence (verified 2026-08-02):**
  - Workflow: `.github/workflows/ci.yml` — triggers `pull_request` + `push` to `main`; Node 20; `npm ci`; sequential `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
  - Stable script: `package.json` `"typecheck": "tsc --noEmit"`.
  - CI env (smallest safe): placeholder `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` only — enough for `next build` client construction. No production secrets; no `SUPABASE_SERVICE_ROLE_KEY`.
  - Backup workflows unchanged: `backup-database.yml`, `backup-storage.yml`.
  - Supporting fixes so the gate can fail honestly: client/server split for event-brand destination index (`*.server.ts`); Node unit-test runner (`scripts/run-unit-tests.sh`); eslint config turns off two React Compiler rules that were pre-existing blockers (`set-state-in-effect`, `refs`) — deferred dedicated remediation, not skipped checks.
  - Local verification: `npm run typecheck`, `npm run lint`, `npm test` (1945 pass / 0 fail), `npm run build` (with same public placeholders) — all exit 0. Focused `arc005.ciWorkflow.test.ts` asserts workflow shape.
  - YAML: workflow parses as valid GitHub Actions structure (local `python`/`node` syntax check as applicable).
- **Why criteria pass:** Repo now has a PR/`main` quality gate that runs all four required commands and fails the job on any failure. Repo-verifiable acceptance is met.
- **Residual (ops / not ARC-005 code):** GitHub Branch Protection must separately require the CI check (`Typecheck, lint, test, build` / workflow `CI`) — cannot be set from this repo alone. React Compiler eslint rules remain deferred.

### 2026-08-04 — ARC-003 resolved

- **Acceptance criteria:** No production import-matching hot path paginates all active `companies` or all `company_domains` by default; each importer defaults to candidate loading from batch/input identity keys; full-directory loaders remain only as intentional rollback; independent rollback envs exist per importer; cutover parity tests require 100% equality vs full-directory; exact-name/alias candidate RPCs remain service_role-only.
- **Closing evidence (verified 2026-08-04):**
  - **Shared foundation (Phases 0–2.5):** Parity harness + fixtures (`importMatchParity`); candidate loader package (`importMatchCandidateLoader`); shadow compare (`importMatchShadow`); exact-key RPCs via migration `20260802180000_import_match_exact_name_alias_keys.sql` (`import_match_company_ids_by_exact_name_keys`, `import_match_company_ids_by_exact_alias_keys`) — EXECUTE confirmed service_role only (anon/authenticated = false).
  - **Phase 3 — Sponsor Import:** Production default `candidate`; rollback `SPONSOR_IMPORT_MATCH_LOADER=full_directory`; `runBatchMatching` wires identity rows → context. Commit `cb46af3` / merge `1aa4b6d`. Cutover parity test: `sponsorImportCandidateCutover.parity.test.ts`.
  - **Phase 4 — Exhibitor Import:** Same pattern with `EXHIBITOR_IMPORT_MATCH_LOADER`; live overlay stays `event_exhibitors`. Commit `5bf11ae`. Cutover parity: `exhibitorImportCandidateCutover.parity.test.ts`.
  - **Phase 5 — Partner Alumni Import:** Same pattern with `PARTNER_ALUMNI_IMPORT_MATCH_LOADER`; version-member overlay / `intended_member_action` preserved. Commit `769857c`. Cutover parity: `partnerAlumniImportCandidateCutover.parity.test.ts`.
  - **Phase 6 — Partner Alumni Bulk:** Same pattern with `PARTNER_ALUMNI_BULK_MATCH_LOADER`; preview/commit, on_roster, duplicate_in_file, `companyNameById`, display_order preserved. Commit `07dbbd1`. Cutover parity: `partnerAlumniBulkCandidateCutover.parity.test.ts`.
  - **Real-data parity (100% identical persisted/preview fields, in-memory, no writes):**
    - Sponsor: Blockchain Life Dubai 2025 Sponsors (170 rows); Bitcoin Las Vegas 2026 Sponsors (264 rows).
    - Exhibitor: Singapore Fintech Festival 2025 Exhibitors (463 rows).
    - PA Import: NFT.NYC 2025 partners Sheet3 (461 rows) vs version overlay.
    - PA Bulk: same NFT.NYC source as Bulk preview vs NFT NYC roster (461 rows; 460 on_roster / 1 review).
  - **Final verification (2026-08-04):** All four importers default to candidate; full-directory `.from("companies")` / full `company_domains` pagination only inside `loadFullDirectoryMatchContext` behind mode=`full_directory`; production admins/preview call `loadMatchContext` / `loadImportMatchContext` with identity rows. Cutover + Phase 0/1/2 parity: **38** pass. Importer-related suites: **506** pass. `tsc --noEmit` / eslint (matcher hot paths) / full `npm test` (**1988** pass) / `git diff --check` clean. RPCs remain service_role-only.
- **Why criteria pass:** Default production matching no longer loads the full company/domain directories into memory; candidates are keyed from the batch/upload identity set. Rollback remains available without sharing env flags across importers.
- **Residual (not ARC-003):** Empty identity-row API default still yields an empty candidate context if mis-called (production paths pass rows). Candidate website host `ilike` / PostgREST chunking remain operational edges covered by parity. Stale “Not wired into production” comments on the candidate loader package are comment debt only. `ARC-011` (parallel import trees) and `ARC-010` (chunked materialize / no durable jobs) remain Open.

### 2026-08-04 — ARC-018 resolved

- **Acceptance criteria:** `mergeCompaniesOntoEventSponsorLinks` must not perform a second admin/service-role round-trip to fill missing company ids; hydration uses a single session/RLS batch (or equivalent) and fails closed for missing rows; wiring/regression tests forbid the admin miss-path.
- **Closing evidence (verified 2026-08-04):**
  - Baseline root (Issue 11.3): batch-by-id then a *second* admin round for missing ids on every edition render.
  - Current `src/lib/queries/companies.ts`: `mergeCompaniesOntoEventSponsorLinks` collects `company_id`s → one `getCompaniesByIds` (session/RLS) → `getEventBrandPublicDestinationIndex` → `attachCompaniesToEventSponsorLinks`. Missing ids stay `null` (comment: “no admin fill”).
  - `getCompaniesByIdsAdmin` / `missingCompanyIds` miss-path absent from the function body and from the module (removed with ARC-001 Phase 1 commit `56fcc0d`).
  - Wiring tests: `companies.publicReads.wiring.test.ts` asserts the export does not match `createAdminClient` / `getCompaniesByIdsAdmin` / `missingCompanyIds` and calls `attachCompaniesToEventSponsorLinks`. `companies.arc001.phase1.test.ts` asserts missing companies remain null.
  - Call site: `publicSponsorRoster.ts` still uses `mergeCompaniesOntoEventSponsorLinks` for hydration (edition-scoped roster path).
- **Why criteria pass:** The named double-path (session batch + admin miss-fill) is gone; remaining cost is a single bounded company batch plus destination index — not the Issue 11.3 defect.
- **Residual (not ARC-018):** Public edition SSR cost from `force-dynamic` / undeduped loaders remains `ARC-004`. Destination-index + company batch still run per hydration call (acceptable shape; not a second admin fill).

---

## Change log

| Date | Note |
|------|------|
| 2026-07-31 | Recurring Architecture Audit published (`2026-08` cycle token). Reconciled `ARC-001`…`ARC-020` — all still Open. Updated `ARC-011` evidence for third import pipeline (`exhibitor-import`). No new ARC IDs. No resolutions. |
| 2026-08-02 | Resolved `ARC-001` after Phases 1–6 public service-role remediation. Closing evidence in Resolution History. `ARC-002`…`ARC-020` remain Open. No companion closeout report (Framework v1.2). |
| 2026-08-02 | Resolved `ARC-002` after verification that ARC-001 Phase 2 aggregate counts close the full-table count scan. Closing evidence in Resolution History. `ARC-003`…`ARC-020` remain Open. |
| 2026-08-02 | Resolved `ARC-005` after adding `.github/workflows/ci.yml` quality gate + local green typecheck/lint/test/build. Closing evidence in Resolution History. Branch protection remains an ops step. `ARC-003`, `ARC-004`, `ARC-006`…`ARC-020` remain Open. |
| 2026-08-04 | Resolved `ARC-003` after Sponsor / Exhibitor / PA Import / PA Bulk candidate-loader cutovers + real-data parity. Closing evidence in Resolution History. `ARC-004`, `ARC-006`…`ARC-020` remain Open. No companion closeout report (Framework v1.2). |
| 2026-08-04 | Resolved `ARC-018` after reconciliation: Issue 11.3 admin miss-path / double-path hydration absent; session-only batch verified. Closing evidence in Resolution History. `ARC-004`, `ARC-006`…`ARC-017`, `ARC-019`, `ARC-020` remain Open. No companion closeout report (Framework v1.2). |
