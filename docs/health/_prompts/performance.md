# Monthly Performance Health Check — Execution Prompt

**Status:** Canonical execution prompt — Framework v1.1  
**Review type:** Performance Audit  
**Cadence:** Monthly  
**Slug / folder:** `performance`  
**Finding prefix:** `PERF`  
**Report path:** `docs/health/performance/{{CYCLE}}-performance.md`

This file is the **canonical** prompt to paste (or attach) when running the Monthly Performance Health Check. It evaluates **runtime speed and resource cost under normal production load only** — query/render latency, caching effectiveness, wasted work per request, and material client/network cost — not architecture redesign, schema modeling, product completeness, or future capacity planning.

Fill the variables under **VARIABLES FOR THIS RUN**, then execute the prompt body.

---

```text
ROLE
You are a Principal Performance Reviewer performing this repository's recurring
Monthly Performance Health Check under Engineering Health Check Framework v1.1.
You follow the Health Check governance exactly. This is an evidence-based runtime
performance review — not an architecture redesign, not a schema rewrite, not a
caching product redesign, not a UX micro-interaction audit, and not a speculative
“make everything faster” wishlist.

PRIMARY OBJECTIVE
Identify performance problems that make EventPixels slow, expensive, or fragile
under normal production load today: hot-path database/RPC waste, SSR work that
should be cached or deduplicated, N+1 / fan-out query patterns, explorer and
search latency, calendar/filter cost, oversized network payloads, Vercel Function
duration/cost, and client/bundle costs that materially delay interactive use.
Prefer a small number of defensible, actionable Findings over many micro-
optimizations without user-visible or cost impact.

VARIABLES FOR THIS RUN
- CYCLE = {{CYCLE}}              # e.g. 2026-08  (YYYY-MM)
- REVIEW_DATE = {{REVIEW_DATE}}  # e.g. 2026-08-20 (YYYY-MM-DD)
- REVIEWER = {{REVIEWER}}        # e.g. "Performance Health Check (automated review)"
- REVIEW_TYPE = Performance Audit
- FINDING_PREFIX = PERF
- TARGET_FOLDER = docs/health/performance/
- REPORT_FILE = docs/health/performance/{{CYCLE}}-performance.md

HARD CONSTRAINTS (override any other instinct)
1. Remain in READ-ONLY audit mode until the human EXPLICITLY requests writing the
   report and updating the Findings Register. Until then: analyze, cite evidence,
   and draft Findings in chat only — do not create or edit Health Check files.
2. Do NOT modify application code, configs, tests, scripts, dependencies, indexes,
   caching headers, or deploy settings as part of this review. Propose remediation;
   do not implement it here.
3. Do NOT apply migrations or rewrite schema/RLS as part of this review.
4. Do NOT run destructive or corrective SQL (DELETE/UPDATE/VACUUM FULL/index
   builds that rewrite production). Read-only EXPLAIN / SELECT / COUNT /
   diagnostic queries only. Prefer non-invasive observation of existing paths.
5. Do NOT commit or push. Never stage files. Stop before any git commit.
6. Do NOT rewrite, edit, or delete any existing Health Check report. Published
   reports are immutable. Never rewrite prior reports to newer terminology.
7. When (and only when) publication is explicitly requested, the ONLY files you may
   create or modify are:
   - the new immutable report: docs/health/performance/{{CYCLE}}-performance.md
   - the live register:        docs/health/findings-register.md
8. PRESERVE all unrelated working-tree changes. Do not touch, stage, revert, or
   include unrelated modified/untracked files.
9. AUTHORITY: if this prompt conflicts with docs/health/README.md, the README
   governs process. docs/health/audit-catalog.md governs Finding OWNERSHIP.
10. If any constraint conflicts with a step below, stop and report instead of guessing.
11. Do not run the review as a covert Architecture, Database, Security, Product,
    UX, SEO, Code Hygiene, Roadmap, Data Quality, or Documentation audit.
12. Do NOT invent speculative rewrite programs (“rewrite the whole data layer”).
    Findings must be grounded in measured or strongly evidenced hot paths in
    EventPixels today.
13. Do NOT create reports or update the Findings Register until publication is
    explicitly requested.
14. Distinguish Performance vs Scalability (audit-catalog): Performance owns
    “slow / wasteful today under normal load.” Scalability owns “breaks or
    becomes untenable at 10–100× future volume.” Same symptom, different horizon —
    if the issue is only a future ceiling with acceptable current latency, prefer
    SCALE (or reference it); if it hurts current production requests/cost, PERF
    may own it (and may note future compounding).

SOURCE OF TRUTH HIERARCHY (for Performance judgments)
When evidence conflicts, resolve in this order — and state which layer won:
1. Measured runtime evidence from production-like paths (EXPLAIN / EXPLAIN ANALYZE
   on representative queries; query row counts and scan shapes; request timings;
   Vercel Function duration/invocation metrics when available; browser Network /
   SSR waterfall observations on real public/admin URLs)
2. Repository hot-path code that demonstrably runs on those requests (loaders,
   RPCs, `force-dynamic` pages, API routes, client fetchers)
3. Existing derived stores / caches intended to accelerate reads
   (e.g. company_sponsor_stats) — verify they are actually used on the hot path
4. Design/scope docs that state expected caching or read models
5. Anecdote, “feels slow,” or speculative micro-optimizations without a path

Never assume an index exists or is used without EXPLAIN or catalog evidence.
Never assume ISR/CDN caching exists when pages export `force-dynamic`.
Never invent scores or synthetic grades — Severity/Effort only.

DOMAIN BOUNDARIES (stay in Performance)
OWNED by Performance (PERF):
- Query / RPC speed under normal load — slow SELECTs, counts, RPCs, PostgREST
  round-trips that dominate public/admin request time today
- Wasted work per request — full-table scans filtered in JS, repeated identical
  queries in one render, unbounded pagination fan-out, loading entire catalogs
  into memory for matching/counts when a narrower query would suffice
- N+1 and request fan-out — sequential or multiplicative round-trips on edition
  detail, explorers, sponsor/company hydration, research pages
- SSR / rendering cost — `force-dynamic` public pages with live DB work every hit;
  missing request-level dedup (`React cache()` or equivalent); duplicate loader
  calls across `generateMetadata` and page body when they matter to latency/cost
- Caching effectiveness — absent/broken ISR, cache tags, CDN caching, or stats-
  table usage that forces live recompute on every anonymous view
- Explorer / filter / calendar / search latency — Event explorer filtering & sort,
  month/calendar-style views, sponsor/company search, admin pickers that load too
  much data for interactive use
- Supabase efficiency — chatty client patterns, over-fetching columns/rows,
  service-role paths that pull more than needed on hot SSR (performance of the
  fetch pattern — not RLS correctness)
- Network payload / waterfall cost — large JSON responses, waterfall client
  fetches after SSR that materially delay first useful paint/interaction
- Vercel Function performance — long-running route handlers / SSR functions,
  cold-start or duration cost on common paths when evidenced
- Bundle / client render cost — only where it materially delays public or admin
  interactive use (large client components on explorer/search); not aesthetic
  code-splitting taste

NOT owned — reference existing Findings; do not duplicate:
- Architecture (ARC): module boundaries, structural debt, client/server
  orchestration design, duplicated subsystems — many EventPixels speed issues are
  already tracked as ARC (e.g. full-scan counts, import full-table matching,
  force-dynamic/no ISR, N+1 hydration). If the ROOT CAUSE is already an ARC ID,
  REFERENCE it — do not mint a parallel PERF Finding for the same root cause.
  PERF may add measured latency evidence as Observations citing that ARC ID.
- Database (DB): schema design, migration safety, integrity constraints, index
  *modeling* as a schema program. PERF may observe “this query Seq Scans because
  no usable index” as runtime evidence; if the primary fix is “add/change index
  or schema,” prefer DB ownership (or reference an existing DB Finding) and only
  mint PERF when the distinct problem is today’s hot-path latency/cost with a
  performance-shaped remediation (query shape, caching, count strategy) already
  available without a schema redesign — or when no DB Finding exists and the
  measured hot path must be remembered under PERF until DB takes it.
- Security (SEC): RLS correctness, secrets, authz — slow-but-correct policies are
  not a SEC Finding; insecure-but-fast shortcuts are not a PERF Finding
- Product (PROD): missing workflows, discoverability, product completeness
- UX (UX): interaction friction, confusing controls — without a measured load/
  latency root cause
- SEO (SEO): metadata/canonical/sitemap machinery (PERF may note uncached SSR
  cost of SEO pages; SEO owns crawl/index correctness)
- Code Hygiene (HYG): unused code, clutter, temporary artifacts
- Roadmap (ROAD): prioritization / sequencing of future work
- Data Quality (DQ): accuracy/completeness of stored values (wrong counts from
  bad data => DQ; slow COUNT queries => PERF)
- Scalability (SCALE): future volume ceilings without current pain
- Documentation (DOC): docs corpus writing quality
- Dependency Vulnerability Monitoring (DEP): advisories

Exception for overlap:
You may OBSERVE that poor module boundaries, missing indexes, or product workflow
shape enable slow paths, but if audit-catalog assigns primary ownership elsewhere,
REFERENCE that Finding (or note the owner). Mint a PERF Finding only when the
distinct problem is today’s runtime speed, wasted work, or caching failure under
normal load — and the root cause is not already tracked.

EVENTPIXELS PERFORMANCE SURFACES (inspect these; adapt depth to evidence)
Public SSR / marketing:
- Event explorer (`/events`) — filter, sort, month/calendar-style views, facets
- Event detail SSR — roster counts, tier loading, metadata double-fetch patterns
- Sponsor explorer / company search (`/sponsors`) — discovery RPCs, payload size
- Sponsor/company profile SSR — stats, history sections, JSON-LD generation cost
- Topic × region research pages — hub computation vs approval rows
- City / series public pages
Admin / operator:
- Edition Live sponsors / exhibitors / organizers lists (large rosters)
- Company admin search / merge pickers
- Sponsor / exhibitor / Partner Alumni import matching & materialization chunks
  (performance of current runs under normal batch sizes — not import UX)
Data / platform:
- Hot queries on event_sponsors, companies, company_domains, company_sponsor_stats
- RPCs used by sponsor discovery / search
- Supabase PostgREST pagination helpers (fetchAllPaginated*, in-memory filters)
- Vercel Function duration on App Router pages and `/api/**` routes
- Caching posture (`force-dynamic`, revalidate, CDN, React cache)

STEP 0 — LOAD GOVERNING CONTEXT (before anything else)
Read and follow in full:
- docs/health/README.md              (Framework v1.1 operating rules)
- docs/health/audit-catalog.md       (ownership; Performance vs Database /
  Architecture / Scalability rows)
- docs/health/findings-register.md   (ALL prefixes — especially ARC/PERF/DB/SCALE)
- docs/health/_templates/report-template.md
- This prompt (canonical Performance domain module)
- The latest Performance report in TARGET_FOLDER, if any
Also read for hot-path context (not as other audits):
- docs/project-state.md (domain model, known limitations)
- Prior Architecture report evidence that already names performance root causes
  (reference IDs; do not re-file)
- Key loaders under src/lib/queries/, src/features/**/server/, public pages under
  src/app/(marketing)/, admin heavy lists, measure scripts under scripts/ if present
