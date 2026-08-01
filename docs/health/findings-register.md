# Findings Register

**Status:** Living document — this is the single mutable file in the Engineering Health Check.
**Purpose:** The current engineering work queue. It answers one question: **"What engineering problems still require attention?"**

This register holds **only outstanding Findings** — statuses `Open`, `In Progress`, and `Deferred`.
When a Finding is **Resolved it is removed from this file**; its resolution is recorded permanently in the resolving cycle's immutable report (and in Git history, PRs, commits, ADRs). See [`README.md`](./README.md) for the full rules.

## Conventions (summary)

- **Inclusion:** memory-value test — a Finding exists only if we will likely need to remember it in a future review cycle. Severity is *not* the gate.
- **IDs:** `<PREFIX>-NNN`, permanent, never reused or renumbered. Reuse the same ID for the same root cause for its entire life (including reopening after resolution). Prefix encodes the review type (`DEP` = Dependency Vulnerability Monitoring, `ARC` = Architecture, `PROD` = Product, `DQ` = Data Quality, `DB` = Database, `SEC` = Security, `PERF` = Performance, `HYG` = Code Hygiene, `ROAD` = Roadmap, `SCALE` = Scalability, `SEO`, `UX`, `DOC` = Documentation).
- **Cross-audit ownership:** every root cause has one primary owner per [`audit-catalog.md`](./audit-catalog.md). Before adding a Finding, search all prefixes; reference an existing Finding for the same root cause instead of duplicating it across audits.
- **Severity / Effort:** descriptive metadata only (Critical/High/Medium/Low · Small/Medium/Large). No composite scores or grades.
- **Source / links:** each row links to the immutable report section where the Finding was first described; add plan / ADR / migration / PR / commit links as work progresses.

---

## Open findings

