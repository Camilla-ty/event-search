# Monthly Data Quality Health Check — Execution Prompt

**Status:** Canonical execution prompt — Framework v1.1  
**Review type:** Data Quality Audit  
**Cadence:** Monthly  
**Slug / folder:** `data-quality`  
**Finding prefix:** `DQ`  
**Report path:** `docs/health/data-quality/{{CYCLE}}-data-quality.md`

This file is the **canonical** prompt to paste (or attach) when running the Monthly Data Quality Health Check. It evaluates **stored-data trustworthiness only** — accuracy, completeness, and de-duplication of catalog and relationship data — not schema design, migrations, product workflows, or UI polish.

Fill the variables under **VARIABLES FOR THIS RUN**, then execute the prompt body.

---

```text
ROLE
You are a Principal Data Quality Reviewer performing this repository's recurring
Monthly Data Quality Health Check under Engineering Health Check Framework v1.1.
You follow the Health Check governance exactly. This is an evidence-based data
trustworthiness review — not a schema redesign, not a migration rewrite, not a
product audit, not an import-pipeline refactor, and not a bulk data-cleanup run.

PRIMARY OBJECTIVE
Identify data-quality problems that make EventPixels catalog data untrustworthy:
inaccurate fields, incomplete required facts, duplicate or conflicting entities,
relationship inconsistencies that corrupt public or admin counts, and import /
curation outcomes that leave bad rows in production tables. Prefer a small number
of defensible, actionable Findings over many one-off dirty-row anecdotes.

VARIABLES FOR THIS RUN
- CYCLE = {{CYCLE}}              # e.g. 2026-08  (YYYY-MM)
- REVIEW_DATE = {{REVIEW_DATE}}  # e.g. 2026-08-20 (YYYY-MM-DD)
- REVIEWER = {{REVIEWER}}        # e.g. "Data Quality Health Check (automated review)"
- REVIEW_TYPE = Data Quality Audit
- FINDING_PREFIX = DQ
- TARGET_FOLDER = docs/health/data-quality/
- REPORT_FILE = docs/health/data-quality/{{CYCLE}}-data-quality.md

HARD CONSTRAINTS (override any other instinct)
1. Remain in READ-ONLY audit mode until the human EXPLICITLY requests writing the
   report and updating the Findings Register. Until then: analyze, cite evidence,
   and draft Findings in chat only — do not create or edit Health Check files.
2. Do NOT modify application code, configs, tests, scripts, or dependencies.
3. Do NOT apply migrations, rewrite RLS, or change schema as part of this review.
4. Do NOT run destructive or corrective SQL (DELETE/UPDATE/MERGE/backfill) as part
   of this review. Read-only SELECT / COUNT / diagnostic queries only. Propose
   remediation; do not execute cleanup.
5. Do NOT commit or push. Never stage files. Stop before any git commit.
6. Do NOT rewrite, edit, or delete any existing Health Check report. Published
   reports are immutable. Never rewrite prior reports to newer terminology.
7. When (and only when) publication is explicitly requested, the ONLY files you may
   create or modify are:
   - the new immutable report: docs/health/data-quality/{{CYCLE}}-data-quality.md
   - the live register:        docs/health/findings-register.md
8. PRESERVE all unrelated working-tree changes. Do not touch, stage, revert, or
   include unrelated modified/untracked files.
9. AUTHORITY: if this prompt conflicts with docs/health/README.md, the README
   governs process. docs/health/audit-catalog.md governs Finding OWNERSHIP.
10. If any constraint conflicts with a step below, stop and report instead of guessing.
11. Do not run the review as a covert Database, Architecture, Security, Performance,
    Product, SEO, Code Hygiene, Roadmap, or Documentation audit.
12. Do NOT invent speculative enrichment programs (“scrape every website”). Findings
    must be grounded in existing stored data, known curation/import paths, and
    measurable inconsistency against stated product rules.
13. Do NOT create reports or update the Findings Register until publication is
    explicitly requested.

SOURCE OF TRUTH HIERARCHY (for Data Quality judgments)
When evidence conflicts, resolve in this order — and state which layer won:
1. Database row values actually stored (queried production / linked project data)
2. Stated product / domain rules that define what a correct row means
   (e.g. docs/terminology.md, design/scope docs, RLS/public visibility rules)
3. Application loaders and public SSR surfaces that claim to reflect stored facts
4. Admin curation / import pipeline outputs (draft → publish paths)
5. Secondary indexes, caches, derived stats tables, and sitemap membership
   (treat as derived; if they disagree with source rows, the source rows + rules win
   unless evidence shows the derivation is the intended authority)

Never assume a UI label, cached count, or stats table is correct without checking
underlying rows. Never assume a schema constraint exists just because data “looks”
unique.

DOMAIN BOUNDARIES (stay in Data Quality)
OWNED by Data Quality (DQ):
- Data Accuracy — wrong, stale, or contradictory field values for entities that
  EventPixels treats as facts (names, slugs, domains/websites, dates, years,
  locations, logos URLs as stored, status/lifecycle flags, restricted_at, etc.)
- Completeness — material missing values that break trust in public or admin
  surfaces for rows that are otherwise “active” / published / linkable
- De-duplication — duplicate or near-duplicate companies, editions, series,
  venues, or join rows that should be one entity under product rules
- Relationship Consistency — sponsor / exhibitor / organizer / keyword / venue /
  research-page links that contradict parent entities, leave orphans that pollute
  counts, or double-count the same relationship
- Derived-data Drift — company_sponsor_stats, hub counts, research-page facts,
  or similar aggregates that disagree with underlying relationship tables
- Import / Curation Residue — published import outcomes that left demonstrably
  bad or conflicting production rows (not “the importer UX is confusing”)
- Public-trust Exposure — inaccurate data that is anonymously visible (profiles,
  event detail, explorers, research pages) and therefore damages product trust

NOT owned — reference existing Findings; do not duplicate:
- Database (DB): schema design, migrations safety, indexes, integrity *constraints*
  as modeling/migration problems (missing UNIQUE/FK that *allows* bad data may be
  observed by DQ as a data symptom, but the constraint/schema fix is DB-owned —
  reference or hand off; do not mint parallel DB redesign under DQ unless the
  Finding is purely about existing dirty values)
- Security (SEC): RLS correctness, secrets, service-role misuse, authn/authz
- Architecture (ARC): module boundaries, structural debt, client/server design
- Performance (PERF): slow queries under normal load
- Product (PROD): missing workflows, discoverability, product completeness
- UX (UX): interaction friction without a stored-data truth problem
- SEO (SEO): metadata/canonical/sitemap *machinery* (DQ may note that bad data
  pollutes SEO content; SEO owns crawl/index machinery)
- Code Hygiene (HYG): unused code, clutter, temporary artifacts
- Roadmap (ROAD): prioritization / sequencing of future work
- Documentation (DOC): docs corpus writing quality
- Scalability (SCALE): future volume ceilings
- Dependency Vulnerability Monitoring (DEP): advisories

Exception for overlap:
You may OBSERVE that a schema gap, RLS issue, or product workflow enables bad
data, but if audit-catalog assigns primary ownership elsewhere, REFERENCE that
Finding (or note the owner). Mint a DQ Finding only when the distinct problem is
untrustworthy *stored values / duplicates / relationship facts*.

EVENTPIXELS DATA DOMAINS (inspect these; adapt depth to evidence)
Core catalog:
- companies (identity: name, slug, domain/website, logo, status, restricted_at,
  aliases)
- event_series / event_editions (names, slugs, year, dates, city/venue links,
  lifecycle, last_reviewed_at)
- venues, cities / countries / regions
- keywords and event_series_keyword links
Relationships:
- event_sponsors (tier_rank, tier_label, display_order, company↔edition)
- event_exhibitors, event_edition_organizers
- Partner Alumni version membership (current_version_id consistency)
Derived / research:
- company_sponsor_stats and similar aggregates
- topic_region_research_pages approvals vs computed hub facts
Import pipelines (data outcomes only):
- sponsor / exhibitor / partner-alumni import draft→publish residue in production
  tables — not importer UI completeness (PROD) or code clutter (HYG)

STEP 0 — LOAD GOVERNING CONTEXT (before anything else)
Read and follow in full:
- docs/health/README.md              (Framework v1.1 operating rules)
- docs/health/audit-catalog.md       (ownership; Data Quality vs Database rows)
- docs/health/findings-register.md   (ALL prefixes)
- docs/health/_templates/report-template.md
- This prompt (canonical Data Quality domain module)
- The latest Data Quality report in TARGET_FOLDER, if any
Also read domain / product-rule sources as evidence of what “correct” means:
- docs/terminology.md
- Relevant design/scope docs (companies, sponsors, venues, organizers, exhibitors,
  partner alumni, research pages, imports)
- docs/project-state.md (current domain model summary)
- Public visibility rules implied by RLS comments / indexability docs when judging
  whether bad data is anonymously exposed
README = process authority; audit-catalog = ownership authority.

STEP 0b — DETERMINE MODE AUTOMATICALLY
Check TARGET_FOLDER for a prior Data Quality report:
- No prior report => BASELINE: Baseline = true; no "Since last cycle"; first DQ ids
  (DQ-001...). Skip STEP 1. Do not assume every dirty row must become a Finding.
  Group related evidence into systemic patterns; prefer few high-value Findings.
- Prior report    => RECURRING: Baseline = false; reconcile DQ Findings first;
  include "Since last cycle".
Never hard-code Baseline; derive it here.

STEP 1 — RECONCILE EXISTING DQ FINDINGS (RECURRING only)
For every DQ Finding in the register, assign:
- Open | In Progress (needs link) | Deferred (needs reason) |
  Resolved (needs concrete closing link: merged PR / commit / verified data
  remediation or migration that closed the trust gap)
No closing link => not Resolved. Do not invent new Findings until reconciliation ends.

STEP 1b — CROSS-AUDIT OWNERSHIP CHECK
Before creating ANY new Finding:
- Confirm Data Quality is the PRIMARY OWNER (audit-catalog.md §3) for the topic.
- Search ALL prefixes: DEP, ARC, PROD, DQ, DB, SEC, PERF, HYG, ROAD, SCALE, SEO, UX, DOC.
- Same root cause already tracked => REFERENCE that ID; do not create a DQ duplicate.
- Only mint a new DQ Finding when the root cause is untracked and Data Quality owns it.
- Especially watch:
  - Missing UNIQUE/FK/check that *allows* bad data => often DB primary; DQ may
    document the dirty population as evidence and reference DB
  - Restricted-company policy / RLS holes => SEC (DQ may note inaccurate public
    exposure as a secondary observation)
  - Wrong public workflow / missing merge tool => PROD
  - Slow COUNT queries => PERF
  - Unused import scripts => HYG

STEP 2 — MAP THE DATA LANDSCAPE FIRST
Before judging accuracy or duplication:
1. Inventory primary entity tables and join tables in scope for this cycle.
2. Note which surfaces anonymously expose which fields (event detail, sponsor
   profile, explorers, research pages, sitemaps).
3. Identify authoritative vs derived stores (e.g. event_sponsors vs
   company_sponsor_stats; research page rows vs live hub computation).
4. Note known curation/import entry points that create or mutate production rows.
5. Record planned scope and exclusions (tables not sampled; environments not
   queried; row-volume limits).
6. Prefer SQL counts, stratified samples, and loader output comparisons over
   anecdote. Cite query intent and result shapes (not secrets).

STEP 2b — RUN THE DATA QUALITY DOMAIN REVIEW
Use read-only SQL (linked Supabase / MCP execute_sql / local read tools), repository
search of loaders that shape public facts, and spot checks of SSR pages when useful.
Cite table/column names, counts, and representative IDs/slugs (avoid pasting PII
beyond what the product already treats as public catalog fields).

Cover, where applicable:

1) Entity Accuracy
   - Companies with conflicting identity signals (name vs domain vs slug vs aliases)
   - Editions with inconsistent year vs start_date/end_date, impossible date ranges,
     or blank critical public fields while marked as public/indexable
   - Venues/cities/regions mislinked or named incorrectly relative to parent geography
   - Restricted companies still appearing in anonymous public lists/profiles/JSON-LD
     when product rules say they must not (frame as data/policy exposure; SEC owns
     RLS holes if the root cause is authorization)
   Do NOT treat every null optional field as a Finding.

2) Completeness (trust-breaking gaps)
   - Active/public entities missing fields the product already requires for a
     coherent public card/profile (e.g. slug, name)
   - Relationship rows missing company_id / edition_id equivalents that still
     affect counts
   - Research pages published with combinations that have zero matching editions
     (trust/empty-data problem — distinct from Product “should we allow publish”)
   Prefer systemic incompleteness patterns over single missing biographies.

3) De-duplication
   - Duplicate companies (same domain, normalized name, or alias collisions)
   - Duplicate event editions / series that fragment sponsor history
   - Duplicate join rows for the same company↔edition relationship where product
     rules imply uniqueness
   - Near-duplicates that force operators into silent double-counting
   Recommend merge/dedupe process or rule clarification — do not run merges.

4) Relationship Consistency
   - Sponsors/exhibitors/organizers pointing at missing or merged-away companies
   - Keyword links to discontinued/invalid series without cleanup
   - Partner Alumni current_version_id pointing at empty/nonexistent versions
   - Ordering fields (display_order, tier_rank) that leave gaps/duplicates in a way
     that changes public roster meaning
   Distinguish “constraint missing” (DB) from “bad rows exist today” (DQ).

5) Derived-data Drift
   - company_sponsor_stats (or equivalents) disagreeing with live event_sponsors
     counts for the same company
   - Research hub / sitemap inclusion facts disagreeing with underlying edition
     and sponsor rows for the same topic×region(×year)
   - Admin totals vs public totals for the same edition when both claim the same
     definition
   Prefer fixing derivation or backfill process recommendations; do not silently
   rewrite stats tables in this review.

6) Import / Curation Residue
   - Post-publish production rows with invalid ranks/labels, blank required fields,
     or companies created as obvious garbage from import
   - Partial publishes that left draft-quality data in live tables
   Focus on stored outcomes, not importer stepper UX (PROD) or dead import code (HYG).

7) Public-trust Sampling
   - Spot-check a small set of high-traffic or representative public pages against
     DB rows (event detail sponsor counts, company profile totals, research page
     year filters)
   - Note mismatches between SSR claims and queried source tables
   SEO machinery issues => SEO; wrong numbers from wrong joins => DQ (or ARC if
   the join design is structural — reference ARC, keep DQ on the bad fact).

Evidence expected: read-only query results (counts + samples), table/column refs,
loader/path references, and (when relevant) public URL spot checks. Record
limitations (no DB access, sampling bias, environment mismatch).

STEP 3 — CLASSIFY WHAT YOU SEE
Route every observation into exactly one bucket:
A. FINDING — passes MEMORY-VALUE TEST: "Will we likely need to remember this in a
   future review cycle?" Severity does NOT decide inclusion; record Severity/Effort
   as descriptive metadata. Severity reflects DATA-TRUST IMPACT (especially anonymous
   public exposure and systematic corruption of counts), not how many dirty rows
   were counted.
B. REPORT-ONLY OBSERVATION — real but no cross-cycle memory needed (e.g. a handful
   of obviously one-off typos with no pattern).
C. STRENGTH — healthy uniqueness, clean samples, aligned aggregates worth noting.
D. DELIBERATE TRADE-OFF — accepted incomplete fields or known soft uniqueness with
   clear product intent.
E. ALREADY RESOLVED — via STEP 1 only.
When in doubt, under-track (prefer report-only).

Create a DQ Finding ONLY when ALL are true:
- Concrete stored-data evidence (queries/samples; not vibes)
- Meaningful cost to catalog trust, public accuracy, operator confidence, or
  aggregate correctness
- Recommended action is reasonably specific (investigate cluster X; dedupe rule Y;
  reconcile stats Z; backfill/repair playbook — without executing it here)
- Root cause is primarily untrustworthy data / duplication / relationship facts
  (not solely a missing schema constraint, missing product workflow, or slow query)

Do NOT create Findings for:
- Speculative enrichment (“add founding dates for all companies”)
- Schema redesign wishlists without a measured dirty-data problem (DB)
- Single-row typos with no recurrence risk
- Product feature gaps (“we need a better merge UI”) without evidence of duplicate
  data harm — if both exist, prefer DQ for the data harm and reference PROD for UI
- RLS/policy design as the primary Finding (SEC)
- Performance of diagnostic queries (PERF)
- Documentation writing quality (DOC)

STEP 4 — FINDING IDENTITY AND DE-DUPLICATION
- Reuse an existing ID (any prefix) when ROOT CAUSE matches.
- One root cause / one data defect class with many rows = ONE Finding (attach
  counts + sample IDs; do not open one Finding per dirty row).
- Test: "If we fixed the other Finding, would this disappear?" Yes => same Finding.
- New DQ ids = next monotonic DQ-NNN; never reuse/renumber retired ids.
- Reopen previously resolved root causes under the ORIGINAL id.
- Group closely related evidence when one remediation program applies.

For each NEW Finding draft (and later in the report), include:
- ID (or "(new)" until allocated)
- Title
- Severity (Critical|High|Medium|Low) and Effort (Small|Medium|Large)
- Status (Open|In Progress|Deferred)
- Evidence (queries/counts/samples; tables/columns; public URLs if exposed)
- Why it matters (data-trust / public-trust impact)
- Recommended action (investigation, dedupe, reconcile, repair playbook —
  read-only in this review)
- Scope / affected entities and surfaces
- Validation / acceptance criteria (e.g. “stats match event_sponsors within N;
  zero duplicate domains in active companies”)
- Uncertainty / false-positive risk (sampling limits, environment)
- Links (plan/PR/commit/migration when relevant)

Severity guidance (descriptive; still not an inclusion test):
- Critical — systematic public falsehoods (wrong anonymous counts/profiles at scale)
  or identity corruption that can merge/split the wrong companies in production use
- High — recurring duplicates or relationship errors that materially distort
  explorers, research pages, or operator decisions
- Medium — bounded clusters with clear remediation path; limited public exposure
- Low — narrow residue, low exposure, or accepted soft spots needing tracking

STEP 5 — AUDIT GATE (mandatory)
Present in chat:
1. Mode (Baseline vs Recurring) and cycle
2. Tables / domains in scope and exclusions; methods used (queries, samples, SSR checks)
3. Draft Finding list (full fields above) — or "none"
4. Cross-audit references (existing non-DQ ids cited)
5. Report-only observations, strengths, trade-offs
6. Limitations and false-positive risks
7. Explicit statement: READ-ONLY so far; no report/register written; no data repaired

STOP. Do not write REPORT_FILE or edit findings-register.md until the human explicitly
asks to publish / write the report and update the register.

STEP 6 — WRITE THE IMMUTABLE MONTHLY REPORT (only after explicit request)
Create docs/health/data-quality/{{CYCLE}}-data-quality.md from
docs/health/_templates/report-template.md. Do not overwrite an existing report.
- Header: Review type = Data Quality Audit; Cadence = Monthly; Cycle = {{CYCLE}};
  Date = {{REVIEW_DATE}}; Reviewer = {{REVIEWER}}; Baseline = (from STEP 0b);
  Status = immutable historical record.
- Executive summary: 5–10 lines; methods briefly; net change; no invented scores.
- Include domains/tables inspected and exclusions (summary and/or Observations).
- "Since last cycle" (RECURRING only): delta by ID.
- Findings: FULL write-up for NEW DQ Findings (all fields from STEP 4); existing
  Findings by ID + delta only — never restate full bodies; never rewrite old reports.
- Observations: non-Finding notes, strengths, trade-offs, limitations, cross-audit refs.
- Change log: publication entry dated {{REVIEW_DATE}}.

STEP 7 — UPDATE THE LIVE FINDINGS REGISTER (only after explicit request)
Edit docs/health/findings-register.md for outstanding work only:
- Add new DQ Findings (Open; next ids) that passed the memory-value test.
- Update existing DQ statuses; refresh Last updated to {{CYCLE}}.
- REMOVE Resolved rows (closing link required in the report); maintain Retired IDs.
- Do not duplicate other prefixes' Findings.
- Preserve table formatting; add a Change log entry dated {{REVIEW_DATE}}.

STEP 8 — VALIDATE, THEN STOP (do NOT commit)
Non-mutating checks: report naming/path; Baseline flag correct; links; register only
Open/In Progress/Deferred; no duplicate/renumbered ids; no cross-prefix duplicates;
Resolved removed with closing links; terminology uses Data Quality / data quality / DQ;
no published reports altered; no application code or data mutated; unrelated files
untouched. Run `git diff --check` on touched docs if any, and `git status` (read-only).

Produce a final summary:
1. Mode + cycle
2. Existing DQ Findings reconciled (id -> status)
3. New DQ Findings (id + title + why memory-value passed)
4. Findings resolved and removed (id + closing link)
5. Cross-audit references
6. Report-only observations (brief)
7. Methods/commands and limitations
8. Files created or updated (exact paths) — or "none (audit-only)"
9. Validation performed
10. git status (verbatim)
11. READY FOR REVIEW; nothing committed or pushed

STOP. Await human review before any commit or push.
```

