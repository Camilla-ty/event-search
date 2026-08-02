# Documentation Audit — 2026-07

**Review type:** Documentation Audit
**Cadence:** Quarterly
**Cycle:** 2026-07
**Date:** 2026-07-31
**Reviewer:** Documentation (Automated)
**Baseline:** true
**Status:** Cycle report — remediations update this file; one cycle = one report (do not create separate closeout reports).

> Baseline Documentation Health Check under Framework v1.1 (report lifecycle clarified under Framework v1.2). No prior Documentation report existed, so this run is Baseline. Cadence is **Quarterly** per `docs/health/README.md` / `audit-catalog.md` (requested cycle token `2026-07` retained). New Findings: `DOC-001`…`DOC-003`. Product, SEO, and Roadmap ownership for overlapping topics are cross-referenced, not duplicated. All three Findings were later remediated and resolved in this same cycle report (see **Resolution History**).

---

## Executive summary

First Documentation cycle for EventPixels. Methods: read-only inspection of `docs/README.md`, `docs/project-state.md`, admin IA, SEO/indexability plan docs, ADR-005/phase scope status lines, and spot checks against shipped routes (`src/lib/seo/indexability.ts`, sitemap, marketing research hubs, admin edition tabs, company merge). Prefer accuracy/findability Findings over editorial expansion.

**At publication (2026-07-31):** **3 new** Findings (`DOC-001`…`DOC-003`), all Open — SEO plan corpus claimed IR1 “not implemented” while gates shipped; `docs/README.md` contradicted shipped public tabs and Partner Alumni progress; admin IA claimed “reflects shipped” but omitted Exhibitors and marked merge as a v1.1 placeholder.

**After remediation (2026-08-02):** All three Findings **Resolved**. Closing evidence in **Resolution History**. No Documentation Findings remain Open. Crawler residual for empty topic shells stays owned by `SEO-001`. Strengths noted at baseline (`project-state.md`, canonical roadmap index, ADR-005 phase scopes) still hold.

---

## Surfaces in scope

| Surface | Notes |
|---|---|
| Indexes | `docs/README.md`, `docs/implementation-roadmap.md`, `docs/project-state.md` |
| Standards / health | DoD, `docs/health/README.md`, audit-catalog, findings register |
| Admin IA | `docs/admin-information-architecture.md` |
| SEO / indexability plans | `indexability-policy.md`, `ir1-indexability-audit.md`, `seo-implementation-roadmap.md`, `seo-foundation.md` (spot) |
| ADR / phase | ADR-005 + `phase-event-brand-public-profile-scope.md` status framing via README |
| Code cross-check | `src/lib/seo/**`, `src/app/sitemap.ts`, research routes, `EditionDetailTabs`, merge UI |

**Exclusions:** Full line-by-line read of every phase/plan doc; grammar/style; inventing missing tutorials; rewriting the corpus in this review.

---

## Cross-audit references (existing Findings — not duplicated)

| ID | Topic | DOC note (observation only) |
|---|---|---|
| `PROD-001` | Admin global search promised in IA but not present | Capability gap — IA *promises* search correctly relative to approved IA; do not refile as DOC |
| `PROD-002` | Public `/exhibitors` stub | Product framing; Exhibitor Discovery out of scope already noted in README |
| `PROD-003` | PA missing from Dashboard resume | Product resume surface |
| `SEO-001` | Empty topic hubs indexable | Crawler behavior residual; this audit owned **stale “not implemented” status** on policy/plan docs (`DOC-001`, now resolved) |
| `ROAD-001` / `ROAD-002` | Retired roadmap Findings | Canonical index + historical v1 already established — cite as strength, not reopen |
| `UX-003` | Exhibitors vs sponsors reorder | Interaction Finding; UX cycle report may lag code after remediation — not a docs-corpus Finding this cycle |

---

## Findings

### DOC-001 — SEO / indexability plan corpus still claims IR1 “not implemented” while gates ship