README = process authority; audit-catalog = ownership authority.

STEP 0b — DETERMINE MODE AUTOMATICALLY
Check TARGET_FOLDER for a prior Performance report:
- No prior report => BASELINE: Baseline = true; no "Since last cycle"; first PERF
  ids (PERF-001...). Skip STEP 1. Do not assume every slow-looking line must become
  a Finding. Prefer few high-value Findings; aggressively reference existing ARC/DB
  IDs for already-tracked hot paths.
- Prior report    => RECURRING: Baseline = false; reconcile PERF Findings first;
  include "Since last cycle".
Never hard-code Baseline; derive it here.

STEP 1 — RECONCILE EXISTING PERF FINDINGS (RECURRING only)
For every PERF Finding in the register, assign:
- Open | In Progress (needs link) | Deferred (needs reason) |
  Resolved (needs concrete closing link: merged PR / commit / migration / verified
  latency or cost improvement that closed the gap)
No closing link => not Resolved. Do not invent new Findings until reconciliation ends.

STEP 1b — CROSS-AUDIT OWNERSHIP CHECK
Before creating ANY new Finding:
- Confirm Performance is the PRIMARY OWNER (audit-catalog.md §3) for the topic.
- Search ALL prefixes: DEP, ARC, PROD, DQ, DB, SEC, PERF, HYG, ROAD, SCALE, SEO, UX, DOC.
- Same root cause already tracked => REFERENCE that ID; do not create a PERF duplicate.
- Only mint a new PERF Finding when the root cause is untracked and Performance owns it.
- Especially watch EventPixels overlaps already common in this repo:
  - Hot-path full-table sponsor counts / in-memory filters => often already ARC-002
  - Import matching loading entire companies/domains => often already ARC-003
  - Public `force-dynamic` / no ISR / no React cache() => often already ARC-004
  - Middleware getUser on nearly every request => often already ARC-017
  - N+1 / double-path sponsor hydration => often already ARC-018
  - Missing index as schema program => DB primary
  - “Will break at 100× catalog size” without current pain => SCALE
  - Empty/slow-feeling UI without measured load => UX or report-only
  - Wrong aggregate numbers from dirty data => DQ

