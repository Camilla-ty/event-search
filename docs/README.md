# EventPixels — Project documentation

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

## End-to-end admin flow

```
Discover event → Series → Edition → Create & import sponsors → Review → Draft → Publish
```
