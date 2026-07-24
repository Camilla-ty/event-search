# EventPixels — Venue Design Document

**Status:** Approved  
**Version:** v1  
**Last updated:** 2026-06-25  

Canonical design for **Venue** as a first-class, reusable location entity linked to event editions. Venue provides **event context and accurate location data** inside the Event Edition experience — not a standalone public directory or venue-discovery product.

Defines entity boundaries, fields, relationships, governance, admin IA, and public display rules.

**This document is design only.** It does not specify migrations, SQL, API routes, implementation phases, or code.

For the existing city hierarchy, see [Phase 1.1 — Location Usability](./phase-1.1-location-scope.md). For edition admin patterns, see [Event Admin Workflow](./event-admin-workflow.md) and [Admin Information Architecture](./admin-information-architecture.md).

---

## 1. Purpose and scope

### 1.1 Problem

Today, `event_editions.city_id` captures **city-level** location only. Many events occur at a named venue (convention center, hotel, campus) that researchers want to record, display, and reuse across editions — without storing coordinates, map URLs, or third-party place IDs.

### 1.2 Goal (v1)

Introduce **Venue** as a reusable catalog entity that admins attach to editions and that visitors see **in event edition context**. An edition may optionally reference one venue while **retaining** its existing city assignment. Venues support historical accuracy: a venue that relocates is modeled as a **new** record; past editions stay linked to the original venue.

### 1.3 What Venue is — and is not

| Venue **is** | Venue **is not** |
|--------------|------------------|
| A reusable data entity for accurate event location | A public venue directory or discovery product |
| Linked to `event_editions` via `venue_id` | A standalone marketing destination (no `/venues/[slug]` pages) |
| Displayed inside the **Event Edition** public experience | A browseable catalog on the marketing site |
| Curated in admin for researcher reuse across editions | An auto-generated or backfilled location guess |

**Primary public surface (locked):** venue information lives within the Event Edition experience:

```
Event Edition
├── Overview
├── Sponsors
├── Exhibitors
└── Venue
```

Standalone public venue profile pages are **not planned** and should **not** be assumed in future roadmap work unless explicitly reconsidered.

### 1.4 In scope (this document)

| Area | Covered |
|------|---------|
| Entity model and v1 fields | Yes |
| Relationship to `event_editions` and `cities` | Yes |
| Historical location / immutability policy | Yes |
| Data governance (duplicates, backfill, warnings) | Yes |
| Logo policy (conceptual; same family as Event Series) | Yes |
| Google Maps link behavior (dynamic, not stored) | Yes |
| Admin information architecture (top-level Venues) | Yes |
| Public display rules (edition Venue tab) | Yes |
| Access model (RLS intent) | Yes |

### 1.5 Out of scope (this document)

| Area | Deferred to implementation docs |
|------|----------------------------------|
| Migrations, constraints SQL, indexes | Migration design (future) |
| API routes and validation modules | Implementation scope (future) |
| UI component structure | Implementation scope (future) |
| Logo upload pipeline details | Implementation scope (future) |
| Venue seeding / bulk import | Future ops |
| Automated backfill of `venue_id` on existing editions | Explicitly excluded (§7) |
| Standalone public venue pages (`/venues/...`) | **Not planned** (§12) |
| Venue discovery / venue-first browsing on marketing site | **Not in scope** |

---

## 2. Design principles

