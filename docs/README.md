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

## Implementation (v1)

| Document | Description |
|----------|-------------|
| [Implementation Roadmap](./implementation-roadmap.md) | **Approved** five-phase plan: events admin → migration → API → UI → QA |

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

### Roadmap phases

1. **Events admin** — ✅ Complete — series, editions, companies, nav, import handoff stubs  
1.1. **Location usability** — Formatter + inline Add City (proposed before Phase 2)  
2. **Sponsor import migration** — 4 tables + constraints + RLS  
3. **Sponsor import API** — Batch lifecycle (service role)  
4. **Sponsor import UI** — Full Excel import flow  
5. **QA and test plan** — Verification, search, dashboard polish  

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

**Locked highlights:** `venues` + nullable `event_editions.venue_id`; city retained; archive-only (no delete); public edition tabs **Overview / Sponsors / Venue** only; no standalone `/venues/...` pages. Logo: HTTP URL paste (stored as-is) or file upload to `COMPANY_LOGO_BUCKET` on venue edit. External URL ingest into Storage deferred to a future enhancement.

---

## Exhibitors (v1 — design approved; E1 applied; E2 admin CRUD)

| Document | Description |
|----------|-------------|
| [Exhibitor Design](./exhibitor-design.md) | **Approved** — edition↔company exhibitor join; orthogonal to sponsors/organizers; public tab hide-when-empty |

**Locked highlights:** `event_exhibitors` join (`tier_rank`, `tier_label`, within-tier `display_order`; Name/Website on `companies`); organizer-like public SELECT (no sponsor tier RLS); admin Exhibitors tab (E2); `assertCompanyLinkable` on create; Sponsor-style merge conflicts; **manual-only** `last_reviewed_at` (no auto-touch); public Exhibitors tab / Company History / Discovery / import deferred; do not modify `/exhibitors` marketing stub.

---

## Organizer (v1 — complete; UX amendment O5 approved)

| Document | Description |
|----------|-------------|
| [Organizer Design](./organizer-design.md) | **Approved** — edition↔company organizer join; admin Profile embed; public Organizers tab |
| [Phase — Organizer v1 Scope](./phase-organizer-scope.md) | **Implemented** (O1–O4) — database, admin API, merge extension |
| [Phase — Organizer UX Amendment](./phase-organizer-ux-amendment-scope.md) | **Implemented** (O5) — Profile embed + public Organizers tab |
| [Organizer Migration Design](./organizer-migration-design.md) | **Approved and applied** — `20260708120000_organizers_v1.sql`, `20260709120000_company_merge_organizers.sql` |

**Locked highlights:** `event_edition_organizers` join table (companies-only; no legacy `organizers` / `event_organizers` tables); admin **Organizers section on edition Profile** (metadata alongside venue); public tabs **Overview / Sponsors / Venue / Organizers** — Organizers tab always visible with in-tab empty state when none; company merge repoints organizer links; `last_reviewed_at` auto-touch on add/remove/role edit (not reorder).

---

## Partner Alumni (v2 — PA5 complete; import redesign approved)

| Document | Description |
|----------|-------------|
| [Partner Alumni Design](./partner-alumni-design.md) | **Approved (v2)** — series-level **versioned** roster; current version public |
| [Phase — Partner Alumni v2 Scope](./phase-partner-alumni-scope.md) | **Approved (v2)** — PA0′–PA5 deliverables |
| [Partner Alumni Import Redesign](./partner-alumni-import-redesign.md) | **Approved (v1.1)** — batch workflow modeled on Sponsor Import (replaces PA3′ drawer); locked decisions §2; golden QA file §19 |
| [Partner Alumni Migration Design](./partner-alumni-migration-design.md) | **Approved (v2)** — PA1′ migration authored; apply + verify next |

**Status:** **PA0′ complete**; **PA1′ migration authored** (OQ1–OQ4, OQ7 locked; OQ8–OQ9 locked for PA2′/PA3′). v1 draft/Verify/snapshot model **deprecated**.

**Next step:** Apply **`20260711120000_partner_alumni_v2_versions.sql`** + run verify script, then PA2′ admin.

**Locked highlights (v2):** `event_partner_alumni` program + **`event_partner_alumni_versions`** + **version members**; **`current_version_id`** public pointer; **no draft table**; **no Verify**; **Create New Version copies current by default**; **cannot delete current version**; **cannot set empty version as current** (OQ8); **bulk import does not auto-set current** (OQ9); **rename snapshot→version tables** (no parallel system); **discard v1 draft rows**; **server-side public resolution**; versions **editable/deletable**; **version-scoped bulk import** (400+ companies); public edition tab shows **current version only**; historical versions **admin-only**; separate from sponsors; sponsor counts unaffected; series hub out of scope.

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