| ID | Title | Area | Severity | Effort | Status | First seen | Last updated | Source / links |
|----|-------|------|----------|--------|--------|-----------|--------------|----------------|
| ARC-001 | Service-role client bypasses RLS on read paths, with fail-open fallback | security / data-access | Critical | Large | Open | 2026-07 | 2026-08 | [Baseline §1.1](./architecture/2026-07-architecture.md); [2026-08 delta](./architecture/2026-08-architecture.md) |
| ARC-002 | Hot-path full-table scans for sponsor counts (`getSponsorCountsByEditionIds`) | performance / db | Critical | Small | Open | 2026-07 | 2026-08 | [Baseline §11.1](./architecture/2026-07-architecture.md); [2026-08 delta](./architecture/2026-08-architecture.md) |
| ARC-003 | Import matching loads entire `companies` / `company_domains` into memory | performance / imports | Critical | Large | Open | 2026-07 | 2026-08 | [Baseline §11.2](./architecture/2026-07-architecture.md); [2026-08 delta](./architecture/2026-08-architecture.md) |
| ARC-004 | Public pages `force-dynamic`; no caching/ISR; no request-level dedup (`React cache()`) | performance / public-pages | High | Medium | Open | 2026-07 | 2026-08 | [Baseline §3.1, §3.2, §10.1](./architecture/2026-07-architecture.md); [2026-08 delta](./architecture/2026-08-architecture.md) |
| ARC-005 | No CI gate (typecheck / lint / test / build) on PRs | ci / tooling | High | Small | Open | 2026-07 | 2026-08 | [Baseline §14.1](./architecture/2026-07-architecture.md); [2026-08 delta](./architecture/2026-08-architecture.md) |
| ARC-006 | Untyped database access — no generated `Database` types | db / types | High | Medium | Open | 2026-07 | 2026-08 | [Baseline §5.1](./architecture/2026-07-architecture.md); [2026-08 delta](./architecture/2026-08-architecture.md) |
| ARC-007 | No rate limiting on public/auth endpoints; no schema-validation library | api / security | High | Small–Medium | Open | 2026-07 | 2026-08 | [Baseline §4.1](./architecture/2026-07-architecture.md); [2026-08 delta](./architecture/2026-08-architecture.md) |
| ARC-008 | No observability — no error tracking / structured logging / metrics | observability | High | Medium | Open | 2026-07 | 2026-08 | [Baseline §B.8, §12, §14](./architecture/2026-07-architecture.md); [2026-08 delta](./architecture/2026-08-architecture.md) |
| ARC-009 | Reactive DB security hardening — no RLS/grant regression-test harness | security / db | High | Medium | Open | 2026-07 | 2026-08 | [Baseline §5.2](./architecture/2026-07-architecture.md); [2026-08 delta](./architecture/2026-08-architecture.md) |
| ARC-010 | Client-orchestrated, non-transactional chunked materialization (no durable job queue) | imports / scalability | Medium–High | Large | Open | 2026-07 | 2026-08 | [Baseline §13](./architecture/2026-07-architecture.md); [2026-08 delta](./architecture/2026-08-architecture.md) |
| ARC-011 | Three parallel import subsystems (sponsor / partner-alumni / exhibitor) | imports | Medium | Large | Open | 2026-07 | 2026-08 | [Baseline §1.2](./architecture/2026-07-architecture.md); [2026-08 delta](./architecture/2026-08-architecture.md) |
| ARC-012 | God modules / components (1,000+ line files) | code-structure | Medium | Medium | Open | 2026-07 | 2026-08 | [Baseline §2.1, §6](./architecture/2026-07-architecture.md); [2026-08 delta](./architecture/2026-08-architecture.md) |
| ARC-013 | Per-route boilerplate duplication; no shared handler wrapper | api | Medium | Medium | Open | 2026-07 | 2026-08 | [Baseline §4.2](./architecture/2026-07-architecture.md); [2026-08 delta](./architecture/2026-08-architecture.md) |
| ARC-014 | Extreme API route nesting (12+ dynamic segments) | api | Medium | Medium | Open | 2026-07 | 2026-08 | [Baseline §4.3](./architecture/2026-07-architecture.md); [2026-08 delta](./architecture/2026-08-architecture.md) |
| ARC-015 | Email enumeration via unauthenticated `/api/auth/check-email` | security / auth | Medium | Small | Open | 2026-07 | 2026-08 | [Baseline §12.1](./architecture/2026-07-architecture.md); [2026-08 delta](./architecture/2026-08-architecture.md) |
| ARC-016 | Thin security headers (no CSP / HSTS / X-Content-Type-Options / frame-ancestors) | security | Medium | Small | Open | 2026-07 | 2026-08 | [Baseline §12.2](./architecture/2026-07-architecture.md); [2026-08 delta](./architecture/2026-08-architecture.md) |
| ARC-017 | Middleware runs `getUser()` on nearly every non-asset request | auth / performance | Medium | Small | Open | 2026-07 | 2026-08 | [Baseline §3.3](./architecture/2026-07-architecture.md); [2026-08 delta](./architecture/2026-08-architecture.md) |
| ARC-018 | N+1 / double-path hydration in `mergeCompaniesOntoEventSponsorLinks` | performance / db | Medium | Small | Open | 2026-07 | 2026-08 | [Baseline §11.3](./architecture/2026-07-architecture.md); [2026-08 delta](./architecture/2026-08-architecture.md) |
| ARC-019 | Manual client server-state (no cache / dedup / retry / abort) | client-state | Low–Medium | Medium | Open | 2026-07 | 2026-08 | [Baseline §9.1, §7.1](./architecture/2026-07-architecture.md); [2026-08 delta](./architecture/2026-08-architecture.md) |
| ARC-020 | Thin end-to-end coverage (single Playwright spec) | testing | Low–Medium | Medium | Open | 2026-07 | 2026-08 | [Baseline §14.2](./architecture/2026-07-architecture.md); [2026-08 delta](./architecture/2026-08-architecture.md) |
| SEC-002 | Logo uploads trust client MIME; SVG still allowed on ingest paths | security / file-upload | Medium | Small | Open | 2026-07 | 2026-09 | [Security 2026-07 §SEC-002](./security/2026-07-security.md); [2026-09 delta](./security/2026-09-security.md) |
| SEC-003 | SSRF in logo/website ingestion without host allow-listing | security / ssrf | Medium | Medium | Open | 2026-07 | 2026-09 | [Security 2026-07 §SEC-003](./security/2026-07-security.md); [2026-09 delta](./security/2026-09-security.md) |
| HYG-002 | Unused superseded EditionImportsStub after live imports panel shipped | dead-code / admin | Low | Small | Open | 2026-07 | 2026-07 | [Code Hygiene 2026-07 §HYG-002](./code-hygiene/2026-07-code-hygiene.md) |
| HYG-003 | Unretired NFT.NYC partner-alumni corruption repair scripts | scripts / one-off | Medium | Small | Open | 2026-07 | 2026-07 | [Code Hygiene 2026-07 §HYG-003](./code-hygiene/2026-07-code-hygiene.md) |
| PROD-001 | Admin global search promised in v1 IA but not present | admin / discoverability | High | Medium | Open | 2026-07 | 2026-07 | [Product 2026-07 §PROD-001](./product/2026-07-product.md) |
| PROD-002 | Public /exhibitors module is a roadmap stub with live product framing | public / polish | Medium | Small | Open | 2026-07 | 2026-07 | [Product 2026-07 §PROD-002](./product/2026-07-product.md) |
| PROD-003 | Partner Alumni imports missing from Dashboard resume surface | admin / workflows | Medium | Medium | Open | 2026-07 | 2026-07 | [Product 2026-07 §PROD-003](./product/2026-07-product.md) |
| DQ-001 | Sponsor companies lack official website/domain identity at scale | data / company-identity | High | Large | Open | 2026-07 | 2026-07 | [Data Quality 2026-07 §DQ-001](./data-quality/2026-07-data-quality.md) |
| DQ-002 | Public event editions missing `city_id` | data / editions | Medium | Small | Open | 2026-07 | 2026-07 | [Data Quality 2026-07 §DQ-002](./data-quality/2026-07-data-quality.md) |
| DQ-003 | Active orphan and bogus company shells from import/curation residue | data / companies | Medium | Medium | Open | 2026-07 | 2026-07 | [Data Quality 2026-07 §DQ-003](./data-quality/2026-07-data-quality.md) |
| SCALE-001 | Admin company alias search loads all active companies without pagination | scalability / admin-search | High | Medium | Open | 2026-07 | 2026-07 | [Scalability 2026-07 §SCALE-001](./scalability/2026-07-scalability.md) |
| SEO-001 | Empty topic hubs remain indexable and sitemap-included | seo / topics | Medium | Small | Open | 2026-07 | 2026-07 | [SEO 2026-07 §SEO-001](./seo/2026-07-seo.md) |
| UX-001 | Event Explorer “Clear all” / “Reset Filters” controls disagree | ux / events-explorer | High | Small | Open | 2026-07 | 2026-07 | [UX 2026-07 §UX-001](./ux/2026-07-ux.md) |
| UX-002 | Events global search clears after submit and desyncs from the applied query | ux / global-search | High | Small | Open | 2026-07 | 2026-07 | [UX 2026-07 §UX-002](./ux/2026-07-ux.md) |
| UX-003 | Edition roster reorder uses incompatible save models (sponsors vs exhibitors) | ux / admin-rosters | High | Medium | Open | 2026-07 | 2026-07 | [UX 2026-07 §UX-003](./ux/2026-07-ux.md) |
| UX-004 | Create-new company acknowledgment exists only on Partner Alumni imports | ux / imports | High | Medium | Open | 2026-07 | 2026-07 | [UX 2026-07 §UX-004](./ux/2026-07-ux.md) |

