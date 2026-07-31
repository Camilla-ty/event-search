# Data Quality Audit — 2026-07

**Review type:** Data Quality Audit
**Cadence:** Monthly
**Cycle:** 2026-07
**Date:** 2026-07-23
**Reviewer:** Data Quality (Automated)
**Baseline:** true
**Status:** Immutable historical record — do not edit after publication.

> Baseline Data Quality Health Check under Framework v1.1. No prior `data-quality/` report existed, so this run is Baseline. New Findings are `DQ-001`…`DQ-003`. Cross-audit topics already tracked under `ARC` / `SEC` / `HYG` / `PROD` are referenced, not duplicated. Prefer few high-value Findings over one-off dirty-row anecdotes. Read-only diagnostics only — no data cleanup executed.

---

## Executive summary

First Data Quality cycle for EventPixels. Scope: trustworthiness of stored catalog and relationship data — accuracy, completeness, de-duplication, relationship consistency, and derived-data drift. Excluded: schema/constraint redesign (`DB`), RLS/authorization (`SEC` / `ARC-001`), import UX (`PROD`), import-subsystem structure (`ARC-011`), and dead script hygiene (`HYG-003`).

Methods: inventory of public tables via linked Supabase; read-only `COUNT` / stratified samples across companies, editions, sponsors, exhibitors, organizers, venues, Partner Alumni, research pages, and `company_sponsor_stats`; cross-check against ADR-001 / project-state product rules.

Net result: core relationship integrity and uniqueness constraints look healthy (no orphan joins; no duplicate company↔edition sponsor/exhibitor/organizer rows; `company_sponsor_stats` fully aligned with live `event_sponsors`). Three Findings opened: systemic weak company website/domain identity on sponsor rows; four public editions missing `city_id`; and active orphan / bogus company shells left by import/curation residue. No DQ Findings resolved (baseline).

---

## Findings

### DQ-001 — Sponsor companies lack official website/domain identity at scale

- **Why it matters:** ADR-001 treats official website domains as the durable company-identity foundation for matching and merge. When `companies.website` / `company_domains` hold only social or community hosts (or are blank), import matching cannot remember verified identity, public profiles expose weak or non-navigable “websites,” and operators cannot confidently detect duplicates. This is a standing catalog-trust condition, not a one-off typo cluster.
- **Severity:** High  ·  **Effort:** Large  (descriptive only)
- **Evidence:**
  - Host-parsed active companies (avoiding substring false positives such as `okx.com` matching `x.com`): **312** with social/community website hosts (`x.com`, `twitter.com`, `linkedin.com`, `facebook.com`, `instagram.com`, `youtube.com`, `linktr.ee`, `t.me`, `discord.com`, `beacons.ai`, `link3.to`, `opensea.io`).
  - **295** of those have **no** real apex domain in `company_domains` (host-like domain excluding the social/community set); **294** are linked via `event_sponsors`.
  - **28** distinct sponsor-linked companies have null/blank `website`.
  - Samples: `allspark-research` (`website` / primary domain `x.com/alsparkresearch`; domains only LinkedIn + X); `bd-gemx` (`https://x.com/BD_GemX`; domains only Telegram + X); contrast healthy `okx` (`https://www.okx.com/` + `okx.com` apex domain present).
  - Product rule: [`docs/adr/ADR-001-company-identity.md`](../../adr/ADR-001-company-identity.md) and [`docs/implementation/company-domain-matching-v1.md`](../../implementation/company-domain-matching-v1.md) — official website domains only; social/community sites out of matching scope.
- **Status:** Open
- **Recommended action:** Prioritize identity repair for sponsor-linked companies: backfill official websites where known; normalize scheme-less hostlike values to `https://…`; stop treating social/community URLs as primary website when a real domain exists elsewhere; add an admin completeness filter/report for “social-only / missing website” sponsors. Do **not** auto-merge on name similarity (ADR-001). Tighten import publish rules in a follow-up so new creates prefer official domains — pipeline UX remains `PROD` / structure `ARC-011`.
- **Scope / affected entities and surfaces:** `companies.website`, `companies.domain`, `company_domains`; public sponsor profiles; admin company completeness; sponsor/exhibitor/Partner Alumni import matching.
- **Validation / acceptance criteria:** Among active sponsor-linked companies, social-host-only identity (no real apex domain) is driven below an agreed threshold (e.g. under 5%) or explicitly deferred with documented exception list; null-website sponsor count tracked to near-zero for newly published rows.
- **Uncertainty / false-positive risk:** Medium — some organizations genuinely have only social presence; host parsing may miss exotic TLDs; `company_domains` path-form social rows (`x.com/handle`) are intentional for matching memory and are not themselves the defect.
- **Links:** ADR-001; related performance of full-table import matching remains `ARC-003` (not duplicated).

