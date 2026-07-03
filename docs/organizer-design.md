# EventPixels — Organizer Design Document

**Status:** Approved  
**Version:** v1  
**Last updated:** 2026-07-04 (UX amendment — admin Profile embed, public Organizers tab)  

Canonical design for **Organizer** as an edition-scoped relationship between an **Event Edition** and a **Company**. Organizers answer *who produces or hosts this occurrence* — inside the Event Edition experience, not as a separate public directory or organizer-discovery product.

Defines entity boundaries, the company relationship model, role labels, governance, admin IA, public display rules, and `last_reviewed_at` policy intent.

**This document is design only.** It does not specify migrations, SQL, API routes, implementation phases, or code.

For edition admin patterns, see [Event Admin Workflow](./event-admin-workflow.md) and [Admin Information Architecture](./admin-information-architecture.md). For the company-as-entity model, see [project-state.md](./project-state.md) and [ADR-001 — Company Identity](./adr/ADR-001-company-identity.md). For research freshness automation, see [Phase — Edition Last Reviewed Automation](./phase-edition-last-reviewed-automation-scope.md). For a parallel edition-scoped join pattern, see [Venue Design](./venue-design.md).

---

## 1. Product vision

EventPixels helps visitors and researchers understand **who runs an event**, not only who sponsors it. Today the public Event Detail experience emphasizes dates, location, sponsors, and research metadata — but not the organizing companies behind an edition.

Organizer v1 adds **curated, public attribution**: one or more companies linked to an edition with an explicit **role label** (e.g. “Organizer”, “Co-organizer”, “Host”). The same global **Company** catalog used for sponsors is reused — there is no parallel “organizer profile” entity.

Organizers are **edition-scoped**. A series may have different organizers across years or cities; organizer data belongs on the occurrence (`event_editions`), not on `event_series`.

**Primary public surface (locked, amended 2026-07-04):** organizer information appears on Event Detail → dedicated **Organizers** tab (`Overview | Sponsors | Venue | Organizers`). Not on Overview, not standalone organizer pages, and not Event Explorer cards in v1.

**Primary admin surface (locked, amended 2026-07-04):** organizer curation on edition **Profile** — edition metadata alongside venue, website, city, and dates. No dedicated Organizers tab. See [phase-organizer-ux-amendment-scope.md](./phase-organizer-ux-amendment-scope.md).

---

## 2. Goals

| # | Goal |
|---|------|
| G1 | Record **who organizes** each event edition using existing **companies** |
| G2 | Support **multiple organizers** per edition with stable **display order** |
| G3 | Store a human-readable **role label** on each edition↔company link |
| G4 | Allow the **same company** to be both **sponsor and organizer** on one edition |
| G5 | Expose organizer data **publicly** on Event Detail → **Organizers** tab |
| G6 | Keep curation **edition-scoped** in admin (no series-level organizers) |
| G7 | Treat organizer curation as **meaningful edition research** for `last_reviewed_at` policy |
| G8 | Align with existing catalog access patterns: public read, admin write via service role |

---

## 3. Non-goals

### 3.1 Product non-goals (v1)

| Non-goal | Notes |
|----------|-------|
| Separate **Organizer** entity or `organizers` table | Companies are the only organization record |
| Series-level organizers | Organizers attach to **editions** only |
| Standalone public organizer pages (`/organizers/...`) | **Not planned** |
| Organizer discovery / organizer-first browsing | **Out of scope** |
| Organizer data on Event Explorer cards | **Not required** in v1 |
| Excel / sponsor-import pipeline for organizers | **Deferred** — manual curation only in v1 |
| Automated backfill of organizers from heuristics | **No** — researchers assign deliberately |
| Organizer logos or fields beyond company profile | Use existing `companies` presentation |
| Top-level **Organizers** admin directory | Management is **edition-scoped** only (unlike Venues) |
| **Global admin search** for organizer links | **Deferred** beyond organizer v1 |
| Public **“Events organized”** on marketing company profile | **Deferred** — admin company detail only in v1 |

### 3.2 Deferred to implementation docs