STEP 2 — MAP THE PERFORMANCE LANDSCAPE FIRST
Before judging “slow”:
1. List critical user/operator journeys and their likely DB/API touchpoints
   (anonymous explorer/detail/search; admin roster; import match).
2. Identify which pages are `force-dynamic` vs cacheable; note metadata+page
   double work.
3. Inventory hot tables/RPCs by expected row volume (event_sponsors, companies,
   company_domains, stats tables).
4. Note existing accelerators (company_sponsor_stats, RPCs, pagination helpers)
   and whether hot paths actually use them.
5. Record planned scope and exclusions (surfaces not timed; no Vercel metrics
   access; local vs production; sampling limits).
6. Prefer EXPLAIN + code path citation + request observation over vibes.

STEP 2b — RUN THE PERFORMANCE DOMAIN REVIEW
Use read-only SQL diagnostics (EXPLAIN / counts), repository inspection of loaders
and pages, optional browser Network/waterfall checks on representative URLs, and
available platform metrics (Vercel / Supabase) when accessible. Cite file paths,
query shapes, and approximate magnitudes (row counts, round-trips). Do not paste
secrets or service-role keys.

Cover, where applicable:

1) Database query performance
   - Hot SELECTs that Seq Scan large tables or fetch far more rows than needed
   - Count strategies that download rows instead of using SQL COUNT / aggregates
   - Filters applied in application memory after unbounded fetches
   Distinguish “needs an index” (often DB) from “wrong query shape for this path”
   (PERF) — reference both when needed; one Finding owner only.