| # | Principle | Implication |
|---|-----------|-------------|
| 1 | **City remains canonical for geography** | `event_editions.city_id` is unchanged. City pages, country/region filtering, and the location formatter continue to use city (+ state + country). |
| 2 | **Venue is optional granularity** | Editions may have city only, or city + venue. Missing venue never blocks save or sponsor import. |
| 3 | **Historical fidelity** | Venue rows represent a location **as it was** when used. Relocation → new venue; do not rewrite history. |
| 4 | **Warnings, not walls** | Duplicate venue names in the same city warn; they do not block create or attach. |
| 5 | **Manual curation** | No automatic backfill of venue on legacy editions. Researchers assign venues deliberately. |
| 6 | **Catalog consistency** | Venues follow the same public-read / admin-write access pattern as other catalog tables (data loaded in edition context, not as a public directory). |
| 7 | **No stored map data** | Map links are computed at display time; the database does not store coordinates, place IDs, or map URLs. |
| 8 | **Edition-centric public surface** | All v1 public venue UI is scoped to the Event Edition **Venue** tab (and admin). No standalone venue marketing routes. |
| 9 | **Archive over delete** | Venue rows are archived, not deleted, in v1. |

---

## 3. Relationship to existing location model

### 3.1 Verified hierarchy (unchanged)

```
regions
  └── countries (region_id)
        └── states (country_id)
              └── cities (country_id, state_id nullable)
                    ├── event_editions.city_id
                    ├── companies.city_id
                    └── venues.city_id          ← new (v1)
                          └── event_editions.venue_id   ← new (v1, nullable)
```

### 3.2 Division of responsibility

| Layer | Answers | Stored on |
|-------|---------|-----------|
| **City** | Where (metro / city) | `event_editions.city_id` |
| **Venue** | At which named place (optional) | `event_editions.venue_id` |

City and venue are complementary. City-level discovery (city pages, Event Explorer geography filters, location formatter) does **not** require a venue. Venue name and address appear on the edition **Venue** tab when `venue_id` is set — not as a separate public venue destination.

### 3.3 Location display formatter

The existing [location display formatter](./phase-1.1-location-scope.md) (`city, state` / `city, country` rules) **remains city-based**. Venue name and address are shown on the edition **Venue** tab — not as a replacement for city formatting on Overview or Explorer. Design intent:

- **Without venue:** unchanged (formatter output on edition Overview; no Venue tab content beyond empty state).
- **With venue:** venue name, address, logo, and map link on the edition **Venue** tab; city label on Overview still derived from `city_id`.

---

## 4. Entity model — `venues` (v1)

### 4.1 Standalone table

| Concept | Table name |
|---------|------------|
| Venue | `venues` |

### 4.2 Columns (v1)

| Column | Type (conceptual) | Nullable | Notes |
|--------|-------------------|----------|-------|
| `id` | uuid | NO | Primary key |
| `name` | text | NO | Display name (e.g. "Marina Bay Sands Expo") |
| `slug` | text | NO | URL-safe identifier; globally unique |
| `city_id` | uuid | NO | FK → `cities.id` |
| `website_url` | text | YES | Official venue site |
| `address_text` | text | YES | Free-form street address for display and map links |
| `logo_url` | text | YES | Manual logo storage path or URL (see §8) |
| `archived_at` | timestamp | YES | Set when venue is archived; NULL = active |
| `created_at` | timestamp | NO | |
| `updated_at` | timestamp | NO | |

### 4.3 Explicitly excluded from v1

The following are **not** columns on `venues` in v1:

| Excluded | Reason |
|----------|--------|
| `description` | Defer rich profile |
| `latitude` / `longitude` | No stored coordinates |
| `google_place_id` | No third-party place binding |
| Stored map URL | Maps generated dynamically (§9) |
| Venue capacity | Out of catalog scope |
| Venue type (conference center, hotel, etc.) | Defer taxonomy |

### 4.4 Slug policy (resolved)

| Rule | Behavior |
|------|----------|
| Uniqueness | **Globally unique** `slug` on `venues` (consistent with `event_series`, `event_editions`) |
| Purpose | Admin catalog identifier and stable internal reference — **not** a public marketing URL segment |
| Generation | Server-generated from `name`; suffix fallback on collision (same pattern as cities and editions) |
| Admin edit | Slug editable with strong warnings, matching edition slug policy |

Duplicate **names** in the same city are allowed (§7); duplicate **slugs** are not.

---

## 5. Relationship to `event_editions`

