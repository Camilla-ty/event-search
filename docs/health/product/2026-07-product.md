# Product Audit — 2026-07

**Review type:** Product Audit
**Cadence:** Monthly
**Cycle:** 2026-07
**Date:** 2026-07-23
**Reviewer:** Product (Automated)
**Baseline:** true
**Status:** Immutable historical record — do not edit after publication.

> Baseline Product Health Check under Framework v1.1. No prior `product/` report existed. New Findings are `PROD-001`…`PROD-003`. Cross-audit topics already tracked under `ARC` / `HYG` / `SEC` are referenced, not duplicated. Prefer few high-value Findings over speculative feature requests.

---

## Executive summary

First Product cycle for EventPixels. Scope: product quality for admin operators and public browse audiences — completeness, workflows, consistency, discoverability, IA, polish, and vision alignment. Excluded: Architecture, Database, Security, Performance, SEO, Documentation corpus quality, Accessibility programs, and code hygiene (except as cross-refs).

Methods: mapped `src/app` / admin navigation (`navigation.ts`, `AdminShell`); compared shipped surfaces to `docs/terminology.md` and approved `docs/admin-information-architecture.md`; inspected dashboard, Events hub, companies/merge, sponsor-import vs partner-alumni import entry points, and public `/exhibitors`.

Three Findings: missing admin global search (promised in v1 IA), public Exhibitors stub presented as a product module, and Partner Alumni imports omitted from the Dashboard resume widget. Strengths: admin Event Brand / Event terminology largely aligns with `docs/terminology.md`; company merge is shipped and linked from Companies.

---

## Findings

### PROD-001 — Admin global search promised in v1 IA but not present

- **Why it matters:** Approved admin IA treats cross-entity search as a core v1 operating principle (“Global discoverability”) and lists Admin search as a v1 capability. Without it, operators cannot find events, brands, companies, or imports from a single entry point and must hunt through section lists — slowing day-to-day ops the product was designed around.
- **Severity:** High  ·  **Effort:** Medium  (descriptive only)
- **Evidence:**
  - `docs/admin-information-architecture.md` §1 principle “Global discoverability”; §2.5 “Admin search” in global chrome; §3.7 screen X-01 `/admin/search?q=`; §6 full search requirements (⌘K, entity groups); §9.2 capability matrix marks **Admin search** ✓ for v1.
  - `src/features/admin/components/AdminShell.tsx` — sidebar + main only; **no** search control.
  - No `src/app/admin/search/` route; repo search for `admin/search` finds IA docs + company *picker* helpers, not a global admin search UI.
  - Public `GlobalSearchBar` lives under `BrowseMarketingChrome` (marketing layouts only), not admin mode (`LayoutShell` admin branch → `AdminShell`).
- **Status:** Open
- **Recommended action:** Ship the v1 admin search chrome + results experience described in IA §6 (or explicitly revise the approved IA to defer search to v1.1 and remove it from the v1 capability matrix — product decision, not silent omission).
- **Scope / affected surfaces:** Admin chrome (`AdminShell`), new `/admin/search` (or equivalent), Dashboard / Events / Companies / Sponsor imports discoverability
- **Validation / acceptance criteria:** From any `/admin/*` page, an operator can search and jump to an Event, Event Brand, company, or sponsor-import batch per IA §6; or IA/docs and in-product chrome consistently state search is out of scope for current v1.
- **Uncertainty / false-positive risk:** Low for “not shipped.” Partial building blocks exist (`companyAdminSearch` for merge pickers) but do not satisfy the global product capability.
- **Links:** Intent source: [Admin IA §6](../../admin-information-architecture.md)

### PROD-002 — Public `/exhibitors` module is a roadmap stub with live product framing

- **Why it matters:** A public route presents Exhibitors as a searchable intelligence module in page metadata while the body admits the capability is still on the roadmap. That mismatches product promise vs reality and dilutes trust next to working Events/Sponsors surfaces.
- **Severity:** Medium  ·  **Effort:** Small  (descriptive only)
- **Evidence:**
  - `src/app/(marketing)/exhibitors/page.tsx` — `createPageMetadata` title/description: “Search and analyze exhibitor participation across events…”; body: “Structured company and booth data will appear here as coverage expands” / “on the roadmap for this module.”
  - Not linked from `primaryNavItems` (`src/lib/constants/navigation.ts`), but the route is a first-class App Router page (reachable/bookmarkable).
  - No other `exhibitors` product entry points under `src/components/layout` or nav constants.
- **Status:** Open
- **Recommended action:** Until a real exhibitor directory ships, remove or clearly gate the public module (e.g. unpublish route, redirect to Sponsors/Events, or replace metadata/copy so it does not claim search/analyze capability). Do not invent a full exhibitor product in this Finding — only stop over-promising.
- **Scope / affected surfaces:** `/exhibitors`, related metadata/sitemap inclusion if any
- **Validation / acceptance criteria:** Public visitors no longer see a live Exhibitors product claim without working directory behavior; or a minimal real directory is shipped that matches the claim.
- **Uncertainty / false-positive risk:** Low. Intentional “coming soon” marketing pages can be a deliberate trade-off — if so, document and tone metadata to match; current metadata over-claims.
- **Links:** —