| Area | Deferred to |
|------|-------------|
| Migrations, constraints SQL, indexes | Migration design (future) |
| API routes and validation modules | Implementation scope (future) |
| UI component structure | Implementation scope (future) |

### 3.3 Legacy direction explicitly rejected

Early code and backup documentation reference `event_organizers` joined to a separate `organizers` table. **That direction is rejected.** v1 organizers are **company links on editions** via **`event_edition_organizers`** only. Any legacy query stubs must be replaced during implementation — not extended. The name **`event_organizers`** is reserved for that rejected legacy shape and must **not** be reused for the v1 join table.

---

## 4. Design principles

| # | Principle | Implication |
|---|-----------|-------------|
| 1 | **Company is canonical** | One real-world organization → one `companies` row. Organizer is a **role on an edition**, not a new entity type. |
| 2 | **Edition-centric** | All organizer links reference `event_editions.id`. Series pages do not own organizer lists. |
| 3 | **Sponsor and organizer are independent joins** | `event_sponsors` and `event_edition_organizers` coexist. Same company may appear in both. |
| 4 | **One link per company per edition** | At most one organizer relationship row per `(event_editions_id, company_id)`. Role changes edit that row. |
| 5 | **Role on the relationship** | `role_label` lives on the join row, not on `companies`. |
| 6 | **Public by default** | Organizer links are public catalog data (unlike tier-gated sponsor visibility). |
| 7 | **Meaningful curation touches review** | Add, remove, and substantive role edits advance `last_reviewed_at`; pure reorder does not (mirrors sponsor reorder policy). |
| 8 | **Warnings, not walls** | Missing organizers never block edition save or sponsor import. |
| 9 | **Manual curation** | No auto-inference from sponsor list, series website, or import data in v1. |

---

## 5. Data model direction

### 5.1 What gets stored

Organizer v1 introduces **one new join table**: **`event_edition_organizers`**. It does **not** introduce a `organizers` table or columns on `companies` specific to organizing.

| Concept | Storage |
|---------|---------|
| Organizer relationship | `event_edition_organizers` — edition + company + role + order |
| Company identity | Existing `companies` row |
| Edition context | Existing `event_editions` row |

### 5.2 Join table columns (v1)

| Column | Nullable | Notes |
|--------|----------|-------|
| `id` | NO | Primary key (uuid) |
| `event_editions_id` | NO | FK → `event_editions.id` |
| `company_id` | NO | FK → `companies.id` |
| `role_label` | NO | Human-readable role; **default `"Organizer"`**; max **80** characters |
| `display_order` | NO | Dense ordering within the edition’s organizer list (1..n) |
| `created_at` | NO | |
| `updated_at` | NO | |

**Explicitly excluded from v1 join row:** `created_by`, `updated_by`, provenance columns, soft-archive flags, series_id, import-batch references, separate slug, logo override.

### 5.3 Integrity rules (locked)

| Rule | Intent |
|------|--------|
| **One row per company per edition** | `UNIQUE (event_editions_id, company_id)` |
| **Edition required** | Every organizer link belongs to exactly one edition |
| **Company required** | Every link references an existing company |
| **No series FK** | Organizer rows never reference `event_series` directly |

### 5.4 Foreign key delete behavior (locked)

Mirror venue and catalog FK policy — editions and companies are not hard-deleted in v1:

| FK | ON DELETE |
|----|-----------|
| `event_edition_organizers.event_editions_id` → `event_editions.id` | **RESTRICT** |
| `event_edition_organizers.company_id` → `companies.id` | **RESTRICT** |

Organizer rows are removed explicitly via admin “remove from edition” — not via cascade when parent rows are archived or edited.

### 5.5 Relationship to `event_sponsors`

| Aspect | Sponsors (`event_sponsors`) | Organizers (`event_edition_organizers`) |
|--------|----------------------------|----------------------------------------|
| Entity | Company on edition | Company on edition |
| Uniqueness | One sponsor link per company per edition | One organizer link per company per edition |
| Extra fields | `tier_rank`, `tier_label`, `display_order` (within tier) | `role_label`, `display_order` (within edition list) |
| Public visibility | Tier-gated (anon sees rank 1 only) | **Full public read** for all linked organizers |
| Import pipeline | Excel sponsor import | **None in v1** |
| Same company both roles | Allowed | **Allowed** |

