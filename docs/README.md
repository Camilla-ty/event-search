# EventPixels — Project documentation

## Product language

| Document | Description |
|----------|-------------|
| [Terminology](./terminology.md) | Source of truth for internal model names and user-facing **Event Brand** / **Event** terminology |

## Engineering standards

| Document | Description |
|----------|-------------|
| [Definition of Done](./standards/definition-of-done.md) | **Canonical** minimum evidence before work may be described as complete or prepared for commit |

## Engineering Health Check

| Document | Description |
|----------|-------------|
| [Engineering Health Check](./health/README.md) | Recurring monthly/quarterly engineering reviews; operating rules, cadence, and finding lifecycle |
| [Audit Catalog](./health/audit-catalog.md) | Governance: responsibility boundaries and one-primary-owner rule for every audit type |
| [Findings Register](./health/findings-register.md) | **Live work queue** — outstanding Findings only (`Open` / `In Progress` / `Deferred`) |

Immutable review reports live under `docs/health/<review-type>/`; the baseline is [Architecture Audit 2026-07](./health/architecture/2026-07-architecture.md).

## Architecture

| Document | Description |
|----------|-------------|
| [Navigation & data fetching](./architecture/navigation-and-data-fetching.md) | Category A–D policy, shared `src/lib/navigation` utilities, PR checklist, phased rollout |
| [Side-effect ownership](./architecture/side-effect-ownership.md) | One event / one owner policy, auth refresh provider, audit checklist |
| [ADR-004 — Event Series ↔ Company same-brand link](./adr/ADR-004-event-series-company-same-brand-link.md) | **Accepted** — optional 1:1 `event_series.company_profile_id`; roles stay Company-only; supersedes polymorphic sponsors. **Implemented through SB3** (SB4 manual review pending). Public dual-destination V1 for Event Brand Companies **amended by ADR-005**. |
| [ADR-005 — Event Brand Public Profile Policy](./adr/ADR-005-event-brand-public-profile-policy.md) | **Accepted** architectural decision (2026-08-01) — Series hub is public Event Brand identity; Participated Events for brand activity elsewhere; Event Brand Company public profiles retire over time under per-Company approval; normal Sponsor Profiles unchanged. The ADR records policy only; it does **not** by itself authorize schema/route work. |
| [Phase — Event Brand Public Profile (ADR-005)](./phase-event-brand-public-profile-scope.md) | **Implementation tracker** for ADR-005 (EB0–EB6). **Shipped:** EB0–EB4 (SFF approved, soft SEO, temporary Series redirect, public role hrefs). **Not started:** EB5–EB6 |
| [ADR-005 Event Brand Public Profile — Implementation Audit](./audits/adr-005-event-brand-public-profile-implementation-audit.md) | Point-in-time planning audit (2026-08-01) — Company public URL producers/consumers, retarget map, EB0–EB6 phase order; historical inventory baseline for the phase scope |
| [Phase — Event Series ↔ Company same-brand scope](./phase-event-series-company-same-brand-scope.md) | Thin V1 implementation scope (SB0–SB4) for ADR-004 — **SB0–SB3 complete; SB4 pending** |
| [Linked Event Series & Company Profiles — Architecture Audit](./audits/event-series-company-same-brand-architecture-audit.md) | Documentation-only audit (Phase 1 data/admin + Phase 2 public UI/search/SEO/permissions/V1 scope); 2026-07-31 |
| [Participated Events Tab Placement Audit](./audits/participated-events-tab-placement-audit.md) | Documentation-only (2026-08-01) — Series hub vs Edition tab placement for ADR-004 Participated Events prototype; **no implementation authorized** |
| [Same-Brand Company Public Redirect Audit](./audits/same-brand-company-public-redirect-audit.md) | Documentation-only (2026-08-01) — whether linked Event Companies should redirect/hide `/sponsors/...` toward Series Participated Events; **no implementation authorized** |
| [Same-brand Admin Section Placement Audit](./audits/same-brand-admin-section-placement-audit.md) | Placement/prominence audit (2026-08-01); **Option B implemented** (collapse-by-default on Series Admin) |
| [Series Hub vs Edition Tabs Reuse Audit](./audits/series-hub-vs-edition-tabs-reuse-audit.md) | Documentation-only (2026-08-01) — whether Series hub should reuse public Event Edition tab component/style; **no implementation authorized** |

## Implementation

| Document | Description |
|----------|-------------|
| [Implementation Roadmap](./implementation-roadmap.md) | **Canonical** project-wide roadmap **index** — links to domain phase/design/plan docs |
| [Implementation Roadmap v1 (Historical)](./implementation-roadmap-v1.md) | Historical Events Admin + Sponsor Import five-phase plan |