### DQ-002 — Public event editions missing `city_id`

- **Why it matters:** City is a core public Event fact (explorer geography, city pages, research-page region joins). Editions stored without `city_id` publish incomplete location truth even when names/years look fine.
- **Severity:** Medium  ·  **Effort:** Small  (descriptive only)
- **Evidence:**
  - **4 / 93** `event_editions` rows have `city_id IS NULL`:
    - `permissionless-i-2022`, `permissionless-ii-2023`, `permissionless-iii-2024` (series `permissionless`)
    - `nordic-blockchain-conference-2027` (series `nordic-blockchain-conference`)
  - All four currently have **0** sponsors, exhibitors, and organizers — low roster exposure, but edition identity is still incomplete for public SSR surfaces that key off city.
  - All other edition accuracy checks in this cycle were clean: **0** year-vs-`start_date` mismatches, **0** impossible date ranges (`end_date` before `start_date`), **0** missing name/slug/year/series.
- **Status:** Open
- **Recommended action:** Curate cities for the four editions (or archive/unpublish if they should not be public shells). Add an admin completeness warning for editions missing city when status implies public visibility.
- **Scope / affected entities and surfaces:** `event_editions.city_id`; public event detail / explorer / city pages; research-page edition matching by region.
- **Validation / acceptance criteria:** Zero public/active editions with null `city_id`, or documented intentional exceptions with non-public lifecycle.
- **Uncertainty / false-positive risk:** Low for the null count. Future editions may intentionally omit city pre-announce — if so, record as deliberate trade-off and narrow the Finding.
- **Links:** —

### DQ-003 — Active orphan and bogus company shells from import/curation residue

- **Why it matters:** Active companies with no relationships still occupy slugs/names in admin search and can collide with future imports. Bogus rows (non-URL “websites,” program labels stored as companies) corrupt identity tables and confuse merge/matching. This is stored-outcome residue, distinct from importer stepper UX (`PROD`) or unretired repair scripts (`HYG-003`).
- **Severity:** Medium  ·  **Effort:** Medium  (descriptive only)
- **Evidence:**
  - **46** active companies have no rows in `event_sponsors`, `event_exhibitors`, `event_edition_organizers`, or `event_partner_alumni_version_companies` (plus **22** intentional `status = merged` tombstones with no relationships — by design, not counted as this defect).
  - Bogus shell: `partner-alumni` — name `Partner Alumni`, `website` / `companies.domain` / `company_domains` = `Amazon Web Services (AWS)` (not a URL); no relationships.
  - Orphan identity shells that collide with real catalog names: e.g. `binance` (null website, 0 links) alongside linked `binance-academy` / `binance-us` / `binance-japan`; `franklin-templeton` (0 links) beside linked `franklin-templeton-japan`.
  - Near-duplicate name shell: `1783-dao` (`1783 DAO`, null website, 0 links) beside `1783dao` (`1783DAO`, `linktr.ee`, 3 sponsor links).
  - Exact-domain uniqueness across companies: **0** duplicate normalized `company_domains` shared by multiple companies (strength for domain keying). Exact-name duplicate among active companies: one pair (`Teleport` / `TELEPORT`) with **different** real domains — treated as likely distinct brands (report-only).
- **Status:** Open
- **Recommended action:** Triage the 46 active orphans: merge into canonical companies where identity is proven, restrict/archive, or delete per product policy; remove or repair the `partner-alumni` bogus row and any non-URL domain rows; review high-confidence near-dup shells (`1783-dao`) via existing company merge. Cross-check whether NFT.NYC Partner Alumni incident cleanup (`HYG-003` scripts) left related residue — do not re-run those scripts from this review.
- **Scope / affected entities and surfaces:** `companies`, `company_domains`; admin company list/search/merge; future import matching.
- **Validation / acceptance criteria:** No active company whose name/website is a program label or non-URL string; active orphan count materially reduced or each remaining orphan documented as intentional staging; `1783-dao`-class shells merged or disposed.
- **Uncertainty / false-positive risk:** Medium — some orphans may be intentional staging for upcoming editions; name-near-dups with different domains are often legitimately distinct (e.g. `cryptonews.com` vs `crypto.news`).
- **Links:** Related script hygiene (not duplicated): `HYG-003`. Company merge capability already shipped (Product 2026-07 observation).