The two joins are **orthogonal**. Uniqueness is per table — a company may have one sponsor row and one organizer row on the same edition.

### 5.6 Computed / derived (not stored)

| Concept | Derivation |
|---------|------------|
| Public organizer list | Join rows for edition ordered by `display_order`, embed `companies` |
| Organizer count on edition | `COUNT(*)` on join table by `event_editions_id` |
| Company organizer history (admin) | Join rows by `company_id` — read-only on company detail |
| Empty state on public Organizers tab | **Standard empty state inside tab** when zero organizers; tab **always visible** |

---

## 6. Company relationship model

### 6.1 Organizer = company-on-an-edition

Following the established EventPixels pattern:

> **Company** = global entity. **Sponsor** = company linked to an edition via `event_sponsors`. **Organizer** = company linked to an edition via `event_edition_organizers`.

There is no third catalog type. Public company pages continue to represent the organization; edition pages show **that company’s role on this occurrence**.

### 6.2 Dual role: sponsor and organizer

| Scenario | Policy |
|----------|--------|
| Company is sponsor only | Unchanged sponsor behavior |
| Company is organizer only | Shown on edition **Organizers** tab only |
| Company is **both** on same edition | **Allowed** — appears in Sponsors tab (with tier) and **Organizers** tab (with role label) |
| Admin picker | Adding as organizer does **not** remove or block sponsor link, and vice versa |

### 6.3 Company page (admin — locked)

Mirror the read-only **Sponsorships** section on company detail:

| Section | Content |
|---------|---------|
| **Organizer roles** (read-only, admin only in v1) | Editions where this company is an organizer; edition name, year, series; role label; link to edition admin |

**Public marketing company profile (`/sponsors/[slug]`)** does **not** show “Events organized” in v1. That remains a future expansion (§13).

Company profile fields (`name`, `website`, `domain`, logo, city) are **not** duplicated on the join row.

### 6.4 Company merge (design intent)

When companies merge, organizer join rows should follow the same repointing semantics as sponsor links (implementation detail in scope doc). Merged-away company’s organizer links consolidate onto the survivor. **Affected editions** should be evaluated for `last_reviewed_at` auto-touch per existing merge policy (§5.4 in last-reviewed scope).

---

## 7. Organizer role model

### 7.1 `role_label` (locked)

| Rule | Policy |
|------|--------|
| Storage | Text on the join row |
| Default on create | **`"Organizer"`** |
| Editable | **Yes** — admins may change label after create |
| Required | **Yes** — never NULL; empty string not allowed |
| Max length | **80 characters** — aligned with `event_sponsors.tier_label` |
| Controlled vocabulary | **No enum in v1** — free text with sensible default |
| Examples | “Organizer”, “Co-organizer”, “Host”, “Producer”, “Presented by” |

### 7.2 Display order (locked)

| Rule | Policy |
|------|--------|
| Column | `display_order` on join row |
| Scope | Ordering **within one edition’s organizer list** |
| Assignment | Server-managed dense integers (1..n), same family as sponsor `display_order` |
| Admin UX | Move Up / Move Down (or equivalent) — **not** free numeric input in v1 |
| Public display | Same order as admin list |

### 7.3 Reorder vs substantive edit

| Action | `last_reviewed_at` (locked) |
|--------|----------------------------|
| Add organizer link | **Yes** — meaningful curation |
| Remove organizer link | **Yes** |
| Change `role_label` | **Yes** — public attribution changed |
| Reorder only (`display_order`) | **No** — mirrors sponsor within-tier reorder exclusion |

Exact hook placement is specified in implementation scope; this design **requires** organizer changes to be **evaluated** under the last-reviewed policy and documented alongside live sponsor rules.

---

## 8. Public UX

### 8.1 Primary surface — Event Detail → Organizers tab (locked)