**Security topics owned by Security but tracked under existing IDs (cross-referenced, not duplicated):** `ARC-001` (RLS/service-role bypass), `ARC-007` (rate limiting + input validation), `ARC-009` (RLS/grant regression tests), `ARC-015` (email enumeration), `ARC-016` (security headers), `ARC-017` (middleware auth). See [Security 2026-07](./security/2026-07-security.md) and [Security 2026-09](./security/2026-09-security.md).

**Scalability topics owned by Scalability but already tracked under Architecture (cross-referenced, not duplicated):** `ARC-002` (full-scan counts), `ARC-003` (import full-directory match), `ARC-004` (force-dynamic / no read cache), `ARC-010` (no durable job queue), `ARC-011` (parallel import trees). See [Scalability 2026-07](./scalability/2026-07-scalability.md).

**SEO topics owned by SEO but already tracked under other prefixes (cross-referenced, not duplicated):** `PROD-002` (public `/exhibitors` stub framing / indexability residual), `ARC-004` (force-dynamic crawl/cache cost). See [SEO 2026-07](./seo/2026-07-seo.md).

**UX topics owned by UX but already tracked under other prefixes (cross-referenced, not duplicated):** `PROD-001` (admin global search missing), `PROD-002` (`/exhibitors` stub framing), `PROD-003` (PA Dashboard resume), `ARC-011` (parallel import trees — structure), `ARC-004` (force-dynamic wait), `SCALE-001` (alias search pagination). See [UX 2026-07](./ux/2026-07-ux.md).