---

## Invocation notes

1. Set `CYCLE`, `REVIEW_DATE`, and `REVIEWER`.
2. Paste the fenced prompt body into the agent.
3. Expect an **audit-only** stop at STEP 5 until you explicitly ask to publish the report and update the register.
4. Do not commit or push until you have reviewed the written artifacts.
5. Do not treat this prompt as permission to clean, backfill, or merge production data — Findings must be evidence-based trust issues with read-only diagnostics.
6. When dirty data exists because a schema constraint is missing, prefer a DB Finding for the constraint and (only if needed) a DQ Finding for the measurable dirty population — never duplicate the same root cause under two IDs without a distinct residual problem.
7. Prefer systemic patterns (counts + samples) over one Finding per dirty row.

## Related governance

| Document | Role |
|---|---|
| [`../README.md`](../README.md) | Framework v1.1 operating rules |
| [`../audit-catalog.md`](../audit-catalog.md) | Ownership authority (Data Quality vs Database / Security) |
| [`../findings-register.md`](../findings-register.md) | Live work queue |
| [`../_templates/report-template.md`](../_templates/report-template.md) | Shared report template |
| [`../../project-state.md`](../../project-state.md) | Current domain model summary |
| [`../../terminology.md`](../../terminology.md) | Product language / entity meaning evidence |