Organizer v1 adds a dedicated **Organizers** tab on Event Detail. Organizer content **does not** appear on Overview.

**Tab order (locked):**

```
Event Edition
├── Overview      — existing content only (no organizers block)
├── Sponsors      — unchanged
├── Venue         — unchanged (when venue linked)
└── Organizers    — organizer list or empty state (?tab=organizers)
```

Follows the same pattern as **Venue**: metadata curated on admin Profile, consumed on a public edition tab. See [venue-design.md](./venue-design.md) §12.

### 8.2 Organizers tab — content (locked)

**Tab visibility:** The Organizers tab is **always shown**, including when the edition has zero organizer links.

When the edition has one or more organizer links:

| Element | Source |
|---------|--------|
| Company name | `companies.name` |
| Role label | Join row `role_label` |
| Company link | Public company / sponsor profile route when company is public |
| Logo | Company logo when available (existing company presentation) |
| Order | Join row `display_order` ascending |

When no organizers are linked: render a **standard empty state inside the tab** (heading + short copy). **Do not hide the tab.**

### 8.3 What public UX does not include (v1)

| Excluded | Policy |
|----------|--------|
| Dedicated `/organizers/...` routes | **Not planned** |
| Organizers on Event Explorer cards | **Not required** |
| Organizers on series hub pages | **Not in v1** — edition detail only |
| Filtering Explorer by organizer | **Not planned** |
| “Events organized” on public company profile | **Deferred** — see §13 |

### 8.4 Access model (RLS intent)

Consistent with other public catalog joins:

| Role | `event_edition_organizers` |
|------|---------------------------|
| Anonymous / authenticated | **SELECT all rows** (no tier gate) |
| Client writes | **None** |
| Admin mutations | Service role via `/api/admin/...` gated by `requireAdminApi()` |

Company embed fields follow existing `companies` public read rules.

---

## 9. Admin UX

### 9.1 Edition-scoped management — Profile embed (locked)

Organizer curation happens on **Event Edition detail → Profile** — not on a dedicated Organizers tab, not on series detail, and not via a global Organizers nav item.

Organizers are **edition metadata**, in the same class as venue (`venue_id`), website, city, and dates. Large operational datasets (live sponsor roster, import batches) remain on separate tabs.

**Edition detail tabs (locked order):**

| Order | Tab | Route param |
|-------|-----|-------------|
| 1 | Profile | `profile` (default) — includes **Organizers** section |
| 2 | Live sponsors | `sponsors` |
| 3 | Imports | `imports` |

The Profile tab hosts the full organizer list: add, edit role label, reorder, and remove — via an embedded **Organizers** section below core profile fields (placement relative to venue picker and research metadata is an implementation layout choice).

### 9.2 Add organizer flow (locked)

| Step | Behavior |
|------|----------|
| 1 | Admin opens edition detail → **Profile** tab → **Organizers** section |
| 2 | **Add organizer** opens company search picker (same search family as Add sponsor) |
| 3 | Companies already linked as organizer on **this edition** are disabled |
| 4 | Companies already sponsors (but not organizers) remain **selectable** |
| 5 | On add: create join row with `role_label = "Organizer"`, `display_order` at end of list |
| 6 | Admin may edit role label inline or via drawer |
| 7 | **Create company** escape hatch — link to `/admin/companies/new` (same pattern as Add sponsor); no inline create modal required in v1 |

### 9.3 Edit and remove (locked)

| Action | Behavior |
|--------|----------|
| Edit role label | Save on row; triggers last-reviewed evaluation |
| Remove | Confirm modal — “Remove organizer from this edition only”; does **not** delete company |
| Reorder | Move Up / Move Down; does **not** trigger last-reviewed auto-touch |
| Remove company from catalog | Out of v1 organizer scope — company delete not exposed |

### 9.4 Gates and warnings

| Workflow | Organizers required? |
|----------|---------------------|
| Save edition profile | **No** |
| Sponsor import | **No** (unchanged) |
| Publish import | **No** |
| Public Event Detail | **No** — Organizers tab always visible; empty state inside tab when none |