### 5.1 Column addition (v1)

| Table | Column | Nullable | References |
|-------|--------|----------|------------|
| `event_editions` | `venue_id` | YES | `venues.id` |

`event_editions.city_id` **remains** and is **not** removed or deprecated in v1.

### 5.2 Integrity rules (locked)

| Rule | Enforcement intent |
|------|-------------------|
| **City match** | When `venue_id` is set, `event_editions.city_id` must equal `venues.city_id` for the referenced venue |
| **City required for venue** | An edition cannot set `venue_id` without a non-null `city_id` |
| **Optional venue** | `venue_id` may be NULL for any edition (historical, TBC, or city-only events) |

Conceptually: the edition’s city is the geographic anchor; the venue must belong to that same city.

### 5.3 Edition form behavior (design intent)

| State | Venue picker |
|-------|--------------|
| No city selected | Disabled — admin must select city first |
| City selected | Enabled — lists venues where `venues.city_id` = edition `city_id` |
| Inline create venue | Scoped to current edition city (same pattern as Add City) |

Changing an edition’s `city_id` after a venue is attached requires either clearing `venue_id` first or selecting a venue in the new city (implementation validates city match).

### 5.4 Sponsor import and other gates

| Workflow | Venue required? |
|----------|-----------------|
| Save edition | No |
| Sponsor import | No (unchanged — city/dates remain warnings-only) |
| Public listing | No |

---

## 6. Historical location policy (locked)

Venue records are **historical snapshots** of where an event was held.

### 6.1 Relocation

When a real-world venue moves to a new address or city:

| Action | Allowed |
|--------|---------|
| Create a **new** `venues` row for the new location | Yes |
| Link **future** editions to the new venue | Yes |
| Update existing `venues` row to reflect the new address/city as if it always existed | **No** |
| Re-point past editions to the new venue automatically | **No** |

Past editions **remain** linked to the original venue record.

### 6.2 Minor corrections (resolved)

Corrections that do **not** represent a relocation are allowed on the existing venue row:

| Change | Policy |
|--------|--------|
| Typo in `name` | Allowed |
| Formatting fix in `address_text` | Allowed |
| Updated `website_url` or `logo_url` | Allowed |
| Changing `city_id` on an existing venue | **Treated as relocation** — create a new venue instead |

If any editions are already linked, changing `city_id` would violate historical intent; admins should create a new venue.

### 6.3 Archive (locked)

Venue records are **not deleted in v1**. Archive is the preferred lifecycle.

| Rule | Policy |
|------|--------|
| Hard delete | **Not supported in v1** |
| Archive | Set `archived_at`; venue hidden from pickers and admin list default view |
| Archived venue with linked editions | **Allowed** — editions retain `venue_id`; historical links preserved |
| Unarchive | Admin may clear `archived_at` to restore to active pickers |
| Relocation | Still requires a **new** venue row (§6.1), not archive-and-replace |

Archived venues remain readable for editions already linked. Admin detail remains reachable from linked-edition views.

---

## 7. Data governance

### 7.1 Duplicate names (locked)

| Situation | Behavior |
|-----------|----------|
| Two venues, same `name`, same `city_id` | **Allowed** |
| Admin create / attach | **Warning** — show existing similar names in that city |
| Hard block | **No** |

Warnings help researchers avoid accidental duplicates; legitimate duplicates (e.g. renamed buildings, distinct halls) remain possible.

### 7.2 Backfill (locked)

| Rule | Policy |
|------|--------|
| Auto-populate `event_editions.venue_id` from city or name heuristics | **No** |
| Existing editions | `venue_id` stays **NULL** until manually researched and set |
| Bulk migration scripts | Out of v1 scope; require separate approved ops plan if ever needed |

### 7.3 Provenance

Venue assignment is **admin-curated**. v1 does not add import-batch or automated provenance columns on `venues` (recoverable from admin action logs if needed later).

---

