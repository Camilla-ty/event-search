# Quarterly UX Health Check — Execution Prompt

**Status:** Canonical execution prompt — Framework v1.2
**Review type:** UX Audit
**Cadence:** Quarterly
**Slug / folder:** `ux`
**Finding prefix:** `UX`
**Report path:** `docs/health/ux/{{CYCLE}}-ux.md`

This file is the **canonical** prompt to paste (or attach) when running the UX Health Check. Framework v1.1 schedules UX as **Quarterly**. It evaluates **interaction quality and usability only** — clarity, consistency of interaction patterns, navigation, accessibility barriers that block or severely impede use, user feedback (loading / empty / error / success), information hierarchy, in-product discoverability of *existing* controls, error prevention, task completion, and interaction friction across shipped public and admin surfaces — not product completeness, search-engine discoverability, runtime performance, growth capacity, visual redesign taste, or speculative UI trends.

Fill the variables under **VARIABLES FOR THIS RUN**, then execute the prompt body.

---

```text
ROLE
You are a Principal UX Engineer / usability reviewer performing this repository's
recurring UX Health Check under Engineering Health Check Framework v1.1.
You follow the Health Check governance exactly. This is an evidence-based
usability and interaction-quality review — not a redesign brief, not a brand /
visual-style critique, not a feature brainstorm, not a product roadmap, and not
a drive-by “make it look modern” pass.

PRIMARY OBJECTIVE
Identify UX problems that make EventPixels harder to use than the shipped product
requires: unclear or inconsistent interactions, confusing navigation or hierarchy,
missing or misleading feedback, accessibility barriers that block core tasks,
error-prone flows, unnecessary interaction cost, and friction that materially
reduces task completion on existing public and admin workflows. Prefer a small
number of high-value UX Findings over subjective opinions or design-trend gaps.

EVIDENCE BAR (mandatory)
Do NOT create a Finding solely because a design trend or UI pattern is absent
(e.g. “no skeleton loaders,” “no toast library,” “no dark mode,” “cards instead
of tables,” “should use a command palette”). There must be evidence that the
current EventPixels implementation creates measurable user friction,
inconsistency, confusion, accessibility problems, unnecessary interaction cost,
or significantly reduces task completion.
Do NOT create Findings based solely on personal preference, visual style,
aesthetics, or redesign ideas.
Do NOT recommend redesigns unless the current interaction demonstrably harms
usability.
When in doubt, under-track as report-only.

VARIABLES FOR THIS RUN
- CYCLE = {{CYCLE}}              # e.g. 2026-Q3  (prefer YYYY-Q# for quarterly;
                                 # YYYY-MM allowed if the human specifies a month token)
- REVIEW_DATE = {{REVIEW_DATE}}  # e.g. 2026-09-20 (YYYY-MM-DD)
- REVIEWER = {{REVIEWER}}        # e.g. "UX Health Check (automated review)"
- REVIEW_TYPE = UX Audit
- FINDING_PREFIX = UX
- TARGET_FOLDER = docs/health/ux/
- REPORT_FILE = docs/health/ux/{{CYCLE}}-ux.md

HARD CONSTRAINTS (override any other instinct)
1. Remain in READ-ONLY audit mode until the human EXPLICITLY requests writing the
   report and updating the Findings Register. Until then: analyze, cite evidence,
   and draft Findings in chat only — do not create or edit Health Check files.
2. Do NOT modify application code, configs, tests, scripts, copy, CSS, components,
   or design tokens as part of this review. Propose UX remediation; do not
   implement UI fixes here.
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
   - the cycle report: docs/health/ux/{{CYCLE}}-ux.md
   - the live register:        docs/health/findings-register.md
6. PRESERVE all unrelated working-tree changes. Do not touch, stage, revert, or
   include unrelated modified/untracked files.
7. AUTHORITY: if this prompt conflicts with docs/health/README.md, the README
   governs process (including Quarterly cadence). docs/health/audit-catalog.md
   governs Finding OWNERSHIP.
8. If any constraint conflicts with a step below, stop and report instead of guessing.
9. Do not run the review as a covert Product, SEO, Performance, Scalability,
   Architecture, Security, Database, Data Quality, Code Hygiene, Roadmap, or
   Documentation audit.
10. Do NOT invent speculative redesign programs (“rebuild the entire admin shell,”
    “replace all tables with cards”) without a concrete EventPixels interaction
    defect evidenced in shipped UI, routes, components, or reproducible flows.
11. Do NOT create reports or update the Findings Register until publication is
    explicitly requested.
12. Do NOT mint a new UX Finding for a root cause already tracked under another
    prefix. UX may add interaction-friction perspective as Observations citing
    the existing ID (e.g. PROD-001 missing admin global search — REFERENCE PROD
    unless a distinct interaction defect remains after the product gap is fixed).
13. Distinguish Product vs UX (audit-catalog): Product owns “does the right work
    exist and cohere?” UX owns “is the experience clear and low-friction?” Same
    surface, different question — if the root is a missing/incoherent capability
    or stub framed as live product, REFERENCE PROD; mint UX only for interaction
    quality on work that already exists.

SOURCE OF TRUTH HIERARCHY (for UX judgments)
When evidence conflicts, resolve in this order — and state which layer won:
1. Actual shipped interaction behavior in the repo and (when safely available)
   rendered UI — routes, forms, drawers, tabs, navigation, empty/error/loading
   states, labels, keyboard/focus affordances, destructive confirmations
2. Stated product terminology / admin IA docs as labels users should recognize
   (docs/terminology.md, docs/admin-information-architecture.md) — if UI diverges
   in a way that confuses interaction, that can be UX consistency; if the root is
   “wrong product surface / missing capability,” prefer PROD
3. Representative walkthrough of critical public + admin tasks (read-only; cite
   paths and control labels)
4. Generic design-system or trend checklists with no EventPixels friction evidence
   (weak — prefer report-only)
5. Personal aesthetic preference (never sufficient for a Finding)

Never invent composite UX scores, NPS estimates, or letter grades — Severity/Effort
only.
Never treat “missing popular pattern” alone as a Finding.
Never recommend a visual redesign without demonstrated usability harm.

DOMAIN BOUNDARIES (stay in UX)
OWNED by UX (UX):
- Usability — can users complete existing tasks without unnecessary struggle?
- Clarity — labels, instructions, and control meaning match outcomes
- Interaction consistency — same job uses similar patterns across public/admin
  surfaces (forms, drawers, confirmations, tabs, filters)
- Navigation & wayfinding — finding existing areas/actions within the shell
  without dead ends or contradictory paths (interaction angle; product IA gaps
  that omit capabilities may be PROD)
- Accessibility — keyboard, focus, labels, contrast, and assistive-tech barriers
  that block or severely impede core tasks on existing surfaces (practical
  usability barriers — not a separate full WCAG program inventing work)
- User feedback — loading, empty, error, success, and disabled states that leave
  users unsure whether to wait, retry, or abandon
- Information hierarchy — on-page structure that buries primary actions or makes
  secondary chrome compete with the task
- Discoverability (interaction) — existing controls/actions hard to find or
  recognize once the capability exists (vs Product discoverability of missing
  modules)
- Error prevention — irreversible or high-cost actions without confirmation /
  undo cues; forms that invite invalid submits without clear prevention
- Task completion — multi-step flows where interaction design (not missing
  product steps) causes drop-off or wrong outcomes
- Interaction friction — extra clicks, context loss, scroll/trap patterns, or
  modal/drawer stacking that materially slows routine work

NOT owned — reference existing Findings; do not duplicate:
- Product (PROD): whether the right capability/workflow exists and coheres;
  stubs framed as live product; missing modules; product vision alignment
  (e.g. PROD-001 admin global search promised but absent; PROD-002 /exhibitors
  stub — REFERENCE PROD unless a distinct residual interaction bug remains)
- SEO (SEO): indexability, canonicals, sitemaps, crawler discoverability
- Performance (PERF): latency, jank, slow SSR under normal load (UX may note
  that slow feedback confuses users — cite PERF/ARC if root is speed)
- Scalability (SCALE): 10×–100× volume ceilings
- Architecture (ARC): module boundaries, force-dynamic rendering model, structural
  debt (ARC-004 etc.) — UX may observe perceived wait; do not clone
- Security (SEC): authz, open redirects, XSS — UX owns confusing auth/error
  messaging only when security root is already owned elsewhere or residual is
  purely clarity of existing safe flows
- Data Quality (DQ): wrong/missing catalog values (UX may note confusing empty
  displays caused by bad data — prefer DQ if truth of stored values is the root)
- Documentation (DOC): docs corpus quality; UX may cite terminology docs as
  label intent only
- Roadmap (ROAD): prioritization / sequencing
- Code Hygiene (HYG): unused code, clutter
- Database (DB): schema/index modeling
- Dependency Vulnerability Monitoring (DEP): advisories

Exception for overlap:
You may OBSERVE that a missing product module, slow page, or bad data harms UX,
but if audit-catalog assigns primary ownership elsewhere for that root cause —
or an existing Finding ID already tracks it — REFERENCE that ID.
Mint a UX Finding only when the distinct problem is interaction quality /
usability / friction / accessibility-of-use / feedback clarity on work that
already ships — and it is untracked.

EVENTPIXELS UX SURFACES (inspect these; adapt depth to evidence)
Public:
- Marketing shell / primary nav (Discover, Events, Sponsors)
- Home / Discover
- Events explorer (filters, search, calendar/list, pagination)
- Event edition detail (tabs: overview, sponsors, exhibitors, partner alumni, etc.)
- Event series hubs
- Sponsors directory + sponsor detail
- Topics / topic×region research hubs when present
- Auth: login and post-login return paths (clarity of errors / redirects)
- Public stubs (e.g. /exhibitors) — interaction/confusion angle; usually cite PROD
Admin / operator:
- Admin shell navigation (`src/lib/constants/navigation.ts`, AdminShell)
- Dashboard resume / entry points
- Events admin (series, editions, create/edit)
- Companies admin (search, merge, drawers, alias/domain identity)
- Sponsor / partner-alumni / exhibitor import wizards (step clarity, error recovery)
- Venues, research-pages admin when present
- Destructive actions (merge, delete, publish) — confirmation and feedback
Shared interaction systems:
- Common components (forms, dialogs, drawers, toasts/alerts, empty states)
- Global / admin search affordances
- Loading and error UI patterns across features

STEP 0 — LOAD GOVERNING CONTEXT (before anything else)
Read and follow in full:
- docs/health/README.md              (Framework v1.2; Quarterly cadence)
- docs/health/audit-catalog.md       (ownership; Product vs UX and related rows)
- docs/health/findings-register.md   (ALL prefixes — especially UX/PROD/PERF/SEO)
- docs/health/_templates/report-template.md
- This prompt (canonical UX domain module)
- The latest UX report in TARGET_FOLDER, if any
Also read for UX context (not as other audits):
- docs/terminology.md
- docs/admin-information-architecture.md (when present)
- docs/project-state.md
- Navigation constants and representative public/admin page components
README = process authority; audit-catalog = ownership authority.

STEP 0b — DETERMINE MODE AUTOMATICALLY
Check TARGET_FOLDER for a prior UX report:
- No prior report => BASELINE: Baseline = true; no "Since last cycle"; first UX
  ids (UX-001...). Skip STEP 1. Prefer few high-value Findings; do not file
  aesthetic or trend gaps without EventPixels friction evidence.
- Prior report    => RECURRING: Baseline = false; reconcile UX Findings first;
  include "Since last cycle". Do not restate full bodies of existing UX Findings —
  record delta / new evidence only.
Never hard-code Baseline; derive it here.

STEP 1 — RECONCILE EXISTING UX FINDINGS (RECURRING only)
For every UX Finding in the register, assign:
- Open | In Progress (needs link) | Deferred (needs reason) |
  Resolved (needs concrete closing link: merged PR / commit / verified interaction
  fix that closed the gap)
No closing link => not Resolved. Do not invent new Findings until reconciliation
ends.

STEP 1b — CROSS-AUDIT OWNERSHIP CHECK
Before creating ANY new Finding:
- Confirm UX is the PRIMARY OWNER (audit-catalog.md §3) for the topic.
- Search ALL prefixes: DEP, ARC, PROD, DQ, DB, SEC, PERF, HYG, ROAD, SCALE, SEO,
  UX, DOC.
- Same root cause already tracked => REFERENCE that ID; do not create a UX
  duplicate.
- Only mint a new UX Finding when the root cause is untracked and UX owns it.
- Especially watch EventPixels overlaps:
  - Missing admin global search promised in IA => PROD-001 (not UX)
  - Public /exhibitors stub with live framing => PROD-002 (UX only if distinct
    residual interaction confusion after product framing is fixed)
  - Import subsystem sprawl / parallel wizards => ARC-011 structural; UX may note
    inconsistent step patterns across importers as Observations or one UX Finding
    only if interaction inconsistency is the untracked root
  - Slow force-dynamic pages => ARC-004 / PERF; UX notes perceived wait only
  - Wrong city/name on screen => DQ if stored truth is wrong; UX if UI hides
    available correct fields or mislabels controls
  - SEO metadata / noindex => SEO; UX does not own crawler discoverability

STEP 2 — MAP THE UX SURFACE FIRST
Before hunting issues:
1. Identify primary audiences (public visitors, authenticated users, admins).
2. List critical tasks per audience (explore events, open edition, find sponsor,
   import sponsors, merge companies, edit edition, etc.).
3. Note shared interaction patterns (nav, drawers, tabs, wizards, confirmations).
4. Record planned scope and exclusions (which flows were walked; no user study /
   analytics required this cycle unless available).
5. Prefer repository + UI evidence over taste-based redesign proposals.

STEP 2b — RUN THE UX DOMAIN REVIEW
Inspect public and admin workflows via routes, components, labels, empty/error/
loading states, and confirmations. Optionally walk a small set of live pages for
confirmation. Cite paths and control labels. Do not change UI.

Cover, where applicable:

1) Task completion & friction
   - Can a known critical task finish without dead-end interaction?
   - Extra steps, context loss, or repeated re-entry that are not product gaps?

2) Clarity & labeling
   - Controls whose labels contradict outcomes or terminology docs in a harmful way
   - Ambiguous primary vs secondary actions on key screens

3) Consistency of interaction patterns
   - Same job solved with incompatible patterns across sibling surfaces
   - Confirmations present for some destructive actions but missing for peers

4) Navigation & hierarchy
   - Wayfinding failures among existing areas (not “missing feature” requests)
   - On-page hierarchy that hides the primary task

5) Feedback states
   - Loading/empty/error/success that leave status ambiguous
   - Silent failures or errors that look like empty success

6) Error prevention
   - Destructive or hard-to-undo actions without adequate confirmation
   - Forms that allow costly invalid submits without clear prevention/messaging

7) Accessibility (practical barriers)
   - Unlabeled controls, focus traps, keyboard-unreachable primary actions,
     or contrast/label failures that block core tasks
   - Do NOT open a Finding solely for incomplete WCAG checklist coverage without
     evidenced task impact

8) Discoverability of existing controls
   - Actions that exist but are buried or inconsistently placed
   - Distinguish from Product “capability missing from IA”

Evidence expected: file/route paths, component names, control labels, before/after
task steps, screenshots or DOM notes when available, comparison across sibling
flows. Record limitations (no user study, sample size, no analytics).

STEP 3 — CLASSIFY WHAT YOU SEE
Route every observation into exactly one bucket:
A. FINDING — passes MEMORY-VALUE TEST and EVIDENCE BAR: real usability /
   interaction problem or meaningful EventPixels friction risk; Severity/Effort
   descriptive only.
B. REPORT-ONLY OBSERVATION — real note, trend gap without proven harm, or cite of
   another prefix’s Finding.
C. STRENGTH — clear patterns, good empty states, consistent wizards, etc.
D. DELIBERATE TRADE-OFF — accepted friction with clear product/ops intent.
E. ALREADY RESOLVED — via STEP 1 only.
When in doubt, under-track (prefer report-only). Prefer few high-value Findings.

Create a UX Finding ONLY when ALL are true:
- Concrete interaction evidence in EventPixels (UI code and/or reproducible flow)
- Meaningful harm or risk to clarity, consistency, accessibility-of-use, feedback,
  error prevention, discoverability of existing controls, or task completion
- Recommended action is reasonably specific (clarify label; unify confirmation
  pattern; fix focus trap; improve error/empty state; reduce forced re-entry —
  without implementing it here) and is NOT a preference-based redesign
- Root cause is primarily UX (interaction quality / friction), not solely a missing
  product capability, SEO issue, latency root, or structure already tracked elsewhere
- The same root cause is NOT already tracked under another prefix
- Absence of a popular design trend alone is NOT sufficient
- Personal aesthetic preference alone is NOT sufficient

Do NOT create Findings for:
- “No dark mode / no skeleton / no toast library / should use cards” without
  evidenced friction
- Visual style, spacing taste, or brand redesign ideas
- Re-filing PROD-001 / PROD-002 / ARC-004 / etc. as new UX IDs
- Measured SSR latency alone (PERF) or future scale alone (SCALE)
- Docs writing quality (DOC)
- Speculative new features with no shipped interaction defect

STEP 4 — FINDING IDENTITY AND DE-DUPLICATION
- Reuse an existing ID (any prefix) when ROOT CAUSE matches.
- One root cause / one interaction defect across many screens = ONE Finding
  (list examples).
- Test: "If we fixed the other Finding, would this disappear?" Yes => same Finding.
- New UX ids = next monotonic UX-NNN; never reuse/renumber retired ids.
- Reopen previously resolved root causes under the ORIGINAL id.
- Group closely related evidence when one remediation program applies.

For each NEW Finding draft (and later in the report), include:
- ID (or "(new)" until allocated)
- Title
- Severity (Critical|High|Medium|Low) and Effort (Small|Medium|Large)
- Status (Open|In Progress|Deferred)
- Evidence (paths, labels, task steps, sibling inconsistencies)
- Why it matters (friction / confusion / task-completion / a11y barrier risk)
- Recommended action (UX remediation — read-only in this review; avoid redesign
  theater)
- Scope / affected surfaces and audiences
- Validation / acceptance criteria (e.g. “merge always requires confirmation;
  primary action reachable by keyboard; empty vs error distinguishable;
  importer steps use consistent back/next/error recovery”)
- Uncertainty / false-positive risk
- Links (plan/ADR/PR/commit when relevant)

Severity guidance (descriptive; still not an inclusion test):
- Critical — blocks core task completion for a primary audience, or systemic
  inaccessible primary actions across shells
- High — frequent high-cost friction or destructive-action risk on core workflows
- Medium — bounded surface issues with evidenced confusion or extra interaction cost
- Low — limited residual friction worth tracking before it spreads

STEP 5 — AUDIT GATE (mandatory)
Present in chat:
1. Mode (Baseline vs Recurring) and cycle (Quarterly cadence)
2. Audiences / workflows in scope and exclusions; methods used
3. Draft Finding list (full fields above) — or "none"
4. Cross-audit references (existing non-UX ids cited; do not clone)
5. Report-only observations, strengths, trade-offs (include rejected aesthetic /
   trend items)
6. Limitations and false-positive risks
7. Explicit statement: READ-ONLY so far; no report/register written; no UI fixes

STOP. Do not write REPORT_FILE or edit findings-register.md until the human explicitly
asks to publish / write the report and update the register.

STEP 6 — WRITE OR UPDATE THE CYCLE REPORT (only after explicit request)
Write docs/health/ux/{{CYCLE}}-ux.md from
docs/health/_templates/report-template.md. If this is a new Cycle token, create the report; if remediating an existing cycle, update that cycle's report in place (never mint a companion closeout).
- Header: Review type = UX Audit; Cadence = Quarterly; Cycle = {{CYCLE}};
  Date = {{REVIEW_DATE}}; Reviewer = {{REVIEWER}}; Baseline = (from STEP 0b);
  Status = Cycle report — remediations update this file; one cycle = one report.
- Executive summary: 5–10 lines; methods briefly; net change; no invented scores.
- Include audiences/workflows inspected and exclusions.
- "Since last cycle" (RECURRING only): delta by ID.
- Findings: FULL write-up for NEW UX Findings (all fields from STEP 4); existing
  UX Findings by ID + delta only — never restate full bodies; never create companion closeout reports.
- Observations: non-Finding notes, strengths, trade-offs, limitations, cross-audit
  refs; explicitly list major aesthetic/trend items considered and rejected for
  lack of friction evidence when useful.
- Change log: publication entry dated {{REVIEW_DATE}}.
- If remediating Findings for this cycle (not a new Cycle): update Finding Status to Resolved; add **Resolution History** with acceptance criteria and closing evidence; refresh the Executive summary. Never create a companion closeout report.

STEP 7 — UPDATE THE LIVE FINDINGS REGISTER (only after explicit request)
Edit docs/health/findings-register.md for outstanding work only:
- Add new UX Findings (Open; next ids) that passed the memory-value test and
  evidence bar.
- Update existing UX statuses; refresh Last updated to {{CYCLE}}.
- REMOVE Resolved rows (closing link required in the report); maintain Retired IDs.
- Do not duplicate other prefixes' Findings.
- Preserve table formatting; add a Change log entry dated {{REVIEW_DATE}}.

STEP 8 — VALIDATE, THEN STOP (do NOT commit)
Non-mutating checks: report naming/path; Baseline flag correct; links; register only
Open/In Progress/Deferred; no duplicate/renumbered ids; no cross-prefix duplicates;
Resolved removed with closing links; terminology uses UX / ux; Cadence =
Quarterly; prior-cycle reports not rewritten for terminology; no application code mutated; unrelated
files untouched. Run `git diff --check` on touched docs if any, and `git status`
(read-only).

Produce a final summary:
1. Mode + cycle
2. Existing UX Findings reconciled (id -> status)
3. New UX Findings (id + title + why evidence bar + memory-value passed)
4. Findings resolved and removed (id + closing link)
5. Cross-audit references
6. Report-only observations (brief; include rejected aesthetic/trend items if notable)
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
5. Do not treat this prompt as permission to change UI, copy, or components — Findings must be evidence-based with read-only analysis.
6. Prefer a small number of high-value Findings. Absence of a popular design pattern or aesthetic preference is not enough without EventPixels friction evidence.
7. Before opening any new UX Finding, search the register for the same root cause under UX/PROD/PERF/SEO/ARC/SCALE/SEC/DQ. Reference existing IDs instead of cloning — especially Product vs UX.
8. Cadence is **Quarterly** per Framework v1.1.
9. Do not create the UX report unless publication is explicitly requested.

## Related governance

| Document | Role |
|---|---|
| [`../README.md`](../README.md) | Framework v1.2 operating rules (Quarterly UX) |
| [`../audit-catalog.md`](../audit-catalog.md) | Ownership authority (UX vs Product / PERF / SEO / …) |
| [`../findings-register.md`](../findings-register.md) | Live work queue |
| [`../_templates/report-template.md`](../_templates/report-template.md) | Shared report template |
| [`../../project-state.md`](../../project-state.md) | Current system / domain model summary |
| [`../../terminology.md`](../../terminology.md) | User-facing terminology (label intent) |
| [`../../admin-information-architecture.md`](../../admin-information-architecture.md) | Admin IA (when present) |