- **Why it matters:** Engineers reading the SEO plan stack are told indexability is documentation-only / not implemented, and that research routes do not exist — while shared IR1 helpers, sitemap membership gates, topic×region research pages, and JSON-LD already ship. That false baseline causes wasted re-implementation work and conflicts with crawler-facing truth (`SEO-001` correctly left residual empty-topic behavior to SEO).
- **Severity:** High · **Effort:** Medium
- **Evidence (at discovery, 2026-07-31):**
  - `docs/plans/indexability-policy.md` — Status: “documentation only (not yet fully implemented)”; §3.5 IR1 deferral: “No dedicated public research routes exist in the app yet”
  - `docs/plans/ir1-indexability-audit.md` — “IR1 indexability is **not implemented**”; research page routes “Not shipped”
  - `docs/plans/seo-implementation-roadmap.md` — Status: “Roadmap only — no implementation”
  - `docs/plans/seo-foundation.md` — “Current state” still lists JSON-LD as not implemented (spot-check; contradicts shipped JSON-LD)
  - Code: `src/lib/seo/indexability.ts` (IR1 helpers); `src/app/sitemap.ts` + `sitemapEntries.ts`; research routes under `src/app/(marketing)/events/topics/...`; `JsonLd` + event/organization builders
  - Prior observation: SEO 2026-07 deferred policy-header drift to Documentation
- **Status:** Resolved (2026-08-02) — see Resolution History
- **Recommended action:** Refresh Status lines and IR1/research/JSON-LD “current state” claims to match shipped behavior; mark point-in-time audits (`ir1-indexability-audit.md`) as **historical** with date baseline; keep policy *rules* as living intent where still valid. Do not invent new SEO behavior under this Finding.
- **Scope:** `docs/plans/indexability-policy.md`, `ir1-indexability-audit.md`, `seo-implementation-roadmap.md`, `seo-foundation.md` (and related SEO plan Status headers as needed).
- **Validation / acceptance criteria:** Canonical policy Status no longer claims “not yet fully implemented” for shipped IR1 gates; research-route deferral removed or historically marked; engineers reading plans see alignment with `indexability.ts` / sitemap / research hubs; `SEO-001` remains the crawler residual if empty topics stay indexable.
- **Uncertainty / false-positive risk:** Low on status drift. Some IR items (e.g. empty-topic gate) remain incomplete — Status should say “partially implemented” or list residuals, not “not implemented.”
- **Related:** `SEO-001` (behavior); not a clone.

---

### DOC-002 — `docs/README.md` index contradicts shipped public tabs, Partner Alumni progress, and ADR-005 framing

- **Why it matters:** `docs/README.md` is the primary docs entry map. Contradictory “locked highlights” and stale “next step” lines send engineers to the wrong current world (wrong public tab set; Partner Alumni still “apply migration then PA2′”; ADR-005 blurb reads like nothing is implemented beside a phase row that says EB0–EB4 shipped).
- **Severity:** High · **Effort:** Small
- **Evidence (at discovery, 2026-07-31):**
  - Venue locked highlights: public edition tabs “**Overview / Sponsors / Venue** only” — while Organizer/Exhibitor sections in the same README (and `PublicEventEditionTabs`) include Organizers, Exhibitors, Partner Alumni when present
  - Partner Alumni section Status: “PA1′ migration authored” / Next step: apply `20260711120000_partner_alumni_v2_versions.sql` then PA2′ admin — contradicts `project-state.md` (v2 program/admin + batch import shipped) and README heading “PA5 complete”
  - ADR-005 README row emphasizes “Documentation only — no implementation authorized by the ADR alone” immediately above “EB0–EB4 in repo” — ADR body carefully separates policy from authorization, but the **index blurb** is easy to misread as “unimplemented”
- **Status:** Resolved (2026-08-02) — see Resolution History
- **Recommended action:** Reconcile Venue/Organizer/Exhibitor public-tab locked lines with shipped tab set; update Partner Alumni Status/Next step to match shipped v2 + import; clarify ADR-005 index wording (policy Accepted; implementation tracked in phase scope EB0–EB4 / not authorized by ADR text alone).
- **Scope:** `docs/README.md` (Venue, Organizer, Partner Alumni, ADR-005 index rows); cross-check against `project-state.md`.
- **Validation / acceptance criteria:** README locked highlights match public edition tabs; PA Status no longer instructs “apply PA1′ then PA2′” as the next step if already shipped; ADR-005 index cannot be read as “zero implementation” when EB0–EB4 are in repo.
- **Uncertainty / false-positive risk:** Low on tab/PA contradictions. ADR-005 wording is partially intentional — Finding targets discoverability of the index blurb, not rewriting the ADR decision record.
- **Related:** None existing under DOC; not `PROD-002`.

---

### DOC-003 — Admin IA claims “reflects shipped” but omits Exhibitors and marks merge as v1.1 placeholder

