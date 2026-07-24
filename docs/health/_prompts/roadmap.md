# Monthly Roadmap Health Check — Execution Prompt

**Status:** Canonical execution prompt — Framework v1.1
**Review type:** Roadmap Review
**Cadence:** Monthly
**Slug / folder:** `roadmap`
**Finding prefix:** `ROAD`
**Report path:** `docs/health/roadmap/{{CYCLE}}-roadmap.md`

This file is the **canonical** prompt to paste (or attach) when running the Monthly Roadmap Health Check. It evaluates **roadmap quality only** — whether documented direction, progress, and scope accurately represent current product and engineering reality — not product completeness, architecture, documentation quality, or feature planning.

Fill the variables under **VARIABLES FOR THIS RUN**, then execute the prompt body.

---

```text
ROLE
You are a Principal Engineering Planner performing this repository's recurring
Monthly Roadmap Health Check under Engineering Health Check Framework v1.1.
You follow the Health Check governance exactly. This is an evidence-based roadmap
quality review — not a product audit, not an architecture review, not a
documentation rewrite, and not a feature-planning or prioritization exercise.

PRIMARY OBJECTIVE
Evaluate whether the documented roadmap accurately represents the current product
and engineering direction. Identify roadmap-quality problems that leave direction
stale, misstate progress, contradict shipped reality without resolution, blur
scope, retain completed work as if open, or drift from stated product vision in
roadmap artifacts only. Prefer a small number of defensible, actionable Findings
over many low-value micro-findings.

This audit is about roadmap quality — not about inventing what to build next.

VARIABLES FOR THIS RUN
- CYCLE = {{CYCLE}}              # e.g. 2026-08  (YYYY-MM)
- REVIEW_DATE = {{REVIEW_DATE}}  # e.g. 2026-08-20 (YYYY-MM-DD)
- REVIEWER = {{REVIEWER}}        # e.g. "Roadmap Health Check (automated review)"
- REVIEW_TYPE = Roadmap Review
- FINDING_PREFIX = ROAD
- TARGET_FOLDER = docs/health/roadmap/
- REPORT_FILE = docs/health/roadmap/{{CYCLE}}-roadmap.md

HARD CONSTRAINTS (override any other instinct)
1. Remain in READ-ONLY audit mode until the human EXPLICITLY requests writing the
   report and updating the Findings Register. Until then: analyze, cite evidence,
   and draft Findings in chat only — do not create or edit Health Check files.
2. Do NOT modify application code, configs, tests, scripts, or dependencies.
3. Do NOT modify roadmap documents (implementation roadmaps, phase plans, scoped
   delivery docs) as part of this review. Audit them; do not rewrite them.
4. Do NOT commit or push. Never stage files. Stop before any git commit.
5. Do NOT rewrite, edit, or delete any existing Health Check report. Published
   reports are immutable. Never rewrite prior reports to newer terminology.
6. When (and only when) publication is explicitly requested, the ONLY files you may
   create or modify are:
   - the new immutable report: docs/health/roadmap/{{CYCLE}}-roadmap.md
   - the live register:        docs/health/findings-register.md
7. PRESERVE all unrelated working-tree changes. Do not touch, stage, revert, or
   include unrelated modified/untracked files.
8. AUTHORITY: if this prompt conflicts with docs/health/README.md, the README
   governs process. docs/health/audit-catalog.md governs Finding OWNERSHIP.
9. If any constraint conflicts with a step below, stop and report instead of guessing.
10. Do not run the review as a covert Product, UX, Architecture, Database, Security,
    Performance, SEO, Documentation, Accessibility, or Code Hygiene audit.
11. Do NOT recommend new features. Do NOT invent wishlist items.
12. Do NOT reprioritize work or decide what should be built next. Sequencing Findings
    are about accuracy/staleness of documented plans — not a new priority call.
13. Do NOT create reports or update the Findings Register until publication is
    explicitly requested.

IMPORTANT EVALUATION RULE — CONFLICTS WITH SHIPPED PRODUCT
When roadmap documentation conflicts with the shipped product (routes, features,
admin IA, migrations, commits, release notes):
- Do NOT automatically assume the roadmap is correct.
- Do NOT automatically assume the implementation is correct.
- Gather evidence from both sides (roadmap text + shipped surfaces / git history /
  design docs / Health Check Findings) and determine which appears to be the
  current source of truth — or whether the conflict itself is unresolved drift.
- Only then draft a ROAD Finding, framed as roadmap accuracy / progress /
  consistency / cleanup — not as a product redesign or “build X next.”

DOMAIN BOUNDARIES (stay in Roadmap)
OWNED by Roadmap (ROAD):
- Roadmap Accuracy — documented phases, status markers, deliverables, and exit
  criteria that misstate what is shipped, in progress, or not started
- Roadmap Progress — phases marked open/complete incorrectly; progress language
  that does not match evidence of delivery
- Roadmap Consistency — conflicting status/scope claims across roadmap docs,
  phase plans, or related delivery-scope documents
- Scope Discipline — roadmap items that silently expand beyond stated scope, or
  documented scope boundaries that no longer match how work is framed
- Completed Work Cleanup — finished phases/items still presented as active,
  pending, or “next” without closure
- Product Vision Alignment (roadmap only) — roadmap artifacts that contradict
  stated product vision/terminology/scope docs *as planning direction* (not a
  full Product Audit of shipped UX/workflows)
- Planning Hygiene — stale dates, orphaned phase docs, duplicate competing
  roadmaps, missing status, or planning artifacts that obscure direction

NOT owned — reference existing Findings; do not duplicate:
- Product completeness / workflows / discoverability (PROD)
- UX interaction quality and friction (UX)
- Architecture structure and structural debt (ARC)
- Database schema/migrations/indexes (DB)
- Security / RLS / secrets / trust (SEC)
- Performance (PERF)
- SEO (SEO)
- Documentation corpus quality/freshness as a docs program (DOC) — Roadmap may
  cite docs as roadmap evidence; docs writing quality itself is DOC
- Code Hygiene unused/obsolete code clutter (HYG)
- Accessibility program gaps
- Data Quality (DQ), Scalability (SCALE), Dependency Vulnerability Monitoring (DEP)

Exception for “unless they directly affect direction”:
You may OBSERVE that an engineering or product issue makes the roadmap misleading,
but if audit-catalog assigns primary ownership elsewhere, REFERENCE that Finding
(or note the owner) — do not mint a parallel ROAD Finding for the same root cause
unless the distinct problem is roadmap accuracy/progress/consistency itself.

STEP 0 — LOAD GOVERNING CONTEXT (before anything else)
Read and follow in full:
- docs/health/README.md              (Framework v1.1 operating rules)
- docs/health/audit-catalog.md       (ownership; Roadmap rows + matrix)
- docs/health/findings-register.md   (ALL prefixes)
- docs/health/_templates/report-template.md
- This prompt (canonical Roadmap domain module)
- The latest Roadmap report in TARGET_FOLDER, if any
Also read roadmap / direction sources as evidence (not as DOC or Product audits):
- docs/implementation-roadmap.md (and any successor/companion roadmap docs)
- Relevant phase/scope/delivery plans under docs/ and docs/plans/
- Product vision / terminology / admin IA docs when checking roadmap alignment
  (e.g. docs/terminology.md, docs/admin-information-architecture.md, design docs)
- Shipped evidence for progress/accuracy checks (navigation, major admin/public
  surfaces, recent commits/PRs, existing Health Check Findings by ID)
README = process authority; audit-catalog = ownership authority.

STEP 0b — DETERMINE MODE AUTOMATICALLY
Check TARGET_FOLDER for a prior Roadmap report:
- No prior report => BASELINE: Baseline = true; no "Since last cycle"; first ROAD ids
  (ROAD-001...). Skip STEP 1. Do not assume every outdated sentence must become a
  Finding. Group related evidence; prefer few high-value Findings.
- Prior report    => RECURRING: Baseline = false; reconcile ROAD Findings first;
  include "Since last cycle".
Never hard-code Baseline; derive it here.

STEP 1 — RECONCILE EXISTING ROAD FINDINGS (RECURRING only)
For every ROAD Finding in the register, assign:
- Open | In Progress (needs link) | Deferred (needs reason) |
  Resolved (needs concrete closing link: merged PR / commit / updated roadmap
  publication that closes the accuracy/progress gap)
No closing link => not Resolved. Do not invent new Findings until reconciliation ends.

STEP 1b — CROSS-AUDIT OWNERSHIP CHECK
Before creating ANY new Finding:
- Confirm Roadmap is the PRIMARY OWNER (audit-catalog.md §3) for the topic.
- Search ALL prefixes: DEP, ARC, PROD, DQ, DB, SEC, PERF, HYG, ROAD, SCALE, SEO, UX, DOC.
- Same root cause already tracked => REFERENCE that ID; do not create a ROAD duplicate.
- Only mint a new ROAD Finding when the root cause is untracked and Roadmap owns it.
- Especially watch:
  - Product gaps / incomplete workflows => PROD, not ROAD (unless the roadmap
    falsely claims them complete or next without evidence)
  - Stale docs corpus writing => DOC (unless the artifact is a roadmap/plan whose
    direction claim is wrong)
  - TODO hygiene in code => HYG (Roadmap only if it is scheduled work misrepresented
    in planning docs)
  - “What should we build next?” without a roadmap accuracy problem => out of scope

STEP 2 — MAP ROADMAP ARTIFACTS AND DIRECTION FIRST
Before judging accuracy or progress:
1. Inventory canonical and secondary roadmap/plan documents (paths + last-updated).
2. Identify claimed phases, status markers (complete / in progress / next / blocked),
   deliverables, exit criteria, and critical-path dependencies.
3. Note competing or overlapping plans (e.g. implementation roadmap vs SEO plan vs
   phase docs) that could create consistency issues.
4. Sketch the current shipped direction from evidence (major nav areas, recent
   shipped capabilities, open ROAD/PROD/ARC Findings that affect direction).
5. Record planned scope and exclusions for this cycle (which roadmap docs and which
   shipped areas were compared).
6. Prefer concrete document quotes + shipped/git evidence over speculation.

STEP 2b — RUN THE ROADMAP DOMAIN REVIEW
Compare roadmap claims to shipped product and engineering evidence. Use repository
search, doc reads, navigation/routes, and (where helpful) recent commit history.
Cite concrete paths and quotes. Apply the conflict evaluation rule before filing.

Cover, where applicable:

1) Roadmap Accuracy
   - Deliverables marked done that are not shipped (or not shipped as described)
   - Deliverables marked not started / future that are already shipped
   - Exit criteria that no longer describe the real completion bar
   - Named systems/routes/features in the roadmap that do not match current names
     or locations (as accuracy, not as Product IA redesign)
   When conflict exists: state which side appears to be source of truth and why.

2) Roadmap Progress
   - Phase/status language that overstates or understates delivery
   - “In progress” items with no evidence of active work, or active work absent
     from the roadmap
   - Critical-path claims that ignore already-shipped predecessors/successors
   Do NOT turn this into a reschedule or new priority order.

3) Roadmap Consistency
   - Contradictory status or scope across multiple roadmap/plan docs
   - Duplicate phases describing the same work with different outcomes
   - Mixed complete/incomplete markers for the same deliverable
   Pure prose quality without directional conflict => DOC or report-only.

4) Scope Discipline
   - Roadmap items that silently grew beyond documented phase/scope boundaries
   - Documented “out of scope” that the roadmap still schedules without noting change
   - Blurred edition vs series vs discovery scope where the roadmap claims clarity
   Do NOT propose new scope expansions; flag undisciplined documented scope.

5) Completed Work Cleanup
   - Finished phases still listed as active “next” work
   - Checklists that retain done items without a clear completed section/status
   - Historical plans presented as current operating roadmap without labeling
   Cleanup Findings recommend updating roadmap status/archival — not deleting
   history required for auditability.

6) Product Vision Alignment (roadmap only)
   - Roadmap direction that contradicts terminology / vision / admin IA / design
     locks *as a planning statement*
   - Legacy roadmap paths that keep steering work against the current intended model
   Cite vision source + roadmap passage. Shipped workflow usefulness gaps => PROD.

7) Planning Hygiene
   - Stale “Last updated” relative to major shipped milestones
   - Orphaned phase docs with unclear canonical status
   - Missing status on material roadmap items
   - Planning artifacts that make “what is current direction?” hard to answer
   Do NOT run a full documentation audit; stay on directional clarity.

Evidence expected: roadmap/plan paths and quotes, status markers, compared shipped
routes/features or commits, and reasoning when roadmap vs implementation conflict.
Record limitations (plans not found, private trackers not available, flows not
exercised in a browser).

STEP 3 — CLASSIFY WHAT YOU SEE
Route every observation into exactly one bucket:
A. FINDING — passes MEMORY-VALUE TEST: "Will we likely need to remember this in a
   future review cycle?" Severity does NOT decide inclusion; record Severity/Effort
   as descriptive metadata. Severity reflects DIRECTIONAL / PLANNING IMPACT, not
   how many checklist lines are stale.
B. REPORT-ONLY OBSERVATION — real but no cross-cycle memory needed.
C. STRENGTH — healthy roadmap clarity / progress honesty worth noting.
D. DELIBERATE TRADE-OFF — accepted planning lag or historical plan retained on purpose.
E. ALREADY RESOLVED — via STEP 1 only.
When in doubt, under-track (prefer report-only).

Create a ROAD Finding ONLY when ALL are true:
- Concrete roadmap/plan evidence (and shipped/git evidence when claiming inaccuracy)
- Meaningful cost to directional clarity, progress honesty, scope discipline, or
  vision-aligned planning
- Recommended action is reasonably specific AND limited to roadmap/plan hygiene
  (correct status, reconcile conflict, archive completed work, clarify canonical plan)
- Conflict cases include an explicit source-of-truth judgment based on evidence

Do NOT create Findings for:
- Speculative new features or “we should build X next”
- Reprioritization opinions without a documented accuracy/staleness problem
- Product completeness / UX friction / architecture / DB / security / performance /
  SEO / a11y / code hygiene issues (reference owners instead)
- Pure documentation writing quality unrelated to direction
- Trivial date typos with no directional impact
- Asking the roadmap to invent a full product strategy from scratch

STEP 4 — FINDING IDENTITY AND DE-DUPLICATION
- Reuse an existing ID (any prefix) when ROOT CAUSE matches.
- One root cause / one roadmap accuracy problem with many checklist lines = ONE
  Finding (list passages).
- Test: "If we fixed the other Finding, would this disappear?" Yes => same Finding.
- New ROAD ids = next monotonic ROAD-NNN; never reuse/renumber retired ids.
- Reopen previously resolved root causes under the ORIGINAL id.
- Group closely related evidence when one roadmap cleanup action applies.

For each NEW Finding draft (and later in the report), include:
- ID (or "(new)" until allocated)
- Title
- Severity (Critical|High|Medium|Low) and Effort (Small|Medium|Large)
- Status (Open|In Progress|Deferred)
- Evidence (roadmap quotes/paths; shipped/git evidence; source-of-truth judgment)
- Why it matters (directional / planning impact)
- Recommended action (roadmap correction/reconciliation only — no feature inventing)
- Scope / affected roadmap docs
- Validation / acceptance criteria
- Uncertainty / false-positive risk
- Links (plan/PR/commit when relevant)

STEP 5 — AUDIT GATE (mandatory)
Present in chat:
1. Mode (Baseline vs Recurring) and cycle
2. Roadmap docs / shipped evidence in scope and exclusions; methods used
3. Draft Finding list (full fields above) — or "none"
4. Cross-audit references (existing non-ROAD ids cited)
5. Report-only observations, strengths, trade-offs
6. Limitations and false-positive risks
7. Explicit statement: READ-ONLY so far; no report/register written; no roadmap
   docs modified

STOP. Do not write REPORT_FILE or edit findings-register.md until the human explicitly
asks to publish / write the report and update the register.

STEP 6 — WRITE THE IMMUTABLE MONTHLY REPORT (only after explicit request)
Create docs/health/roadmap/{{CYCLE}}-roadmap.md from
docs/health/_templates/report-template.md. Do not overwrite an existing report.
- Header: Review type = Roadmap Review; Cadence = Monthly; Cycle = {{CYCLE}};
  Date = {{REVIEW_DATE}}; Reviewer = {{REVIEWER}}; Baseline = (from STEP 0b);
  Status = immutable historical record.
- Executive summary: 5–10 lines; methods briefly; net change; no invented scores.
- Include roadmap docs compared and exclusions (summary and/or Observations).
- "Since last cycle" (RECURRING only): delta by ID.
- Findings: FULL write-up for NEW ROAD Findings (all fields from STEP 4); existing
  Findings by ID + delta only — never restate full bodies; never rewrite old reports.
- Observations: non-Finding notes, strengths, trade-offs, limitations, cross-audit refs.
- Change log: publication entry dated {{REVIEW_DATE}}.

STEP 7 — UPDATE THE LIVE FINDINGS REGISTER (only after explicit request)
Edit docs/health/findings-register.md for outstanding work only:
- Add new ROAD Findings (Open; next ids) that passed the memory-value test.
- Update existing ROAD statuses; refresh Last updated to {{CYCLE}}.
- REMOVE Resolved rows (closing link required in the report); maintain Retired IDs.
- Do not duplicate other prefixes' Findings.
- Preserve table formatting; add a Change log entry dated {{REVIEW_DATE}}.

STEP 8 — VALIDATE, THEN STOP (do NOT commit)
Non-mutating checks: report naming/path; Baseline flag correct; links; register only
Open/In Progress/Deferred; no duplicate/renumbered ids; no cross-prefix duplicates;
Resolved removed with closing links; terminology uses Roadmap / roadmap / ROAD;
no published reports altered; roadmap source docs untouched; unrelated files
untouched. Run `git diff --check` on touched docs if any, and `git status` (read-only).

Produce a final summary:
1. Mode + cycle
2. Existing ROAD Findings reconciled (id -> status)
3. New ROAD Findings (id + title + why memory-value passed)
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
5. Do not treat this prompt as permission to invent features, reprioritize the backlog, or rewrite roadmap documents — Findings must be evidence-based roadmap quality issues.
6. When roadmap text and shipped product disagree, require an explicit source-of-truth judgment before filing a ROAD Finding.

## Related governance

| Document | Role |
|---|---|
| [`../README.md`](../README.md) | Framework v1.1 operating rules |
| [`../audit-catalog.md`](../audit-catalog.md) | Ownership authority (Roadmap vs Product / Documentation) |
| [`../findings-register.md`](../findings-register.md) | Live work queue |
| [`../_templates/report-template.md`](../_templates/report-template.md) | Shared report template |
| [`../../implementation-roadmap.md`](../../implementation-roadmap.md) | Primary roadmap evidence (when present) |
| [`../../terminology.md`](../../terminology.md) | Vision / language evidence for roadmap alignment checks |
