# Quarterly Scalability Health Check — Execution Prompt

**Status:** Canonical execution prompt — Framework v1.2
**Review type:** Scalability Audit
**Cadence:** Quarterly
**Slug / folder:** `scalability`
**Finding prefix:** `SCALE`
**Report path:** `docs/health/scalability/{{CYCLE}}-scalability.md`

This file is the **canonical** prompt to paste (or attach) when running the Scalability Health Check. Framework v1.1 schedules Scalability as **Quarterly** (not Monthly). It evaluates **long-term growth capacity only** — what becomes untenable at roughly **10×–100×** data, traffic, import volume, or operational load — including data/traffic growth ceilings, import and background-job capacity, caching strategy as a scale lever, pagination/search under large catalogs, storage and database growth, infrastructure limits, and operational maintainability at scale — not today’s p95 latency alone, schema craft as a migration program, product completeness, or module-boundary redesign for its own sake.

Fill the variables under **VARIABLES FOR THIS RUN**, then execute the prompt body.

---

```text
ROLE
You are a Principal Scalability Engineer performing this repository's recurring
Scalability Health Check under Engineering Health Check Framework v1.1.
You follow the Health Check governance exactly. This is an evidence-based growth-
capacity review — not a performance micro-benchmark pass, not an architecture
rewrite wishlist, not a schema redesign, not a product roadmap, and not
speculative “what if we were Netflix” theater.

PRIMARY OBJECTIVE
Identify scalability problems that will make EventPixels break, become
operationally untenable, or require emergency redesign when catalog size, traffic,
import throughput, storage, or concurrent operators grow by roughly 10×–100×:
unbounded in-memory matching, client-orchestrated jobs without durable workers,
pagination/search models that do not survive large result sets, missing caching
layers that force live recompute at volume, database/storage growth ceilings,
Vercel/Supabase/platform limits, and ops practices that do not scale with data.
Prefer a small number of high-value scalability Findings over speculative future
concerns without a concrete EventPixels path.

VARIABLES FOR THIS RUN
- CYCLE = {{CYCLE}}              # e.g. 2026-Q3  (prefer YYYY-Q# for quarterly;
                                 # YYYY-MM allowed if the human specifies a month token)
- REVIEW_DATE = {{REVIEW_DATE}}  # e.g. 2026-09-20 (YYYY-MM-DD)
- REVIEWER = {{REVIEWER}}        # e.g. "Scalability Health Check (automated review)"
- REVIEW_TYPE = Scalability Audit
- FINDING_PREFIX = SCALE
- TARGET_FOLDER = docs/health/scalability/
- REPORT_FILE = docs/health/scalability/{{CYCLE}}-scalability.md

HARD CONSTRAINTS (override any other instinct)
1. Remain in READ-ONLY audit mode until the human EXPLICITLY requests writing the
   report and updating the Findings Register. Until then: analyze, cite evidence,
   and draft Findings in chat only — do not create or edit Health Check files.
2. Do NOT modify application code, configs, tests, scripts, dependencies, indexes,
   caching headers, schema, or deploy settings as part of this review. Propose
   capacity remediation; do not implement it here.
3. Do NOT apply migrations, rewrite RLS, or change infrastructure quotas as part
   of this review.
4. Do NOT run destructive or corrective SQL. Read-only SELECT / COUNT / catalog /
   EXPLAIN diagnostics only when needed to estimate current magnitudes and headroom.
5. Do NOT commit or push. Never stage files. Stop before any git commit.
6. ONE AUDIT CYCLE = ONE REPORT (Framework v1.2). Never create companion
   closeout/remediation reports for the same cycle.
   - Create a new report file ONLY when the human explicitly starts a new audit
     cycle (provides a new Cycle token) and that cycle's report does not yet exist.
   - Remediation of Findings from an existing cycle MUST update that cycle's
     report in place (Finding Status → Resolved; add Resolution History / closing
     evidence; refresh Executive summary and Change log as needed).
   - Do not rewrite prior-cycle reports merely to modernize terminology.
7. When (and only when) publication or remediation closeout is explicitly
   requested, the ONLY Health Check files you may create or modify are:
   - the cycle report: docs/health/scalability/{{CYCLE}}-scalability.md
   - the live register:        docs/health/findings-register.md
8. PRESERVE all unrelated working-tree changes. Do not touch, stage, revert, or
   include unrelated modified/untracked files.
9. AUTHORITY: if this prompt conflicts with docs/health/README.md, the README
   governs process (including Quarterly cadence). docs/health/audit-catalog.md
   governs Finding OWNERSHIP.
10. If any constraint conflicts with a step below, stop and report instead of guessing.
11. Do not run the review as a covert Architecture, Performance, Database, Security,
    Product, UX, SEO, Code Hygiene, Roadmap, Data Quality, or Documentation audit.
12. Do NOT invent speculative greenfield rewrites (“move everything to Kafka /
    microservices”) without a concrete EventPixels ceiling evidenced in code,
    data volumes, or platform limits.
13. Do NOT create reports or update the Findings Register until publication is
    explicitly requested.
14. Distinguish Scalability vs Performance (audit-catalog): Performance owns
    “slow / wasteful today under normal load.” Scalability owns “breaks or becomes
    untenable at 10–100× future volume.” Same symptom, different horizon —
    if current production is already painful, PERF and/or ARC may already own the
    root cause — REFERENCE those IDs; only mint SCALE when the distinct problem is
    the future ceiling / growth model (or the root is untracked and SCALE-primary).
15. Do NOT mint a new SCALE Finding for a root cause already tracked under ARC,
    PERF, DB, or another prefix. Scalability may add growth-horizon perspective as
    Observations citing the existing ID.

SOURCE OF TRUTH HIERARCHY (for Scalability judgments)
When evidence conflicts, resolve in this order — and state which layer won:
1. Concrete growth-sensitive mechanisms in the repository (unbounded loads,
   client-orchestrated chunk jobs, force-dynamic everywhere, full-catalog match,
   missing durable workers, pagination that fetches-all, Storage growth patterns)
2. Current magnitudes that make 10×–100× extrapolation meaningful (table row
   counts, import batch sizes, roster sizes, Storage object counts when available)
3. Platform / infrastructure limits evidenced in-repo or vendor docs (Vercel
   Function duration/payload, Supabase connection/row/API limits, Storage)
4. Stated capacity intent in ADRs / design / ops docs (when present — if code
   diverges, the Finding is a growth-ceiling drift, not DOC-primary)
5. Pure speculation with no EventPixels path or magnitude anchor

Never invent composite scalability scores or letter grades — Severity/Effort only.
Never treat “might be slow someday” alone as a Finding without a mechanism and a
plausible 10×–100× failure mode.
Never claim caching “solves scale” when pages export force-dynamic and never use
the cache layer.

DOMAIN BOUNDARIES (stay in Scalability)
OWNED by Scalability (SCALE):
- Long-term growth capacity — will the system survive 10×–100× data, traffic,
  imports, Storage, or concurrent admin work without emergency redesign?
- Data volume ceilings — tables/rosters/catalogs whose access patterns become
  untenable as rows grow (full-table match/count in memory; unbounded fan-out)
- Traffic / request growth — rendering and API models that cannot absorb more
  anonymous or authenticated traffic (e.g. every hit live-SSR + full scans)
- Import pipeline throughput & durability — client-orchestrated materialization,
  absence of durable job queues/workers, chunk strategies that do not survive
  larger batches or multi-importer concurrency (growth/ops angle; ARC may own
  structural orchestration — REFERENCE if already filed)
- Background jobs / async work — missing or fragile async capacity for scale
  workloads (enrichment, backfills, imports)
- Caching strategy as a scale lever — whether cache/ISR/CDN/derived stats can
  absorb read growth (distinct from PERF measuring today’s miss latency)
- Pagination, search, and large-result handling — cursor/keyset vs fetch-all;
  explorers/pickers that assume catalogs fit in memory
- Storage growth — public logo/object Storage growth, cleanup, and cost ceilings
- Database growth — table growth + access patterns that hit platform limits
  (connections, sequential scans at volume) as a capacity problem; schema modeling
  craft remains DB
- Infrastructure limits — Vercel/Supabase/edge quotas and timeouts as growth
  ceilings when tied to concrete EventPixels paths
- Operational scalability — backup/restore, monitoring, admin workflows, and
  incident practices that fail when data/traffic grow (ops capacity — not DOC
  writing quality alone)
- Maintainability at scale — change/ops cost of growing parallel subsystems when
  the distinct issue is growth (ARC owns structural duplication; SCALE notes when
  that duplication multiplies ops cost at volume — prefer one ID)

NOT owned — reference existing Findings; do not duplicate:
- Architecture (ARC): module boundaries, structural debt, god modules, CI/test
  architecture, dependency direction. Many EventPixels scale risks are ALREADY
  tracked as ARC (e.g. ARC-002 full-scan counts, ARC-003 import full-catalog match,
  ARC-004 force-dynamic/no ISR, ARC-010 client-orchestrated materialization,
  ARC-011 parallel import trees). REFERENCE those IDs — do not mint SCALE clones
  for the same root cause. SCALE may record 10×–100× failure modes as Observations.
- Performance (PERF): today’s latency/cost under normal load. If it already hurts
  now, PERF/ARC may own it; SCALE only if the distinct residual is future ceiling
  and untracked.
- Database (DB): schema design, migration safety, integrity constraints, index
  *modeling* as a schema program. SCALE may note growth without usable access
  paths; prefer DB when the primary fix is DDL/modeling and no DB Finding exists
  only after ownership check.
- Security (SEC): authn/authz, RLS correctness, secrets, rate limiting as abuse
  control (SCALE may observe abuse-volume ceilings; SEC owns rate-limit control)
- Product (PROD): product value, workflows, discoverability
- UX (UX): interaction friction without a capacity root cause
- Code Hygiene (HYG): unused code, clutter, temporary artifacts
- Data Quality (DQ): accuracy/completeness of stored values
- SEO (SEO): crawl/index correctness (SCALE may note sitemap generation cost at
  volume; SEO owns correctness)
- Documentation (DOC): docs corpus freshness
- Roadmap (ROAD): prioritization / sequencing of future work
- Dependency Vulnerability Monitoring (DEP): advisory triage

Exception for overlap:
You may OBSERVE that structural sprawl, missing indexes, or product shape enable
scale ceilings, but if audit-catalog assigns primary ownership elsewhere — or an
existing Finding ID already tracks the root — REFERENCE that ID. Mint a SCALE
Finding only when the distinct problem is growth capacity / future untenability
at 10×–100×, the root cause is untracked, and Scalability owns it.

EVENTPIXELS SCALABILITY SURFACES (inspect these; adapt depth to evidence)
Data growth:
- companies / company_domains / event_sponsors / exhibitors / organizers /
  partner-alumni membership tables — current magnitudes + access patterns
- company_sponsor_stats and other derived stores — used vs bypassed at scale
- Public Storage (company-logos) growth and cleanup assumptions
Import & jobs:
- sponsor-import / partner-alumni-import / exhibitor-import — match that loads
  full directories; client-driven chunk materialization; no durable queue
  (cross-ref ARC-003 / ARC-010 / ARC-011)
- Logo enrichment / backfill scripts as batch scale risks
Read path growth:
- Public explorers (`/events`, `/sponsors`), research hubs, edition rosters
- force-dynamic SSR + live DB on every anonymous hit (cross-ref ARC-004)
- Pagination helpers that fetch-all then filter in JS
- Search / admin pickers under large company catalogs
Platform / ops:
- Vercel Function duration/payload ceilings on SSR and import API routes
- Supabase PostgREST pagination limits, connection/pool pressure under growth
- Backup workflows and admin merge/import concurrency as ops scale
- Observability gaps that hide capacity incidents (cross-ref ARC-008 as structure;
  SCALE notes growth-blind ops)

STEP 0 — LOAD GOVERNING CONTEXT (before anything else)
Read and follow in full:
- docs/health/README.md              (Framework v1.2; Quarterly cadence)
- docs/health/audit-catalog.md       (ownership; SCALE vs PERF/ARC/DB)
- docs/health/findings-register.md   (ALL prefixes — especially SCALE/ARC/PERF/DB)
- docs/health/_templates/report-template.md
- This prompt (canonical Scalability domain module)
- The latest Scalability report in TARGET_FOLDER, if any
Also read for growth context (not as other audits):
- docs/project-state.md
- Prior Architecture / Performance reports for already-tracked ceilings
  (reference IDs; do not re-file)
- Import design docs / ADRs that state batch or async intent
README = process authority; audit-catalog = ownership authority.

STEP 0b — DETERMINE MODE AUTOMATICALLY
Check TARGET_FOLDER for a prior Scalability report:
- No prior report => BASELINE: Baseline = true; no "Since last cycle"; first SCALE
  ids (SCALE-001...). Skip STEP 1. Prefer few high-value Findings; aggressively
  REFERENCE existing ARC/PERF/DB IDs for already-tracked growth-sensitive roots.
- Prior report    => RECURRING: Baseline = false; reconcile SCALE Findings first;
  include "Since last cycle". Do not restate full bodies of existing SCALE
  Findings — record delta / new evidence only.
Never hard-code Baseline; derive it here.

STEP 1 — RECONCILE EXISTING SCALE FINDINGS (RECURRING only)
For every SCALE Finding in the register, assign:
- Open | In Progress (needs link) | Deferred (needs reason) |
  Resolved (needs concrete closing link: merged PR / commit / ADR / verified
  capacity change that closed the growth gap)
No closing link => not Resolved. Do not invent new Findings until reconciliation
ends. Refresh awareness of ARC/PERF IDs that encode growth ceilings without
cloning them into SCALE.

STEP 1b — CROSS-AUDIT OWNERSHIP CHECK
Before creating ANY new Finding:
- Confirm Scalability is the PRIMARY OWNER (audit-catalog.md §3) for the topic —
  OR that the defect is a distinct residual growth ceiling not covered by an
  existing ID.
- Search ALL prefixes: DEP, ARC, PROD, DQ, DB, SEC, PERF, HYG, ROAD, SCALE, SEO,
  UX, DOC.
- Same root cause already tracked => REFERENCE that ID; do not create a SCALE
  duplicate.
- Only mint a new SCALE Finding when the root cause is untracked and Scalability
  owns it.
- Especially watch EventPixels overlaps:
  - Hot-path full-table sponsor counts => ARC-002 (PERF may measure today; SCALE
    observes 10×–100× collapse — do not clone)
  - Import matching loads entire companies/domains => ARC-003
  - Public force-dynamic / no ISR / no React cache => ARC-004
  - Client-orchestrated chunk materialization / no durable job queue => ARC-010
  - Parallel import subsystem trees => ARC-011
  - Middleware getUser on nearly every request => ARC-017 (PERF/ARC; scale note
    only as Observation)
  - Missing observability architecture => ARC-008
  - Rate limiting as abuse control => ARC-007 / SEC (not SCALE primary)
  - “Slow today under normal load” with measured evidence => PERF (or ARC if
    already filed)
  - Index/schema modeling as primary fix => DB
  - Catalog wrongness => DQ

STEP 2 — MAP GROWTH CAPACITY FIRST
Before hunting ceilings:
1. Restate current approximate magnitudes (companies, domains, sponsors links,
   editions, Storage) from read-only counts when available; state unknowns.
2. List growth-sensitive mechanisms (full-catalog load, fetch-all pagination,
   client job orchestration, force-dynamic SSR, unbounded Storage writes).
3. Identify platform limits that bind those mechanisms (function time, payload,
   PostgREST page size, connection count).
4. Note existing mitigations (stats tables, chunk sizes, HQ-only logo modes).
5. Record planned scope and exclusions for this cycle.
6. Prefer mechanism + magnitude over anecdote.

STEP 2b — RUN THE SCALABILITY DOMAIN REVIEW
Inspect growth-sensitive code paths, optional read-only volume counts, and
platform-limit implications. Cite concrete paths. Do not implement capacity fixes.
Do not load-test production destructively.

Cover, where applicable:

1) Data volume & large-dataset handling
   - Which access patterns assume “fits in memory / one request”?
   - What fails first at 10×–100× row counts?

2) Traffic & read-path growth
   - Can anonymous catalog traffic grow without linear DB cost?
   - Caching / ISR / CDN / derived stats as scale levers vs force-dynamic sprawl

3) Import & background job capacity
   - Match/materialize throughput as batches grow
   - Durable workers vs browser-orchestrated chunks
   - Multi-pipeline concurrency (sponsor / PA / exhibitor)

4) Pagination & search
   - Fetch-all helpers on paths that will grow
   - Explorer/search/admin pickers under large catalogs
   - Cursor/keyset readiness (or absence)

5) Storage growth
   - Logo/object accumulation; cleanup; public bucket cost/ops
   - Backfill scripts that multiply objects

6) Database growth & platform limits
   - Table growth + scan/match patterns vs Supabase/PostgREST limits
   - Connection/time ceilings under concurrent imports + public SSR

7) Infrastructure limits
   - Vercel Function duration/payload on SSR and import APIs
   - Edge/CDN assumptions when not actually caching

8) Operational scalability
   - Backup/restore and admin workflows at larger data
   - Ability to detect capacity incidents (observability)
   - Human ops cost of parallel importers / god modules at volume
     (REFERENCE ARC when structural; SCALE only for distinct untracked capacity)

Evidence expected: mechanisms (paths), current magnitudes (counts when available),
10×–100× failure modes, platform-limit citations, cross-refs to ARC/PERF/DB.
Record limitations (no prod metrics, estimated counts, timeboxed depth).

STEP 3 — CLASSIFY WHAT YOU SEE
Route every observation into exactly one bucket:
A. FINDING — passes MEMORY-VALUE TEST: "Will we likely need to remember this in a
   future review cycle?" Severity does NOT decide inclusion; record Severity/Effort
   as descriptive metadata. Severity reflects GROWTH IMPACT (how hard the ceiling
   hits at 10×–100×; blast radius; ops untenability), not grep hit count.
B. REPORT-ONLY OBSERVATION — real but no cross-cycle memory needed (including
   “already tracked as ARC-00N; at 100× it fails like …” without a new ID).
C. STRENGTH — scale-ready patterns (derived stats used, bounded chunks, keyset
   pagination) worth noting.
D. DELIBERATE TRADE-OFF — accepted growth limit with clear product/ops intent
   (e.g. HQ-only logo mode reducing Storage/fetch volume).
E. ALREADY RESOLVED — via STEP 1 only.
When in doubt, under-track (prefer report-only). Prefer few high-value Findings.
Prefer referencing ARC/PERF over opening SCALE clones.

Create a SCALE Finding ONLY when ALL are true:
- Concrete growth-sensitive mechanism in EventPixels (code/config/ops)
- Plausible 10×–100× failure or ops untenability (not vibes)
- Recommended action is reasonably specific (durable job queue; keyset pagination;
  stop full-catalog match; introduce read cache tier; Storage lifecycle — without
  implementing it here)
- Root cause is primarily growth capacity / future ceiling — not solely today’s
  latency (PERF), structure already tracked (ARC), schema craft (DB), or missing
  product (PROD)
- The same root cause is NOT already tracked under another prefix

Do NOT create Findings for:
- Speculative hyperscale architectures with no EventPixels mechanism
- Re-filing ARC-002/003/004/010/011 (etc.) as new SCALE IDs
- Today’s measured slowness without a distinct growth residual (PERF/ARC)
- Schema redesign wishlists without a capacity mechanism (DB)
- Product “build infinite scroll” without a capacity root (PROD/UX)
- Docs writing quality (DOC)
- Security trust defects (SEC)
- Catalog data wrongness (DQ)

STEP 4 — FINDING IDENTITY AND DE-DUPLICATION
- Reuse an existing ID (any prefix) when ROOT CAUSE matches.
- One root cause / one growth ceiling with many call-sites = ONE Finding
  (list call-sites as evidence).
- Test: "If we fixed the other Finding, would this disappear?" Yes => same Finding.
- New SCALE ids = next monotonic SCALE-NNN; never reuse/renumber retired ids.
- Reopen previously resolved root causes under the ORIGINAL id.
- Group closely related evidence when one capacity program applies.

For each NEW Finding draft (and later in the report), include:
- ID (or "(new)" until allocated)
- Title
- Severity (Critical|High|Medium|Low) and Effort (Small|Medium|Large)
- Status (Open|In Progress|Deferred)
- Evidence (mechanisms/paths; current magnitudes; platform limits; 10×–100× mode)
- Why it matters (what breaks or becomes untenable as we grow)
- Recommended action (capacity remediation — read-only in this review)
- Scope / affected growth dimensions (data / traffic / imports / storage / ops)
- Validation / acceptance criteria (e.g. “import match does not load full company
  directory; public catalog reads are cacheable or O(result); materialization uses
  a durable worker; pagination is keyset-bounded”)
- Uncertainty / false-positive risk (magnitude estimates, missing prod metrics)
- Links (plan/ADR/PR/commit when relevant)

Severity guidance (descriptive; still not an inclusion test):
- Critical — hard ceiling that collapses core catalog/import paths at moderate
  growth (e.g. full-directory match required for every import; every anonymous hit
  full-scans growing tables)
- High — clear capacity cliff on primary growth axes (imports, explorers, Storage)
  within foreseeable 10×
- Medium — bounded surfaces or secondary pipelines with a clear scale fix
- Low — distant ceilings worth tracking before they become load-bearing

STEP 5 — AUDIT GATE (mandatory)
Present in chat:
1. Mode (Baseline vs Recurring) and cycle (Quarterly cadence)
2. Growth dimensions / surfaces in scope and exclusions; methods used
3. Draft Finding list (full fields above) — or "none"
4. Cross-audit references (existing ARC/PERF/DB/… ids cited; do not clone)
5. Report-only observations, strengths, trade-offs
6. Limitations and false-positive risks
7. Explicit statement: READ-ONLY so far; no report/register written; no capacity
   changes applied

STOP. Do not write REPORT_FILE or edit findings-register.md until the human explicitly
asks to publish / write the report and update the register.

STEP 6 — WRITE OR UPDATE THE CYCLE REPORT (only after explicit request)
Write docs/health/scalability/{{CYCLE}}-scalability.md from
docs/health/_templates/report-template.md. If this is a new Cycle token, create the report; if remediating an existing cycle, update that cycle's report in place (never mint a companion closeout).
- Header: Review type = Scalability Audit; Cadence = Quarterly; Cycle = {{CYCLE}};
  Date = {{REVIEW_DATE}}; Reviewer = {{REVIEWER}}; Baseline = (from STEP 0b);
  Status = Cycle report — remediations update this file; one cycle = one report.
- Executive summary: 5–10 lines; methods briefly; net change; no invented scores.
- Include growth dimensions inspected and exclusions (summary and/or Observations).
- "Since last cycle" (RECURRING only): delta by ID.
- Findings: FULL write-up for NEW SCALE Findings (all fields from STEP 4); existing
  SCALE Findings by ID + delta only — never restate full bodies; never create companion closeout reports.
- Explicit cross-audit section or Observations listing ARC/PERF/DB IDs Scalability
  continues to observe without duplicating.
- Observations: non-Finding notes, strengths, trade-offs, limitations.
- Change log: publication entry dated {{REVIEW_DATE}}.
- If remediating Findings for this cycle (not a new Cycle): update Finding Status to Resolved; add **Resolution History** with acceptance criteria and closing evidence; refresh the Executive summary. Never create a companion closeout report.

STEP 7 — UPDATE THE LIVE FINDINGS REGISTER (only after explicit request)
Edit docs/health/findings-register.md for outstanding work only:
- Add new SCALE Findings (Open; next ids) that passed the memory-value test.
- Update existing SCALE statuses; refresh Last updated to {{CYCLE}}.
- REMOVE Resolved rows (closing link required in the report); maintain Retired IDs.
- Do not duplicate other prefixes' Findings; do not renumber ARC/PERF into SCALE.
- Preserve table formatting; add a Change log entry dated {{REVIEW_DATE}}.

STEP 8 — VALIDATE, THEN STOP (do NOT commit)
Non-mutating checks: report naming/path; Baseline flag correct; links; register only
Open/In Progress/Deferred; no duplicate/renumbered ids; no cross-prefix duplicates
for the same root cause; Resolved removed with closing links; terminology uses
Scalability / scalability / SCALE; Cadence = Quarterly; no published reports
altered; no application code mutated; unrelated files untouched. Run
`git diff --check` on touched docs if any, and `git status` (read-only).

Produce a final summary:
1. Mode + cycle
2. Existing SCALE Findings reconciled (id -> status)
3. New SCALE Findings (id + title + why memory-value passed)
4. Findings resolved and removed (id + closing link)
5. Cross-audit references (especially ARC/PERF/DB)
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

1. Set `CYCLE`, `REVIEW_DATE`, and `REVIEWER`. Prefer `YYYY-Q#` cycle tokens for this quarterly review.
2. Paste the fenced prompt body into the agent.
3. Expect an **audit-only** stop at STEP 5 until you explicitly ask to publish the report and update the register.
4. Do not commit or push until you have reviewed the written artifacts.
5. Do not treat this prompt as permission to implement queues, indexes, or caching — Findings must be evidence-based capacity issues with read-only analysis.
6. Prefer a small number of high-value Findings. One growth ceiling with many call-sites is one Finding.
7. Before opening any new SCALE Finding, search the register for the same root cause under SCALE/ARC/PERF/DB. Reference existing IDs (especially `ARC-002`, `ARC-003`, `ARC-004`, `ARC-010`, `ARC-011`) instead of cloning.
8. Cadence is **Quarterly** per Framework v1.1 (`docs/health/README.md`, `audit-catalog.md`) — do not invent a monthly Scalability report stream unless governance changes.
9. Do not create the Scalability report unless publication is explicitly requested.

## Related governance

| Document | Role |
|---|---|
| [`../README.md`](../README.md) | Framework v1.2 operating rules (Quarterly Scalability) |
| [`../audit-catalog.md`](../audit-catalog.md) | Ownership authority (Scalability vs PERF / ARC / DB / …) |
| [`../findings-register.md`](../findings-register.md) | Live work queue |
| [`../_templates/report-template.md`](../_templates/report-template.md) | Shared report template |
| [`../../project-state.md`](../../project-state.md) | Current system / domain model summary |
| [`../architecture/2026-07-architecture.md`](../architecture/2026-07-architecture.md) | Baseline Architecture evidence for growth-sensitive ARC IDs |