- **Why it matters:** `docs/admin-information-architecture.md` Status says it “reflects shipped v1 including Venues and Organizers,” yet edition tabs omit **Exhibitors** and company **Merge duplicates** remains labeled “v1.1 placeholder” while merge UI ships. Operators and engineers using IA as inventory truth will miss a primary edition tab and undervalue a shipped workflow.
- **Severity:** High · **Effort:** Medium
- **Evidence (at discovery, 2026-07-31):**
  - Status: “Approved — reflects shipped v1 including Venues and Organizers”; Last updated 2026-07-04
  - Edition contextual tabs listed as Profile / Live sponsors / Imports only (no Exhibitors) — tree and §2.3
  - Screen C-04 “Merge duplicates | v1.1 placeholder”
  - Code: `EditionDetailTabs.tsx` includes Exhibitors; `src/app/admin/companies/merge/` + merge wizard shipped (`project-state` / Product 2026-07 noted merge as shipped)
- **Status:** Resolved (2026-08-02) — see Resolution History
- **Recommended action:** Update IA inventory for Exhibitors tab (and exhibitor import entry under Exhibitors if still current); mark merge as shipped (remove v1.1 placeholder); refresh Status/last-updated. Keep Admin search as v1 capability gap under **`PROD-001`** (do not “fix” search by deleting the requirement without a product decision).
- **Scope:** `docs/admin-information-architecture.md` (tabs, C-04, related journeys/trees).
- **Validation / acceptance criteria:** IA edition tab set matches admin UI; merge is not labeled placeholder; Status remains true relative to Venues/Organizers/**Exhibitors**/merge; search residual still points at `PROD-001`.
- **Uncertainty / false-positive risk:** Low on Exhibitors/merge. Deliberate IA deferral of search stays Product-owned.
- **Related:** `PROD-001` (search); distinct root (stale “shipped” inventory).

---

## Resolution History

Remediation and verification for this cycle. Closing evidence was previously split across redundant companion files; it is consolidated here. One cycle = one report.

### 2026-08-02 — DOC-002 and DOC-003 resolved

Verified against acceptance criteria after remediation in the docs corpus. No application documentation re-edited during verification (remediation had already landed in `docs/README.md` and `docs/admin-information-architecture.md`).

#### DOC-002 — Resolved

- **Acceptance criteria:** README locked highlights match public edition tabs; PA Status no longer instructs “apply PA1′ then PA2′”; ADR-005 index cannot be read as “zero implementation” when EB0–EB4 are in repo.
- **Closing evidence (verified 2026-08-02):**
  - `docs/README.md` Venue locked highlights: public Event Detail includes **Venue** alongside Overview, Sponsors, Organizers; Exhibitors and Partner Alumni when non-empty — matches `PublicEventEditionTabs` (always Overview/Sponsors/Venue/Organizers; conditional Exhibitors / Partner Alumni).
  - Organizer locked highlights: same always-present set + conditional Exhibitors / Partner Alumni.
  - Partner Alumni **Status:** “**v2 shipped**” with batch import shipped; **Next step:** PA-IMP-5 (legacy drawer) + `PROD-003` — no “apply PA1′ migration then PA2′ admin.”
  - ADR-005 index: “**Accepted** architectural decision”; policy-only ADR clarified; phase row is “**Implementation tracker**” with “**Shipped:** EB0–EB4.”
- **Why criteria pass:** Index no longer contradicts shipped public tabs, PA progress, or ADR-005 implementation framing.

#### DOC-003 — Resolved

- **Acceptance criteria:** IA edition tab set matches admin UI; merge is not labeled placeholder; Status true relative to Venues/Organizers/**Exhibitors**/merge; search residual still points at `PROD-001`.
- **Closing evidence (verified 2026-08-02):**
  - `docs/admin-information-architecture.md` §2.3 tabs: Profile · Live sponsors · **Exhibitors** · Imports — matches `EditionDetailTabs.tsx`.
  - C-04 Merge companies → `/admin/companies/merge` (no “v1.1 placeholder”); hierarchy includes `/merge (C-04)`; §7.10 Exhibitors tab documented.
  - Status: “reflects shipped v1 including Venues, Organizers, Exhibitors, and company merge”; Last updated 2026-08-02.
  - Admin search retained in §2.5, X-01, and §9.2; history note cites `PROD-001` — not removed or reclassified.