**Permissions:** Admin-only for all v1 phases (`profiles.role = admin`). No Editor/staff behavior.

### Phase 1 (complete)

| Document | Description |
|----------|-------------|
| [Phase 1 — Events Admin Scope](./phase-1-events-admin-scope.md) | Screens, journeys, fields, validations — **implemented** |

**Locked Phase 1 rules:** company website required; company/edition slug editable with warnings; **multiple editions per series + year allowed** (unique slug only; series+year+city warnings in admin).

### Phase 1.1 (complete — location usability)

| Document | Description |
|----------|-------------|
| [Phase 1.1 — Location Scope](./phase-1.1-location-scope.md) | Location formatter + inline Add City — **implemented** |

### Historical v1 roadmap phases

See [Implementation Roadmap v1 (Historical)](./implementation-roadmap-v1.md):

1. **Events admin** — ✅ Complete — series, editions, companies, nav, import handoff stubs
1.1. **Location usability** — Formatter + inline Add City (proposed before Phase 2)
2. **Sponsor import migration** — ✅ Complete
3. **Sponsor import API** — ✅ Complete
4. **Sponsor import UI** — ✅ Complete
5. **QA and test plan** — Residual items (see historical roadmap; admin search tracked as `PROD-001`)

---

## Admin information architecture (v1)

| Document | Description |
|----------|-------------|
| [Admin Information Architecture](./admin-information-architecture.md) | Navigation, screen inventory, journeys, search, **admin-only** permissions |

---

## Event admin (v1)

| Document | Description |
|----------|-------------|
| [Event Series & Edition Admin Workflow](./event-admin-workflow.md) | **Approved** series/edition UX, field rules, import linking |
| [Phase — Edition Last Reviewed Automation](./phase-edition-last-reviewed-automation-scope.md) | **Implemented** — auto-update `last_reviewed_at` on meaningful curation (Phases 1–3) |

**Locked highlights:** multiple editions per series + year (e.g. multi-city); globally unique edition slug; series and year immutable after create; slug editable with warnings; dates/city warn but do not block import; **Create & import sponsors** is the primary post-create path.

---

## Venue (v1 — complete)

| Document | Description |
|----------|-------------|
| [Venue Design](./venue-design.md) | **Approved** reusable venue entity, edition link, admin IA, public Edition Venue tab |
| [Phase — Venue v1 Scope](./phase-venue-scope.md) | **Implemented** — database, admin, edition integration, public tabs, QA |
| [Venue Migration Design](./venue-migration-design.md) | **Approved and applied** — `20260704120000_venues_v1.sql` |

**Locked highlights:** `venues` + nullable `event_editions.venue_id`; city retained; archive-only (no delete); public Event Detail includes a **Venue** tab (always present alongside Overview, Sponsors, and Organizers; Exhibitors and Partner Alumni appear when non-empty); no standalone `/venues/...` pages. Logo: HTTP URL paste (stored as-is) or file upload to `COMPANY_LOGO_BUCKET` on venue edit. External URL ingest into Storage deferred to a future enhancement.

---

## Exhibitors (E0–E6 shipped; Discovery out of scope)

| Document | Description |
|----------|-------------|
| [Exhibitor Design](./exhibitor-design.md) | **Approved** — edition↔company exhibitor join; orthogonal to sponsors/organizers; public tab hide-when-empty; **E6 bulk import shipped** |

**Locked highlights:** `event_exhibitors` join (`tier_rank`, `tier_label`, within-tier `display_order`; Name/Website on `companies`); organizer-like public SELECT (no sponsor tier RLS); admin Exhibitors tab (E2); public Exhibitors tab (E3); company Exhibitor history (E4); **manual-only** `last_reviewed_at` (no auto-touch); `assertCompanyLinkable` on create; Sponsor-style merge conflicts; **E6** independent exhibitor import (writes `event_exhibitors` only — never `event_sponsors`); Exhibitor Discovery / marketing `/exhibitors` stub expansion out of scope (`PROD-002`).

---

## Organizer (v1 — complete; UX amendment O5 approved)

| Document | Description |
|----------|-------------|
| [Organizer Design](./organizer-design.md) | **Approved** — edition↔company organizer join; admin Profile embed; public Organizers tab |
| [Phase — Organizer v1 Scope](./phase-organizer-scope.md) | **Implemented** (O1–O4) — database, admin API, merge extension |
| [Phase — Organizer UX Amendment](./phase-organizer-ux-amendment-scope.md) | **Implemented** (O5) — Profile embed + public Organizers tab |
| [Organizer Migration Design](./organizer-migration-design.md) | **Approved and applied** — `20260708120000_organizers_v1.sql`, `20260709120000_company_merge_organizers.sql` |

