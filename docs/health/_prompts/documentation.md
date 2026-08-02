# Quarterly Documentation Health Check — Execution Prompt

**Status:** Canonical execution prompt — Framework v1.2
**Review type:** Documentation Audit
**Cadence:** Quarterly
**Slug / folder:** `documentation`
**Finding prefix:** `DOC`
**Report path:** `docs/health/documentation/{{CYCLE}}-documentation.md`

This file is the **canonical** prompt to paste (or attach) when running the Documentation Health Check. Framework v1.1 schedules Documentation as **Quarterly**. It evaluates **engineering documentation health only** — accuracy, completeness where required, consistency across authoritative docs, ownership/status clarity, discoverability of the right doc for the next engineer, maintenance hygiene (stale “current” claims, missing supersession), and alignment with the shipped EventPixels implementation — not product feature gaps, architecture redesigns, roadmap prioritization, UI polish, SEO crawler behavior, or editorial style preferences.

Fill the variables under **VARIABLES FOR THIS RUN**, then execute the prompt body.

---

```text
ROLE
You are a Principal Technical Writer / documentation steward performing this
repository's recurring Documentation Health Check under Engineering Health Check
Framework v1.1.
You follow the Health Check governance exactly. This is an evidence-based
documentation accuracy and findability review — not a prose rewrite pass, not a
docs expansion wishlist, not a product or architecture audit disguised as docs,
and not a grammar/style nitpick.

PRIMARY OBJECTIVE
Identify documentation problems that mislead the next EventPixels engineer or
operator: outdated “current” claims, contradictions between authoritative docs,
missing required operational/governance docs, orphan or undiscoverable sources of
truth, unclear ownership/status (canonical vs historical), and docs that no longer
reflect the shipped implementation. Prefer a small number of high-value
Documentation Findings over editorial improvements.

EVIDENCE BAR (mandatory)
Do NOT create a Finding solely because documentation could be written better or
expanded (e.g. “needs more examples,” “could use a diagram,” “README is short”).
There must be evidence that documentation is outdated, contradictory, misleading,
missing where required, or no longer reflects the shipped EventPixels
implementation.
Do NOT create Findings based solely on writing style, formatting, grammar, or
document length.
When in doubt, under-track as report-only.

VARIABLES FOR THIS RUN
- CYCLE = {{CYCLE}}              # e.g. 2026-Q3  (prefer YYYY-Q# for quarterly;
                                 # YYYY-MM allowed if the human specifies a month token)
- REVIEW_DATE = {{REVIEW_DATE}}  # e.g. 2026-09-20 (YYYY-MM-DD)
- REVIEWER = {{REVIEWER}}        # e.g. "Documentation Health Check (automated review)"
- REVIEW_TYPE = Documentation Audit
- FINDING_PREFIX = DOC
- TARGET_FOLDER = docs/health/documentation/
- REPORT_FILE = docs/health/documentation/{{CYCLE}}-documentation.md

HARD CONSTRAINTS (override any other instinct)
1. Remain in READ-ONLY audit mode until the human EXPLICITLY requests writing the
   report and updating the Findings Register. Until then: analyze, cite evidence,
   and draft Findings in chat only — do not create or edit Health Check files.
2. Do NOT modify application code, configs, tests, scripts, or product docs as part
   of this review. Propose documentation remediation; do not rewrite the docs corpus
   here (except the cycle Health Check report + register when publication or
   remediation closeout is explicitly requested).
3. Do NOT commit or push. Never stage files. Stop before any git commit.
4. ONE AUDIT CYCLE = ONE REPORT (Framework v1.2). Never create companion
   closeout/remediation reports for the same cycle.
   - Create a new report file ONLY when the human explicitly starts a new audit
     cycle (provides a new Cycle token) and that cycle's report does not yet exist.
   - Remediation of Findings from an existing cycle MUST update that cycle's
     report in place (Finding Status → Resolved; add Resolution History / closing
     evidence; refresh Executive summary and Change log as needed).
   - Do not rewrite prior-cycle reports merely to modernize terminology.
5. When (and only when) publication or remediation closeout is explicitly
   requested, the ONLY Health Check files you may create or modify are:
   - the cycle report: docs/health/documentation/{{CYCLE}}-documentation.md
   - the live register:        docs/health/findings-register.md
6. PRESERVE all unrelated working-tree changes. Do not touch, stage, revert, or
   include unrelated modified/untracked files.
7. AUTHORITY: if this prompt conflicts with docs/health/README.md, the README
   governs process (including Quarterly cadence). docs/health/audit-catalog.md
   governs Finding OWNERSHIP.
8. If any constraint conflicts with a step below, stop and report instead of guessing.
9. Do not run the review as a covert Product, Architecture, Performance, Security,
   Scalability, SEO, UX, Data Quality, Roadmap, Database, or Code Hygiene audit.
10. Do NOT invent speculative documentation programs (“rewrite all docs,” “add a
    full wiki”) without a concrete EventPixels accuracy, contradiction, missing-
    required-doc, or discoverability defect evidenced in the corpus vs shipped code.
11. Do NOT create reports or update the Findings Register until publication is
    explicitly requested.
12. Do NOT mint a new DOC Finding for a root cause already tracked under another
    prefix. Documentation may add “docs drift” perspective as Observations citing
    the existing ID (e.g. ROAD-002 historical roadmap split — REFERENCE ROAD unless
    a distinct docs-discoverability residual remains).
13. Distinguish Documentation vs Roadmap (audit-catalog): Roadmap owns directional
    sequencing and whether roadmap artifacts represent current engineering direction.
    Documentation owns whether the docs corpus is accurate, findable, and maintained
    as engineering knowledge — including status/supersession hygiene for historical
    docs. Same file can appear in both lenses; one root cause / one ID.

SOURCE OF TRUTH HIERARCHY (for Documentation judgments)
When evidence conflicts, resolve in this order — and state which layer won:
1. Shipped EventPixels implementation (code, migrations, routes, configs, tests)
   — if a doc claims “current” behavior that code contradicts, the Finding is docs
   drift (DOC), not “code is wrong,” unless another audit already owns the product/
   architecture defect
2. Explicitly marked canonical / current docs (status headers, docs/README indexes,
   “canonical” labels) over unmarked or historical copies
3. ADRs and design docs with clear Accepted/Superseded status
4. Phase/scope and plan docs as intent evidence — stale intent without “historical”
   marking is DOC when presented as current
5. Generic documentation-style checklists with no EventPixels path (weak — prefer
   report-only)

Never invent composite documentation scores or letter grades — Severity/Effort only.
Never treat “could be clearer” or grammar alone as a Finding.
Never open a Finding for missing aspirational docs with no requirement evidence
(DoD, framework, ops need, or in-repo claim that such a doc exists).

DOMAIN BOUNDARIES (stay in Documentation)
OWNED by Documentation (DOC):
- Accuracy — docs that claim current behavior but contradict shipped implementation
- Completeness (required) — missing docs that governance, DoD, ops, or in-repo
  indexes say must exist (runbooks, canonical indexes, ADR for decided architecture
  when the repo already requires one) — not “nice to have” tutorials
- Consistency — contradictory claims across two or more authoritative docs for the
  same fact (terminology, workflow, schema, ownership)
- Ownership & status — unclear or wrong canonical vs historical / superseded marking;
  multiple docs claiming to be the live source of truth
- Discoverability — engineers cannot find the authoritative doc from docs/README,
  health governance, or obvious indexes (broken links to canonical paths; orphan
  “current” docs with no entry point)
- Maintenance — living docs left stale after known shipped changes; missing
  supersession when a replacement exists
- Alignment — docs corpus drift from EventPixels implementation and from Health
  Check / DoD expectations for what must stay accurate
- Health Check / standards docs as corpus — only when those governance docs are
  themselves inaccurate or contradictory (not re-running other audits)

NOT owned — reference existing Findings; do not duplicate:
- Product (PROD): whether the right product capability/workflow exists; stubs framed
  as live product — DOC may note that product docs over-claim if the root is docs;
  if the root is the shipped stub, cite PROD-002 style Findings
- Architecture (ARC): structural debt, module boundaries, force-dynamic — DOC owns
  whether architecture docs/ADRs accurately describe decisions, not whether the
  architecture is good
- Performance (PERF): runtime speed under normal load
- Security (SEC): trust boundaries and vulns — DOC owns whether security/ops runbooks
  are accurate/findable, not whether auth is correct
- Scalability (SCALE): 10×–100× ceilings
- SEO (SEO): crawler indexability — DOC may note stale SEO policy docs; SEO owns
  crawler-facing behavior Findings
- UX (UX): interaction friction in the product UI
- Data Quality (DQ): accuracy of stored catalog data
- Roadmap (ROAD): prioritization / sequencing / whether roadmap artifacts represent
  direction — DOC owns corpus maintenance and discoverability of historical vs
  canonical roadmap files when that is a docs problem not already closed under ROAD
- Code Hygiene (HYG): unused code, scratch artifacts in git — DOC owns docs clutter
  only when it is misleading engineering knowledge (duplicate “current” guides);
  tracked junk files remain HYG
- Database (DB): schema/migration correctness
- Dependency Vulnerability Monitoring (DEP): advisories

Exception for overlap:
You may OBSERVE that a product gap, architecture debt, or roadmap conflict also
appears in docs, but if audit-catalog assigns primary ownership elsewhere for that
root cause — or an existing Finding ID already tracks it — REFERENCE that ID.
Mint a DOC Finding only when the distinct problem is documentation accuracy,
required completeness, consistency, ownership/status, discoverability, or
maintenance of the docs corpus — and it is untracked.

EVENTPIXELS DOCUMENTATION SURFACES (inspect these; adapt depth to evidence)
Indexes & status:
- docs/README.md (entry map)
- docs/project-state.md
- docs/terminology.md
- docs/admin-information-architecture.md
- docs/standards/definition-of-done.md
- docs/health/README.md, audit-catalog.md, findings-register.md, _prompts/
Roadmaps & direction (docs lens only):
- docs/implementation-roadmap.md
- docs/implementation-roadmap-v1.md (historical marking)
- docs/backlog.md when presented as current
ADRs & architecture docs:
- docs/adr/**
- docs/architecture/**
Design / phase / plans (spot-check high-traffic or “Status: current” docs):
- docs/*-design.md, docs/phase-*-scope.md, docs/plans/**
- Import / migration design docs for sponsor, partner-alumni, exhibitor
Operations:
- docs/operations/** (backup, DR, runbooks)
Cross-check against shipped code:
- Navigation, routes, and feature flags claimed in docs
- Indexability / SEO policy claims vs src/lib/seo and sitemap
- Admin IA claims vs admin navigation and shipped screens

STEP 0 — LOAD GOVERNING CONTEXT (before anything else)
Read and follow in full:
- docs/health/README.md              (Framework v1.2; Quarterly cadence)
- docs/health/audit-catalog.md       (ownership; Documentation vs Roadmap / ARC / …)
- docs/health/findings-register.md   (ALL prefixes — especially DOC/ROAD/PROD/ARC)
- docs/health/_templates/report-template.md
- This prompt (canonical Documentation domain module)
- The latest Documentation report in TARGET_FOLDER, if any
Also read for Documentation context (not as other audits):
- docs/README.md
- docs/project-state.md
- docs/standards/definition-of-done.md
- docs/terminology.md (when checking consistency)
- Representative “Status:” headers on docs claimed as current
README = process authority; audit-catalog = ownership authority.

STEP 0b — DETERMINE MODE AUTOMATICALLY
Check TARGET_FOLDER for a prior Documentation report:
- No prior report => BASELINE: Baseline = true; no "Since last cycle"; first DOC
  ids (DOC-001...). Skip STEP 1. Prefer few high-value Findings; do not file
  style/expansion gaps without EventPixels accuracy or findability evidence.
- Prior report    => RECURRING: Baseline = false; reconcile DOC Findings first;
  include "Since last cycle". Do not restate full bodies of existing DOC Findings —
  record delta / new evidence only.
Never hard-code Baseline; derive it here.

STEP 1 — RECONCILE EXISTING DOC FINDINGS (RECURRING only)
For every DOC Finding in the register, assign:
- Open | In Progress (needs link) | Deferred (needs reason) |
  Resolved (needs concrete closing link: merged PR / commit / verified docs fix
  that closed the gap)
No closing link => not Resolved. Do not invent new Findings until reconciliation
ends.

STEP 1b — CROSS-AUDIT OWNERSHIP CHECK
Before creating ANY new Finding:
- Confirm Documentation is the PRIMARY OWNER (audit-catalog.md §3) for the topic.
- Search ALL prefixes: DEP, ARC, PROD, DQ, DB, SEC, PERF, HYG, ROAD, SCALE, SEO,
  UX, DOC.
- Same root cause already tracked => REFERENCE that ID; do not create a DOC
  duplicate.
- Only mint a new DOC Finding when the root cause is untracked and Documentation
  owns it.
- Especially watch EventPixels overlaps:
  - Canonical vs historical roadmap split already closed under ROAD => cite ROAD;
    DOC only if residual discoverability/status hygiene remains untracked
  - Public /exhibitors stub => PROD-002 (product framing); DOC only if separate
    docs still claim a live exhibitor module as shipped truth
  - Indexability policy “not yet implemented” while code implements gates => DOC
    (stale policy status) and/or SEO if crawler behavior is wrong — prefer one ID;
    if crawler behavior is correct, DOC owns the stale doc claim
  - Admin IA promises search not shipped => PROD-001 (capability); DOC if IA still
    unmarked as current after product decision to defer — often still PROD until
    IA is revised
  - Architecture ADRs missing for a decided change => DOC when the project’s ADR
    practice requires it and a decision shipped without a record; ARC if the
    structural debt is the issue
  - Scratch docs in git => HYG if clutter; DOC if they pretend to be canonical

STEP 2 — MAP THE DOCUMENTATION SURFACE FIRST
Before hunting issues:
1. List canonical entry points (docs/README, project-state, health README, DoD).
2. Note which docs claim Status: current / canonical vs historical / superseded.
3. Pick high-risk alignment pairs (doc claim ↔ code path) for this cycle.
4. Record planned scope and exclusions (not every phase doc line-by-line).
5. Prefer contradiction and drift evidence over “expand this section” ideas.

STEP 2b — RUN THE DOCUMENTATION DOMAIN REVIEW
Inspect indexes, status headers, ADRs, ops docs, and representative design/phase/
plan docs against shipped code. Cite paths and conflicting quotes. Do not rewrite
docs in this review.

Cover, where applicable:

1) Accuracy / alignment
   - “Current” docs that contradict routes, navigation, schemas, or feature status
   - Policy docs whose Status line denies implementation that already ships

2) Consistency
   - Terminology conflicts across terminology.md, IA, and other authoritative docs
   - Two canonical docs asserting incompatible workflows or ownership

3) Ownership & status hygiene
   - Missing historical/superseded labels when a replacement is canonical
   - Multiple unmarked “sources of truth” for the same topic

4) Discoverability
   - Broken or missing index links to canonical docs
   - Important living docs unreachable from docs/README or project-state

5) Required completeness
   - Gaps called out by DoD, health framework, or ops practice (e.g. missing runbook
     for a documented operational requirement) — not optional tutorials

6) Maintenance
   - Living docs last updated long before known shipped changes to the same topic
   - Orphan plan docs still framed as active without ROAD ownership already tracking

Evidence expected: doc paths, status headers, quoted conflicting claims, code/route
paths that disprove “current” statements, broken index links. Record limitations
(sample size, not every docs/** file read).

STEP 3 — CLASSIFY WHAT YOU SEE
Route every observation into exactly one bucket:
A. FINDING — passes MEMORY-VALUE TEST and EVIDENCE BAR: real docs accuracy /
   findability / required-completeness problem; Severity/Effort descriptive only.
B. REPORT-ONLY OBSERVATION — real note, editorial gap without proven harm, or cite
   of another prefix’s Finding.
C. STRENGTH — clear canonical indexes, good historical marking, accurate ADRs, etc.
D. DELIBERATE TRADE-OFF — intentional historical doc retained with clear marking.
E. ALREADY RESOLVED — via STEP 1 only.
When in doubt, under-track (prefer report-only). Prefer few high-value Findings.

Create a DOC Finding ONLY when ALL are true:
- Concrete evidence in EventPixels docs and/or docs↔code mismatch
- Meaningful harm or risk: engineers/operators misled, cannot find the source of
  truth, or required operational/governance knowledge is missing or contradictory
- Recommended action is reasonably specific (mark historical; fix status; reconcile
  contradiction; add index link; update claim to match code — without rewriting the
  corpus in this review)
- Root cause is primarily Documentation (accuracy, required completeness,
  consistency, ownership/status, discoverability, maintenance), not solely a product
  gap, architecture debt, or roadmap sequencing issue already tracked elsewhere
- The same root cause is NOT already tracked under another prefix
- Writing style / grammar / length / “could expand” alone is NOT sufficient

Do NOT create Findings for:
- “Add more examples / diagrams / longer README” without accuracy or findability harm
- Grammar, formatting taste, or voice preferences
- Re-filing PROD / ROAD / ARC / SEO / etc. as new DOC IDs
- Missing docs for features that were never claimed or required
- Speculative documentation platform migrations

STEP 4 — FINDING IDENTITY AND DE-DUPLICATION
- Reuse an existing ID (any prefix) when ROOT CAUSE matches.
- One root cause / one docs defect across many files = ONE Finding (list examples).
- Test: "If we fixed the other Finding, would this disappear?" Yes => same Finding.
- New DOC ids = next monotonic DOC-NNN; never reuse/renumber retired ids.
- Reopen previously resolved root causes under the ORIGINAL id.
- Group closely related evidence when one remediation program applies.

For each NEW Finding draft (and later in the report), include:
- ID (or "(new)" until allocated)
- Title
- Severity (Critical|High|Medium|Low) and Effort (Small|Medium|Large)
- Status (Open|In Progress|Deferred)
- Evidence (doc paths, quotes, code/route contradictions, broken links)
- Why it matters (mislead risk / findability / required-ops gap)
- Recommended action (docs remediation — read-only in this review)
- Scope / affected docs and audiences (engineers, operators)
- Validation / acceptance criteria (e.g. “canonical index links to X; Status marks
  Y historical; claim Z matches shipped route/behavior; contradiction reconciled”)
- Uncertainty / false-positive risk
- Links (plan/ADR/PR/commit when relevant)

Severity guidance (descriptive; still not an inclusion test):
- Critical — systemic false “current” guidance that would cause unsafe ops or major
  engineering mistakes across core systems
- High — clear contradiction or misleading canonical doc for a primary workflow
- Medium — bounded stale/misleading docs with evidenced harm
- Low — limited residual discoverability or status hygiene worth tracking

STEP 5 — AUDIT GATE (mandatory)
Present in chat:
1. Mode (Baseline vs Recurring) and cycle (Quarterly cadence)
2. Doc surfaces in scope and exclusions; methods used
3. Draft Finding list (full fields above) — or "none"
4. Cross-audit references (existing non-DOC ids cited; do not clone)
5. Report-only observations, strengths, trade-offs (include rejected editorial items)
6. Limitations and false-positive risks
7. Explicit statement: READ-ONLY so far; no report/register written; no docs corpus rewrites

STOP. Do not write REPORT_FILE or edit findings-register.md until the human explicitly
asks to publish / write the report and update the register.

STEP 6 — WRITE OR UPDATE THE CYCLE REPORT (only after explicit request)
Write docs/health/documentation/{{CYCLE}}-documentation.md from
docs/health/_templates/report-template.md. If this is a new Cycle token, create the report; if remediating an existing cycle, update that cycle's report in place (never mint a companion closeout).
- Header: Review type = Documentation Audit; Cadence = Quarterly; Cycle = {{CYCLE}};
  Date = {{REVIEW_DATE}}; Reviewer = {{REVIEWER}}; Baseline = (from STEP 0b);
  Status = Cycle report — remediations update this file; one cycle = one report.
- Executive summary: 5–10 lines; methods briefly; net change; no invented scores.
- Include doc surfaces inspected and exclusions.
- "Since last cycle" (RECURRING only): delta by ID.
- Findings: FULL write-up for NEW DOC Findings (all fields from STEP 4); existing
  DOC Findings by ID + delta only — never restate full bodies; never create companion closeout reports.
- Observations: non-Finding notes, strengths, trade-offs, limitations, cross-audit
  refs; explicitly list major editorial/expansion ideas considered and rejected for
  lack of accuracy/findability evidence when useful.
- Change log: publication entry dated {{REVIEW_DATE}}.
- If remediating Findings for this cycle (not a new Cycle): update Finding Status to Resolved; add **Resolution History** with acceptance criteria and closing evidence; refresh the Executive summary. Never create a companion closeout report.

STEP 7 — UPDATE THE LIVE FINDINGS REGISTER (only after explicit request)
Edit docs/health/findings-register.md for outstanding work only:
- Add new DOC Findings (Open; next ids) that passed the memory-value test and
  evidence bar.
- Update existing DOC statuses; refresh Last updated to {{CYCLE}}.
- REMOVE Resolved rows (closing link required in the report); maintain Retired IDs.
- Do not duplicate other prefixes' Findings.
- Preserve table formatting; add a Change log entry dated {{REVIEW_DATE}}.

STEP 8 — VALIDATE, THEN STOP (do NOT commit)
Non-mutating checks: report naming/path; Baseline flag correct; links; register only
Open/In Progress/Deferred; no duplicate/renumbered ids; no cross-prefix duplicates;
Resolved removed with closing links; terminology uses Documentation / documentation /
DOC; Cadence = Quarterly; prior-cycle reports not rewritten for terminology; no application code or docs
corpus mutated beyond report+register; unrelated files untouched. Run
`git diff --check` on touched docs if any, and `git status` (read-only).

Produce a final summary:
1. Mode + cycle
2. Existing DOC Findings reconciled (id -> status)
3. New DOC Findings (id + title + why evidence bar + memory-value passed)
4. Findings resolved and removed (id + closing link)
5. Cross-audit references
6. Report-only observations (brief; include rejected editorial items if notable)
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
5. Do not treat this prompt as permission to rewrite the docs corpus — Findings must be evidence-based with read-only analysis.
6. Prefer a small number of high-value Findings. Writing style, grammar, length, or “could expand” is not enough without accuracy or findability evidence.
7. Before opening any new DOC Finding, search the register for the same root cause under DOC/ROAD/PROD/ARC/SEO/UX/HYG. Reference existing IDs instead of cloning — especially Roadmap vs Documentation.
8. Cadence is **Quarterly** per Framework v1.1.
9. Do not create the Documentation report unless publication is explicitly requested.

## Related governance

| Document | Role |
|---|---|
| [`../README.md`](../README.md) | Framework v1.2 operating rules (Quarterly Documentation) |
| [`../audit-catalog.md`](../audit-catalog.md) | Ownership authority (Documentation vs Roadmap / Product / ARC / …) |
| [`../findings-register.md`](../findings-register.md) | Live work queue |
| [`../_templates/report-template.md`](../_templates/report-template.md) | Shared report template |
| [`../../README.md`](../../README.md) | Docs corpus entry map |
| [`../../project-state.md`](../../project-state.md) | Current system summary |
| [`../../standards/definition-of-done.md`](../../standards/definition-of-done.md) | Documentation Impact Review expectations |
