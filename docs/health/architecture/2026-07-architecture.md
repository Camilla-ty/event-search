# Architecture Audit — 2026-08

**Review type:** Architecture Audit
**Cadence:** Monthly
**Cycle:** 2026-08
**Date:** 2026-07-31
**Reviewer:** Architecture (Automated)
**Baseline:** false
**Status:** Immutable historical record — do not edit after publication.

> Recurring Architecture Health Check under Framework v1.1. Prior report: [`2026-07-architecture.md`](./2026-07-architecture.md) (immutable baseline). This run was requested with review date **2026-07-31**; the cycle token is **2026-08** because `architecture/2026-07-architecture.md` already exists and must not be overwritten. No new `ARC` IDs. Existing `ARC-001`…`ARC-020` reconciled — all remain `Open`. Delta evidence recorded for import-subsystem sprawl (`ARC-011`).

---

## Executive summary

Second Architecture cycle for EventPixels. Methods: reconcile all open `ARC` Findings against current `src/` and `.github/workflows/`; re-check trust-boundary / data-access / import / App Router / CI patterns named in the baseline; scan for untracked structural root causes (prefer under-tracking).

Net change: **0 resolved**, **0 new**, **20 still open**. Highest-severity structural risks are unchanged (`ARC-001` service-role fail-open on public reads; `ARC-002`/`ARC-003` unbounded catalog scans; `ARC-004` force-dynamic public SSR). Material delta: exhibitor import shipped as a **third** parallel import tree, strengthening `ARC-011` (not a new Finding — same root cause). Strengths from the baseline (feature-modular layout; consistent `requireAdminApi` route shape; transactional SECURITY DEFINER RPCs for critical mutations) still hold.

---

## Since last cycle

| Change | Finding IDs | Notes / links |
|---|---|---|
| Resolved (removed from register) | — | none |
| Still open | `ARC-001`…`ARC-020` | all root causes still present in code; see Findings deltas |
| In progress | — | none (no linked PR/branch for ARC work) |
| Deferred | — | none |
| New this cycle | — | none |
| Reopened (same ID) | — | none |

---

## Findings

Existing Findings by ID + delta only (canonical bodies remain in [`2026-07-architecture.md`](./2026-07-architecture.md)).

### ARC-001 — Service-role client bypasses RLS on read paths, with fail-open fallback

- **Status:** Open
- **Delta:** Still present. `getCompanyById` / `getCompanyBySlug` fail open to admin client (`src/lib/queries/companies.ts`). Public/hub helpers continue to use `createAdminClient` (e.g. `publicStats.ts`, `publicSponsorRoster.ts`, `topicRegionHubData.ts`, `partnerAlumniPublic.ts`). No containment PR.

### ARC-002 — Hot-path full-table scans for sponsor counts (`getSponsorCountsByEditionIds`)

- **Status:** Open
- **Delta:** Still paginates all `event_sponsors` then filters in JS (`src/lib/queries/companies.ts`). Still on explorer/home/hub/admin call paths. No query-shape fix.

### ARC-003 — Import matching loads entire `companies` / `company_domains` into memory

- **Status:** Open
- **Delta:** Same full-directory match pattern in `sponsor-import`, `partner-alumni-import`, **and** `exhibitor-import` `server/matchRows.ts`. Scope of call-sites grew with the third importer (same root cause).

### ARC-004 — Public pages `force-dynamic`; no caching/ISR; no request-level dedup (`React cache()`)

- **Status:** Open
- **Delta:** Marketing pages still export `force-dynamic` (e.g. `(marketing)/page.tsx`, `events/page.tsx`, `sponsors/page.tsx`). No `import { cache } from "react"`. Narrow `revalidate` remains limited (e.g. `sitemap.ts`, `/api/public/stats`).

### ARC-005 — No CI gate (typecheck / lint / test / build) on PRs

- **Status:** Open
- **Delta:** `.github/workflows/` still only `backup-database.yml` and `backup-storage.yml`. No PR quality gate.

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

- **Status:** Open
- **Delta:** Session then admin miss-path hydration pattern still in `src/lib/queries/companies.ts`.

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
| Runtime cost of full-scan counts / force-dynamic SSR | `ARC-002`, `ARC-004` | PERF should reference these IDs; no PERF clones opened here |
| Service-role / RLS trust | `ARC-001` | SEC observes; ownership remains this ID |
| Dead `EditionImportsStub` after live panel | `HYG-002` | Hygiene leftover; not structural duplication of live importers (`ARC-011`) |
| Partner Alumni Dashboard resume gap | `PROD-003` | Product workflow; structural import duplication stays `ARC-011` |
| Exhibitor public marketing stub | `PROD-002` | Product polish; not architecture |

---

## Observations (not tracked)

**Mode / cycle note**
- Recurring review. Baseline report preserved untouched at `architecture/2026-07-architecture.md`.
- Cycle token **2026-08** used for this publication to satisfy immutability (requested review date 2026-07-31).

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

**New Finding gate**
- No new ARC Finding passed the memory-value test. Triple import trees and larger god modules are deltas on existing IDs.

**Limitations**
- Call-site counts are sampled, not a full dependency-graph tool run.
- No linked PR search beyond local `main` tree evidence for “In Progress.”

---

## Change log

| Date | Note |
|------|------|
| 2026-07-31 | Recurring Architecture Audit published (`2026-08` cycle token). Reconciled `ARC-001`…`ARC-020` — all still Open. Updated `ARC-011` evidence for third import pipeline (`exhibitor-import`). No new ARC IDs. No resolutions. Baseline `2026-07` report untouched. |