### 9.5 Admin capabilities matrix (v1)

| Area | View | Add | Edit role | Reorder | Remove |
|------|------|-----|-----------|---------|--------|
| Edition Profile — Organizers section | ✓ | ✓ | ✓ | ✓ | ✓ |
| Company organizer history (read-only) | ✓ | — | — | — | — |
| Global organizer directory | — | — | — | — | — |
| Global admin search (organizers) | — | — | — | — | — |

---

## 10. `last_reviewed_at` policy (locked)

Organizer curation is **meaningful edition research** under the automation policy in [phase-edition-last-reviewed-automation-scope.md](./phase-edition-last-reviewed-automation-scope.md).

### 10.1 Rules

| Action | Auto-touch `last_reviewed_at`? |
|--------|-------------------------------|
| **Add** organizer link | **Yes** |
| **Remove** organizer link | **Yes** |
| **Update** `role_label` | **Yes** |
| **Reorder** organizers (`display_order` only) | **No** |
| Company merge repointing organizer links | **Yes per affected edition** (align with §5.4 sponsor merge) |

### 10.2 Rationale

Organizer attribution is part of the public Event Detail research surface. Adding or correcting organizers is comparable to adding a sponsor or editing sponsor tier labels — it signals the edition profile was actively verified.

Pure reorder does not change factual content; it mirrors the exclusion for sponsor Move Up/Down within tier.

### 10.3 Documentation dependency

When organizer ships, **update**:

- [event-admin-workflow.md](./event-admin-workflow.md) — edition research copy
- [phase-edition-last-reviewed-automation-scope.md](./phase-edition-last-reviewed-automation-scope.md) — new § for organizer join writes

---

## 11. Resolved decisions

| # | Decision | Resolution |
|---|----------|------------|
| 1 | Scope | **Edition-scoped** only — not series |
| 2 | Entity | Reuse **`companies`** — no separate organizer entity |
| 3 | Join model | **`event_edition_organizers`** — edition↔company join with role and order |
| 4 | Dual role | Same company may be **sponsor and organizer** on one edition |
| 5 | Uniqueness | **One organizer link per company per edition** |
| 6 | Role label | Stored on join row; **default `"Organizer"`**; editable; **max 80 chars** |
| 7 | Display order | **`display_order`** on join row; server-managed |
| 8 | Public visibility | **Public** — all organizer links readable |
| 9 | Public surface (v1) | Event Detail → **Organizers tab** (`?tab=organizers`); not on Overview |
| 10 | Admin surface | **Profile embed** on edition detail — no dedicated Organizers tab; no top-level Organizers nav |
| 11 | Import pipeline | **None in v1** |
| 12 | Last reviewed | Organizer add/remove/role edit auto-touch; reorder excluded |
| 13 | Legacy `organizers` table | **Rejected** |
| 14 | Join table name | **`event_edition_organizers`** — not legacy `event_organizers` |
| 15 | Admin placement | **Profile embed** (Profile · Live sponsors · Imports) |
| 16 | Empty public state | **Always show Organizers tab**; standard empty state inside tab when zero links |
| 17 | Create company | **Escape hatch link** to Companies create — not inline modal required |
| 18 | Company public page | **Admin-only** organizer history in v1; public “Events organized” deferred |
| 19 | Global admin search | **Deferred** beyond organizer v1 |
| 20 | Audit attribution | **No `created_by` / `updated_by`** on join row in v1 — `updated_at` + edition touch suffice |
| 21 | FK delete behavior | **`ON DELETE RESTRICT`** on edition and company FKs |

---

## 12. Decisions requiring review

| # | Topic | Notes |
|---|-------|-------|
| 1 | **Role label picklist** | Free text in v1; controlled vocabulary is a future enhancement (§13) |

**Resolved (2026-07-04 UX amendment):** Organizers tab vs Profile embed → **Profile embed** for admin; dedicated **Organizers** public tab. See [phase-organizer-ux-amendment-scope.md](./phase-organizer-ux-amendment-scope.md).

None of the above block implementation.

---

## 13. Future expansion opportunities

