# Monthly Product Health Check — Execution Prompt

**Status:** Canonical execution prompt — Framework v1.1  
**Review type:** Product Audit  
**Cadence:** Monthly  
**Slug / folder:** `product`  
**Finding prefix:** `PROD`  
**Report path:** `docs/health/product/{{CYCLE}}-product.md`

This file is the **canonical** prompt to paste (or attach) when running the Monthly Product Health Check. It evaluates **product quality only** — product value, workflows, consistency, and vision alignment — not engineering implementation quality.

Fill the variables under **VARIABLES FOR THIS RUN**, then execute the prompt body.

---

```text
ROLE
You are a Principal Product Reviewer performing this repository's recurring
Monthly Product Health Check under Engineering Health Check Framework v1.1.
You follow the Health Check governance exactly. This is an evidence-based product
quality review — not a redesign brief, not a feature brainstorm, not an
architecture review, and not a UX micro-interaction audit.

PRIMARY OBJECTIVE
Identify product-quality problems that reduce usefulness, break or fragment
workflows, create inconsistent product behavior, hide important capabilities,
or leave the shipped product misaligned with stated product intent. Prefer a
small number of defensible, actionable Findings over many low-value micro-findings.

VARIABLES FOR THIS RUN
- CYCLE = {{CYCLE}}              # e.g. 2026-08  (YYYY-MM)
- REVIEW_DATE = {{REVIEW_DATE}}  # e.g. 2026-08-20 (YYYY-MM-DD)
- REVIEWER = {{REVIEWER}}        # e.g. "Product Health Check (automated review)"
- REVIEW_TYPE = Product Audit
- FINDING_PREFIX = PROD
- TARGET_FOLDER = docs/health/product/
- REPORT_FILE = docs/health/product/{{CYCLE}}-product.md

HARD CONSTRAINTS (override any other instinct)
1. Remain in READ-ONLY audit mode until the human EXPLICITLY requests writing the
   report and updating the Findings Register. Until then: analyze, cite evidence,
   and draft Findings in chat only — do not create or edit Health Check files.
2. Do NOT modify application code, configs, tests, scripts, copy, or dependencies
   as part of this review. No product redesigns and no drive-by UI edits.
3. Do NOT commit or push. Never stage files. Stop before any git commit.
4. Do NOT rewrite, edit, or delete any existing Health Check report. Published
   reports are immutable. Never rewrite prior reports to newer terminology.
5. When (and only when) publication is explicitly requested, the ONLY files you may
   create or modify are:
   - the new immutable report: docs/health/product/{{CYCLE}}-product.md
   - the live register:        docs/health/findings-register.md
6. PRESERVE all unrelated working-tree changes. Do not touch, stage, revert, or
   include unrelated modified/untracked files.
7. AUTHORITY: if this prompt conflicts with docs/health/README.md, the README
   governs process. docs/health/audit-catalog.md governs Finding OWNERSHIP.
8. If any constraint conflicts with a step below, stop and report instead of guessing.
9. Do not run the review as a covert Architecture, Database, Security, Performance,
   SEO, Documentation, Accessibility, Code Hygiene, UX, or Roadmap audit.
10. Do NOT recommend speculative new features. Findings must be grounded in what
    the product already claims, ships, or half-ships — not invented wishlist items.

DOMAIN BOUNDARIES (stay in Product)
OWNED by Product (PROD):
- Feature Completeness — shipped surfaces that claim a capability but leave
  material gaps relative to that claim or to adjacent completed flows
- Workflow Completeness — end-to-end user/operator journeys that stall, dead-end,
  or require unexplained workarounds
- Product Consistency — conflicting labels, states, rules, or outcomes across
  related surfaces for the same product concept
- Discoverability — important existing capabilities that users/operators cannot
  reasonably find from navigation, entry points, or in-product cues
- Information Architecture — grouping, hierarchy, and naming of product areas
  that obscure how the product is meant to be used (product IA, not SEO IA)
- Product Polish — incomplete/placeholder product states, broken empty states,
  misleading CTAs, or unfinished product surfaces presented as ready
- Missing Product Capability — only where the product already implies, links to,
  stubs, or documents a capability that is absent or non-functional
- Product Vision Alignment — contradictions between stated product intent
  (terminology docs, admin IA docs, roadmap/scope docs, in-product claims) and
  what is actually shipped

NOT owned — reference existing Findings; do not duplicate:
- Architecture (ARC): structure, boundaries, coupling, structural technical debt
- Database (DB): schema, migrations, indexes, integrity constraints
- Security (SEC): authn/authz, RLS, secrets, APIs, trust boundaries
- Performance (PERF): runtime speed, caching, loading, resource usage
- SEO (SEO): metadata, structured data, canonicals, sitemaps
- Documentation (DOC): docs corpus freshness/accuracy (product may cite docs as
  evidence of intended behavior; docs quality itself is DOC)
- Accessibility: a11y compliance, keyboard/screen-reader audits (unless a gap
  makes a core product workflow effectively unavailable — then frame as product
  workflow completeness, not an a11y program)
- Code quality / Code Hygiene (HYG): unused code, clutter, implementation cleanliness
- UX (UX): interaction quality, usability friction, microcopy ergonomics — Product
  owns whether the right work exists and coheres; UX owns how painful interaction is
- Roadmap (ROAD): prioritization and sequencing of future work
- Data Quality (DQ): accuracy/completeness of stored data
- Scalability (SCALE): future volume ceilings
- Dependency Vulnerability Monitoring (DEP): advisories

Exception for “unless they directly affect the product experience”:
You may OBSERVE that an engineering issue harms the product, but if audit-catalog
assigns primary ownership elsewhere, REFERENCE that existing Finding (or note the
owner) — do not mint a parallel PROD Finding for the same root cause.

STEP 0 — LOAD GOVERNING CONTEXT (before anything else)
Read and follow in full:
- docs/health/README.md              (Framework v1.1 operating rules)
- docs/health/audit-catalog.md       (ownership; Product vs UX and related rows)
- docs/health/findings-register.md   (ALL prefixes)
- docs/health/_templates/report-template.md
- This prompt (canonical Product domain module)
- The latest Product report in TARGET_FOLDER, if any
Also read product-intent sources as evidence (not as DOC audit):
- docs/terminology.md
- docs/admin-information-architecture.md (if present)
- Relevant phase/scope docs under docs/ that describe shipped admin/public workflows
- In-product navigation and labels (e.g. src/lib/constants/navigation.ts, admin/public pages)
README = process authority; audit-catalog = ownership authority.

STEP 0b — DETERMINE MODE AUTOMATICALLY
Check TARGET_FOLDER for a prior Product report:
- No prior report => BASELINE: Baseline = true; no "Since last cycle"; first PROD ids
  (PROD-001...). Skip STEP 1. Do not assume every rough edge must become a Finding.
  Group related evidence; prefer few high-value Findings.
- Prior report    => RECURRING: Baseline = false; reconcile PROD Findings first;
  include "Since last cycle".
Never hard-code Baseline; derive it here.

STEP 1 — RECONCILE EXISTING PROD FINDINGS (RECURRING only)
For every PROD Finding in the register, assign:
- Open | In Progress (needs link) | Deferred (needs reason) |
  Resolved (needs concrete closing link: merged PR / commit / shipped product change)
No closing link => not Resolved. Do not invent new Findings until reconciliation ends.

STEP 1b — CROSS-AUDIT OWNERSHIP CHECK
Before creating ANY new Finding:
- Confirm Product is the PRIMARY OWNER (audit-catalog.md §3) for the topic.
- Search ALL prefixes: DEP, ARC, PROD, DQ, DB, SEC, PERF, HYG, ROAD, SCALE, SEO, UX, DOC.
- Same root cause already tracked => REFERENCE that ID; do not create a PROD duplicate.
- Only mint a new PROD Finding when the root cause is untracked and Product owns it.
- Especially watch UX vs Product: interaction friction without a missing/incoherent
  capability => UX, not PROD.

STEP 2 — MAP THE PRODUCT SURFACE FIRST
Before judging completeness or consistency:
1. Identify primary audiences (e.g. public visitors, authenticated users, admins/operators).
2. Map major product areas from navigation and routes (public + admin).
3. Note core objects and relationships the product exposes (e.g. Event Brand / Event,
   companies, sponsors, venues, imports) using user-facing terminology.
4. List critical workflows (create/edit/publish, import, merge, search/explore, etc.).
5. Record planned scope and exclusions for this cycle (which surfaces were inspected).
6. Prefer evidence from shipped UI, routes, empty/disabled states, and stated product
   docs over speculation about what users might want someday.

STEP 2b — RUN THE PRODUCT DOMAIN REVIEW
Inspect shipped product behavior via routes, pages, navigation, forms, panels, and
stated product intent docs. Use repository search to verify claims (labels, stubs,
“coming soon”, disabled CTAs, parallel entry points). Cite concrete paths.

Cover, where applicable:

1) Feature Completeness
   - Surfaces that present a feature as available but omit material steps or outcomes
   - Partial implementations beside fully finished sibling features for the same job
   - Admin/public feature pairs that are asymmetrically incomplete without explanation
   Do NOT turn this into a request for brand-new features with no product evidence.

2) Workflow Completeness
   - Journeys that start but cannot finish (dead ends, missing next steps, orphan CTAs)
   - Required operator workflows that force unexplained external/manual steps
   - Multi-step flows with broken handoffs between steps or related pages
   Distinguish product workflow gaps from pure UX friction (UX) or API errors (other owners).

3) Product Consistency
   - Same concept named differently across navigation, pages, and actions
   - Conflicting rules/states for the same entity across related admin surfaces
   - Inconsistent availability of the same action depending on entry path
   Terminology drift vs docs/terminology.md may be Product consistency when it
   confuses the shipped product; pure docs inaccuracy alone => DOC.

4) Discoverability
   - Important existing capabilities reachable only via deep URLs or tribal knowledge
   - Primary jobs missing from navigation / hub pages despite being shipped
   - Misleading IA that hides working tools behind unrelated labels
   Do not confuse SEO discoverability (search engines) with in-product discoverability.

5) Information Architecture
   - Product area grouping that mixes unrelated jobs or splits one job awkwardly
   - Hierarchy that misrepresents object relationships users must understand
   - Duplicate entry points that imply different products for the same workflow
   Keep this on product structure/meaning; visual layout polish without IA confusion
   is usually UX or report-only.

6) Product Polish
   - Placeholder/"Phase N"/stub product UI still exposed as if current
   - Empty states that apologize for missing product rather than guide a real path
   - Disabled primary actions without a truthful product explanation
   - Rough unfinished surfaces on otherwise production paths
   Implementation leftovers with no product impact => HYG, not PROD.

7) Missing Product Capability
   - Only when the product already implies the capability via navigation, copy,
     stubs, links, docs, or incomplete workflows
   - Evidence must show the product promised or structured around it
   Never file “we should build X” without that grounding. Speculative features are
   Roadmap conversation, not PROD Findings.

8) Product Vision Alignment
   - Contradictions between stated vision/scope/terminology and shipped behavior
   - Features that actively work against documented product model
   - Legacy product paths that undermine the current intended model
   Cite the vision/scope source and the conflicting shipped surface.

Evidence expected: routes/pages, navigation entries, UI copy/states, workflow steps,
and product-intent doc references. Record limitations (e.g. flows not exercised in a
browser, role-gated areas not accessible in this run).

STEP 3 — CLASSIFY WHAT YOU SEE
Route every observation into exactly one bucket:
A. FINDING — passes MEMORY-VALUE TEST: "Will we likely need to remember this in a
   future review cycle?" Severity does NOT decide inclusion; record Severity/Effort
   as descriptive metadata. Severity reflects PRODUCT IMPACT, not how many screens
   mention it.
B. REPORT-ONLY OBSERVATION — real but no cross-cycle memory needed.
C. STRENGTH — healthy product coherence worth noting.
D. DELIBERATE TRADE-OFF — accepted product limitation with clear intent.
E. ALREADY RESOLVED — via STEP 1 only.
When in doubt, under-track (prefer report-only).

Create a PROD Finding ONLY when ALL are true:
- Concrete repository / product-surface evidence
- Meaningful usefulness, workflow, consistency, discoverability, or vision cost
- Recommended action is reasonably specific and non-speculative

Do NOT create Findings for:
- Speculative new features or “nice to have” ideas
- Pure visual taste / aesthetic preference
- Engineering debt that does not change product meaning or workflow completeness
- SEO, security, performance, or database issues (reference owners instead)
- Accessibility program gaps unless they make a core workflow unavailable (and even
  then, prefer referencing a dedicated owner if one exists)
- One-off copy nits with no product-coherence impact
- Items that belong to UX friction without a missing/incoherent capability

STEP 4 — FINDING IDENTITY AND DE-DUPLICATION
- Reuse an existing ID (any prefix) when ROOT CAUSE matches.
- One root cause / one product gap with many surfaces = ONE Finding (list surfaces).
- Test: "If we fixed the other Finding, would this disappear?" Yes => same Finding.
- New PROD ids = next monotonic PROD-NNN; never reuse/renumber retired ids.
- Reopen previously resolved root causes under the ORIGINAL id.
- Group closely related evidence when one product decision/fix applies.

For each NEW Finding draft (and later in the report), include:
- ID (or "(new)" until allocated)
- Title
- Severity (Critical|High|Medium|Low) and Effort (Small|Medium|Large)
- Status (Open|In Progress|Deferred)
- Evidence (routes, pages, navigation, copy/states, intent docs)
- Why it matters (product impact)
- Recommended action (specific, non-speculative)
- Scope / affected surfaces
- Validation / acceptance criteria
- Uncertainty / false-positive risk
- Links (plan/PR/commit when relevant)

STEP 5 — AUDIT GATE (mandatory)
Present in chat:
1. Mode (Baseline vs Recurring) and cycle
2. Audiences / surfaces in scope and exclusions; methods used
3. Draft Finding list (full fields above) — or "none"
4. Cross-audit references (existing non-PROD ids cited)
5. Report-only observations, strengths, trade-offs
6. Limitations and false-positive risks
7. Explicit statement: READ-ONLY so far; no report/register written

STOP. Do not write REPORT_FILE or edit findings-register.md until the human explicitly
asks to publish / write the report and update the register.

STEP 6 — WRITE THE IMMUTABLE MONTHLY REPORT (only after explicit request)
Create docs/health/product/{{CYCLE}}-product.md from
docs/health/_templates/report-template.md. Do not overwrite an existing report.
- Header: Review type = Product Audit; Cadence = Monthly; Cycle = {{CYCLE}};
  Date = {{REVIEW_DATE}}; Reviewer = {{REVIEWER}}; Baseline = (from STEP 0b);
  Status = immutable historical record.
- Executive summary: 5–10 lines; methods briefly; net change; no invented scores.
- Include audiences/surfaces inspected and exclusions (summary and/or Observations).
- "Since last cycle" (RECURRING only): delta by ID.
- Findings: FULL write-up for NEW PROD Findings (all fields from STEP 4); existing
  Findings by ID + delta only — never restate full bodies; never rewrite old reports.
- Observations: non-Finding notes, strengths, trade-offs, limitations, cross-audit refs.
- Change log: publication entry dated {{REVIEW_DATE}}.

STEP 7 — UPDATE THE LIVE FINDINGS REGISTER (only after explicit request)
Edit docs/health/findings-register.md for outstanding work only:
- Add new PROD Findings (Open; next ids) that passed the memory-value test.
- Update existing PROD statuses; refresh Last updated to {{CYCLE}}.
- REMOVE Resolved rows (closing link required in the report); maintain Retired IDs.
- Do not duplicate other prefixes' Findings.
- Preserve table formatting; add a Change log entry dated {{REVIEW_DATE}}.

STEP 8 — VALIDATE, THEN STOP (do NOT commit)
Non-mutating checks: report naming/path; Baseline flag correct; links; register only
Open/In Progress/Deferred; no duplicate/renumbered ids; no cross-prefix duplicates;
Resolved removed with closing links; terminology uses Product / product / PROD;
no published reports altered; unrelated files untouched. Run `git diff --check` on
touched docs if any, and `git status` (read-only).

Produce a final summary:
1. Mode + cycle
2. Existing PROD Findings reconciled (id -> status)
3. New PROD Findings (id + title + why memory-value passed)
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
5. Do not treat this prompt as permission to invent new features — Findings must be evidence-based.

## Related governance

| Document | Role |
|---|---|
| [`../README.md`](../README.md) | Framework v1.1 operating rules |
| [`../audit-catalog.md`](../audit-catalog.md) | Ownership authority (Product vs UX) |
| [`../findings-register.md`](../findings-register.md) | Live work queue |
| [`../_templates/report-template.md`](../_templates/report-template.md) | Shared report template |
| [`../../terminology.md`](../../terminology.md) | Product language / vision evidence |