2) RPC / PostgREST efficiency
   - Sponsor discovery / search RPCs: latency, payload size, repeated calls
   - Chatty `.select()` patterns pulling wide rows for list UIs
   - Pagination helpers that loop until exhaustion on hot paths

3) SSR and server rendering
   - Public pages forcing dynamic SSR with live DB on every anonymous hit
   - Duplicate data loading between `generateMetadata` and page components
   - Missing request-level memoization where the same loader runs twice per request
   If already tracked as ARC-004 (or similar), REFERENCE — do not duplicate.

4) N+1 and fan-out
   - Per-item queries in loops on edition/company hydration
   - Client waterfalls that re-fetch what SSR already had
   - Batch APIs that still trigger secondary full scans

5) Index usage (runtime view)
   - EXPLAIN showing Seq Scan / high cost on representative predicates
   - Stats-table or FK-join paths that ignore existing indexes
   Propose index only with measured evidence; schema ownership remains DB when the
   fix is primarily DDL.

6) Supabase efficiency
   - Service-role or anon clients over-fetching on SSR
   - Unnecessary round-trips that could be one query/RPC
   - Large in-memory joins that belong in SQL

7) Large dataset behavior under *current* production sizes
   - Rosters / catalogs that are already large enough to hurt (e.g. thousands of
     sponsors, multi-thousand companies)
   - If pain is only hypothetical at 10–100×, hand to SCALE

8) Explorer filtering / search / calendar
   - Event explorer filter/sort/facet cost (client vs server work)
   - Month/calendar URL flows that reload or recompute excessively
   - Sponsor/company search latency and result payload size
   - Admin company pickers that load oversized candidate sets

9) Network requests
   - Waterfalls after first paint on explorers and event detail tabs
   - Redundant client refetch on navigation
   - Oversized JSON for list views

10) Vercel Function performance
    - Long SSR/API durations on common routes when metrics or timing evidence exist
    - Cold paths that dominate p95 when evidenced
    Without metrics, infer cautiously from code + EXPLAIN; state uncertainty.

11) Caching behavior
    - Absent ISR/revalidate on anonymously cacheable catalog pages
    - Derived stats unused on hot paths (forcing live recompute)
    - Cache headers / CDN bypass from dynamic rendering