---

## Cross-audit references (existing Findings — not duplicated)

| Topic observed | Existing ID | Why not a new DQ Finding |
|---|---|---|
| Service-role reads bypass RLS / scattered `restricted_at` filters | `ARC-001` | Security/data-access architecture; DQ notes restricted company `aidav2` still has 4 non-tier-1 sponsor links — public scrubbing depends on JS filters under that Finding |
| Full-table company load for import matching | `ARC-003` | Performance of matching, not the dirty identity population (`DQ-001`) |
| Dual sponsor / partner-alumni import subsystems | `ARC-011` | Structural duplication; DQ owns stored residue outcomes only |
| Unretired NFT.NYC PA corruption repair scripts | `HYG-003` | Script hygiene; DQ-003 tracks leftover bad rows if any remain |
| Partner Alumni imports missing from Dashboard resume | `PROD-003` | Product workflow discoverability |
| Logo MIME / SSRF | `SEC-002`, `SEC-003` | Security of ingestion, not catalog truth |

---

## Observations (not tracked)

**Domains / tables inspected**
- Core: `companies` (4583; 4561 active / 22 merged), `company_domains` (6401), `event_series` (38), `event_editions` (93), `venues` (34), geography tables, `keyword` / `event_series_keyword`.
- Relationships: `event_sponsors` (7287), `event_exhibitors` (56), `event_edition_organizers` (65), Partner Alumni program/version/members (454 current members for `nft-nyc`).
- Derived: `company_sponsor_stats` (aligned 4494/4494 with live distinct edition counts).
- Research: `topic_region_research_pages` (5; 1 published `bitcoin` × `asia` with 7 matching editions — not empty).
- Import tables: sponsor/exhibitor batches empty; one Partner Alumni import batch retained historically.
- Legacy (rejected model, still populated): `organizers` (4) / `event_organizers` (4) for `singapore-fintech-festival-2025` only — **0** modern organizer rows on that edition. Legacy websites appear cross-wired (ABS↔MAS, Constellar↔GFTN). Not public-facing; recommend DB/HYG retirement rather than a DQ Finding.

**Strengths**
- No orphan FK-style sponsor/exhibitor/organizer/series/keyword links detected.
- No duplicate `(edition, company)` join rows for sponsors, exhibitors, or organizers.
- No duplicate series/edition/venue slugs; no active same-city duplicate venue names; no editions on archived venues.
- Partner Alumni `current_version_id` resolves; 0 orphan/duplicate members on current version.
- `company_sponsor_stats.sponsored_edition_count` matches live `event_sponsors` for all compared companies.
- Completed merges (22) correctly tombstone losers (`status = merged`, slug `merged-…`); slug redirects = 22. One merged tombstone still holds domain `marathondh.com` — minor residue, report-only.

**Report-only / low memory-value**
- **11** sponsor edition+tier groups with non-dense `display_order` (max ≠ tier size) — consistent with “imports append, never reorder” product rule; relative order still defined; not tracked.
- Near-normalized-name clusters with **different** real domains (Crypto News / Cryptonews / crypto.news; Fortune vs Fortune!; Teleport vs TELEPORT; The Block vs TheBlock.; Wu Blockchain pair) — do not auto-merge; optional human review only.
- **28** scheme-less but hostlike `website` values (e.g. `tradingview.com`) — normalize as part of DQ-001 remediation.
- Restricted company `aidav2`: 4 sponsor links, 0 tier-1 — anon sponsor RLS hides tier≠1; residual exposure risk owned by `ARC-001` filter discipline.

**Deliberate trade-offs**
- Merged company tombstones retained (`status = merged`) instead of hard delete — intentional merge design.
- Social handles stored in `company_domains` as path-form domains for matching memory — intentional; defect is using them as the *only* identity.

**Limitations**
- Diagnostics against linked Supabase project only; no production SSR URL crawl this cycle.
- Research-page matching used keyword + city→country→region joins; loader edge cases not exhaustively compared line-by-line.
- Near-duplicate detection is heuristic (normalized names / hosts); false positives expected for distinct brands sharing generic names.
- No destructive SQL and no application code changes in this review.

---

## Change log

| Date | Note |
|------|------|
| 2026-07-23 | Baseline Data Quality Audit published. Added `DQ-001`–`DQ-003`. Cross-referenced `ARC-001/003/011`, `HYG-003`, `PROD-003`, `SEC-002/003`. Read-only diagnostics only; no data repaired. |