**Locked highlights:** `event_edition_organizers` join table (companies-only; no legacy `organizers` / `event_organizers` tables); admin **Organizers section on edition Profile** (metadata alongside venue); public Event Detail tabs always include **Overview / Sponsors / Venue / Organizers** (Organizers always visible with in-tab empty state when none); **Exhibitors** and **Partner Alumni** tabs appear when non-empty; company merge repoints organizer links; `last_reviewed_at` auto-touch on add/remove/role edit (not reorder).

---

## Partner Alumni (v2 — PA5 complete; import redesign approved)

| Document | Description |
|----------|-------------|
| [Partner Alumni Design](./partner-alumni-design.md) | **Approved (v2)** — series-level **versioned** roster; current version public |
| [Phase — Partner Alumni v2 Scope](./phase-partner-alumni-scope.md) | **Approved (v2)** — PA0′–PA5 deliverables |
| [Partner Alumni Import Redesign](./partner-alumni-import-redesign.md) | **Approved (v1.1)** — batch workflow modeled on Sponsor Import (replaces PA3′ drawer); locked decisions §2; golden QA file §19 |
| [Partner Alumni Migration Design](./partner-alumni-migration-design.md) | **Approved (v2)** — PA1′ versions migration design; applied as `20260711120000_partner_alumni_v2_versions.sql` (+ company-merge follow-on) |

**Status:** **v2 shipped** — PA0′–PA5 program/admin complete; **version-scoped batch import shipped** (full-page stepper under version import routes). v1 draft/Verify/snapshot model **deprecated**. Legacy PA3′ **drawer** bulk upload still present in series admin (deprecation incomplete — PA-IMP-5).

**Next step:** Finish **PA-IMP-5** (deprecate/remove legacy drawer + old preview/commit paths; keep batch import as the only bulk path). Dashboard resume for Partner Alumni imports remains a product gap (`PROD-003`).

**Locked highlights (v2):** `event_partner_alumni` program + **`event_partner_alumni_versions`** + **version members**; **`current_version_id`** public pointer; **no draft table**; **no Verify**; **Create New Version copies current by default**; **cannot delete current version**; **cannot set empty version as current** (OQ8); **bulk import does not auto-set current** (OQ9); **rename snapshot→version tables** (no parallel system); **discard v1 draft rows**; **server-side public resolution**; versions **editable/deletable**; **version-scoped bulk import** (400+ companies); public edition tab shows **current version only** (hide-when-empty); historical versions **admin-only**; separate from sponsors; sponsor counts unaffected; series hub out of scope.

**Deprecated (v1):** `event_partner_alumni_companies`, Verify, `latest_snapshot_id`, immutable snapshots.

---

## Sponsor import (v1)

| Document | Description |
|----------|-------------|
| [Sponsor Import — Database Design](./sponsor-import-database-design.md) | **Approved** canonical schema: 4 import tables, columns, constraints, status enums |
| [Sponsor Import — Migration Design](./sponsor-import-migration-design.md) | Migration plan, ordering, dependencies, constraints, rollout (pre-SQL) |

### Approved v1 policy summary

- **Import source:** Excel / CSV (scraping is future)
- **Publish mode:** Additive
- **Draft discard:** Keep global companies; remove draft links only
- **Drafts:** One active import per event edition
- **Auto-accept:** Exact domain match only
- **Draft storage:** `sponsor_import_draft_links` — separate from live `event_sponsors`
- **Draft links after publish:** Retained for audit
- **Tier input:** Numeric `tier_rank` in Excel (no tier mapping table in v1)
- **Duplicates:** Row-level flags (no duplicate groups table in v1)
- **Prerequisite:** Existing `event_edition_id` (edition created first)

### v1 import tables

1. `sponsor_import_batches`
2. `sponsor_import_rows`
3. `sponsor_import_draft_links`
4. `sponsor_import_admin_action_logs`

Plus one constraint on existing `event_sponsors`: `UNIQUE (event_editions_id, company_id)`.

---

## Backlog (future ideas)

| Document | Description |
|----------|-------------|
| [Product Backlog](./backlog.md) | Deferred enhancements — not approved for implementation until promoted to a scope doc |

---

## End-to-end admin flow

```
Discover event → Series → Edition → Create & import sponsors → Review → Draft → Publish
```