## 8. Venue logo policy

Venue logos follow the **same conceptual pattern as Event Series logos** (manual-only, no Logo.dev auto-fetch).

| Aspect | v1 design intent |
|--------|------------------|
| Storage | `venues.logo_url` — path or URL to stored asset |
| Create | Logo optional; not required at create |
| Admin input (future) | URL paste and file upload (both supported eventually) |
| Public display | Show logo on edition **Venue** tab and venue admin detail when `venue_id` is set |
| Auto-fetch | **None** — no third-party logo discovery for venues |

Implementation mechanics (Supabase bucket, ingest API, cache-bust) are **out of scope** for this document; they should mirror `event_series` logo behavior when built.

---

## 9. Google Maps

### 9.1 Policy (locked)

| Rule | Policy |
|------|--------|
| Store coordinates, place IDs, or embed URLs | **No** |
| Generate map search / directions link at render time | **Yes** |

### 9.2 Link composition (design intent)

Dynamic query built from available fields:

1. `venues.name`
2. `venues.address_text` (when present)
3. City context from `venues.city_id` embed (`cities.name`, `states.name`, `countries.name` via existing location embeds)

Exact URL format (Google Maps search URL vs Maps Place query) is an implementation choice. The design requirement is: **one clickable “Map” or “Directions” affordance** on the edition **Venue** tab (and on venue admin detail) when there is enough text to form a query.

### 9.3 When to show

| Condition | Show map link? |
|-----------|----------------|
| Venue with `name` only | Yes (name + city context) |
| Venue with `address_text` | Yes (prefer address in query) |
| Edition with city only (no venue) | No venue-specific map link (city-level maps deferred) |

---

## 10. Access model (RLS intent)

Consistent with other catalog entities (`event_series`, `event_editions`, `cities`):

| Role | `venues` access |
|------|-----------------|
| Anonymous / authenticated (public) | SELECT (for edition embed / Venue tab — not venue-directory pages) |
| Client writes | **None** |
| Admin mutations | Service role via `/api/admin/...` gated by `requireAdminApi()` |

No change to public marketing query patterns for import tables or sponsor data.

---

## 11. Admin information architecture

### 11.1 Top-level navigation (approved)

Venues is a **primary sidebar item** (same tier as Companies). Locked order relative to catalog sections:

| Order | Label | Route | Purpose |
|-------|-------|-------|---------|
| 1 | **Dashboard** | `/admin` | Work queue (unchanged) |
| 2 | **Events** | `/admin/events` | Series + editions hub (sub-nav below) |
| 3 | **Sponsor imports** | `/admin/sponsor-imports` | Import list (unchanged) |
| 4 | **Companies** | `/admin/companies` | Global company directory |
| 5 | **Venues** | `/admin/venues` | Venue directory |
| 6 | **View site** | `/` (new tab) | Marketing site (unchanged) |

**Events sub-nav (locked):**

| Order | Label | Route |
|-------|-------|-------|
| 1 | Overview | `/admin/events` |
| 2 | Series | `/admin/events/series` |
| 3 | Editions | `/admin/events/editions` |

Align [Admin Information Architecture](./admin-information-architecture.md) §2.1–§2.2 when that doc is next revised.

### 11.2 Venues section structure

```
Admin
├── Dashboard
├── Events
│   ├── Overview      /admin/events
│   ├── Series        /admin/events/series
│   └── Editions      /admin/events/editions
├── Sponsor imports
├── Companies
├── Venues
│   ├── List          /admin/venues
│   ├── Create        /admin/venues/new
│   └── Detail / edit /admin/venues/[id]
└── View site
```

### 11.3 Venues list (design intent)

| Column / affordance | Source |
|---------------------|--------|
| Name | `venues.name` |
| City | `cities` via `city_id` (formatter label) |
| Linked editions count | Count `event_editions` where `venue_id` = venue |
| Logo thumbnail | `logo_url` when set |
| Status | Active vs archived (`archived_at`) |
| Search | Name, slug, city name |