---

## Retired IDs

Permanently used identifiers that must never be reissued. (A retired ID may be *reopened* under its original number if the same root cause reappears.)

| ID | Title | Resolved in | Notes |
|----|-------|-------------|-------|
| SEC-001 | No dependency vulnerability scanning | [Security 2026-08](./security/2026-08-security.md) | Closed via GitHub Dependabot alerts + security updates; original write-up [Security 2026-07 §SEC-001](./security/2026-07-security.md) |
| HYG-001 | Tracked temporary run artifacts and scratch files in git | [Code Hygiene 2026-08](./code-hygiene/2026-08-code-hygiene.md) | Removed tracked `tmp/`/`reports/`/`.tmp-before-phase1` artifacts; archived two logo rollback backups under `scripts/archives/logo-migrations/`; original write-up [Code Hygiene 2026-07 §HYG-001](./code-hygiene/2026-07-code-hygiene.md) |
| ROAD-002 | Canonical implementation roadmap no longer represents current engineering direction | [Roadmap 2026-08](./roadmap/2026-08-roadmap.md) | Option C: historical v1 at `docs/implementation-roadmap-v1.md`; canonical index at `docs/implementation-roadmap.md`; original write-up [Roadmap 2026-07 §ROAD-002](./roadmap/2026-07-roadmap.md) |
| ROAD-001 | Canonical implementation roadmap still marks sponsor-import phases 2–4 incomplete | [Roadmap 2026-09](./roadmap/2026-09-roadmap.md) | Historical v1 marks Phases 2–4 ✅ Complete (`docs/implementation-roadmap-v1.md`); original write-up [Roadmap 2026-07 §ROAD-001](./roadmap/2026-07-roadmap.md) |

---

## Change log

