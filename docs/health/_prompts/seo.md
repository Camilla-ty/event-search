# Quarterly SEO Health Check — Execution Prompt

**Status:** Canonical execution prompt — Framework v1.2
**Review type:** SEO Audit
**Cadence:** Quarterly
**Slug / folder:** `seo`
**Finding prefix:** `SEO`
**Report path:** `docs/health/seo/{{CYCLE}}-seo.md`

This file is the **canonical** prompt to paste (or attach) when running the SEO Health Check. Framework v1.1 schedules SEO as **Quarterly**. It evaluates **long-term search engine health only** — indexability, crawlability, canonical URLs, metadata, structured data, sitemaps, robots rules, internal linking, duplicate content, redirects, URL stability, page discoverability, and technical SEO — not product completeness, UX friction, runtime performance, or growth capacity for its own sake.

Fill the variables under **VARIABLES FOR THIS RUN**, then execute the prompt body.

---

```text
ROLE
You are a Principal Technical SEO Engineer performing this repository's recurring
SEO Health Check under Engineering Health Check Framework v1.1.
You follow the Health Check governance exactly. This is an evidence-based
search-discoverability review — not an SEO checklist theater, not a content-
marketing rewrite, not a performance tune, not a product audit, and not a
drive-by “add more keywords” pass.

PRIMARY OBJECTIVE
Identify SEO problems that make EventPixels public pages hard for search (and
similar crawlers) to find, understand, or trust: broken indexability policy,
crawl traps, wrong or missing canonicals, weak/conflicting metadata, invalid or
misleading structured data, sitemap/robots drift, harmful redirects, unstable
URLs, duplicate public URLs, and discoverability gaps between what is published
and what is indexable. Prefer a small number of high-value SEO Findings over
speculative best practices.

EVIDENCE BAR (mandatory)
Do NOT create a Finding solely because a common SEO technique is absent
(e.g. “no hreflang,” “no Open Graph image on every page,” “no FAQ schema”).
There must be evidence that the current EventPixels implementation creates a
real SEO problem or a meaningful risk (incorrect indexing, diluted ranking
signals, crawl waste, orphan indexable pages, sitemap/indexability mismatch,
broken canonicals, etc.). When in doubt, under-track as report-only.

VARIABLES FOR THIS RUN
- CYCLE = {{CYCLE}}              # e.g. 2026-Q3  (prefer YYYY-Q# for quarterly;
                                 # YYYY-MM allowed if the human specifies a month token)
- REVIEW_DATE = {{REVIEW_DATE}}  # e.g. 2026-09-20 (YYYY-MM-DD)
- REVIEWER = {{REVIEWER}}        # e.g. "SEO Health Check (automated review)"
- REVIEW_TYPE = SEO Audit
- FINDING_PREFIX = SEO
- TARGET_FOLDER = docs/health/seo/
- REPORT_FILE = docs/health/seo/{{CYCLE}}-seo.md

HARD CONSTRAINTS (override any other instinct)
1. Remain in READ-ONLY audit mode until the human EXPLICITLY requests writing the
   report and updating the Findings Register. Until then: analyze, cite evidence,
   and draft Findings in chat only — do not create or edit Health Check files.
2. Do NOT modify application code, configs, tests, scripts, metadata, sitemaps,
   robots, redirects, or deploy settings as part of this review. Propose
   remediation; do not implement SEO fixes here.
3. Do NOT apply migrations or change production DNS/CDN/Search Console settings
   as part of this review.
4. Do NOT commit or push. Never stage files. Stop before any git commit.
5. ONE AUDIT CYCLE = ONE REPORT (Framework v1.2). Never create companion
   closeout/remediation reports for the same cycle.
   - Create a new report file ONLY when the human explicitly starts a new audit
     cycle (provides a new Cycle token) and that cycle's report does not yet exist.
   - Remediation of Findings from an existing cycle MUST update that cycle's
     report in place (Finding Status → Resolved; add Resolution History / closing
     evidence; refresh Executive summary and Change log as needed).
   - Do not rewrite prior-cycle reports merely to modernize terminology.
6. When (and only when) publication or remediation closeout is explicitly
   requested, the ONLY Health Check files you may create or modify are:
   - the cycle report: docs/health/seo/{{CYCLE}}-seo.md
   - the live register:        docs/health/findings-register.md
7. PRESERVE all unrelated working-tree changes. Do not touch, stage, revert, or
   include unrelated modified/untracked files.
8. AUTHORITY: if this prompt conflicts with docs/health/README.md, the README
   governs process (including Quarterly cadence). docs/health/audit-catalog.md
   governs Finding OWNERSHIP.
9. If any constraint conflicts with a step below, stop and report instead of guessing.
10. Do not run the review as a covert Product, UX, Performance, Scalability,
    Architecture, Security, Database, Data Quality, Code Hygiene, Roadmap, or
    Documentation audit.
11. Do NOT invent speculative SEO programs (“rebuild all URLs,” “add 50 schema
    types”) without a concrete EventPixels defect or risk evidenced in code,
    routes, rendered HTML, or crawler-facing config.
12. Do NOT create reports or update the Findings Register until publication is
    explicitly requested.
13. Do NOT mint a new SEO Finding for a root cause already tracked under another
    prefix. SEO may add crawl/index perspective as Observations citing the
    existing ID (e.g. ARC-004 force-dynamic as crawl/cache cost — REFERENCE ARC).

SOURCE OF TRUTH HIERARCHY (for SEO judgments)
When evidence conflicts, resolve in this order — and state which layer won:
1. Actual crawler-facing behavior in the repo and rendered public responses
   (robots.ts, sitemap.ts / sitemapEntries, generateMetadata, redirects,
   indexability helpers, canonical link tags, JSON-LD, noindex decisions)
2. Stated SEO / indexability policy docs (e.g. docs/plans/indexability-policy.md)
   — if code diverges, the Finding is policy drift / incorrect indexing behavior,
   not “docs are wrong” as DOC-primary
3. Representative live public URLs (when safely fetchable) confirming title,
   robots, canonical, sitemap membership
4. Search Console / crawl-stats anecdotes without repo evidence (weak — prefer
   report-only unless corroborated)
5. Generic industry SEO checklists with no EventPixels path

Never invent composite SEO scores or letter grades — Severity/Effort only.
Never treat “missing popular technique” alone as a Finding.
Never claim a page is “SEO-ready” if indexability policy and sitemap disagree.

DOMAIN BOUNDARIES (stay in SEO)
OWNED by SEO (SEO):
- Indexability — which public URLs should be indexed vs noindex; consistency of
  robots metadata with product/public-value rules (IR1 / indexability helpers)
- Crawlability — robots.txt allow/deny, crawl traps (infinite params/filters),
  soft-404 vs hard not-found for crawlers
- Canonical URLs — correct self-canonicals; cross-duplicate consolidation;
  query-param / filter URL canonical policy
- Metadata — title/description (and robots) accuracy and uniqueness where
  conflicts or blanks create real discoverability harm
- Structured data / JSON-LD — validity and honesty of Event/Organization/
  Breadcrumb (etc.) graphs relative to visible page content; escape/safety as
  SEO correctness (XSS sinks may also be SEC — one root cause / one ID)
- Sitemaps — membership ⇔ indexable pages; freshness; broken/orphan entries;
  coverage gaps for important public entities
- Robots rules — robots.ts / headers vs intended public surface
- Internal linking — crawl paths to important public entities (as discoverability,
  not IA-as-product)
- Duplicate content — multiple public URLs for the same entity without
  canonical/redirect consolidation
- Redirects — chains, loops, soft redirects, open-redirect is SEC; SEO owns
  ranking-signal and crawl continuity of intentional redirects (e.g. /companies
  → /sponsors)
- URL stability — slug/path churn that orphans indexed URLs without redirects
- Page discoverability — indexable pages unreachable from sitemap + internal
  links; stubs framed as live public SEO landing pages
- Technical SEO — HTML link tags, h1/title alignment when evidenced as harmful,
  pagination/param indexation policy

NOT owned — reference existing Findings; do not duplicate:
- Product (PROD): whether a product surface should exist or how workflows cohere
  (SEO may note a stub URL that is indexable — if the root is “product stub with
  live framing,” cite PROD-002 style Findings when already tracked)
- UX (UX): interaction friction, visual polish, usability without crawl/index root
- Performance (PERF): latency/cost of SSR/sitemap generation under normal load
- Scalability (SCALE): sitemap/build ceilings at 10×–100× volume
- Architecture (ARC): module boundaries; force-dynamic as structural rendering
  model (ARC-004) — SEO may observe crawl/cache implications; do not clone
- Security (SEC): open redirects, XSS in JSON-LD sinks, secrets
- Data Quality (DQ): wrong city/name/domain values (SEO may note thin/wrong
  metadata caused by bad data — prefer DQ if truth of stored values is the root)
- Documentation (DOC): docs corpus writing quality; SEO policy docs as intent
  evidence only
- Roadmap (ROAD): prioritization / sequencing
- Code Hygiene (HYG): unused code, clutter
- Database (DB): schema/index modeling
- Dependency Vulnerability Monitoring (DEP): advisories

Exception for overlap:
You may OBSERVE that force-dynamic SSR, missing product modules, or bad catalog
data harm SEO, but if audit-catalog assigns primary ownership elsewhere for that
root cause — or an existing Finding ID already tracks it — REFERENCE that ID.
Mint an SEO Finding only when the distinct problem is crawl/index/canonical/
metadata/sitemap/robots/discoverability correctness — and it is untracked.

EVENTPIXELS SEO SURFACES (inspect these; adapt depth to evidence)
Policy & indexability:
- src/lib/seo/indexability.ts (+ tests) and docs/plans/indexability-policy.md
- robotsForIndexability / noindex for filtered collection URLs
- Series / edition / company / topic indexability gates
Metadata & structured data:
- generateMetadata on marketing routes (events, series, sponsors/companies,
  research hubs, cities)
- src/lib/seo/*Metadata.ts, eventJsonLd, organizationJsonLd, breadcrumbListJsonLd
- src/components/seo/JsonLd.tsx (serialization/escape)
Sitemaps & robots:
- src/app/sitemap.ts, src/lib/seo/sitemapEntries.ts
- src/app/robots.ts
URL & redirects:
- next.config redirects (e.g. /companies → /sponsors)
- Public slug routes under src/app/(marketing)/**
- resolveSeriesPublicAccess / not-found vs noindex behavior
Internal discoverability:
- Nav/footer links to primary public entities
- Research / topic×region hub pages
- Public stubs (e.g. /exhibitors) — indexability vs product framing (cross-ref PROD)

STEP 0 — LOAD GOVERNING CONTEXT (before anything else)
Read and follow in full:
- docs/health/README.md              (Framework v1.2; Quarterly cadence)
- docs/health/audit-catalog.md       (ownership; SEO vs PERF/PROD/ARC/…)
- docs/health/findings-register.md   (ALL prefixes — especially SEO/PROD/ARC/PERF)
- docs/health/_templates/report-template.md
- This prompt (canonical SEO domain module)
- The latest SEO report in TARGET_FOLDER, if any
Also read for SEO context (not as other audits):
- docs/plans/indexability-policy.md (or equivalent) when present
- docs/project-state.md
- Key files under src/lib/seo/, src/app/sitemap.ts, src/app/robots.ts,
  representative (marketing) generateMetadata modules
README = process authority; audit-catalog = ownership authority.

STEP 0b — DETERMINE MODE AUTOMATICALLY
Check TARGET_FOLDER for a prior SEO report:
- No prior report => BASELINE: Baseline = true; no "Since last cycle"; first SEO
  ids (SEO-001...). Skip STEP 1. Prefer few high-value Findings; do not file
  checklist gaps without EventPixels harm evidence.
- Prior report    => RECURRING: Baseline = false; reconcile SEO Findings first;
  include "Since last cycle". Do not restate full bodies of existing SEO Findings —
  record delta / new evidence only.
Never hard-code Baseline; derive it here.

STEP 1 — RECONCILE EXISTING SEO FINDINGS (RECURRING only)
For every SEO Finding in the register, assign:
- Open | In Progress (needs link) | Deferred (needs reason) |
  Resolved (needs concrete closing link: merged PR / commit / verified
  crawler-facing fix that closed the gap)
No closing link => not Resolved. Do not invent new Findings until reconciliation
ends.

STEP 1b — CROSS-AUDIT OWNERSHIP CHECK
Before creating ANY new Finding:
- Confirm SEO is the PRIMARY OWNER (audit-catalog.md §3) for the topic.
- Search ALL prefixes: DEP, ARC, PROD, DQ, DB, SEC, PERF, HYG, ROAD, SCALE, SEO,
  UX, DOC.
- Same root cause already tracked => REFERENCE that ID; do not create an SEO
  duplicate.
- Only mint a new SEO Finding when the root cause is untracked and SEO owns it.
- Especially watch EventPixels overlaps:
  - Public force-dynamic / no ISR => ARC-004 (PERF/SCALE may observe; SEO notes
    crawl efficiency only as Observation unless a distinct indexation defect)
  - Public /exhibitors stub with live framing => often PROD-002 (SEO only if
    distinct indexability/discoverability residual untracked)
  - Wrong catalog fields in titles => DQ if data truth is the root; SEO if
    metadata generation ignores available correct fields
  - JSON-LD XSS / unsafe HTML => SEC if exploitability; SEO if structured-data
    correctness — prefer one ID
  - Sitemap generation cost at volume => SCALE/PERF; SEO owns membership correctness
  - Open redirect => SEC (safeRedirect); SEO owns intentional SEO redirects only

STEP 2 — MAP THE PUBLIC SEO SURFACE FIRST
Before hunting issues:
1. List primary public entity types (events/editions, series, sponsors/companies,
   research hubs, cities, marketing home).
2. Restate indexability policy source of truth and how sitemap membership is
   supposed to align.
3. Note redirect map affecting public URLs.
4. Record planned scope and exclusions (no Search Console API, sample URLs only).
5. Prefer repository + rendered metadata evidence over checklist scorecards.

STEP 2b — RUN THE SEO DOMAIN REVIEW
Inspect robots, sitemap builders, indexability helpers, generateMetadata,
JSON-LD builders, and representative public routes. Optionally fetch a small set
of public URLs for confirmation. Cite paths. Do not change SEO config.

Cover, where applicable:

1) Indexability policy
   - Are noindex / index decisions consistent across metadata, sitemap, and
     route availability?
   - Do filtered/query collection URLs correctly noindex?

2) Crawlability & robots
   - robots.ts allows intended public trees; blocks only what should be blocked
   - Param/filter crawl traps

3) Canonical URLs
   - Self-canonical present and correct on key templates
   - /companies vs /sponsors and other alias paths consolidated

4) Metadata quality (harm-based)
   - Missing/duplicated/conflicting titles or descriptions on important templates
   - Metadata that contradicts visible H1 / entity identity when harmful

5) Structured data
   - Event / Organization / Breadcrumb graphs match visible content
   - Invalid or empty required fields that could trigger rich-result rejection
   - serializeJsonLd escape still correct (note SEC if XSS residual)

6) Sitemaps
   - Inclusion matches indexable set (IR1)
   - Orphans: in sitemap but noindex/not found; indexable but absent from sitemap
     and poorly linked
   - Broken lastmod / empty sitemap risk

7) Redirects & URL stability
   - Permanent redirects for renamed public paths
   - Chains/loops on public marketing URLs
   - Soft-404 patterns that keep thin pages indexable

8) Internal linking & discoverability
   - Important indexable entities reachable without knowing the URL
   - Stub routes that compete with real entities in the index

Evidence expected: file/route paths, policy citations, example URLs/slugs,
sitemap vs indexability mismatches, rendered robots/canonical/title samples.
Record limitations (no GSC access, sample size, CF blocking).

STEP 3 — CLASSIFY WHAT YOU SEE
Route every observation into exactly one bucket:
A. FINDING — passes MEMORY-VALUE TEST and EVIDENCE BAR: real SEO problem or
   meaningful EventPixels risk; Severity/Effort are descriptive only.
B. REPORT-ONLY OBSERVATION — real note, checklist gap without proven harm, or
   cite of another prefix’s Finding.
C. STRENGTH — sound indexability/sitemap alignment, good JSON-LD hygiene, etc.
D. DELIBERATE TRADE-OFF — accepted noindex or thin page with clear product intent.
E. ALREADY RESOLVED — via STEP 1 only.
When in doubt, under-track (prefer report-only). Prefer few high-value Findings.

Create an SEO Finding ONLY when ALL are true:
- Concrete crawler-facing evidence in EventPixels (code and/or rendered output)
- Meaningful harm or risk to indexation, crawl efficiency, ranking signals, or
  discoverability of important public entities
- Recommended action is reasonably specific (align sitemap with indexability;
  fix canonical; noindex filtered URLs; correct JSON-LD type/fields; add redirect
  for renamed slug — without implementing it here)
- Root cause is primarily SEO (crawl/index/canonical/metadata/sitemap/robots/
  discoverability), not solely product gap, UX friction, latency, or structure
  already tracked elsewhere
- The same root cause is NOT already tracked under another prefix
- Absence of a popular technique alone is NOT sufficient

Do NOT create Findings for:
- “No hreflang / no image sitemap / no FAQ schema” without EventPixels harm
- Keyword or copywriting taste without a technical/discoverability defect
- Re-filing ARC-004 / PROD-002 / etc. as new SEO IDs
- Measured SSR latency alone (PERF) or future sitemap volume alone (SCALE)
- Docs writing quality (DOC)
- Authz/secrets (SEC) unless the distinct issue is SEO-facing robots/canonical

STEP 4 — FINDING IDENTITY AND DE-DUPLICATION
- Reuse an existing ID (any prefix) when ROOT CAUSE matches.
- One root cause / one SEO defect with many URLs = ONE Finding (list examples).
- Test: "If we fixed the other Finding, would this disappear?" Yes => same Finding.
- New SEO ids = next monotonic SEO-NNN; never reuse/renumber retired ids.
- Reopen previously resolved root causes under the ORIGINAL id.
- Group closely related evidence when one remediation program applies.

For each NEW Finding draft (and later in the report), include:
- ID (or "(new)" until allocated)
- Title
- Severity (Critical|High|Medium|Low) and Effort (Small|Medium|Large)
- Status (Open|In Progress|Deferred)
- Evidence (paths, policy refs, example URLs, sitemap/indexability mismatch)
- Why it matters (indexation / crawl / ranking-signal / discoverability risk)
- Recommended action (SEO remediation — read-only in this review)
- Scope / affected templates and entity types
- Validation / acceptance criteria (e.g. “every sitemap URL is indexable; every
  indexable company/edition has sitemap entry; filtered /events?… is noindex;
  canonical matches preferred host+path”)
- Uncertainty / false-positive risk
- Links (plan/ADR/PR/commit when relevant)

Severity guidance (descriptive; still not an inclusion test):
- Critical — systemic incorrect indexing or canonical failure across core public
  templates (mass noindex of valuable pages, or mass index of junk/duplicates)
- High — clear sitemap/indexability drift, broken canonicals on primary entities,
  or major redirect/discoverability defects
- Medium — bounded template issues with evidenced harm
- Low — limited residual risk worth tracking before it spreads

STEP 5 — AUDIT GATE (mandatory)
Present in chat:
1. Mode (Baseline vs Recurring) and cycle (Quarterly cadence)
2. Surfaces / templates in scope and exclusions; methods used
3. Draft Finding list (full fields above) — or "none"
4. Cross-audit references (existing non-SEO ids cited; do not clone)
5. Report-only observations, strengths, trade-offs (include rejected checklist items)
6. Limitations and false-positive risks
7. Explicit statement: READ-ONLY so far; no report/register written; no SEO fixes

STOP. Do not write REPORT_FILE or edit findings-register.md until the human explicitly
asks to publish / write the report and update the register.

STEP 6 — WRITE OR UPDATE THE CYCLE REPORT (only after explicit request)
Write docs/health/seo/{{CYCLE}}-seo.md from
docs/health/_templates/report-template.md. If this is a new Cycle token, create the report; if remediating an existing cycle, update that cycle's report in place (never mint a companion closeout).
- Header: Review type = SEO Audit; Cadence = Quarterly; Cycle = {{CYCLE}};
  Date = {{REVIEW_DATE}}; Reviewer = {{REVIEWER}}; Baseline = (from STEP 0b);
  Status = Cycle report — remediations update this file; one cycle = one report.
- Executive summary: 5–10 lines; methods briefly; net change; no invented scores.
- Include templates/surfaces inspected and exclusions.
- "Since last cycle" (RECURRING only): delta by ID.
- Findings: FULL write-up for NEW SEO Findings (all fields from STEP 4); existing
  SEO Findings by ID + delta only — never restate full bodies; never create companion closeout reports.
- Observations: non-Finding notes, strengths, trade-offs, limitations, cross-audit
  refs; explicitly list major checklist items considered and rejected for lack of
  EventPixels harm evidence when useful.
- Change log: publication entry dated {{REVIEW_DATE}}.
- If remediating Findings for this cycle (not a new Cycle): update Finding Status to Resolved; add **Resolution History** with acceptance criteria and closing evidence; refresh the Executive summary. Never create a companion closeout report.

STEP 7 — UPDATE THE LIVE FINDINGS REGISTER (only after explicit request)
Edit docs/health/findings-register.md for outstanding work only:
- Add new SEO Findings (Open; next ids) that passed the memory-value test and
  evidence bar.
- Update existing SEO statuses; refresh Last updated to {{CYCLE}}.
- REMOVE Resolved rows (closing link required in the report); maintain Retired IDs.
- Do not duplicate other prefixes' Findings.
- Preserve table formatting; add a Change log entry dated {{REVIEW_DATE}}.

STEP 8 — VALIDATE, THEN STOP (do NOT commit)
Non-mutating checks: report naming/path; Baseline flag correct; links; register only
Open/In Progress/Deferred; no duplicate/renumbered ids; no cross-prefix duplicates;
Resolved removed with closing links; terminology uses SEO / seo; Cadence =
Quarterly; prior-cycle reports not rewritten for terminology; no application code mutated; unrelated
files untouched. Run `git diff --check` on touched docs if any, and `git status`
(read-only).

Produce a final summary:
1. Mode + cycle
2. Existing SEO Findings reconciled (id -> status)
3. New SEO Findings (id + title + why evidence bar + memory-value passed)
4. Findings resolved and removed (id + closing link)
5. Cross-audit references
6. Report-only observations (brief; include rejected checklist items if notable)
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
5. Do not treat this prompt as permission to change metadata, sitemaps, or robots — Findings must be evidence-based with read-only analysis.
6. Prefer a small number of high-value Findings. Absence of a popular SEO technique is not enough without EventPixels harm evidence.
7. Before opening any new SEO Finding, search the register for the same root cause under SEO/PROD/ARC/PERF/SCALE/SEC/DQ. Reference existing IDs instead of cloning.
8. Cadence is **Quarterly** per Framework v1.1.
9. Do not create the SEO report unless publication is explicitly requested.

## Related governance

| Document | Role |
|---|---|
| [`../README.md`](../README.md) | Framework v1.2 operating rules (Quarterly SEO) |
| [`../audit-catalog.md`](../audit-catalog.md) | Ownership authority (SEO vs PROD / PERF / ARC / …) |
| [`../findings-register.md`](../findings-register.md) | Live work queue |
| [`../_templates/report-template.md`](../_templates/report-template.md) | Shared report template |
| [`../../project-state.md`](../../project-state.md) | Current system / domain model summary |
| [`../../plans/indexability-policy.md`](../../plans/indexability-policy.md) | Indexability / IR1 policy (when present) |