### 11.4 Venue detail (design intent)

| Section | Content |
|---------|---------|
| Profile | name, slug, city (read-only after editions linked — see §6), website, address, logo |
| Linked editions | Read-only table of editions using this venue (link to edition admin) |
| Map preview | Dynamic Google Maps link (not stored) |
| Lifecycle | Archive action (sets `archived_at`); no delete in v1 |

### 11.5 Edition form integration

| Field | Behavior |
|-------|----------|
| City | Unchanged (`AdminCitySelect` + Add City) |
| Venue | Optional select; filtered by city; “Add venue” inline scoped to city |
| Warnings | Duplicate name in city; city/venue mismatch blocked at save |

Edition admin profile shows venue when set. Public edition **Overview** continues to use city formatter; full venue presentation is on the **Venue** tab.

---

## 12. Public site behavior (v1 design intent)

### 12.1 Event Edition — primary public surface (locked)

Venue is **not** a standalone public entity. Visitors encounter venue data only within an Event Edition:

```
Event Edition
├── Overview      — city/location summary (existing formatter); no venue directory
├── Sponsors      — unchanged
├── Exhibitors    — unchanged
└── Venue         — venue name, logo, address, website, map link (when venue_id set)
```

When `event_editions.venue_id` is set, the **Venue** tab shows:

| Element | Source |
|---------|--------|
| Venue name | `venues.name` |
| Venue logo | `venues.logo_url` (optional) |
| Location context | City label from `city_id` (formatter) |
| Address | `venues.address_text` when present |
| Website | `venues.website_url` when present |
| Map link | Dynamic (§9) |

When `venue_id` is NULL, the Venue tab shows an appropriate empty state (edition may still show city on Overview).

### 12.2 No standalone public venue pages (locked)

| Rule | Policy |
|------|--------|
| Public routes such as `/venues/[slug]` | **Not planned** — do not assume in roadmap |
| Venue as browseable marketing catalog | **Out of scope** |
| Future reconsideration | Requires explicit new design decision — do not assume in roadmap |

`venues.slug` exists for admin catalog stability, not for a public venue hub.

### 12.3 Event Explorer (locked for v1)

| Rule | Policy |
|------|--------|
| Show venue on Event Explorer cards in v1 | **Not required** |
| City on cards | Unchanged — city remains primary location signal on Explorer |
| Future card venue display | **Possible** — data model (`event_editions.venue_id` + venue embed) supports it without schema change |
| Venue-first Explorer filtering | **Not planned** |

### 12.4 Future venue enhancements (post-v1, non-roadmap)

These are **optional evolution paths** — not commitments and **not** standalone public venue pages:

| Enhancement | Notes |
|-------------|-------|
| Improved venue presentation on edition Venue tab | Layout, hierarchy, empty states |
| Venue logos | Upload + display polish |
| Map integrations | Richer dynamic map affordances (still no stored coordinates) |
| Richer venue metadata | e.g. description, type — only after explicit v2 design |
| Venue on Explorer cards | Display-only; uses existing `venue_id` link |

---

## 13. Resolved decisions