### PROD-003 — Partner Alumni imports missing from Dashboard resume surface

- **Why it matters:** Admin IA’s “Resume over restart” model depends on in-progress imports surfacing on the Dashboard. Partner Alumni import is a full parallel operator workflow, but the Dashboard widget only lists sponsor imports — so PA work can stall without the same resume cue the product already provides for sponsors.
- **Severity:** Medium  ·  **Effort:** Medium  (descriptive only)
- **Evidence:**
  - `docs/admin-information-architecture.md` §1: “In-progress imports surface everywhere (dashboard, edition, imports list).”
  - `src/app/admin/page.tsx` loads only `getDashboardImportsInProgress()` → `DashboardImportsWidget` (sponsor imports).
  - `DashboardImportsWidget` copy/links are sponsor-import specific (`/admin/sponsor-imports/new`, sponsor batch resume hrefs).
  - Partner Alumni import UI/routes exist under `/admin/events/series/[id]/partner-alumni/versions/.../import/...` with its own resume helpers (`partner-alumni-import/client/resumeStep.ts`) but are not wired into the Dashboard.
- **Status:** Open
- **Recommended action:** Extend the Dashboard resume surface to include in-progress Partner Alumni import batches (with correct deep links), or explicitly narrow the IA principle to “sponsor imports only” if PA resume-on-dashboard is intentionally out of scope.
- **Scope / affected surfaces:** `/admin` Dashboard; Partner Alumni import batches
- **Validation / acceptance criteria:** An in-progress PA import appears on the Dashboard with a working resume path; or product docs/IA and Dashboard copy both state that only sponsor imports are resumed there.
- **Uncertainty / false-positive risk:** Medium — PA is brand-scoped and may have been deliberately left off the global Dashboard. Still a product gap relative to the written resume principle and the existence of a second import system (`ARC-011` covers structural duplication; this Finding is the operator resume/discoverability gap only).
- **Links:** Related architecture context (not duplicated): `ARC-011`

---

## Cross-audit references (existing Findings — not duplicated)

| Topic observed | Existing ID | Why not a new PROD Finding |
|---|---|---|
| Dual sponsor / partner-alumni import subsystems (structure) | `ARC-011` | Architecture owns subsystem duplication; PROD-003 only covers Dashboard resume product gap |
| Unused `EditionImportsStub` after live imports panel | `HYG-002` | Code Hygiene owns dead stub file; edition Imports tab uses live `EditionImportsPanel` |
| Thin e2e coverage | `ARC-020` | Testing posture, not product capability |
| Security / upload / SSRF | `SEC-002`, `SEC-003` | Security domain |

---

## Observations (not tracked)

**Audiences / surfaces inspected**
- Admin: Dashboard, Events overview/sub-nav, Event Brands, Events, sponsor imports, companies (+ merge entry), venues; series detail Partner Alumni panel presence.
- Public: primary nav (Discover / Events / Sponsors); `/exhibitors` stub.
- Intent docs: `docs/terminology.md`, `docs/admin-information-architecture.md`.

**Strengths**
- Admin navigation and Dashboard quick actions use **Event Brand** / **Event** aligned with `docs/terminology.md`.
- Company merge is shipped (`/admin/companies/merge`) and linked from Companies (“Merge duplicates”) and company detail actions — despite IA §3.5 still labeling merge as a “v1.1 placeholder” (stale **documentation**, not a missing product capability).
- Sponsor-import resume on Dashboard matches the resume principle for that workflow.
- Legacy `/admin/events/new` cleanly redirects to `/admin/events/editions/new` (no competing create UX).

**Deliberate / acceptable**
- Partner Alumni management living on Event Brand detail (not top-level nav) is a coherent scoped IA choice.
- Public marketing search (`GlobalSearchBar`) for browse modes is separate from admin search.

**Follow-ups (not Findings)**
- Refresh Admin IA labels (Series/Edition → Event Brand/Event; merge v1 status) under Documentation Audit when run.
- Browser/role-gated walkthrough of every import stepper screen was not executed in this run — limitation noted.

**Limitations**
- Read-only static inspection of routes/components/docs; no live authenticated click-through of every admin stepper.
- Did not re-audit full public SEO/metadata corpus (SEO Audit ownership).

---

## Change log

| Date | Note |
|------|------|
| 2026-07-23 | Baseline Product Audit published. Added `PROD-001`–`PROD-003`. Cross-referenced `ARC-011`, `HYG-002`, `SEC-002`/`SEC-003`. No product changes made during the review. |
