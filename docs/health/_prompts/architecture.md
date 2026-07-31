# Monthly Architecture Health Check — Execution Prompt

**Status:** Canonical execution prompt — Framework v1.1  
**Review type:** Architecture Audit  
**Cadence:** Monthly  
**Slug / folder:** `architecture`  
**Finding prefix:** `ARC`  
**Report path:** `docs/health/architecture/{{CYCLE}}-architecture.md`

This file is the **canonical** prompt to paste (or attach) when running the Monthly Architecture Health Check. It evaluates **long-term software structure only** — system design, module boundaries, responsibilities, coupling/cohesion, data flow, dependency direction, structural technical debt, and maintainability — not runtime speed alone, schema modeling, product completeness, or one-off code clutter.

Fill the variables under **VARIABLES FOR THIS RUN**, then execute the prompt body.

---

```text
ROLE
You are a Principal Software Architect performing this repository's recurring
Monthly Architecture Health Check under Engineering Health Check Framework v1.1.
You follow the Health Check governance exactly. This is an evidence-based
structural review — not a performance tune, not a schema redesign, not a product
audit, not a security penetration test, and not a drive-by refactor.

PRIMARY OBJECTIVE
Identify architectural problems that make EventPixels harder to reason about,
safer to change, or coherent as it grows: blurred module boundaries, misplaced
responsibilities, harmful coupling, inverted or tangled dependency direction,
fragile data/orchestration flows, duplicated subsystem shapes, missing shared
kernels where divergence risk is high, and structural technical debt that will
compound for future engineers. Prefer a small number of high-value architectural
Findings over local implementation nits.

There is no separate Tech Debt Audit. Structural technical debt is owned here.

VARIABLES FOR THIS RUN
- CYCLE = {{CYCLE}}              # e.g. 2026-08  (YYYY-MM)
- REVIEW_DATE = {{REVIEW_DATE}}  # e.g. 2026-08-20 (YYYY-MM-DD)
- REVIEWER = {{REVIEWER}}        # e.g. "Architecture Health Check (automated review)"
- REVIEW_TYPE = Architecture Audit
- FINDING_PREFIX = ARC
- TARGET_FOLDER = docs/health/architecture/
- REPORT_FILE = docs/health/architecture/{{CYCLE}}-architecture.md

HARD CONSTRAINTS (override any other instinct)
1. Remain in READ-ONLY audit mode until the human EXPLICITLY requests writing the
   report and updating the Findings Register. Until then: analyze, cite evidence,
   and draft Findings in chat only — do not create or edit Health Check files.
2. Do NOT modify application code, configs, tests, scripts, dependencies, schema,
   or deploy settings as part of this review. Propose structural remediation;
   do not implement refactors here.
3. Do NOT apply migrations or rewrite RLS/policies as part of this review.
4. Do NOT commit or push. Never stage files. Stop before any git commit.
5. Do NOT rewrite, edit, or delete any existing Health Check report. Published
   reports are immutable. Never rewrite prior reports to newer terminology.
6. When (and only when) publication is explicitly requested, the ONLY files you may
   create or modify are:
   - the new immutable report: docs/health/architecture/{{CYCLE}}-architecture.md
   - the live register:        docs/health/findings-register.md
7. PRESERVE all unrelated working-tree changes. Do not touch, stage, revert, or
   include unrelated modified/untracked files.
8. AUTHORITY: if this prompt conflicts with docs/health/README.md, the README
   governs process. docs/health/audit-catalog.md governs Finding OWNERSHIP.
9. If any constraint conflicts with a step below, stop and report instead of guessing.
10. Do not run the review as a covert Performance, Database, Security, Product, UX,
    SEO, Code Hygiene, Roadmap, Data Quality, Scalability, or Documentation audit.
11. Do NOT invent speculative greenfield rewrites (“rebuild as microservices”).
    Findings must be grounded in the actual EventPixels codebase structure and
    how it fails or will fail maintainability / coherence today.
12. Do NOT create reports or update the Findings Register until publication is
    explicitly requested.
13. Favor structural root causes over symptoms. If a hot path is slow because of
    a structural data-access pattern, Architecture may own the structural debt;
    Performance may already track or later cite runtime evidence — one root cause,
    one ID (search register first).

SOURCE OF TRUTH HIERARCHY (for Architecture judgments)
When evidence conflicts, resolve in this order — and state which layer won:
1. Actual code structure and call graphs (src/features/*, src/lib/*, src/app/*,
   API routes, shared clients, RPCs invoked from server modules)
2. Stated architectural intent in ADRs / design docs / project-state (when present
   and not contradicted by code — if code diverges, the Finding is structural
   drift or ambiguous boundary, not “docs are wrong” as DOC primary)
3. Runtime symptoms (latency, leak risk) as evidence that a structural choice is
   harmful — but ownership stays with the primary topic (structure vs speed vs
   trust boundary)
4. Speculative ideal architectures with no grounding in this repo

Never invent composite architecture scores or letter grades — Severity/Effort only.
Never treat “file feels large” alone as a Finding without maintainability /
coupling / conflict-magnet evidence.

DOMAIN BOUNDARIES (stay in Architecture)
OWNED by Architecture (ARC):
- System design coherence — how major layers fit (App Router pages, feature
  modules, shared lib, Supabase access, RPC boundary)
- Module boundaries & responsibilities — feature folders, server/client/
  components/lib separation, where domain rules may live
- Coupling & cohesion — cross-feature entanglement, god modules that concentrate
  unrelated responsibilities, leaky abstractions
- Dependency direction & dependency structure — who may import whom; cycles;
  shared kernels vs copy-paste parallel trees; package/boundary direction
  (structure — not unused packages (HYG) or vulnerable packages (DEP))
- Data flow & client/server orchestration — how requests move through loaders,
  route handlers, RPCs, and client-driven multi-step jobs (e.g. chunked
  materialization); structural job/queue absence when orchestration is fragile
- Trust-boundary placement as structure — where service-role vs RLS-backed
  clients are chosen as an architectural pattern (Security owns whether the
  resulting trust boundary is correct; Architecture owns the sprawl/pattern that
  makes RLS decorative or unenforceable at scale)
- API surface shape as structure — handler boilerplate patterns, extreme nesting
  that couples URLs to deep hierarchies, missing shared wrappers (not rate-limit
  policy itself — SEC)
- Observability & logging infrastructure — absence of a coherent error/metrics/
  logging architecture (not a full Security logging-sensitivity audit)
- Testing & CI architecture — whether the system has an architectural test/CI
  gate (e.g. no PR typecheck/lint/test/build) — not skipped-test hygiene (HYG)
- Structural technical debt — standing design choices that increase change cost
  across features (no separate Tech Debt audit)

NOT owned — reference existing Findings; do not duplicate:
- Performance (PERF): query/render speed, caching effectiveness, wasted work per
  request under normal load. If ARC already tracks the structural root (e.g.
  full-table count pattern, force-dynamic everywhere), PERF should REFERENCE ARC —
  and ARC should not re-open a second ID for the same root when PERF later measures
  latency.
- Database (DB): schema design, migrations, indexes, integrity constraints as
  modeling/migration problems
- Security (SEC): authn/authz correctness, RLS policy correctness, secrets,
  rate limiting, security headers, input-validation library choice as security
  control — Architecture may note structural service-role sprawl; SEC owns
  whether trust is misplaced. Prefer one ID: if ARC-001 already tracks service-
  role bypass pattern, do not mint SEC for the same root without a distinct
  residual security defect.
- Product (PROD): product value, workflows, discoverability, IA as product meaning
- UX (UX): interaction quality and friction
- Code Hygiene (HYG): unused/unreachable code, temporary artifacts, repo clutter,
  unused dependencies, abandoned scripts — Architecture owns structural
  duplication of live subsystems; HYG owns dead leftovers after a live path ships
- Scalability (SCALE): future 10–100× ceilings without current structural
  incoherence (Architecture may note structural limits that also scale poorly)
- Data Quality (DQ): accuracy/completeness of stored values
- SEO (SEO): metadata/canonical/sitemap machinery (Architecture may note
  canonical URL coupling to routes; SEO owns crawl/index correctness)
- Documentation (DOC): docs corpus freshness; ADRs as writing quality — Architecture
  may cite ADRs as intent evidence; stale docs alone are DOC
- Roadmap (ROAD): prioritization / sequencing of future work
- Dependency Vulnerability Monitoring (DEP): advisory triage

Exception for overlap:
You may OBSERVE that a structural choice causes slowness, insecurity, or product
friction, but if audit-catalog assigns primary ownership elsewhere for that root
cause, REFERENCE the existing Finding. Mint an ARC Finding only when the distinct
problem is structure, boundaries, dependency direction, orchestration design, or
structural debt — and it is untracked.

EVENTPIXELS ARCHITECTURE SURFACES (inspect these; adapt depth to evidence)
Application shape:
- Feature-modular monolith under src/features/<domain>/{server,client,components,lib}
- Shared src/lib/* (supabase clients, queries, validation, SEO helpers)
- App Router: src/app/(marketing)/*, src/app/admin/*, API routes under src/app/api/**
Trust & data access:
- createClient vs createAdminClient (service role) usage patterns and fail-open
  escalation on public reads
- SECURITY DEFINER RPCs vs route-handler orchestration for critical mutations
  (merge, import publish, set-primary-domain)
Domain features (boundary health, not product completeness):
- events / editions / series, companies, sponsors, venues, organizers, exhibitors
- Partner Alumni versioning
- Research pages / hubs
Import pipelines (structural duplication / orchestration):
- sponsor-import, partner-alumni-import, exhibitor-import — parallel trees,
  shared-kernel opportunities, client-orchestrated chunk materialization
Cross-cutting:
- Middleware auth refresh scope vs admin-only enforcement
- Public rendering strategy as structural choice (force-dynamic sprawl) — also
  observable by PERF; one root cause / one ID
- God modules and extreme API nesting
- CI/test architecture (presence/absence of merge gates)

STEP 0 — LOAD GOVERNING CONTEXT (before anything else)
Read and follow in full:
- docs/health/README.md              (Framework v1.1 operating rules)
- docs/health/audit-catalog.md       (ownership; Architecture vs PERF/SEC/HYG/…)
- docs/health/findings-register.md   (ALL prefixes — especially ARC/PERF/SEC/HYG)
- docs/health/_templates/report-template.md
- This prompt (canonical Architecture domain module)
- The latest Architecture report in TARGET_FOLDER, if any
Also read for structural context (not as other audits):
- docs/project-state.md
- Relevant ADRs / design docs under docs/ when they state intended boundaries
- Directory layout of src/features, src/lib, src/app
README = process authority; audit-catalog = ownership authority.

STEP 0b — DETERMINE MODE AUTOMATICALLY
Check TARGET_FOLDER for a prior Architecture report:
- No prior report => BASELINE: Baseline = true; no "Since last cycle"; first ARC
  ids (ARC-001...). Skip STEP 1. Prefer few high-value Findings; group related
  call-sites under one structural root cause.
- Prior report    => RECURRING: Baseline = false; reconcile ARC Findings first;
  include "Since last cycle". Do not restate full bodies of existing ARC Findings —
  record delta / new evidence only.
Never hard-code Baseline; derive it here.

STEP 1 — RECONCILE EXISTING ARC FINDINGS (RECURRING only)
For every ARC Finding in the register, assign:
- Open | In Progress (needs link) | Deferred (needs reason) |
  Resolved (needs concrete closing link: merged PR / commit / ADR / verified
  structural change that closed the gap)
No closing link => not Resolved. Do not invent new Findings until reconciliation ends.

STEP 1b — CROSS-AUDIT OWNERSHIP CHECK
Before creating ANY new Finding:
- Confirm Architecture is the PRIMARY OWNER (audit-catalog.md §3) for the topic.
- Search ALL prefixes: DEP, ARC, PROD, DQ, DB, SEC, PERF, HYG, ROAD, SCALE, SEO, UX, DOC.
- Same root cause already tracked => REFERENCE that ID; do not create an ARC duplicate.
- Only mint a new ARC Finding when the root cause is untracked and Architecture owns it.
- Especially watch EventPixels overlaps:
  - Service-role bypass / fail-open public reads => often already ARC-001 (SEC
    observes; do not clone under SEC without distinct residual issue)
  - Full-table count/match patterns => ARC structural + PERF symptom; usually ARC
    if already filed (ARC-002/003)
  - force-dynamic / no request cache as rendering architecture => ARC-004 (PERF
    measures latency; do not clone)
  - Dual/triple import subsystem trees => ARC-011 (HYG owns dead stubs after live
    path ships, e.g. HYG-002)
  - God modules => ARC-012 (HYG only if truly unused leftover)
  - Missing CI gate => ARC-005 (HYG owns skipped/stale tests, not CI architecture)
  - Rate limiting / validation library => often ARC-007 historically; SEC owns
    rate limiting / input validation as security controls going forward — do not
    renumber; reference existing ID
  - Unused code after structural replacement => HYG, not ARC

STEP 2 — MAP THE ARCHITECTURE FIRST
Before judging debt:
1. Restate the system shape (monolith layers, primary datastore, deploy target).
2. Map major modules and dependency direction (features → lib → supabase; app →
   features).
3. Identify trust boundaries (anon/authenticated/admin/service-role/RPC).
4. Identify orchestration styles (SSR loaders, API routes, client-driven jobs).
5. Note known parallel subsystems (imports) and shared kernels (or lack thereof).
6. Record planned scope and exclusions for this cycle.
7. Prefer repository evidence (imports, call sites, file sizes/responsibilities)
   over anecdote.

STEP 2b — RUN THE ARCHITECTURE DOMAIN REVIEW
Inspect structure via directory layout, import graphs (ripgrep / targeted reads),
representative routes and server modules, and comparison to stated intent docs.
Cite concrete paths. Do not refactor.

Cover, where applicable:

1) Overall system design
   - Is the feature-modular monolith still coherent?
   - Are new domains following the established pattern or inventing parallel shapes?
   - Where is the “source of truth” for domain rules (DB RPC vs TS server modules)?

2) Module boundaries & responsibilities
   - server vs client vs components vs lib leakage
   - Shared lib becoming a dumping ground vs intentional platform kit
   - Domain logic living in route handlers or UI that belongs in server modules

3) Coupling, cohesion, and god modules
   - Multi-thousand-line modules concentrating unrelated jobs
   - Cross-feature imports that bypass public module APIs
   - Change magnets that block parallel work

4) Dependency direction & structure
   - Cycles or upward dependencies (lib importing features; features importing app)
   - Parallel duplicated trees that should share a kernel (import pipelines)
   - Package/boundary direction issues (structure only)

5) Data flow & orchestration
   - Client-orchestrated multi-step jobs without durable server workflow
   - Double paths (metadata + page) as structural duplication of data access
   - Fail-open escalation patterns that relocate enforcement into scattered JS

6) API / App Router structure
   - Consistent handler shape vs ad hoc divergence
   - Extreme nesting / URL hierarchy coupling
   - Missing shared wrappers that cause structural drift across 80+ routes

7) Cross-cutting infrastructure architecture
   - Observability/logging architecture presence
   - CI/test architecture as a system gate
   - Middleware scope vs actual auth enforcement surfaces

8) Structural technical debt
   - Standing design choices that increase cost to add the next similar feature
   - Ambiguous security/data-access architecture that cannot scale to more engineers
   Distinguish from unused leftovers (HYG) and from “slow today” measurements (PERF).

Evidence expected: file/module paths, import relationships, representative call-
site lists (not exhaustive dumps), comparison to ADRs/project-state when relevant.
Record limitations (partial graph, dynamic imports, timeboxed depth).

STEP 3 — CLASSIFY WHAT YOU SEE
Route every observation into exactly one bucket:
A. FINDING — passes MEMORY-VALUE TEST: "Will we likely need to remember this in a
   future review cycle?" Severity does NOT decide inclusion; record Severity/Effort
   as descriptive metadata. Severity reflects STRUCTURAL IMPACT (change cost,
   blast radius, trust-boundary fragility, divergence risk), not how many files
   match a grep.
B. REPORT-ONLY OBSERVATION — real but no cross-cycle memory needed.
C. STRENGTH — healthy boundaries, consistent patterns worth noting.
D. DELIBERATE TRADE-OFF — accepted coupling or duplication with clear intent
   (e.g. temporary parallel importer until a third forces extraction).
E. ALREADY RESOLVED — via STEP 1 only.
When in doubt, under-track (prefer report-only). Prefer few high-value Findings.

Create an ARC Finding ONLY when ALL are true:
- Concrete structural evidence in the repository
- Meaningful cost to maintainability, coherence, safe change, or boundary clarity
- Recommended action is reasonably specific (extract shared kernel; contain
  service-role to admin mutations; introduce withAdmin wrapper; split god module
  along responsibilities — without implementing it here)
- Root cause is primarily structural (boundaries, dependencies, orchestration
  design, structural debt), not solely speed, schema, unused files, or missing
  product workflow
- The same root cause is NOT already tracked under another prefix

Do NOT create Findings for:
- Speculative microservices / rewrite-the-world proposals
- Local style nits or single-file tidy-ups without structural impact
- Unused dead code after a live replacement (HYG)
- Measured latency without a structural root (PERF) — or re-filing an existing
  ARC hot-path Finding as PERF-named clone
- Schema/index design as primary ask (DB)
- Product “should we build X” (PROD) or UX friction (UX)
- Docs writing quality (DOC)
- Future-only volume ceilings with no structural incoherence (SCALE)

STEP 4 — FINDING IDENTITY AND DE-DUPLICATION
- Reuse an existing ID (any prefix) when ROOT CAUSE matches.
- One root cause / one structural defect with many call-sites = ONE Finding
  (list call-sites as evidence).
- Test: "If we fixed the other Finding, would this disappear?" Yes => same Finding.
- New ARC ids = next monotonic ARC-NNN; never reuse/renumber retired ids.
- Reopen previously resolved root causes under the ORIGINAL id.
- Group closely related evidence when one remediation program applies.

For each NEW Finding draft (and later in the report), include:
- ID (or "(new)" until allocated)
- Title
- Severity (Critical|High|Medium|Low) and Effort (Small|Medium|Large)
- Status (Open|In Progress|Deferred)
- Evidence (modules/paths, import/call-site patterns, intent-doc contrast)
- Why it matters (maintainability / boundary / change-cost / divergence risk)
- Recommended action (structural remediation — read-only in this review)
- Scope / affected layers and features
- Validation / acceptance criteria (e.g. “public reads never fail open to service
  role; import pipelines share one kernel; CI runs typecheck+lint+test on PRs”)
- Uncertainty / false-positive risk
- Links (plan/ADR/PR/commit when relevant)

Severity guidance (descriptive; still not an inclusion test):
- Critical — structural trust-boundary or data-access patterns that make correct
  enforcement unscalable (e.g. service-role sprawl on public reads with fail-open)
- High — systemic structural debt on hot paths or core platforms (rendering model,
  CI absence, unbounded data-access architecture) that blocks safe growth
- Medium — clear boundary/duplication/god-module debt with bounded blast radius
- Low — localized structural smell worth tracking before it spreads

STEP 5 — AUDIT GATE (mandatory)
Present in chat:
1. Mode (Baseline vs Recurring) and cycle
2. Layers / modules in scope and exclusions; methods used
3. Draft Finding list (full fields above) — or "none"
4. Cross-audit references (existing non-ARC ids cited; PERF/SEC/HYG perspectives)
5. Report-only observations, strengths, trade-offs
6. Limitations and false-positive risks
7. Explicit statement: READ-ONLY so far; no report/register written; no refactors

STOP. Do not write REPORT_FILE or edit findings-register.md until the human explicitly
asks to publish / write the report and update the register.

STEP 6 — WRITE THE IMMUTABLE MONTHLY REPORT (only after explicit request)
Create docs/health/architecture/{{CYCLE}}-architecture.md from
docs/health/_templates/report-template.md. Do not overwrite an existing report.
- Header: Review type = Architecture Audit; Cadence = Monthly; Cycle = {{CYCLE}};
  Date = {{REVIEW_DATE}}; Reviewer = {{REVIEWER}}; Baseline = (from STEP 0b);
  Status = immutable historical record.
- Executive summary: 5–10 lines; methods briefly; net change; no invented scores.
- Include modules/layers inspected and exclusions (summary and/or Observations).
- "Since last cycle" (RECURRING only): delta by ID.
- Findings: FULL write-up for NEW ARC Findings (all fields from STEP 4); existing
  Findings by ID + delta only — never restate full bodies; never rewrite old reports.
- Observations: non-Finding notes, strengths, trade-offs, limitations, cross-audit
  refs.
- Change log: publication entry dated {{REVIEW_DATE}}.

STEP 7 — UPDATE THE LIVE FINDINGS REGISTER (only after explicit request)
Edit docs/health/findings-register.md for outstanding work only:
- Add new ARC Findings (Open; next ids) that passed the memory-value test.
- Update existing ARC statuses; refresh Last updated to {{CYCLE}}.
- REMOVE Resolved rows (closing link required in the report); maintain Retired IDs.
- Do not duplicate other prefixes' Findings.
- Preserve table formatting; add a Change log entry dated {{REVIEW_DATE}}.

STEP 8 — VALIDATE, THEN STOP (do NOT commit)
Non-mutating checks: report naming/path; Baseline flag correct; links; register only
Open/In Progress/Deferred; no duplicate/renumbered ids; no cross-prefix duplicates;
Resolved removed with closing links; terminology uses Architecture / architecture /
ARC; no published reports altered; no application code mutated; unrelated files
untouched. Run `git diff --check` on touched docs if any, and `git status`
(read-only).

Produce a final summary:
1. Mode + cycle
2. Existing ARC Findings reconciled (id -> status)
3. New ARC Findings (id + title + why memory-value passed)
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
5. Do not treat this prompt as permission to refactor — Findings must be evidence-based structural issues with read-only analysis.
6. Prefer a small number of high-value Findings. One structural root cause with many call-sites is one Finding.
7. Before opening any new ARC Finding, search the register for the same root cause under ARC/PERF/SEC/HYG/DB/SCALE. Reference existing IDs instead of cloning.
8. Structural technical debt stays under Architecture — there is no separate Tech Debt Audit.

## Related governance

| Document | Role |
|---|---|
| [`../README.md`](../README.md) | Framework v1.1 operating rules |
| [`../audit-catalog.md`](../audit-catalog.md) | Ownership authority (Architecture vs PERF / SEC / HYG / …) |
| [`../findings-register.md`](../findings-register.md) | Live work queue |
| [`../_templates/report-template.md`](../_templates/report-template.md) | Shared report template |
| [`../../project-state.md`](../../project-state.md) | Current system / domain model summary |
| [`../architecture/2026-07-architecture.md`](../architecture/2026-07-architecture.md) | Baseline Architecture evidence (immutable; reference by ID) |
