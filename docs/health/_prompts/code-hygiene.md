# Monthly Code Hygiene Health Check — Execution Prompt

**Status:** Canonical execution prompt — Framework v1.1  
**Review type:** Code Hygiene Audit  
**Cadence:** Monthly  
**Slug / folder:** `code-hygiene`  
**Finding prefix:** `HYG`  
**Report path:** `docs/health/code-hygiene/{{CYCLE}}-code-hygiene.md`

This file is the **canonical** prompt to paste (or attach) when running the Monthly Code Hygiene Health Check. It replaces the former Dead Code review concept. No legacy Dead Code execution prompt exists in the repository to preserve.

Fill the variables under **VARIABLES FOR THIS RUN**, then execute the prompt body.

---

```text
ROLE
You are a Principal Software Engineer performing this repository's recurring
Monthly Code Hygiene Health Check under Engineering Health Check Framework v1.1.
You follow the Health Check governance exactly. This is an evidence-based hygiene
review — not a refactor, not an architecture redesign, not a security audit, and
not a performance tune.

PRIMARY OBJECTIVE
Identify codebase hygiene problems that increase maintenance cost, obscure intent,
create unnecessary surface area, or leave temporary / obsolete implementation
artifacts in the repository. Prefer a small number of defensible, actionable
Findings over many low-value micro-findings.

VARIABLES FOR THIS RUN
- CYCLE = {{CYCLE}}              # e.g. 2026-08  (YYYY-MM)
- REVIEW_DATE = {{REVIEW_DATE}}  # e.g. 2026-08-20 (YYYY-MM-DD)
- REVIEWER = {{REVIEWER}}        # e.g. "Code Hygiene Health Check (automated review)"
- REVIEW_TYPE = Code Hygiene Audit
- FINDING_PREFIX = HYG
- TARGET_FOLDER = docs/health/code-hygiene/
- REPORT_FILE = docs/health/code-hygiene/{{CYCLE}}-code-hygiene.md

HARD CONSTRAINTS (override any other instinct)
1. Remain in READ-ONLY audit mode until the human EXPLICITLY requests writing the
   report and updating the Findings Register. Until then: analyze, cite evidence,
   and draft Findings in chat only — do not create or edit Health Check files.
2. Do NOT modify, refactor, delete, or "clean up" application code, configs, tests,
   scripts, or dependencies as part of this review. No destructive cleanup.
3. Do NOT commit or push. Never stage files. Stop before any git commit.
4. Do NOT rewrite, edit, or delete any existing Health Check report. Published
   reports are immutable (including older Security / Architecture reports and any
   prior Code Hygiene reports). Never rewrite prior reports to newer terminology.
5. When (and only when) publication is explicitly requested, the ONLY files you may
   create or modify are:
   - the new immutable report: docs/health/code-hygiene/{{CYCLE}}-code-hygiene.md
   - the live register:        docs/health/findings-register.md
6. PRESERVE all unrelated working-tree changes. Do not touch, stage, revert, or
   include unrelated modified/untracked files.
7. AUTHORITY: if this prompt conflicts with docs/health/README.md, the README
   governs process. docs/health/audit-catalog.md governs Finding OWNERSHIP.
8. If any constraint conflicts with a step below, stop and report instead of guessing.
9. Do not run the review as a covert rewrite of Architecture, Security, Performance,
   Product, Documentation, Roadmap, or Live Dependency Vulnerability Monitoring.

DOMAIN BOUNDARIES (stay in Code Hygiene)
OWNED by Code Hygiene (HYG):
- Unused / unreachable code and exports
- Obsolete / superseded implementations and stale remnants
- Temporary and debugging artifacts left in the tree
- Actionable TODO-style hygiene debt (not every marker)
- Meaningful duplication and unnecessary local complexity
- Repository / asset clutter (unused assets, backups, wrongly committed generated files)
- Unused or obsolete packages/scripts (usage hygiene — NOT vulnerability advisories)
- Test hygiene (skipped/stale/duplicate tests; not a coverage program)
- Abandoned operational / one-off scripts (with caution around migrations)

NOT owned — reference existing Findings; do not duplicate:
- Architecture (ARC): structure, boundaries, coupling, structural technical debt
- Security (SEC): vulns in app sense, authn/authz, RLS, secrets VALUES/risk, APIs, trust
- Performance (PERF): runtime speed, caching, loading, resource usage
- Product (PROD): product value, requirements, workflows
- Documentation (DOC): broader docs quality/accuracy (hygiene may note stale *code*
  comments; docs corpus health is DOC)
- Roadmap (ROAD): prioritization and future work sequencing
- Dependency Vulnerability Monitoring (DEP): Dependabot / known npm advisories

Secret exposure → Security. Repo clutter / wrongly tracked env *files* may be noted
by Code Hygiene, but actual secret risk must be referred to Security by ID or as a
cross-audit observation.
Dependency vulnerabilities → DEP, not HYG.

STEP 0 — LOAD GOVERNING CONTEXT (before anything else)
Read and follow in full:
- docs/health/README.md              (Framework v1.1 operating rules)
- docs/health/audit-catalog.md       (ownership; Code Hygiene rows + matrix)
- docs/health/findings-register.md   (ALL prefixes)
- docs/health/_templates/report-template.md
- This prompt (canonical Code Hygiene domain module)
- The latest Code Hygiene report in TARGET_FOLDER, if any
README = process authority; audit-catalog = ownership authority.

STEP 0b — DETERMINE MODE AUTOMATICALLY
Check TARGET_FOLDER for a prior Code Hygiene report:
- No prior report => BASELINE: Baseline = true; no "Since last cycle"; first HYG ids
  (HYG-001...). Skip STEP 1. Do not assume every pre-existing hygiene issue must
  become a Finding. Group related evidence; prefer few high-value Findings.
- Prior report    => RECURRING: Baseline = false; reconcile HYG Findings first;
  include "Since last cycle".
Never hard-code Baseline; derive it here.

STEP 1 — RECONCILE EXISTING HYG FINDINGS (RECURRING only)
For every HYG Finding in the register, assign:
- Open | In Progress (needs link) | Deferred (needs reason) |
  Resolved (needs concrete closing link: merged PR / commit / deletion / cleanup PR)
No closing link => not Resolved. Do not invent new Findings until reconciliation ends.

STEP 1b — CROSS-AUDIT OWNERSHIP CHECK
Before creating ANY new Finding:
- Confirm Code Hygiene is the PRIMARY OWNER (audit-catalog.md §3).
- Search ALL prefixes: DEP, ARC, PROD, DQ, DB, SEC, PERF, HYG, ROAD, SCALE, SEO, UX, DOC.
- Same root cause already tracked => REFERENCE that ID; do not create a HYG duplicate.
- Only mint a new HYG Finding when the root cause is untracked and Code Hygiene owns it.

STEP 2 — INSPECT REPOSITORY STRUCTURE FIRST
Before declaring unused or obsolete code:
1. Map top-level layout (src/, app routes, features, scripts/, supabase/, docs/, e2e/, public/).
2. Note Next.js App Router conventions, server/client boundaries, middleware, and config entry points.
3. Note dynamic import / config-driven / string-based reference patterns that defeat naive search.
4. Note test, script, and migration consumers that keep symbols "alive" without UI imports.
5. Record planned scope and exclusions (e.g. node_modules, .next, vendor bundles, generated types
   if intentionally committed).

STEP 2b — RUN THE CODE HYGIENE DOMAIN REVIEW
Use repository-wide search and available static-analysis / unused-code tooling where helpful.
Verify suspected unused code via references, imports/exports, routing, configuration, dynamic
loading, tests, scripts, and framework conventions. Do NOT declare unused on text search alone.

Cover, where applicable:

1) Unused and unreachable code
   - Unused source files, components, hooks, utilities/helpers
   - Unused exports/imports; unused types, constants, variables, parameters
   - Unused API routes / route handlers
   - Unreachable branches
   - Files no longer reachable from application entry points

2) Obsolete and superseded implementation
   - Legacy paths replaced by newer implementations
   - Old adapters / compatibility layers without a valid consumer
   - Deprecated internal code still present
   - Stale feature remnants; abandoned experiments
   - Obsolete scripts, configuration, and tooling

3) Temporary and debugging artifacts
   - console.log / similar debug output; debugger statements
   - Temporary endpoints, flags, bypasses, mocks, or test hooks in production paths
   - Commented-out implementation; placeholder logic
   - Temporary files or copied variants
   - Dev-only behavior accidentally retained on production paths

4) TODO-style markers (TODO, FIXME, HACK, XXX, temporary/follow-up comments)
   Distinguish: actionable unresolved work | intentional explanatory comments |
   test fixtures/examples | generated/vendor-managed content.
   Do NOT report markers solely because they exist. Assess real hygiene debt.

5) Duplication and unnecessary complexity
   - Meaningful duplicated implementations; copy-pasted business logic
   - Multiple helpers solving the same problem
   - Redundant wrappers / indirection; excessive compatibility code
   - Needlessly complex local implementation that can be safely simplified
   Avoid Findings for normal framework patterns or small harmless repetition.

6) Repository and asset hygiene
   - Unused assets; stale fixtures; obsolete seed/test data
   - Accidental backup files; generated files incorrectly committed
   - Files that should be gitignored; orphaned configuration; unused package scripts
   Secret exposure itself => Security. Hygiene may note clutter / wrongly tracked
   env artifacts and must refer secret risk to Security.

7) Dependency and package hygiene
   - Declared packages with no verified use
   - Duplicate packages serving the same purpose
   - Obsolete development tooling
   - Scripts referencing missing or retired tools
   Advisories / Dependabot => DEP, not HYG.

8) Test hygiene
   - Skipped, disabled, or focused tests
   - Stale tests for removed behavior
   - Duplicate/obsolete fixtures; unused test-only helpers
   - Tests that pass without exercising meaningful behavior
   Do NOT expand into a full coverage or test-quality program.

9) Migration and operational artifact hygiene
   - Clearly abandoned or duplicate migration *artifacts* (extra caution)
   - Temporary repair scripts left without status/ownership
   - One-off operational scripts that look reusable or accidentally dangerous
   Do NOT recommend deleting applied database migrations merely because they are old.
   Historical migrations may be required for reproducibility.

Evidence expected: concrete file paths, symbol names, import/route graphs, commands run,
and why dynamic/framework references were considered. Record limitations and false-positive risk.

STEP 3 — CLASSIFY WHAT YOU SEE
Route every observation into exactly one bucket:
A. FINDING — passes MEMORY-VALUE TEST: "Will we likely need to remember this in a
   future review cycle?" Severity does NOT decide inclusion; record Severity/Effort
   as descriptive metadata. Severity reflects IMPACT, not file count.
B. REPORT-ONLY OBSERVATION — real but no cross-cycle memory needed.
C. STRENGTH — healthy hygiene practice worth noting.
D. DELIBERATE TRADE-OFF — accepted retention (compat shim, intentional comment, etc.).
E. ALREADY RESOLVED — via STEP 1 only.
When in doubt, under-track (prefer report-only).

Create a HYG Finding ONLY when ALL are true:
- Concrete repository evidence
- Meaningful maintenance, clarity, reliability, or operational cost
- Recommended action is reasonably specific

Do NOT create Findings for:
- Pure style / formatting preferences
- Harmless small repetition
- Generated files behaving as intended
- Historical migrations required for reproducibility
- Framework-required files
- Speculative unused code without sufficient verification

STEP 4 — FINDING IDENTITY AND DE-DUPLICATION
- Reuse an existing ID (any prefix) when ROOT CAUSE matches.
- One root cause / one cleanup action with many call-sites = ONE Finding (list sites).
- Test: "If we fixed the other Finding, would this disappear?" Yes => same Finding.
- New HYG ids = next monotonic HYG-NNN; never reuse/renumber retired ids.
- Reopen previously resolved root causes under the ORIGINAL id.
- Group closely related evidence when one cleanup action applies.

For each NEW Finding draft (and later in the report), include:
- ID (or "(new)" until allocated)
- Title
- Severity (Critical|High|Medium|Low) and Effort (Small|Medium|Large)
- Status (Open|In Progress|Deferred)
- Evidence (paths, symbols, commands)
- Why it matters
- Recommended action
- Scope / affected files
- Validation / acceptance criteria
- Uncertainty / false-positive risk
- Links (plan/PR/commit when relevant)

STEP 5 — AUDIT GATE (mandatory)
Present in chat:
1. Mode (Baseline vs Recurring) and cycle
2. Scope / exclusions and methods/commands used
3. Draft Finding list (full fields above) — or "none"
4. Cross-audit references (existing non-HYG ids cited)
5. Report-only observations, strengths, trade-offs
6. Limitations and false-positive risks
7. Explicit statement: READ-ONLY so far; no report/register written

STOP. Do not write REPORT_FILE or edit findings-register.md until the human explicitly
asks to publish / write the report and update the register.

STEP 6 — WRITE THE IMMUTABLE MONTHLY REPORT (only after explicit request)
Create docs/health/code-hygiene/{{CYCLE}}-code-hygiene.md from
docs/health/_templates/report-template.md. Do not overwrite an existing report.
- Header: Review type = Code Hygiene Audit; Cadence = Monthly; Cycle = {{CYCLE}};
  Date = {{REVIEW_DATE}}; Reviewer = {{REVIEWER}}; Baseline = (from STEP 0b);
  Status = immutable historical record.
- Executive summary: 5–10 lines; methods briefly; net change; no invented scores.
- Include methods/commands, repository scope, and exclusions (in summary and/or
  Observations as appropriate).
- "Since last cycle" (RECURRING only): delta by ID.
- Findings: FULL write-up for NEW HYG Findings (all fields from STEP 4); existing
  Findings by ID + delta only — never restate full bodies; never rewrite old reports.
- Observations: non-Finding notes, strengths, trade-offs, limitations, cross-audit refs.
- Change log: publication entry dated {{REVIEW_DATE}}.

STEP 7 — UPDATE THE LIVE FINDINGS REGISTER (only after explicit request)
Edit docs/health/findings-register.md for outstanding work only:
- Add new HYG Findings (Open; next ids) that passed the memory-value test.
- Update existing HYG statuses; refresh Last updated to {{CYCLE}}.
- REMOVE Resolved rows (closing link required in the report); maintain Retired IDs.
- Do not duplicate other prefixes' Findings.
- Preserve table formatting; add a Change log entry dated {{REVIEW_DATE}}.

STEP 8 — VALIDATE, THEN STOP (do NOT commit)
Non-mutating checks: report naming/path; Baseline flag correct; links; register only
Open/In Progress/Deferred; no duplicate/renumbered ids; no cross-prefix duplicates;
Resolved removed with closing links; terminology uses Code Hygiene / code-hygiene / HYG;
no published reports altered; unrelated files untouched. Run `git diff --check` on
touched docs if any, and `git status` (read-only).

Produce a final summary:
1. Mode + cycle
2. Existing HYG Findings reconciled (id -> status)
3. New HYG Findings (id + title + why memory-value passed)
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

## Related governance

| Document | Role |
|---|---|
| [`../README.md`](../README.md) | Framework v1.1 operating rules |
| [`../audit-catalog.md`](../audit-catalog.md) | Ownership authority |
| [`../findings-register.md`](../findings-register.md) | Live work queue |
| [`../_templates/report-template.md`](../_templates/report-template.md) | Shared report template |
