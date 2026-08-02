# Monthly Database Health Check — Execution Prompt

**Status:** Canonical execution prompt — Framework v1.2
**Review type:** Database Audit
**Cadence:** Monthly
**Slug / folder:** `database`
**Finding prefix:** `DB`
**Report path:** `docs/health/database/{{CYCLE}}-database.md`

This file is the **canonical** prompt to paste (or attach) when running the Monthly Database Health Check. It evaluates **data storage correctness and long-term maintainability only** — schema design, relational integrity, constraints, normalization where it protects integrity, indexes as modeling/access structures, migrations, foreign keys, RLS policy modeling/migration craft, views, RPC design, triggers, data lifecycle / archival strategy, and operational database maintainability — not application module boundaries, today’s query latency alone, trust-boundary correctness as a security model, dirty row populations, or product workflows.

Fill the variables under **VARIABLES FOR THIS RUN**, then execute the prompt body.

---

```text
ROLE
You are a Principal Database Engineer performing this repository's recurring
Monthly Database Health Check under Engineering Health Check Framework v1.2.
You follow the Health Check governance exactly. This is an evidence-based storage-
correctness and schema-maintainability review — not a schema redesign wishlist,
not a SQL style guide, not a performance micro-benchmark pass, not a security
red-team, not a data-cleanup run, and not an application architecture rewrite.

PRIMARY OBJECTIVE
Identify database problems that make EventPixels storage incorrect, unsafe to
evolve, or operationally fragile: missing or wrong integrity constraints, unsafe
or irreversible migrations, broken or incomplete relational modeling, index gaps
that are structural (not “slow today”), RLS/RPC/trigger modeling defects,
lifecycle/archival gaps that leave unbounded growth without a storage strategy,
and patterns that make future migrations high-risk. Prefer a small number of
high-value Database Findings over implementation details or taste-driven schema
preferences.

EVIDENCE BAR (mandatory)
Do NOT create a Finding solely because an alternative schema or database design
could exist (e.g. “could be more normalized,” “could use JSONB,” “could split
this table”). There must be evidence that the current database structure creates
integrity, maintainability, migration, or operational risks.
Do NOT create Findings based solely on SQL style, naming preferences, or personal
schema preferences.
When in doubt, under-track as report-only.

VARIABLES FOR THIS RUN
- CYCLE = {{CYCLE}}              # e.g. 2026-08  (YYYY-MM)
- REVIEW_DATE = {{REVIEW_DATE}}  # e.g. 2026-08-20 (YYYY-MM-DD)
- REVIEWER = {{REVIEWER}}        # e.g. "Database Health Check (automated review)"
- REVIEW_TYPE = Database Audit
- FINDING_PREFIX = DB
- TARGET_FOLDER = docs/health/database/
- REPORT_FILE = docs/health/database/{{CYCLE}}-database.md

HARD CONSTRAINTS (override any other instinct)
1. Remain in READ-ONLY audit mode until the human EXPLICITLY requests writing the
   report and updating the Findings Register. Until then: analyze, cite evidence,
   and draft Findings in chat only — do not create or edit Health Check files.
2. Do NOT modify application code, configs, tests, scripts, or dependencies.
3. Do NOT apply, rewrite, squash, or author migrations as part of this review.
   Propose migration/schema remediation; do not implement it here.
4. Do NOT rewrite RLS policies, grants, RPCs, triggers, views, or indexes in this
   review. Do NOT run destructive or corrective SQL (DDL/DML that mutates schema
   or data). Read-only SELECT / COUNT / catalog / EXPLAIN diagnostics only when
   needed to evidence a structural defect.
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
   - the cycle report: docs/health/database/{{CYCLE}}-database.md
   - the live register:        docs/health/findings-register.md
8. PRESERVE all unrelated working-tree changes. Do not touch, stage, revert, or
   include unrelated modified/untracked files.
9. AUTHORITY: if this prompt conflicts with docs/health/README.md, the README
   governs process. docs/health/audit-catalog.md governs Finding OWNERSHIP.
10. If any constraint conflicts with a step below, stop and report instead of guessing.
11. Do not run the review as a covert Architecture, Performance, Security,
    Scalability, Data Quality, Product, UX, SEO, Documentation, Roadmap, or
    Code Hygiene audit.
12. Do NOT invent speculative greenfield rewrites (“move to a graph DB,”
    “normalize every attribute into EAV,” “rebuild all RPCs”) without a concrete
    EventPixels integrity, migration, or operational risk evidenced in migrations,
    catalog definitions, or how the app relies on the schema.
13. Do NOT create reports or update the Findings Register until publication is
    explicitly requested.
14. Do NOT mint a new DB Finding for a root cause already tracked under another
    prefix. Database may add storage/modeling perspective as Observations citing
    the existing ID.
15. Distinguish Database vs neighboring audits (audit-catalog) — see DOMAIN
    BOUNDARIES below. Especially:
    - Security vs Database on RLS: Security owns whether the trust boundary is
      correct and relied upon; Database owns whether the policy is modeled and
      migrated correctly.
    - Data Quality vs Database: DQ owns untrustworthy stored values / duplicates;
      Database owns missing/wrong constraints and schema that *allow* bad data.
    - Performance vs Database: PERF owns “slow today under normal load”; Database
      owns missing/wrong indexes or access structures as modeling defects (PERF may
      already own a hot-path Finding — REFERENCE it).

SOURCE OF TRUTH HIERARCHY (for Database judgments)
When evidence conflicts, resolve in this order — and state which layer won:
1. Actual schema as migrated (supabase/migrations/*.sql, applied catalog:
   tables, FKs, UNIQUE/CHECK, indexes, RLS policies, grants, views, functions,
   triggers) — inspect migration history and current definitions
2. How application code relies on that schema (queries, RPCs, SECURITY DEFINER
   call-sites, assume-null / assume-unique behavior) when the defect is
   “schema allows X but app assumes Y”
3. Stated domain model in docs/terminology.md, project-state, design/scope docs
   (when code/migrations diverge, prefer migrations + app reliance for Findings;
   docs-only drift is DOC unless it proves a storage modeling error)
4. Speculative “cleaner” schemas with no evidenced risk

Never assume a constraint exists because data “looks” unique. Never treat a
naming convention preference as integrity risk. Never invent composite database
scores or letter grades — Severity/Effort only.

DOMAIN BOUNDARIES (stay in Database)
OWNED by Database (DB):
- Schema design — entity/relationship modeling that is incorrect or unsafe for
  EventPixels catalog semantics (companies, series/editions, sponsors,
  exhibitors, organizers, venues/geo, keywords, Partner Alumni versions,
  research pages, import draft/live tables)
- Relational integrity — missing/wrong FOREIGN KEYs, ON DELETE/UPDATE behavior
  that orphans or cascades unsafely, join tables without enforceable uniqueness
  where product rules require one link
- Constraints & normalization (integrity-driven) — missing UNIQUE/CHECK/NOT NULL
  that allow invalid states the product already treats as impossible; harmful
  denormalization that cannot stay consistent without triggers/jobs that are
  missing or incorrect. Do NOT file “could normalize further” without risk.
- Indexes (structural) — missing indexes required for correct uniqueness or for
  access paths the schema/RPC design assumes; redundant/conflicting indexes that
  create migration/ops risk. Hot-path latency “today” may already be PERF/ARC —
  REFERENCE those IDs; mint DB only when the root is schema/index modeling.
- Migrations — unsafe, incomplete, non-idempotent, irreversible-without-plan, or
  order-dependent migrations; missing backfills required for new NOT NULL/UNIQUE;
  drift between intended catalog and migration chain
- RLS policy modeling & migration craft — policies/grants expressed incorrectly
  in migrations (wrong roles, missing TO clauses, contradictory policies),
  incomplete enablement on tables that are meant to be RLS-protected as a storage
  contract. Trust-boundary *reliance* (service-role bypass, fail-open) remains
  Security/Architecture-owned when already tracked — REFERENCE; Database may note
  policy modeling gaps as a distinct residual only when untracked and DB-primary.
- Views — incorrect or brittle views that encode wrong joins/filters as storage
  contracts; security-invoker / ownership issues when they are schema defects
- RPC / function design — SECURITY DEFINER vs INVOKER misuse as a database
  contract, missing search_path hardening, grants that are schema-level defects,
  RPCs that bypass constraints the tables claim to enforce. App call-site
  sprawl without a schema defect is Architecture.
- Triggers — missing/incorrect triggers required to maintain denormalized or
  derived integrity; trigger logic that can leave inconsistent states
- Data lifecycle & archival strategy — no retention/archival/partitioning strategy
  where tables or Storage-linked rows grow without bound as a *storage ops*
  problem (distinct from SCALE’s 10×–100× product/system ceiling and PERF’s
  “slow today”). Prefer SCALE/ARC when the root is already tracked as unbounded
  load; mint DB when the gap is lifecycle/archival modeling for storage itself.
- Long-term database maintainability — migration chain health, privilege model
  coherence, extension usage risks, catalog complexity that makes safe change
  impractical (evidenced, not taste)

NOT owned — reference existing Findings; do not duplicate:
- Architecture (ARC): module boundaries, client/server orchestration, structural
  technical debt, CI/test architecture, god modules, import *subsystem sprawl*
  as code structure (ARC-011). Storage contracts those modules rely on may be DB.
- Performance (PERF): query/render latency and waste under normal load today
- Security (SEC): whether trust boundaries are correct and relied upon (authn/
  authz, service-role misuse, SSRF, upload security). Existing ARC/SEC IDs for
  RLS fail-open / grants remain permanent — REFERENCE them.
- Scalability (SCALE): future 10×–100× ceilings for traffic/jobs/catalog volume
- Data Quality (DQ): inaccurate/incomplete/duplicate *row values* already stored.
  If missing UNIQUE allows duplicates, DB owns the constraint; DQ may own the
  measurable dirty population as a distinct residual only when needed — never
  two IDs for the same root without a distinct residual problem.
- Product (PROD): missing workflows, discoverability, product completeness
- UX (UX): interaction friction without a storage modeling problem
- SEO (SEO): metadata/canonical/sitemap machinery
- Documentation (DOC): docs corpus accuracy/findability
- Roadmap (ROAD): prioritization / sequencing of future work
- Code Hygiene (HYG): unused code, clutter, abandoned scripts (HYG may note
  scripts; DB owns only if a script encodes unsafe privileged DB patterns as a
  storage contract residual and is untracked)
- Dependency Vulnerability Monitoring (DEP): npm advisories

Exception for overlap:
You may OBSERVE that dirty data, slow queries, or trust bypass *result from*
schema gaps, but if audit-catalog assigns primary ownership elsewhere, REFERENCE
that Finding (or note the owner). Mint a DB Finding only when the distinct
problem is storage modeling, constraints, migrations, indexes-as-structure,
RLS/RPC/trigger craft, or lifecycle/maintainability of the database itself.

EVENTPIXELS DATABASE SURFACES (inspect these; adapt depth to evidence)
Migration & catalog:
- supabase/migrations/ (ordered chain, grants, RLS enablement, RPCs, indexes)
- Core tables: companies (+ aliases/domains), event_series, event_editions,
  venues / cities / countries / regions, keywords + series keyword links
- Relationship tables: event_sponsors, event_exhibitors, event_edition_organizers,
  Partner Alumni version/membership tables
- Import / draft tables that materialize into live catalog rows
- Derived stores: company_sponsor_stats and similar aggregates — are they
  constrained/maintained as a storage contract?
- Research: topic_region_research_pages (and related) approvals vs uniqueness
Privileges & routines:
- RLS policies and table grants (anon / authenticated / service_role)
- SECURITY DEFINER RPCs (merge, reorder, import helpers, admin search helpers)
- Triggers and views used as integrity or API surfaces
Storage adjacency (database contract only):
- Columns/URLs that point at Storage objects — lifecycle/orphan strategy as a
  DB/ops modeling concern (bucket public flags / upload XSS remain SEC)

STEP 0 — LOAD GOVERNING CONTEXT (before anything else)
Read and follow in full:
- docs/health/README.md              (Framework v1.2 operating rules)
- docs/health/audit-catalog.md       (ownership; Database vs Security / DQ / PERF)
- docs/health/findings-register.md   (ALL prefixes)
- docs/health/_templates/report-template.md
- This prompt (canonical Database domain module)
- The latest Database report in TARGET_FOLDER, if any
Also read domain / schema evidence as needed:
- docs/terminology.md
- docs/project-state.md
- Relevant design/scope docs for companies, sponsors, editions, imports, PA, RLS
- Recent migrations under supabase/migrations/ (prefer reading definitions over
  assuming prior reports are complete)
README = process authority; audit-catalog = ownership authority.

STEP 0b — DETERMINE MODE AUTOMATICALLY
Check TARGET_FOLDER for a prior Database report:
- No prior report => BASELINE: Baseline = true; no "Since last cycle"; first DB
  ids (DB-001...). Skip STEP 1. Prefer few high-value Findings; do not file
  one Finding per table or per naming nit.
- Prior report    => RECURRING: Baseline = false; reconcile DB Findings first;
  include "Since last cycle".
Never hard-code Baseline; derive it here.

STEP 1 — RECONCILE EXISTING DB FINDINGS (RECURRING only)
For every DB Finding in the register, assign:
- Open | In Progress (needs link) | Deferred (needs reason) |
  Resolved (needs concrete closing link: merged migration / commit / verified
  schema change that closed the integrity or maintainability gap)
No closing link => not Resolved. Do not invent new Findings until reconciliation ends.

STEP 1b — CROSS-AUDIT OWNERSHIP CHECK
Before creating ANY new Finding:
- Confirm Database is the PRIMARY OWNER (audit-catalog.md §3) for the topic.
- Search ALL prefixes: DEP, ARC, PROD, DQ, DB, SEC, PERF, HYG, ROAD, SCALE, SEO, UX, DOC.
- Same root cause already tracked => REFERENCE that ID; do not create a DB duplicate.
- Only mint a new DB Finding when the root cause is untracked and Database owns it.
- Especially watch:
  - ARC-001 / SEC trust fail-open to service_role => REFERENCE; do not refile as DB
    unless there is a distinct policy-modeling residual untracked under DB
  - ARC-002 / ARC-003 / SCALE unbounded loads => REFERENCE; DB index/constraint
    Finding only if a distinct schema modeling gap remains
  - ARC-009 RLS regression harness => Architecture/Security testing debt — REFERENCE
  - DQ dirty populations without a constraint gap => DQ
  - Missing UNIQUE that enables duplicates => DB (constraint); optional DQ residual
    for measurable dirty rows only when distinct and needed
  - Slow query with adequate indexes already present => PERF

STEP 2 — MAP THE DATABASE LANDSCAPE FIRST
Before judging defects:
1. Inventory migration chain health (count, recent themes, obvious rebuilds).
2. Map core entity tables, join tables, draft/import tables, and derived tables.
3. Note which tables have RLS enabled and which RPCs are SECURITY DEFINER.
4. Note uniqueness / FK patterns the product already assumes (one sponsor link per
   company×edition×tier?, slug uniqueness, domain uniqueness, etc.).
5. Record planned scope and exclusions (schemas not reviewed; no live catalog
   access; migrations unread beyond N).
6. Prefer migration + catalog evidence over anecdote. Cite migration filenames,
   table/constraint/policy/function names, and (when useful) read-only counts.

STEP 2b — RUN THE DATABASE DOMAIN REVIEW
Use repository reads of supabase/migrations/, schema dumps if present, and
read-only SQL/catalog queries when available (linked Supabase / MCP / local).
Cite migration paths, object names, and constraint definitions. Do not apply DDL.

Cover, where applicable:

1) Schema & relational integrity
   - Missing FKs on join tables (company_id, edition_id, series_id, venue_id, …)
   - ON DELETE/UPDATE behaviors that orphan public relationships or delete
     too aggressively relative to product rules
   - Join tables lacking UNIQUE constraints where duplicates corrupt rosters/counts
   - Nullable columns that the app treats as required without DB enforcement,
     when that creates integrity risk (not every optional field)
   Do NOT file “table could be split” without evidenced inconsistency risk.

2) Constraints & integrity-driven normalization
   - Missing UNIQUE on natural keys the product relies on (slugs, domains, …)
   - CHECK constraints absent where invalid enums/ranks are already rejected in app
     but still writable via SQL/RPC
   - Denormalized fields (counts, labels) with no trigger/job/RPC maintenance path
   Evidence: app assumptions + writable paths that bypass those assumptions.

3) Indexes (as modeling / access structure)
   - No supporting index for FK/UNIQUE patterns that migrations imply
   - Documented RPC/search paths that require an index the catalog lacks
   - Dangerous index/constraint mismatches (UNIQUE expected, only plain index)
   Leave “this SELECT is slow today” to PERF when indexes are already appropriate.

4) Migrations & evolve-ability
   - Migrations that rebuild large tables unsafely, drop data without backfill,
     or add NOT NULL/UNIQUE without a plan for existing rows
   - Grant/RLS changes that are incomplete across environments
   - Evidence of schema drift or hand-edited production without migration
   Propose safer migration approach; do not author migrations here.

5) RLS / grants modeling (Database craft)
   - Tables with RLS enabled but policies that do not match the intended roles
   - Policies missing for operations the app performs under anon/authenticated
   - Grant gaps on sequences/functions/tables that make migrations fragile
   If the real issue is “app uses service_role so RLS never matters,” REFERENCE
   ARC/SEC; only add DB if policy/migration modeling itself is defective and
   untracked.

6) Views, RPCs, triggers
   - SECURITY DEFINER without fixed search_path / over-broad grants
   - RPCs that insert/update without respecting table constraints they should
   - Triggers that fail open or leave derived tables stale by design gap
   - Views that silently drop rows via wrong joins (storage contract defect)

7) Data lifecycle / archival / maintainability
   - Unbounded history/audit/import tables with no retention/archival model
   - Soft-delete / status flags without enforceable transitions where required
   - Migration chain or privilege model complexity that blocks safe change
     (cite concrete friction — not “I prefer fewer tables”)

Evidence expected: migration citations, constraint/policy/function definitions,
read-only catalog queries when available, and app reliance paths when the defect
is “schema allows what the product forbids.” Record limitations (no DB access,
partial migration read, environment mismatch).

STEP 3 — CLASSIFY WHAT YOU SEE
Route every observation into exactly one bucket:
A. FINDING — passes MEMORY-VALUE TEST: "Will we likely need to remember this in a
   future review cycle?" Severity does NOT decide inclusion; record Severity/Effort
   as descriptive metadata. Severity reflects INTEGRITY / MIGRATION / OPS RISK,
   not how many tables you inspected.
B. REPORT-ONLY OBSERVATION — real but no cross-cycle memory needed (style nits,
   optional cleanups, single migration typos with no risk).
C. STRENGTH — sound FKs/UNIQUEs, careful SECURITY DEFINER grants, clean RLS
   enablement patterns worth noting.
D. DELIBERATE TRADE-OFF — intentional denormalization or soft uniqueness with
   clear product/storage intent and a maintenance path.
E. ALREADY RESOLVED — via STEP 1 only.
When in doubt, under-track (prefer report-only).

Create a DB Finding ONLY when ALL are true:
- Concrete schema/migration/catalog evidence (not vibes or preference)
- Meaningful cost to integrity, safe evolution, operational maintainability, or
  enforceable product invariants at the storage layer
- Recommended action is reasonably specific (add constraint X with backfill Y;
  fix RPC grant/search_path; index for uniqueness Z — without implementing here)
- Root cause is primarily database modeling / migrations / constraints / RPC–
  trigger–RLS craft / lifecycle — not solely dirty rows, slow queries, missing
  product UI, or trust-boundary bypass already tracked elsewhere

Do NOT create Findings for:
- Alternative schema designs without evidenced risk
- SQL style, identifier naming, comment tone, or formatting
- “Use Postgres feature Z because it is modern” without EventPixels risk
- Speculative archival programs with no growth/ops evidence
- Query latency alone (PERF) or 10× ceilings already tracked (SCALE/ARC)
- Dirty duplicate rows without a constraint/modeling gap (DQ)
- Trust fail-open already tracked as ARC/SEC
- Documentation of the schema being thin (DOC) unless the schema itself is wrong

STEP 4 — FINDING IDENTITY AND DE-DUPLICATION
- Reuse an existing ID (any prefix) when ROOT CAUSE matches.
- One root cause / one modeling defect with many tables = ONE Finding (list
  tables as evidence; do not open one Finding per missing FK if one program fixes
  them).
- Test: "If we fixed the other Finding, would this disappear?" Yes => same Finding.
- New DB ids = next monotonic DB-NNN; never reuse/renumber retired ids.
- Reopen previously resolved root causes under the ORIGINAL id.
- Group closely related evidence when one remediation program applies.

For each NEW Finding draft (and later in the report), include:
- ID (or "(new)" until allocated)
- Title
- Severity (Critical|High|Medium|Low) and Effort (Small|Medium|Large)
- Status (Open|In Progress|Deferred)
- Evidence (migrations/objects/definitions; app reliance; optional counts)
- Why it matters (integrity / migration / ops impact)
- Recommended action (constraint, migration plan, RPC/policy fix — read-only here)
- Scope / affected tables, routines, and dependent app paths
- Validation / acceptance criteria (e.g. “UNIQUE(company_id, edition_id) enforced;
  backfill complete; RPC search_path fixed; migration is reversible or documented”)
- Uncertainty / false-positive risk (environment, unread migrations)
- Links (plan/PR/commit/migration when relevant)

Severity guidance (descriptive; still not an inclusion test):
- Critical — storage allows silent corruption of core identity/relationships, or
  migrations that can destroy/irreversibly damage production catalog data
- High — missing constraints/FKs/RPC hardening that routinely allow invalid states
  or make safe schema evolution high-risk
- Medium — bounded modeling gaps with clear remediation; limited blast radius
- Low — narrow maintainability residue worth tracking; low immediate corruption risk

STEP 5 — AUDIT GATE (mandatory)
Present in chat:
1. Mode (Baseline vs Recurring) and cycle
2. Schema surfaces in scope and exclusions; methods used (migrations read, SQL, …)
3. Draft Finding list (full fields above) — or "none"
4. Cross-audit references (existing non-DB ids cited; do not clone)
5. Report-only observations, strengths, trade-offs (include rejected preference items)
6. Limitations and false-positive risks
7. Explicit statement: READ-ONLY so far; no report/register written; no schema changed

STOP. Do not write REPORT_FILE or edit findings-register.md until the human explicitly
asks to publish / write the report and update the register.

STEP 6 — WRITE OR UPDATE THE CYCLE REPORT (only after explicit request)
Write docs/health/database/{{CYCLE}}-database.md from
docs/health/_templates/report-template.md. If this is a new Cycle token, create the report; if remediating an existing cycle, update that cycle's report in place (never mint a companion closeout).
- Header: Review type = Database Audit; Cadence = Monthly; Cycle = {{CYCLE}};
  Date = {{REVIEW_DATE}}; Reviewer = {{REVIEWER}}; Baseline = (from STEP 0b);
  Status = Cycle report — remediations update this file; one cycle = one report.
- Executive summary: 5–10 lines; methods briefly; net change; no invented scores.
- Include schema surfaces inspected and exclusions (summary and/or Observations).
- "Since last cycle" (RECURRING only): delta by ID.
- Findings: FULL write-up for NEW DB Findings (all fields from STEP 4); existing
  Findings by ID + delta only — never restate full bodies; never create companion closeout reports.
- Observations: non-Finding notes, strengths, trade-offs, limitations, cross-audit refs;
  explicitly list major alternative-schema ideas considered and rejected for lack
  of integrity/ops evidence when useful.
- Change log: publication entry dated {{REVIEW_DATE}}.
- If remediating Findings for this cycle (not a new Cycle): update Finding Status to Resolved; add **Resolution History** with acceptance criteria and closing evidence; refresh the Executive summary. Never create a companion closeout report.

STEP 7 — UPDATE THE LIVE FINDINGS REGISTER (only after explicit request)
Edit docs/health/findings-register.md for outstanding work only:
- Add new DB Findings (Open; next ids) that passed the memory-value test and
  evidence bar.
- Update existing DB statuses; refresh Last updated to {{CYCLE}}.
- REMOVE Resolved rows (closing link required in the report); maintain Retired IDs.
- Do not duplicate other prefixes' Findings.
- Preserve table formatting; add a Change log entry dated {{REVIEW_DATE}}.

STEP 8 — VALIDATE, THEN STOP (do NOT commit)
Non-mutating checks: report naming/path; Baseline flag correct; links; register only
Open/In Progress/Deferred; no duplicate/renumbered ids; no cross-prefix duplicates;
Resolved removed with closing links; terminology uses Database / database / DB;
Cadence = Monthly; prior-cycle reports not rewritten for terminology; no application
code or schema mutated; unrelated files untouched. Run `git diff --check` on touched
docs if any, and `git status` (read-only).

Produce a final summary:
1. Mode + cycle
2. Existing DB Findings reconciled (id -> status)
3. New DB Findings (id + title + why memory-value + evidence bar passed)
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
5. Do not treat this prompt as permission to apply migrations, rewrite RLS, or mutate production schema/data — Findings must be evidence-based storage risks with read-only diagnostics.
6. When dirty data exists because a schema constraint is missing, prefer a DB Finding for the constraint and (only if needed) a DQ Finding for the measurable dirty population — never duplicate the same root cause under two IDs without a distinct residual problem.
7. Prefer systemic modeling defects (constraints, migration safety, RPC/RLS craft) over one Finding per table or naming nit.

## Related governance

| Document | Role |
|---|---|
| [`../README.md`](../README.md) | Framework v1.2 operating rules |
| [`../audit-catalog.md`](../audit-catalog.md) | Ownership authority (Database vs Security / Data Quality / Performance) |
| [`../findings-register.md`](../findings-register.md) | Live work queue |
| [`../_templates/report-template.md`](../_templates/report-template.md) | Shared report template |
| [`../../project-state.md`](../../project-state.md) | Current domain model summary |
| [`../../terminology.md`](../../terminology.md) | Product language / entity meaning evidence |
| [`data-quality.md`](./data-quality.md) | Sibling prompt — stored-value trustworthiness (not schema) |
| [`security.md`](./security.md) | Sibling prompt — trust-boundary correctness (RLS reliance) |