| Date | Note |
|------|------|
| 2026-07-20 | Register created and seeded with outstanding architecture Findings (`ARC-001`…`ARC-020`) from the baseline Architecture Audit (`architecture/2026-07-architecture.md`). All `Open`. No new findings generated during setup. |
| 2026-07-20 | Baseline Security Audit (`security/2026-07-security.md`): added `SEC-001`–`SEC-003` (all `Open`). Security-owned topics already tracked under `ARC-001/007/009/015/016/017` were cross-referenced, not duplicated. |
| 2026-07-21 | Aligned `SEC-001`–`SEC-003` titles and severity/effort with the polished Security 2026-07 report (IDs and Finding set unchanged). |
| 2026-07-23 | Resolved `SEC-001` (removed from open findings; retired). Closing report: `security/2026-08-security.md`. `SEC-002` and `SEC-003` remain `Open`. |
| 2026-07-23 | Framework v1.1 prefix legend: added `DEP`, `HYG`, `UX`, `DOC`; replaced `DEAD` (unused) with `HYG` for Code Hygiene. No Finding rows changed. |
| 2026-07-23 | Baseline Code Hygiene Audit (`code-hygiene/2026-07-code-hygiene.md`): added `HYG-001`–`HYG-003` (all `Open`). Cross-referenced `ARC-005/011/012/020`; did not duplicate import-subsystem duplication (`ARC-011`). |
| 2026-07-23 | Resolved `HYG-001` (removed from open findings; retired). Closing report: `code-hygiene/2026-08-code-hygiene.md`. `HYG-002` and `HYG-003` remain `Open`. |
| 2026-07-23 | Baseline Product Audit (`product/2026-07-product.md`): added `PROD-001`–`PROD-003` (all `Open`). Cross-referenced `ARC-011` and `HYG-002`; did not file speculative features. |
| 2026-07-24 | Baseline Roadmap Review (`roadmap/2026-07-roadmap.md`): added `ROAD-001`–`ROAD-002` (all `Open`). Cross-referenced `PROD-001` / `PROD-002` / `ARC-011`; did not invent features or reprioritize work. |
| 2026-07-24 | Resolved `ROAD-002` (removed from open findings; retired). Closing report: `roadmap/2026-08-roadmap.md`. `ROAD-001` remains `Open`. |
| 2026-07-24 | Resolved `ROAD-001` (removed from open findings; retired). Closing report: `roadmap/2026-09-roadmap.md`. Closing evidence: `docs/implementation-roadmap-v1.md` Phases 2–4 complete. |
| 2026-07-23 | Baseline Data Quality Audit (`data-quality/2026-07-data-quality.md`): added `DQ-001`–`DQ-003` (all `Open`). Cross-referenced `ARC-001/003/011`, `HYG-003`, `PROD-003`, `SEC-002/003`; did not duplicate ownership. |
| 2026-07-31 | Recurring Architecture Audit (`architecture/2026-08-architecture.md`): reconciled `ARC-001`…`ARC-020` — all remain `Open`. Refreshed `ARC-011` title/evidence for third import pipeline (`exhibitor-import`). No new ARC IDs; none resolved. Baseline `architecture/2026-07-architecture.md` untouched. |
| 2026-07-31 | Recurring Security Audit (`security/2026-09-security.md`): reconciled `SEC-002`/`SEC-003` — both remain `Open` (manual upload SVG MIME allowlist tightened; residual client-MIME + ingest SVG; SSRF unchanged). `SEC-001` stays retired. No new SEC IDs. Cross-referenced `ARC-001/007/009/015/016/017`. Baseline `security/2026-07-security.md` and closeout `security/2026-08-security.md` untouched (restored from HEAD if missing in working tree). |
| 2026-07-31 | Baseline Scalability Audit (`scalability/2026-07-scalability.md`): added `SCALE-001` (`Open`). Cross-referenced `ARC-002/003/004/008/010/011/017`; did not duplicate import/full-scan/force-dynamic/job-queue roots. Cadence Quarterly per Framework v1.1; cycle token `2026-07` as requested. |
| 2026-07-31 | Baseline SEO Audit (`seo/2026-07-seo.md`): added `SEO-001` (`Open`). Cross-referenced `PROD-002`, `ARC-004`, `DQ-001`/`DQ-003`; did not clone exhibitor stub or force-dynamic roots. Cadence Quarterly per Framework v1.1; cycle token `2026-07` as requested. |
| 2026-07-31 | Baseline UX Audit (`ux/2026-07-ux.md`): added `UX-001`–`UX-004` (all `Open`). Cross-referenced `PROD-001`/`002`/`003`, `ARC-011`/`004`, `SCALE-001`; did not clone product stubs or import-structure roots. Cadence Quarterly per Framework v1.1; cycle token `2026-07` as requested. |