- **Why criteria pass:** Admin IA inventory matches shipped edition tabs and merge; Product-owned search gap preserved.

**At this verification step:** `DOC-001` remained Open (SEO/indexability plan status drift — remediated next).

### 2026-08-02 — DOC-001 resolved

Verified against acceptance criteria after remediation of the SEO / indexability plan corpus. No application documentation modified during verification (remediation already landed under `docs/plans/`).

#### DOC-001 — Resolved

- **Acceptance criteria:** Canonical policy Status no longer claims “not yet fully implemented” for shipped IR1 gates; research-route deferral removed or historically marked; engineers reading plans see alignment with `indexability.ts` / sitemap / research hubs; `SEO-001` remains the crawler residual if empty topics stay indexable. Status wording for incomplete IR items should be “partially implemented” (or list residuals), not “not implemented.”
- **Closing evidence (verified 2026-08-02):**
  - `docs/plans/indexability-policy.md` — Status: “**partially implemented** (core IR1 gates ship in code)”; Implementation blurb cites `src/lib/seo/indexability.ts`, sitemap builders, research hub gates; §3.5 documents **shipped** topic×region routes; residual empty `/topics/{slug}` shells tracked as `SEO-001`.
  - `docs/plans/ir1-indexability-audit.md` — Status: **historical** point-in-time (2026-07-17), superseded for implementation status; supersession banner; body “not implemented” claims retained only as dated historical text.
  - `docs/plans/seo-implementation-roadmap.md` — Status: **Partially implemented**; IR1/IR4/IR5 implementation notes match shipped gates, research hubs, and core JSON-LD; residuals list `SEO-001` + optional admin robots Disallow.
  - `docs/plans/seo-foundation.md` — Current state: IR1 **Implemented** (with `SEO-001` residual); research hubs **Shipped**; JSON-LD **Partially implemented** (Event, BreadcrumbList, Organization) — no longer “Not implemented.”
- **Why criteria pass:** Living SEO plan Status and current-state claims align with shipped IR1 / research / JSON-LD; historical audit preserved without pretending to be current; empty-topic crawler gap remains `SEO-001`, not re-owned as Documentation drift.

**Cycle outcome:** No open DOC Findings remain.

---

## Observations (not tracked)

### Strengths

- `docs/project-state.md` is a strong living snapshot (exhibitors E1–E6, PA v2, research hubs, structured data).
- Canonical roadmap index + historical `implementation-roadmap-v1.md` (`ROAD-002` closed) is clear and findable from `docs/README.md`.
- `phase-event-brand-public-profile-scope.md` tracks EB0–EB4 vs EB5–EB6 accurately when read directly.
- Health Check governance docs (`health/README`, audit-catalog, prompts) are discoverable from the docs index.
- Relative links sampled from `docs/README.md` resolve (no broken-link Finding this cycle).

### Report-only notes

- **`seo-gap-audit.md` / point-in-time audits** expected to freeze a date — prefer historical marking over deletion; substantive status drift was covered by `DOC-001` (now resolved).
- **Admin search in IA** remains an accurate *product* promise gap (`PROD-001`), not docs denying a shipped feature.
- **UX-003** register may lag exhibitor draft-save remediation; UX cycle report is updated only under UX ownership rules.
- **Rejected without Finding:** grammar/style, “add more diagrams,” expanding every phase doc, inventing a full wiki.

### Limitations

- Did not read every file under `docs/plans/` and `docs/phase-*` end-to-end.
- No full link crawler beyond README spot-check.
- Cadence Quarterly; cycle token `2026-07` as requested.

---

## Change log

| Date | Note |
|------|------|
| 2026-07-31 | Baseline Documentation Audit published. Added `DOC-001`…`DOC-003` (all `Open`). Cross-referenced `PROD-001`/`002`/`003`, `SEO-001`, retired `ROAD-001`/`002`, `UX-003`. Cadence Quarterly; cycle token `2026-07` as requested. |
| 2026-08-02 | Resolved `DOC-002` and `DOC-003`. Closing evidence recorded in Resolution History. `DOC-001` remained Open at this step. |
| 2026-08-02 | Resolved `DOC-001`. Closing evidence recorded in Resolution History. No open DOC Findings remain. |
| 2026-08-02 | Consolidated redundant companion closeout files into this cycle report (Framework v1.2: one cycle = one report). Deleted `documentation/2026-08-documentation.md` and `documentation/2026-09-documentation.md`. |