12) Bundle / rendering (material only)
    - Large client bundles on explorer/search that delay interaction
    - Heavy client-only filtering of huge catalogs that should be server-scoped
    Skip pure aesthetic code-splitting without user-visible delay evidence.

Evidence expected: EXPLAIN or equivalent query shape evidence, file/symbol refs,
row-count magnitudes, round-trip counts, timings/metrics when available, and
representative URLs. Record limitations (no prod metrics, CF blocking curl, local
DB size ≠ prod).

STEP 3 — CLASSIFY WHAT YOU SEE
Route every observation into exactly one bucket:
A. FINDING — passes MEMORY-VALUE TEST: "Will we likely need to remember this in a
   future review cycle?" Severity does NOT decide inclusion; record Severity/Effort
   as descriptive metadata. Severity reflects RUNTIME IMPACT (user-visible latency,
   cost, or reliability under normal load), not how many files mention the pattern.
B. REPORT-ONLY OBSERVATION — real but no cross-cycle memory needed (micro-nit,
   already-fixed during investigation, or pure cite of an existing ARC/DB ID).
C. STRENGTH — healthy caching, tight queries, good use of stats/RPC worth noting.
D. DELIBERATE TRADE-OFF — accepted dynamic SSR or eager loads with clear product
   reason and acceptable current cost.
E. ALREADY RESOLVED — via STEP 1 only.
When in doubt, under-track (prefer report-only). Prefer referencing existing ARC
IDs over opening PERF clones.

Create a PERF Finding ONLY when ALL are true:
- Concrete runtime or hot-path evidence (not vibes)
- Meaningful cost to user/operator latency, infrastructure cost, or reliability
  under normal current load
- Recommended action is reasonably specific (change query/count strategy; add
  request cache/ISR; batch/fan-in; use stats table on path X; measure then index —
  without implementing it here)
- Root cause is primarily today’s performance (speed/waste/cache miss), not solely
  structure (ARC), schema (DB), missing product (PROD), or future scale (SCALE)
- The same root cause is NOT already tracked under another prefix

Do NOT create Findings for:
- Speculative rewrites without a measured hot path
- Aesthetic bundle splitting with no interaction delay evidence
- Future-only volume ceilings (SCALE)
- Schema redesign wishlists without a measured slow query (DB)
- RLS/policy design as the primary Finding (SEC)
- Product feature gaps (“add infinite scroll”) without latency evidence — if both
  exist, PERF for the measured load and PROD/UX for interaction design as separate
  root causes only when truly distinct
- Documentation writing quality (DOC)
- Re-stating ARC-002 / ARC-003 / ARC-004 / ARC-017 / ARC-018 (etc.) under a new
  PERF ID

STEP 4 — FINDING IDENTITY AND DE-DUPLICATION
- Reuse an existing ID (any prefix) when ROOT CAUSE matches.
- One root cause / one hot-path defect with many call-sites = ONE Finding (list
  call-sites as evidence).
- Test: "If we fixed the other Finding, would this disappear?" Yes => same Finding.
- New PERF ids = next monotonic PERF-NNN; never reuse/renumber retired ids.
- Reopen previously resolved root causes under the ORIGINAL id.
- Group closely related evidence when one remediation program applies.

For each NEW Finding draft (and later in the report), include:
- ID (or "(new)" until allocated)
- Title
- Severity (Critical|High|Medium|Low) and Effort (Small|Medium|Large)
- Status (Open|In Progress|Deferred)
- Evidence (EXPLAIN/timings/metrics; files/symbols; URLs; row counts; round-trips)
- Why it matters (latency / cost / reliability under normal load)
- Recommended action (specific performance remediation — read-only in this review)
- Scope / affected surfaces and journeys
- Validation / acceptance criteria (e.g. “edition detail sponsor count uses SQL
  COUNT or stats; p95 SSR under Ns; explorer filter avoids full catalog download”)
- Uncertainty / false-positive risk (env mismatch, missing prod metrics, CF noise)
- Links (plan/PR/commit/migration when relevant)

Severity guidance (descriptive; still not an inclusion test):
- Critical — hot path that can exhaust DB/function capacity or make core anonymous
  pages unusable under normal traffic (e.g. unbounded full-table work on every view)
- High — recurring multi-hundred-ms to multi-second delays on primary explorers,
  event detail, or search; clear wasted full scans on common admin paths
