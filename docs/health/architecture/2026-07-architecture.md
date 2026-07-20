# Architecture Audit — 2026-07

**Review type:** Architecture Audit
**Cadence:** Monthly
**Cycle:** 2026-07
**Date:** 2026-07-20
**Reviewer:** Principal Software Architect (read-only audit)
**Baseline:** true
**Status:** Immutable historical record — do not edit after publication.

> This is the baseline Architecture Audit for the Engineering Health Check system. It is preserved verbatim as the evidence-of-record. Outstanding findings with long-term memory value were extracted into [`../findings-register.md`](../findings-register.md) as `ARC-001`…`ARC-019`; each register row links back to the corresponding section below.
>
> **Preservation note:** the audit text is unchanged. The only formatting normalization is that inline code excerpts (originally rendered in the chat's `startLine:endLine:filepath` citation format) are shown here as standard fenced code blocks with a file/line caption. No wording, findings, severities, efforts, or recommendations were altered.

---

# Architecture Audit — HandShakes / "eventpixels"

**System under review:** Next.js 16 (App Router) + React 19 + Supabase (Postgres/PostgREST/Auth/Storage) marketing + admin platform for events, editions, sponsors, companies, venues, organizers, and partner/alumni import pipelines. ~850 source files, 167 test files, 56 SQL migrations, 86 API routes.

I evaluated the actual code, not the docs. Findings are grouped by your 15 categories, then the three summary lists.

---

## 1. Overall Architecture

The app is a **feature-modular monolith**: `src/features/<domain>/{server,client,components,lib}` + shared `src/lib/*`, with Supabase as the single datastore. The separation of server modules (data access) from route handlers (HTTP) from components (UI) is genuinely good and consistent.

**Issue 1.1 — The security boundary is ambiguous: RLS exists but the app routinely bypasses it with the service-role client.**
`createAdminClient()` (service role, bypasses all RLS) is referenced in **257 places across ~50 files**, including *public read paths* (`src/lib/queries/companies.ts`, `publicStats.ts`, `partnerAlumniPublic.ts`, `bitcoinAsiaHubPublic.ts`). Worse, public getters *fail open* to it:

**`src/lib/queries/companies.ts` (lines 101–120):**
```ts
export async function getCompanyById(id: string): Promise<CompanyPublicRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .select(COMPANY_PUBLIC_SELECT)
    .eq("id", id)
    .is("restricted_at", null)
    .maybeSingle();

  if (error) {
    const row = await getCompanyByIdAdmin(id);   // escalates to service role on ANY error
    return isPublicCompanyProfileRow(row) ? mapCompanyPublicRowForDisplay(row) : null;
  }
```

The effective enforcement of "what's public" moves from Postgres RLS into scattered JS filters (`isCompanyRestricted`, `.is("restricted_at", null)`). One forgotten filter = data leak, and RLS can no longer be trusted as a backstop.
- **Why it matters:** With millions of companies and multiple engineers, defense-in-depth (RLS as the true boundary) is the only scalable way to prevent leaks. Today RLS is decorative on read paths.
- **Severity:** Critical · **Effort:** Large · **Fix:** Now (contain the spread before more features copy the pattern).

**Issue 1.2 — Two nearly-identical import subsystems.**
`src/features/sponsor-import/*` and `src/features/partner-alumni-import/*` are parallel trees with duplicated `matchRows.ts`, `materializeCompanies.ts`, `enrichImportRows.ts`, `actionLog.ts`, `storage.ts`, `importUiData.ts`. Divergence risk is high.
- **Severity:** Medium · **Effort:** Large · **Fix:** Later (extract a shared import-pipeline kernel when a third importer appears).

---

## 2. Project Structure

Clean feature-based layout with per-feature `server`/`client`/`components`/`lib` and a shared `src/lib`. This is the strongest part of the codebase and will support parallel teams well.

**Issue 2.1 — God modules.** `sponsorImportAdmin.ts` (1,881 lines), `SeriesPartnerAlumniPanel.tsx` (1,075), `partnerAlumniImportAdmin.ts` (1,005), plus several 600–900-line files. These become merge-conflict magnets and are hard to reason about.
- **Severity:** Medium · **Effort:** Medium · **Fix:** Later, opportunistically.

---

## 3. Next.js App Router Architecture

Correct use of route groups (`(marketing)`), `loading.tsx`/`error.tsx`/`not-found.tsx`, async `params`/`searchParams` (Next 16), and server components by default.

**Issue 3.1 — Every marketing/public page is `export const dynamic = "force-dynamic"`.**
All 30+ public pages opt out of static rendering and caching; only `sitemap.ts` and `/api/public/stats` set `revalidate`.
- **Why it matters:** These SEO pages (sponsors, events, series, topics, cities) are the ones meant to serve millions of anonymous visitors. Forcing SSR-per-request means every hit runs live DB queries with zero cache — the exact opposite of what you want at scale, and it caps you at DB throughput rather than CDN throughput.
- **Severity:** High · **Effort:** Medium (move to ISR / `revalidateTag` on writes) · **Fix:** Now-ish.

**Issue 3.2 — No request-level dedup (`React cache()` is used nowhere).**
On `events/[id]`, `getEventDetailData(id)` and `getTotalSponsorCount(id)` are each called in **both** `generateMetadata` and the page body → duplicate queries per render (Next dedups `fetch()`, not raw Supabase calls).
- **Severity:** High (amplified by 3.1 and 11.1) · **Effort:** Small · **Fix:** Now.

**Issue 3.3 — Middleware calls `supabase.auth.getUser()` (a network round-trip) on essentially every non-asset request** even though auth is only enforced under `/admin`.
- **Severity:** Medium · **Effort:** Small (narrow the matcher, or only refresh where needed) · **Fix:** Later.

---

## 4. API Architecture

86 route handlers with a **consistent, good** shape: `requireAdminApi()` guard → JSON parse → validate → try/catch → `{ ok, ... }` response (see `event-sponsors/[linkId]/route.ts`). Critical mutations (company merge, import publish, set-primary-domain) correctly go through **SECURITY DEFINER RPCs** that run transactionally, and a migration explicitly revokes RPC EXECUTE from `anon`/`authenticated`.

**Issue 4.1 — No rate limiting anywhere, and no schema-validation library.**
Public/unauthenticated endpoints (`/api/auth/check-email`, `/api/sponsors/suggest`, `/api/sponsors/discovery`, `/api/events/explorer`, `/api/companies`) have no throttling. Validation is hand-rolled per route (no zod/valibot), so guarantees vary route-to-route.
- **Why it matters:** At millions of users these are DoS/abuse/enumeration vectors, and hand-rolled validation across 86 routes drifts.
- **Severity:** High · **Effort:** Small–Medium · **Fix:** Now (rate limiting), Later (schema lib).

**Issue 4.2 — Per-route boilerplate duplication.** Auth+parse+validate+error-mapping is copy-pasted into every handler; no shared `withAdmin(handler)` wrapper. Error→HTTP mapping is ad hoc (`500` for anything thrown).
- **Severity:** Medium · **Effort:** Medium · **Fix:** Later.

**Issue 4.3 — Extreme route nesting.** e.g. `/api/admin/event-series/[id]/partner-alumni/versions/[versionId]/import/batches/[batchId]/materialize-companies/chunk`. 12+ dynamic segments couple the URL to the full resource hierarchy and make refactors painful.
- **Severity:** Medium · **Effort:** Medium · **Fix:** Later.

---

## 5. Database Boundaries

RLS is enabled on core tables with a clear intended model (anon sees `tier_rank=1` sponsors; companies/editions/series public read; writes only via service role). Migrations are sequential and readable.

**Issue 5.1 — No generated database types.** There is no `Database` type; `createClient()`/`createServerClient()` are untyped, so every `.from("table").select(...)` returns `any` and the code is littered with `as CompanyPublicRow` / `as Record<string, unknown>` casts.
- **Why it matters:** With millions of rows and many engineers, the compiler is your cheapest defense against schema/column drift. Right now a renamed column fails silently at runtime, not at build.
- **Severity:** High · **Effort:** Medium (generate types, thread `SupabaseClient<Database>`) · **Fix:** Now-ish.

**Issue 5.2 — Reactive security hardening on the DB boundary.** `20260718120000_revoke_admin_rpc_execute_from_public_roles.sql` documents that admin SECURITY DEFINER RPCs were **live-callable by anon/member JWTs in production** until an emergency hotfix. Also `getProfileRoleForUserId` falls back to a service-role read "when profiles RLS policies are missing." These indicate the DB boundary is being discovered in production rather than designed up front.
- **Severity:** High (process signal) · **Effort:** Medium (RLS/grant test harness — one integration test exists, `adminRpcPermissions.integration.test.ts`; expand it) · **Fix:** Now.

---

## 6. React Component Architecture

Server components for data, client components for interactivity, feature-scoped. Reasonable. Main issue is the god components noted in 2.1 (e.g. `SeriesPartnerAlumniPanel.tsx` at 1,075 lines mixing data orchestration, state, and rendering).
- **Severity:** Medium · **Effort:** Medium · **Fix:** Later.

---

## 7. Custom Hooks

Genuinely good: a consistent `use<Feature>Collection` family (`useAdminCompaniesCollection`, `useEventExplorerCollection`, `useAdminVenuesCollection`, etc.) plus focused hooks (`useUrlSyncedState`, `useEmailOtpAuth`). Encapsulation is clean and feature-local.

**Issue 7.1 — Hand-rolled fetching inside hooks (no dedup/caching/retry/cancellation guarantees).** See §10.

---

## 8. Context Usage

Well done. `createContext` appears in only 7 places, all **narrowly scoped** to a feature/wizard (import wizard step, edition live sponsor count, explorer filter bridge, tab navigation). No god-context, no global provider soup. This is the correct pattern and will scale.
- No issues worth reporting.

---

## 9. State Management

No global state library, which is appropriate here — server state dominates and is fetched server-side; local UI state is in feature hooks/context. That's a sound choice.

**Issue 9.1 — Client server-state is manual.** Collection hooks manage `loading/error/data` by hand with `fetch()` and `useEffect`. No cache, no revalidation-on-focus, no request dedup/abort standardization. Fine at current size; friction grows with more interactive admin surfaces.
- **Severity:** Low–Medium · **Effort:** Medium · **Fix:** Later.

---

## 10. Data Fetching Architecture

Server-side reads are centralized in `features/*/server` and `lib/queries` — good. Sponsor **discovery** correctly uses a paginated RPC (`sponsor_discovery_page`, page size capped at 50) — the right model.

**Issue 10.1 — No `fetch`/query caching layer and no request memoization** (ties to 3.1/3.2). Every public render is uncached DB work.
- **Severity:** High · **Effort:** Medium · **Fix:** Now-ish.

---

## 11. Performance Architecture

**Issue 11.1 (CRITICAL) — Hot-path full-table scans for counts.**
`getTotalSponsorCount(editionId)` → `getSponsorCountsByEditionIds()` fetches **every row** of `event_sponsors` (via `fetchAllPaginatedSupabaseRows`, 1,000 at a time) and filters in JS:

**`src/lib/queries/companies.ts` (lines 276–293):**
```ts
    const supabase = createAdminClient();
    const editionIdSet = new Set(uniqueEditionIds);
    const links = await fetchAllPaginatedSupabaseRows<{ event_editions_id?: unknown }>(
      async ({ from, to }) =>
        supabase.from("event_sponsors").select("event_editions_id").range(from, to),
    );
    const filteredLinks = links.filter((link) => { /* ... in JS ... */ });
    return buildSponsorCountByEditionId(filteredLinks);
```

This runs on **every event detail page render** (twice — metadata + body), even though an index `event_sponsors_edition_tier_index` exists. A single event page view scans the entire sponsors table. At hundreds of thousands of events this is a guaranteed outage under load.
- **Fix:** `select('*', { count: 'exact', head: true }).eq('event_editions_id', id)` or a small RPC/materialized count.
- **Severity:** Critical · **Effort:** Small · **Fix:** Now.

**Issue 11.2 (CRITICAL) — Import matching loads entire directories into memory.**
`matchRows.ts` / `partnerAlumniBulkImport.ts` load the **full** `companies` and `company_domains` tables via `fetchAllPaginatedSupabaseRows` to match import rows in JS. At millions of companies this OOMs the serverless function long before then.
- **Severity:** Critical · **Effort:** Large (push matching into SQL / trigram/FTS indexes) · **Fix:** Now for the pattern's blast radius; plan the rewrite.

**Issue 11.3 — Potential N+1 in hydration.** `mergeCompaniesOntoEventSponsorLinks` batches by id (good) but then does a *second* admin round for "missing" ids; acceptable, but the double-path adds latency on every edition render.
- **Severity:** Medium · **Effort:** Small · **Fix:** Later.

---

## 12. Security Architecture

Positives: separate anon/server/admin clients; admin guard centralized in `requireAdminApi`; role read prefers RLS then falls back to service role only *after* `getUser()` verifies identity; middleware protects `/admin`; SECURITY DEFINER RPCs now locked to `service_role`; PKCE OAuth handled server-side; `Referrer-Policy` header set.

Beyond 1.1 / 5.2:

**Issue 12.1 — Email enumeration.** `/api/auth/check-email` returns `{ exists: true|false }`, unauthenticated and unthrottled → lets anyone enumerate registered users.
- **Severity:** Medium · **Effort:** Small · **Fix:** Later (at minimum rate-limit + consider removing the oracle).

**Issue 12.2 — Thin security headers.** Only `Referrer-Policy`. No CSP, HSTS, `X-Content-Type-Options`, `X-Frame-Options`/frame-ancestors.
- **Severity:** Medium · **Effort:** Small · **Fix:** Later.

---

## 13. Scalability

Read scalability is the top risk, driven by 11.1, 11.2, and 3.1 (uncached dynamic pages). Write pipelines are **client-orchestrated**: the browser drives multi-step materialization by POSTing `.../materialize-companies/chunk` repeatedly, with `recoverStaleMaterializePhase` cleaning up abandoned runs.
- **Why it matters:** A batch job shaped as browser-driven HTTP chunks has no transactional envelope, no retry/backoff, and leaves partial state if the tab closes. This belongs in a durable job queue (or a single server-driven orchestration with idempotent steps).
- **Severity:** Medium–High · **Effort:** Large · **Fix:** Later, but before importing at real volume.

---

## 14. Maintainability

Strong signals: 167 test files (including domain/matching/validation logic), ADRs (`docs/adr`), architecture and phase docs, `project-state.md`, consistent module conventions. This is above-average discipline.

**Issue 14.1 (HIGH) — No CI.** The only GitHub Actions are `backup-database.yml` and `backup-storage.yml`. There is **no workflow that runs typecheck, lint, unit tests, or build on PRs.** 167 tests exist but nothing enforces them.
- **Why it matters:** With multiple engineers working simultaneously, the absence of a merge gate means regressions (including the untyped-DB and RLS classes above) land in `main` unchecked. This is the single cheapest high-leverage fix.
- **Severity:** High · **Effort:** Small · **Fix:** Now.

**Issue 14.2 — Thin E2E.** One Playwright spec (`events-navigation.spec.ts`) for a large admin+public surface.
- **Severity:** Low–Medium · **Effort:** Medium · **Fix:** Later.

---

## 15. Technical Debt

Highest-interest debt, in order: RLS-bypass sprawl (1.1), full-scan counts/matching (11.1/11.2), untyped DB (5.1), no CI (14.1), force-dynamic everywhere (3.1), duplicated import subsystems (1.2), god modules (2.1), client-orchestrated materialization (13). None are cosmetic; all compound as data and team size grow.

---

## A. Top 10 Architectural Strengths

1. **Feature-modular structure** (`features/<domain>/{server,client,components,lib}`) — clean seams for parallel teams.
2. **Disciplined client separation** — distinct anon browser / SSR cookie / service-role clients with fail-closed env checks.
3. **Centralized, consistent API contract** — `requireAdminApi` guard + uniform `{ ok, ... }` responses across 86 routes.
4. **Transactional integrity where it counts** — critical merges/publishes use SECURITY DEFINER RPCs, now grant-locked to `service_role`.
5. **RLS present with an explicit, documented model** (tiered sponsor visibility, public reads, service-role writes).
6. **Excellent context hygiene** — 7 tiny feature-scoped contexts, no global state sprawl.
7. **Strong, consistent custom-hook layer** (`use*Collection` family, `useUrlSyncedState`).
8. **Real unit-test culture** — 167 test files covering domain/matching/validation logic.
9. **Mature documentation** — ADRs, phase scopes, migration designs, `project-state.md`.
10. **Operational backups** — automated daily DB + weekly storage backups with retention.

## B. Top 10 Architectural Weaknesses

1. **Service-role client bypassing RLS on read paths, with fail-open fallback** (1.1) — RLS is not the real boundary.
2. **Full-table scans on hot pages** — sponsor counts scan all of `event_sponsors` per event render (11.1).
3. **In-memory full-directory import matching** — loads entire `companies`/`company_domains` (11.2); won't survive scale.
4. **No CI gate** for typecheck/lint/test/build with multiple engineers (14.1).
5. **All public pages `force-dynamic`, no caching/ISR** (3.1) + **no `React cache()` dedup** (3.2).
6. **Untyped database access** — no generated `Database` types; `any` + casts everywhere (5.1).
7. **No rate limiting** on public/auth endpoints; **no schema-validation library** (4.1).
8. **No observability** — no error tracking / structured logging / metrics (only ~33 `console.*`).
9. **Client-orchestrated, non-transactional chunked materialization** instead of a durable job queue (13).
10. **Duplicated import subsystems + god modules** (1.2, 2.1) — divergence and merge-conflict risk.

## C. Top 5 Highest-ROI Improvements

1. **Replace count/scan queries with `count`/`.eq` (and add `React cache()` + ISR on public pages).** Kills the worst outage risk (11.1/3.1/3.2). *Effort: Small–Medium; impact: immediate throughput + cost.*
2. **Stand up CI** (typecheck + lint + `npm test` + build on every PR). *Effort: Small; impact: protects everything else and enables parallel teams.* (14.1)
3. **Generate Supabase `Database` types and thread `SupabaseClient<Database>` everywhere.** *Effort: Medium; impact: compile-time safety against schema drift across millions of rows.* (5.1)
4. **Re-establish RLS as the true boundary:** stop reading via service role on public paths, remove fail-open fallbacks, and add an RLS/grant integration-test suite (extend `adminRpcPermissions.integration.test.ts`). *Effort: Medium–Large; impact: closes the widest data-leak class.* (1.1/5.2)
5. **Add edge rate limiting + a minimal observability layer** (error tracking + structured logs on API routes). *Effort: Small–Medium; impact: abuse/DoS protection + you can actually see failures in prod.* (4.1/12/§14)

---

I did not modify any code, create commits, or refactor anything — this is analysis only.