Optional evolution paths — **not commitments** for v1:

| Enhancement | Notes |
|-------------|-------|
| Organizers on **Event Explorer** cards | Display-only; no schema change |
| **Organizer filter** on Explorer | Requires UX and query design |
| **Series-default organizers** copied to new editions | Would violate current “edition-only” rule — needs explicit v2 design |
| Excel / import column for organizers | Separate pipeline decision |
| Controlled **role label vocabulary** | Enum or admin-managed picklist |
| Public **“Events organized”** on company marketing profile | Mirror sponsorship history |
| **Provenance** fields on join row | Source URL, verified date |
| **`created_by` / `updated_by`** on join row | Per-link audit attribution |
| Organizer data in **global admin search** | Index by company name on editions |
| API exposure for partners | Read-only public API — not planned |

Standalone public organizer profile pages (`/organizers/[slug]`) remain **not planned** unless explicitly reconsidered in a future design revision.

---

## 14. Concept mapping summary

### 14.1 New table (v1)

| Concept | Table |
|---------|-------|
| Edition organizer link | **`event_edition_organizers`** |

### 14.2 Unchanged tables (v1)

| Table | Change |
|-------|--------|
| `companies` | No organizer-specific columns |
| `event_editions` | No organizer FK column — links live in join table |
| `event_series` | No organizer relationship |
| `event_sponsors` | Unchanged |

### 14.3 Rejected concepts

| Concept | Status |
|---------|--------|
| `organizers` standalone table | **Rejected** |
| `event_organizers` → `organizers` FK (legacy stub) | **Replace** with `event_edition_organizers` → `companies` |

---

## 15. Related documents

| Document | Path |
|----------|------|
| Project state | [project-state.md](./project-state.md) |
| Admin IA | [admin-information-architecture.md](./admin-information-architecture.md) |
| Event admin workflow | [event-admin-workflow.md](./event-admin-workflow.md) |
| Edition last reviewed automation | [phase-edition-last-reviewed-automation-scope.md](./phase-edition-last-reviewed-automation-scope.md) |
| Company identity ADR | [adr/ADR-001-company-identity.md](./adr/ADR-001-company-identity.md) |
| Venue design (parallel pattern) | [venue-design.md](./venue-design.md) |
| Phase — Organizer UX amendment | [phase-organizer-ux-amendment-scope.md](./phase-organizer-ux-amendment-scope.md) |
| Phase 1 events admin (historical deferral) | [phase-1-events-admin-scope.md](./phase-1-events-admin-scope.md) |

---

## 16. Maintenance rule

**Design approval (2026-07-04):** Status set to **Approved**. Phase O0 complete.

**Implementation complete (2026-07-04):** O1–O4 shipped. `event_edition_organizers` replaces the rejected legacy `event_organizers` / standalone `organizers` model.

**UX amendment approved (2026-07-04):** Admin → Profile embed; public → **Organizers** tab (always visible; in-tab empty state). Implementation pending (O5). See [phase-organizer-ux-amendment-scope.md](./phase-organizer-ux-amendment-scope.md).

| Step | Document | Action |
|------|----------|--------|
| 1 | This file | **Done** — §8–§9 amended for UX revision |
| 2 | [phase-organizer-scope.md](./phase-organizer-scope.md) | **Done** — §16 amendment reference |
| 3 | [phase-organizer-ux-amendment-scope.md](./phase-organizer-ux-amendment-scope.md) | **Done** — Approved; implementation pending |
| 4 | [project-state.md](./project-state.md) | **Done** — O5 in progress |
| 5 | [README.md](./README.md) | **Done** — Amendment link + highlights |
| 6 | [admin-information-architecture.md](./admin-information-architecture.md) | **Done** — Profile embed |
| 7 | [event-admin-workflow.md](./event-admin-workflow.md) | **Done** — Profile + public tab copy |
| 8 | [phase-edition-last-reviewed-automation-scope.md](./phase-edition-last-reviewed-automation-scope.md) | **No change** — write-path policy unchanged |

---

**End of organizer design (v1 approved).**
