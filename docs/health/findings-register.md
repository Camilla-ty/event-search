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
| ARC-001 | Service-role client bypasses RLS on read paths, with fail-open fallback | security / data-access | Critical | Large | Open | 2026-07 | 2026-07 | [Baseline §1.1](./architecture/2026-07-architecture.md) |
| ARC-002 | Hot-path full-table scans for sponsor counts (`getSponsorCountsByEditionIds`) | performance / db | Critical | Small | Open | 2026-07 | 2026-07 | [Baseline §11.1](./architecture/2026-07-architecture.md) |
| ARC-003 | Import matching loads entire `companies` / `company_domains` into memory | performance / imports | Critical | Large | Open | 2026-07 | 2026-07 | [Baseline §11.2](./architecture/2026-07-architecture.md) |
| ARC-004 | Public pages `force-dynamic`; no caching/ISR; no request-level dedup (`React cache()`) | performance / public-pages | High | Medium | Open | 2026-07 | 2026-07 | [Baseline §3.1, §3.2, §10.1](./architecture/2026-07-architecture.md) |
| ARC-005 | No CI gate (typecheck / lint / test / build) on PRs | ci / tooling | High | Small | Open | 2026-07 | 2026-07 | [Baseline §14.1](./architecture/2026-07-architecture.md) |
| ARC-006 | Untyped database access — no generated `Database` types | db / types | High | Medium | Open | 2026-07 | 2026-07 | [Baseline §5.1](./architecture/2026-07-architecture.md) |
| ARC-007 | No rate limiting on public/auth endpoints; no schema-validation library | api / security | High | Small–Medium | Open | 2026-07 | 2026-07 | [Baseline §4.1](./architecture/2026-07-architecture.md) |
| ARC-008 | No observability — no error tracking / structured logging / metrics | observability | High | Medium | Open | 2026-07 | 2026-07 | [Baseline §B.8, §12, §14](./architecture/2026-07-architecture.md) |
| ARC-009 | Reactive DB security hardening — no RLS/grant regression-test harness | security / db | High | Medium | Open | 2026-07 | 2026-07 | [Baseline §5.2](./architecture/2026-07-architecture.md) |
| ARC-010 | Client-orchestrated, non-transactional chunked materialization (no durable job queue) | imports / scalability | Medium–High | Large | Open | 2026-07 | 2026-07 | [Baseline §13](./architecture/2026-07-architecture.md) |
| ARC-011 | Two nearly-identical import subsystems (sponsor-import / partner-alumni-import) | imports | Medium | Large | Open | 2026-07 | 2026-07 | [Baseline §1.2](./architecture/2026-07-architecture.md) |
| ARC-012 | God modules / components (1,000+ line files) | code-structure | Medium | Medium | Open | 2026-07 | 2026-07 | [Baseline §2.1, §6](./architecture/2026-07-architecture.md) |
| ARC-013 | Per-route boilerplate duplication; no shared handler wrapper | api | Medium | Medium | Open | 2026-07 | 2026-07 | [Baseline §4.2](./architecture/2026-07-architecture.md) |
| ARC-014 | Extreme API route nesting (12+ dynamic segments) | api | Medium | Medium | Open | 2026-07 | 2026-07 | [Baseline §4.3](./architecture/2026-07-architecture.md) |
| ARC-015 | Email enumeration via unauthenticated `/api/auth/check-email` | security / auth | Medium | Small | Open | 2026-07 | 2026-07 | [Baseline §12.1](./architecture/2026-07-architecture.md) |
| ARC-016 | Thin security headers (no CSP / HSTS / X-Content-Type-Options / frame-ancestors) | security | Medium | Small | Open | 2026-07 | 2026-07 | [Baseline §12.2](./architecture/2026-07-architecture.md) |
| ARC-017 | Middleware runs `getUser()` on nearly every non-asset request | auth / performance | Medium | Small | Open | 2026-07 | 2026-07 | [Baseline §3.3](./architecture/2026-07-architecture.md) |
| ARC-018 | N+1 / double-path hydration in `mergeCompaniesOntoEventSponsorLinks` | performance / db | Medium | Small | Open | 2026-07 | 2026-07 | [Baseline §11.3](./architecture/2026-07-architecture.md) |
| ARC-019 | Manual client server-state (no cache / dedup / retry / abort) | client-state | Low–Medium | Medium | Open | 2026-07 | 2026-07 | [Baseline §9.1, §7.1](./architecture/2026-07-architecture.md) |
| ARC-020 | Thin end-to-end coverage (single Playwright spec) | testing | Low–Medium | Medium | Open | 2026-07 | 2026-07 | [Baseline §14.2](./architecture/2026-07-architecture.md) |
| SEC-002 | Logo uploads trust client MIME and allow public SVG | security / file-upload | Medium | Small | Open | 2026-07 | 2026-07 | [Security 2026-07 §SEC-002](./security/2026-07-security.md) |
| SEC-003 | SSRF in logo/website ingestion without host allow-listing | security / ssrf | Medium | Medium | Open | 2026-07 | 2026-07 | [Security 2026-07 §SEC-003](./security/2026-07-security.md) |
| HYG-002 | Unused superseded EditionImportsStub after live imports panel shipped | dead-code / admin | Low | Small | Open | 2026-07 | 2026-07 | [Code Hygiene 2026-07 §HYG-002](./code-hygiene/2026-07-code-hygiene.md) |
| HYG-003 | Unretired NFT.NYC partner-alumni corruption repair scripts | scripts / one-off | Medium | Small | Open | 2026-07 | 2026-07 | [Code Hygiene 2026-07 §HYG-003](./code-hygiene/2026-07-code-hygiene.md) |
| PROD-001 | Admin global search promised in v1 IA but not present | admin / discoverability | High | Medium | Open | 2026-07 | 2026-07 | [Product 2026-07 §PROD-001](./product/2026-07-product.md) |
| PROD-002 | Public /exhibitors module is a roadmap stub with live product framing | public / polish | Medium | Small | Open | 2026-07 | 2026-07 | [Product 2026-07 §PROD-002](./product/2026-07-product.md) |
| PROD-003 | Partner Alumni imports missing from Dashboard resume surface | admin / workflows | Medium | Medium | Open | 2026-07 | 2026-07 | [Product 2026-07 §PROD-003](./product/2026-07-product.md) |

**Security topics owned by Security but tracked under existing IDs (cross-referenced, not duplicated):** `ARC-001` (RLS/service-role bypass), `ARC-007` (rate limiting + input validation), `ARC-009` (RLS/grant regression tests), `ARC-015` (email enumeration), `ARC-016` (security headers), `ARC-017` (middleware auth). See [Security 2026-07](./security/2026-07-security.md).

---

## Retired IDs

Permanently used identifiers that must never be reissued. (A retired ID may be *reopened* under its original number if the same root cause reappears.)

| ID | Title | Resolved in | Notes |
|----|-------|-------------|-------|
| SEC-001 | No dependency vulnerability scanning | [Security 2026-08](./security/2026-08-security.md) | Closed via GitHub Dependabot alerts + security updates; original write-up [Security 2026-07 §SEC-001](./security/2026-07-security.md) |
| HYG-001 | Tracked temporary run artifacts and scratch files in git | [Code Hygiene 2026-08](./code-hygiene/2026-08-code-hygiene.md) | Removed tracked `tmp/`/`reports/`/`.tmp-before-phase1` artifacts; archived two logo rollback backups under `scripts/archives/logo-migrations/`; original write-up [Code Hygiene 2026-07 §HYG-001](./code-hygiene/2026-07-code-hygiene.md) |

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