| # | Decision | Resolution |
|---|----------|------------|
| 1 | Venue is first-class | Yes — `venues` table |
| 2 | Edition link | `event_editions.venue_id` nullable FK |
| 3 | City retained | `event_editions.city_id` unchanged |
| 4 | City–venue consistency | When `venue_id` set, edition `city_id` must match venue `city_id` |
| 5 | v1 fields | id, name, slug, city_id, website_url, address_text, logo_url, archived_at, timestamps |
| 6 | Excluded fields | description, lat/lng, place_id, map URL, capacity, type |
| 7 | Relocation | New venue row; never rewrite historical venue or re-link past editions |
| 8 | Minor typos / address formatting | Edit in place on same venue row |
| 9 | `city_id` change on venue | Treat as relocation → new venue |
| 10 | Duplicate names (same city) | Allowed; warn only |
| 11 | Slug | Globally unique; server-generated with suffix |
| 12 | Backfill | No automatic backfill; `venue_id` NULL until manual |
| 13 | Logo | Manual-only pattern aligned with Event Series |
| 14 | Maps | Dynamic links only; nothing stored |
| 15 | Admin nav | Top-level Venues section |
| 16 | Venue optional on edition | Never a hard gate for save or import |
| 17 | RLS | Public SELECT; admin write via service role |
| 18 | Venue picker scope | Filtered by edition `city_id` |
| 19 | Public surface | Edition **Venue** tab only — not standalone venue pages |
| 20 | Venue purpose | Event context and accurate location — not venue discovery |
| 21 | Explorer cards | Venue display **not** a v1 requirement; data model allows future display |
| 22 | Lifecycle | Archive via `archived_at`; **no delete** in v1 |
| 23 | Public venue routes | `/venues/...` **not planned** unless explicitly reconsidered |
| 24 | Name edits when linked | Allowed with warning; relocation still requires new venue row |
| 25 | Admin nav order | Events sub-nav: Overview → Series → Editions; primary: … → Companies → Venues → View site |

---

## 14. Decisions requiring review

| # | Topic | Notes |
|---|-------|-------|
| 1 | **Venue merge / dedupe tooling** | Deferred (warnings-only in v1); parallels future company dedupe |
| 2 | **Cross-edition venue reuse UX** | Picker only vs “recently used venues” shortcuts — implementation preference |
| 3 | **Exhibitors tab** | Listed in edition IA diagram; confirm Exhibitors tab ships with or before Venue tab (product sequencing, not venue schema) |

None of the above block venue implementation scope or migration design.

---

## 15. Concept mapping summary

### 15.1 New table

| Concept | Table |
|---------|-------|
| Venue | `venues` |

### 15.2 Columns on existing tables (v1)

| Table | Change |
|-------|--------|
| `event_editions` | Add nullable `venue_id` → `venues.id` |
| `cities` | No schema change (already parent of venues) |

### 15.3 Computed / derived (not stored)

| Concept | Derivation |
|---------|------------|
| Formatted city label | Existing location formatter on `city_id` |
| Google Maps URL | Compose from venue name + address + city embed at render time |
| Duplicate-name warning | Query `venues` by `name` + `city_id` on create |
| Linked edition count | `COUNT(event_editions)` by `venue_id` |
| Edition Venue tab content | Venue fields + city formatter for context |
| Venue picker lists | Active venues only (`archived_at` IS NULL) |

---

## 16. Related documents

| Document | Path |
|----------|------|
| Project state | [project-state.md](./project-state.md) |
| Implementation roadmap (canonical index) | [implementation-roadmap.md](./implementation-roadmap.md) |
| Admin IA | [admin-information-architecture.md](./admin-information-architecture.md) |
| Event admin workflow | [event-admin-workflow.md](./event-admin-workflow.md) |
| Location scope (cities) | [phase-1.1-location-scope.md](./phase-1.1-location-scope.md) |
| Sponsor import DB design (style reference) | [sponsor-import-database-design.md](./sponsor-import-database-design.md) |

---

## 17. Maintenance rule

**Design approval (2026-06-25):** Status set to **Approved**. Remaining cross-doc updates:

| Step | Document | Action |
|------|----------|--------|
| 1 | [project-state.md](./project-state.md) §2 Domain model | Add **Venues** row (design approved; implementation pending) |
| 2 | [README.md](./README.md) | Add Venue design entry under documentation index |
| 3 | [admin-information-architecture.md](./admin-information-architecture.md) §2.1–§2.2 | Add Venues to primary nav; lock Events sub-nav order per §11.1 |
| 4 | Migration + implementation scope | Separate documents when implementation is approved — do not append SQL to this file |

---

**End of venue design (v1 approved).**