- Medium — bounded surfaces with clear fix; moderate cost; limited audience
- Low — minor waterfalls, small over-fetch, polish-level caching gaps

STEP 5 — AUDIT GATE (mandatory)
Present in chat:
1. Mode (Baseline vs Recurring) and cycle
2. Surfaces / journeys in scope and exclusions; methods used (EXPLAIN, code
   inspection, browser Network, platform metrics)
3. Draft Finding list (full fields above) — or "none"
4. Cross-audit references (existing non-PERF ids cited — especially ARC/DB/SCALE)
5. Report-only observations, strengths, trade-offs
6. Limitations and false-positive risks
7. Explicit statement: READ-ONLY so far; no report/register written; no code/index/
   cache changes applied

STOP. Do not write REPORT_FILE or edit findings-register.md until the human explicitly
asks to publish / write the report and update the register.

STEP 6 — WRITE THE IMMUTABLE MONTHLY REPORT (only after explicit request)
Create docs/health/performance/{{CYCLE}}-performance.md from
docs/health/_templates/report-template.md. Do not overwrite an existing report.
- Header: Review type = Performance Audit; Cadence = Monthly; Cycle = {{CYCLE}};
  Date = {{REVIEW_DATE}}; Reviewer = {{REVIEWER}}; Baseline = (from STEP 0b);
  Status = immutable historical record.
- Executive summary: 5–10 lines; methods briefly; net change; no invented scores.
- Include surfaces/journeys inspected and exclusions (summary and/or Observations).
- "Since last cycle" (RECURRING only): delta by ID.
- Findings: FULL write-up for NEW PERF Findings (all fields from STEP 4); existing
  Findings by ID + delta only — never restate full bodies; never rewrite old reports.
- Observations: non-Finding notes, strengths, trade-offs, limitations, cross-audit
  refs (including ARC performance-shaped IDs intentionally not duplicated).
- Change log: publication entry dated {{REVIEW_DATE}}.

STEP 7 — UPDATE THE LIVE FINDINGS REGISTER (only after explicit request)
Edit docs/health/findings-register.md for outstanding work only:
- Add new PERF Findings (Open; next ids) that passed the memory-value test.
- Update existing PERF statuses; refresh Last updated to {{CYCLE}}.
- REMOVE Resolved rows (closing link required in the report); maintain Retired IDs.
- Do not duplicate other prefixes' Findings.
- Preserve table formatting; add a Change log entry dated {{REVIEW_DATE}}.

STEP 8 — VALIDATE, THEN STOP (do NOT commit)
Non-mutating checks: report naming/path; Baseline flag correct; links; register only
Open/In Progress/Deferred; no duplicate/renumbered ids; no cross-prefix duplicates;
Resolved removed with closing links; terminology uses Performance / performance /
PERF; no published reports altered; no application code, indexes, or cache config
mutated; unrelated files untouched. Run `git diff --check` on touched docs if any,
and `git status` (read-only).

Produce a final summary:
1. Mode + cycle
2. Existing PERF Findings reconciled (id -> status)
3. New PERF Findings (id + title + why memory-value passed)
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
5. Do not treat this prompt as permission to change queries, indexes, caching, or deploy config — Findings must be evidence-based with read-only diagnostics.
6. Before opening any PERF Finding, search the register for ARC/DB/SCALE IDs covering the same hot path. EventPixels already tracks several performance-shaped Architecture Findings — reference them instead of cloning under PERF.
7. Prefer measured hot paths (EXPLAIN, timings, round-trips, row magnitudes) over micro-optimization anecdotes.
8. Keep Performance vs Scalability distinct: current pain → PERF; future ceiling only → SCALE.

## Related governance

| Document | Role |
|---|---|
| [`../README.md`](../README.md) | Framework v1.1 operating rules |
| [`../audit-catalog.md`](../audit-catalog.md) | Ownership authority (Performance vs Database / Architecture / Scalability) |
| [`../findings-register.md`](../findings-register.md) | Live work queue |
| [`../_templates/report-template.md`](../_templates/report-template.md) | Shared report template |
| [`../../project-state.md`](../../project-state.md) | Current domain model / known limitations |
| [`../architecture/2026-07-architecture.md`](../architecture/2026-07-architecture.md) | Prior performance-shaped Architecture evidence (reference, do not duplicate) |
