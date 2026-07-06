# EventPixels — Partner Alumni Design Document

**Status:** Approved (v2)  
**Version:** v2  
**Last updated:** 2026-07-05  

Canonical design for **Partner Alumni** — long-term partner recognition curated at the **Event Series** level. Partner Alumni highlights companies that event organizers publicly recognize as long-term or recurring partners of the event brand, distinct from edition-scoped **sponsors**.

Recognition data is sourced from official event websites and maintained by EventPixels research. This document defines entity boundaries, the **versioned roster** model, admin IA, public display rules, and company detail integration.

**Supersedes:** v1 design (draft → Verify → immutable snapshot). The v1 model is **deprecated** as of 2026-07-05.

**This document is design only.** It does not specify migration SQL, API routes, implementation phases, or code.

For series admin patterns, see [Event Admin Workflow](./event-admin-workflow.md) and [Admin Information Architecture](./admin-information-architecture.md). For the company-as-entity model, see [project-state.md](./project-state.md) and [ADR-001 — Company Identity](./adr/ADR-001-company-identity.md). For parallel edition public tabs, see [Organizer Design](./organizer-design.md) and [Venue Design](./venue-design.md).

---

## 1. Product vision

During sponsor research, EventPixels researchers encounter organizer-published recognition programs such as:

- Our Partners Over The Years
- Partner Alumni
- Past Sponsors
- Similar long-term partner recognition lists

These companies are **not necessarily sponsors of the current event edition**. They are publicly recognized by the organizer as long-term or recurring partners of the **event brand** — an ongoing relationship across multiple years.

EventPixels currently has no structured way to preserve this information without mixing it into the sponsor system. Partner Alumni v2 adds a **series-scoped, versioned roster** surfaced publicly on Event Detail (and Company Detail when implemented) — without altering sponsor import, tier logic, edition-scoped sponsor rosters, or sponsor counts.

**Feature name (locked):** Partner Alumni  
**Description (locked):** Partner Alumni highlights companies that event organizers publicly recognize as long-term or recurring partners.

**Primary admin surface (locked):** series detail — `/admin/events/series/[id]` — embedded **Partner Alumni** section.

**Primary public surfaces (locked):**

1. Event Detail → **Partner Alumni** tab (conditional visibility) — **current version only**
2. Public company profile (`/sponsors/[slug]`) → **Partner Alumni** recognition section *(deferred post–public retarget)*

**Explicitly out of scope (v2 v1):** Partner Alumni section on the **Series Hub** (`/events/series/[slug]`).

---

## 2. Goals

| # | Goal |
|---|------|
| G1 | Preserve organizer-published **long-term partner recognition** separately from edition sponsors |
| G2 | Store recognition at the **Event Series** level |
| G3 | Support **multiple roster versions** over time with explicit admin control |
| G4 | Allow **large rosters** (400+ companies) via version-scoped bulk import |
| G5 | Expose **current version only** publicly; historical versions admin-only |
| G6 | Reuse existing **companies** as the recognized entity |
| G7 | Allow the **same company** to appear as sponsor (edition) and Partner Alumni member (series) simultaneously |
| G8 | Surface recognition on **public company detail** — cross-series attribution *(deferred)* |
| G9 | Align with catalog access patterns: public read of current version; admin write via service role |

---

## 3. Non-goals

### 3.1 Product non-goals (v2)

| Non-goal | Notes |
|----------|-------|
| Mixing Partner Alumni into **`event_sponsors`** | Separate tables and UI — sponsor system unchanged |
| Edition-scoped Partner Alumni storage | **Series-scoped only** |
| **Verify** / publish workflow | **Removed in v2** — no draft→Verify→snapshot lifecycle |
| **Draft roster** separate from versions | **Removed in v2** — versions are the editable workspace |
| Immutable snapshot history | **Removed in v2** — versions are editable and deletable (with safeguards) |
| Auto-creating versions from source checked date | **Rejected** — new version only via explicit **Create New Version** |
| **Series Hub** public section | **Out of scope** |
| Partner Alumni on Event Explorer cards | **Not required** |
| Standalone public Partner Alumni routes | **Not planned** |
| Top-level Partner Alumni admin nav | Series detail embed only |
| Tier-gated public visibility | **Full public read** of current version |
| Affecting **sponsor counts** | Partner Alumni queries remain separate |

### 3.2 Deferred to implementation docs

| Area | Deferred to |
|------|-------------|
| Migrations, constraints SQL, indexes | [partner-alumni-migration-design.md](./partner-alumni-migration-design.md) |
| API routes and validation modules | [phase-partner-alumni-scope.md](./phase-partner-alumni-scope.md) |
| UI component structure | Implementation scope |

### 3.3 Explicitly rejected directions (v2)

| Direction | Policy |
|-----------|--------|
| Draft → Verify → Snapshot publishing | **Deprecated v1 model — rejected** |
| Treat Partner Alumni as a sponsor tier | **Rejected** |
| Infer alumni from past `event_sponsors` rows | **Rejected** |
| Store alumni on `event_editions` | **Rejected** |
| Checked date alone creates a new version | **Rejected** |

---

## 4. Design principles

| # | Principle | Implication |
|---|-----------|-------------|
| 1 | **Company is canonical** | Partner Alumni is recognition on a series, not a new entity type. |
| 2 | **Series-centric storage** | All Partner Alumni data references `event_series.id`. Editions inherit **current version** from parent series for public display. |
| 3 | **Sponsor and Partner Alumni are independent** | Same company may appear in both; sponsor counts exclude alumni. |
| 4 | **Versions are the workspace** | No separate draft layer. Edit, bulk upload, add/remove/reorder happen on a **version**. |
| 5 | **Explicit version creation** | **Create New Version** is the only way to start a new roster lineage. |
| 6 | **Current pointer controls public** | `current_version_id` on the program row defines what the public sees. |
| 7 | **Historical versions are admin-only** | Public never browses old versions. |
| 8 | **Research-sourced metadata per version** | `recognition_label`, `primary_source_url`, `source_checked_at` live on the **version**. |
| 9 | **Warnings, not walls** | Missing Partner Alumni never blocks edition save, sponsor import, or series save. |
| 10 | **No edition review signal** | Partner Alumni changes do **not** auto-touch edition `last_reviewed_at`. |

---

## 5. Data model direction

### 5.1 Conceptual model (locked)

```
Event Series
    └── Partner Alumni Program (one per series)
            ├── current_version_id  →  public pointer
            └── Versions (1..n, admin-visible)
                    └── Version Companies (ordered members → companies)
```

**Deprecated v1 model:**

```
Program → Draft roster → Verify → Immutable Snapshot → latest_snapshot_id public
```

**v2 model:**

```
Program → Versions (editable) → current_version_id public
```

### 5.2 Table names (v2 target)

| Concept | Table (v2 target) | Notes |
|---------|-------------------|-------|
| Program (one per series) | `event_partner_alumni` | Container + `current_version_id` |
| Version | `event_partner_alumni_versions` | Evolved from v1 `event_partner_alumni_snapshots` |
| Version members | `event_partner_alumni_version_companies` | Evolved from v1 `event_partner_alumni_snapshot_companies` |
| ~~Draft roster~~ | ~~`event_partner_alumni_companies`~~ | **Removed in v2** |

Physical rename vs new tables is specified in [partner-alumni-migration-design.md](./partner-alumni-migration-design.md).

### 5.3 Program — `event_partner_alumni`

One row per **Event Series** (at most one Partner Alumni program per series).

| Column (conceptual) | Nullable | Notes |
|---------------------|----------|-------|
| `id` | NO | Primary key (uuid) |
| `event_series_id` | NO | FK → `event_series.id`; **UNIQUE** |
| `current_version_id` | YES | FK → `event_partner_alumni_versions.id`; NULL until first version set current |
| `created_at` | NO | |
| `updated_at` | NO | Application-maintained |

**Removed from program (v2):** `recognition_label`, `primary_source_url`, `latest_snapshot_id` — metadata moves to **version** rows.

### 5.4 Versions — `event_partner_alumni_versions`

Editable roster container. Created only by admin **Create New Version**.

| Column (conceptual) | Nullable | Notes |
|---------------------|----------|-------|
| `id` | NO | Primary key |
| `event_partner_alumni_id` | NO | FK → program |
| `version_label` | YES | Optional admin label (e.g. "2026 website list") |
| `recognition_label` | YES | Organizer wording (e.g. "Our Partners Over The Years") |
| `primary_source_url` | YES | Official source URL for this version |
| `source_checked_at` | YES | When source was last checked — **metadata only**; does **not** create a version |
| `created_at` | NO | When version was created |
| `updated_at` | NO | Last header or member edit |

**Explicitly excluded from v2:** `verified_at` as publication trigger (v1); immutability after create.

### 5.5 Version members — `event_partner_alumni_version_companies`

Editable company links for a version.

| Column (conceptual) | Nullable | Notes |
|---------------------|----------|-------|
| `id` | NO | Primary key |
| `event_partner_alumni_version_id` | NO | FK → version |
| `company_id` | NO | FK → `companies.id` |
| `display_order` | NO | Dense 1..n within version |
| `created_at` | NO | |
| `updated_at` | NO | Application-maintained |

### 5.6 Integrity rules (locked)

| Rule | Intent |
|------|--------|
| One program per series | `UNIQUE (event_series_id)` |
| One member per company per version | `UNIQUE (version_id, company_id)` |
| `display_order` ≥ 1 | CHECK on member table |
| New version | **Explicit admin action only** |
| Delete current version | **Safeguarded** — see §7.3 |
| Edition not stored | No `event_editions_id` on Partner Alumni tables |

### 5.7 Foreign key delete behavior (locked)

| FK | ON DELETE |
|----|-----------|
| Program → series | **RESTRICT** |
| Version → program | **RESTRICT** (or CASCADE on program delete — TBD in migration) |
| Member → version | **RESTRICT** or CASCADE when version deleted |
| Member → company | **RESTRICT** |
| Program → `current_version_id` | **RESTRICT** or SET NULL on version delete — product prefers block-or-reassign |

Parent catalog rows (series, companies) are not hard-deleted in admin v1.

---

## 6. Company relationship model

### 6.1 Partner Alumni member = company-on-a-series-version

> **Company** = global entity. **Sponsor** = company on an **edition**. **Organizer** = company on an **edition**. **Partner Alumni member** = company on a **series version**.

### 6.2 Relationship to sponsors

| Aspect | Sponsors | Partner Alumni (v2) |
|--------|----------|---------------------|
| Scope | Edition | **Series (version)** |
| Public source | Live roster | **Current version** |
| Import | Sponsor import pipeline | **Version-scoped bulk import** |
| Tier gate | Yes (anon rank 1) | **No** |
| Sponsor count | Included | **Excluded** |

### 6.3 Company merge (design intent)

When companies merge:

1. Repoint **`event_partner_alumni_version_companies.company_id`** from duplicate → canonical across **all versions** (draft repoint pattern from organizers/sponsors).
2. Resolve `UNIQUE (version_id, company_id)` violations when both companies were members of the same version.
3. **No** edition `last_reviewed_at` auto-touch.

### 6.4 Series merge (design intent)

When both series have Partner Alumni programs: **block merge** until ops resolves manually (same as v1).

---

## 7. Version workflow

### 7.1 Version lifecycle (locked)

| Action | Creates new version? | Affects public? |
|--------|----------------------|-----------------|
| **Create New Version** (**copy-from-current** default; optional empty) | **Yes** | **No** until Set as current |
| **Set as current** | No | **Yes** — updates `current_version_id`; **blocked if zero members** (OQ8) |
| Edit version header (label, source URL, checked date) | No | **Yes** if this version is current |
| Add / remove / reorder members | No | **Yes** if this version is current |
| **Bulk upload** into version | No | **Yes** if target version is current; **does not auto-set current** (OQ9) |
| **Delete version** | No | **Blocked if current** (OQ2) |

**There is no Verify action in v2.**

### 7.2 Create New Version (locked)

When admin executes **Create New Version**:

1. Create new `event_partner_alumni_versions` row.
2. **Default: copy from current version** — duplicate header fields (`version_label`, `recognition_label`, `primary_source_url`, `source_checked_at`) and **all members** with preserved `display_order`. This lets admins start from the latest roster and edit deltas instead of rebuilding 400+ companies from scratch.
3. If no current version exists, create an **empty** version (first version for the program).
4. **Do not** automatically set the new version as current — admin uses **Set as current** separately.
5. **Do not** create a version when only `source_checked_at` changes on an existing version.

Admin may optionally create an **empty** version instead of copy-from-current (secondary affordance — not the default).

### 7.3 Set as current (locked — OQ8)

Updates `event_partner_alumni.current_version_id` to the selected version. Public Event Detail and company detail (when implemented) read this version only.

| Rule | Policy |
|------|--------|
| Version has **≥1 member** | **Required** — Set as current **blocked** when version has zero companies (OQ8) |
| Version has zero members | **409 blocked** — admin must add at least one company first |
| Empty version as draft/history | Allowed — version may exist without being current |

### 7.4 Delete version (locked)

| Scenario | Policy |
|----------|--------|
| Delete **current** version | **Blocked** — admin must **Set as current** on another version first (default-payment-card rule: the active version must remain available) |
| Delete non-current version | Allowed — removes version and members |
| Delete last remaining version when it is current | **Blocked** — cannot delete the only current version; create and set another version first, or leave as-is |

### 7.5 Public read model (locked)

| Rule | Policy |
|------|--------|
| Public data source | **`current_version_id` only** |
| Member list | Current version members ordered by `display_order` |
| Header display | Current version `recognition_label`, `primary_source_url`, `source_checked_at` |
| Historical versions | **Never** shown on marketing surfaces |
| No current version or zero members | Public behaves as **no Partner Alumni data** — tab hidden |

---

## 8. Public UX

### 8.1 Event Detail — Partner Alumni tab (locked)

**Tab visibility:**

| Condition | Behavior |
|-----------|----------|
| Current version exists **and** has **≥1 company** | Show **Partner Alumni** tab |
| Otherwise | **Hide** tab |
| `?tab=partner-alumni` when hidden | Redirect to **Overview** |

**Tab order when visible:** Overview · Sponsors · Venue · Organizers · Partner Alumni

### 8.2 Partner Alumni tab — content (locked)

| Element | Source |
|---------|--------|
| Recognition label | Current version |
| Source URL | Current version `primary_source_url` |
| Checked date | Current version `source_checked_at` (display policy in scope doc) |
| Company list | Version members + `companies`; `display_order` ASC |

Data resolved via edition → `series_id` → program → `current_version_id` → members.

### 8.3 Public company detail

Deferred until after public retarget (PA4′). When implemented: show recognitions where company appears in **current version** of each series program.

### 8.4 Out of scope (public)

Series Hub, Overview tab block, historical version browser, Explorer cards, standalone routes.

### 8.5 Access model (RLS intent — locked)

Public pages **never** browse all versions. The server resolves the current version **server-side**:

1. Service role (or admin client) reads `event_partner_alumni.current_version_id` for the series program.
2. Server fetches that version’s header and members for the public response.
3. Anon/authenticated clients do **not** receive a list of historical versions.

| Role | Access |
|------|--------|
| Anonymous / authenticated | **No direct SELECT** on program pointer or non-current versions |
| Public marketing routes | **Server-composed** payload from `current_version_id` only |
| Non-current versions | **Admin / service role only** |
| Client writes | **None** |

Version and member tables may remain RLS-locked for anon/authenticated (recommended post–PA1′) since public reads are fully server-mediated.

---

## 9. Admin UX

### 9.1 Series-scoped management (locked)

Partner Alumni on **Event Series detail** — `/admin/events/series/[id]`.

### 9.2 Partner Alumni section (v2)

| Affordance | Behavior |
|------------|----------|
| **Version list** | All versions for series; indicates **current** |
| **Create New Version** | **Copy-from-current default** (header + members); optional empty; does not auto-set current |
| **Set as current** | Updates public pointer — **blocked if version has zero members** (OQ8) |
| **Delete version** | **Blocked when current** — reassign first (OQ2) |
| **Version editor** | Selected version: header fields + member roster |
| **Add / remove / reorder** | On selected version |
| **Bulk upload** | Targets **selected version** — preview/commit import |
| Create company link | Escape hatch to `/admin/companies/new` |

**Removed from v2:** Verify button, draft roster, snapshot history terminology, latest verified summary tied to Verify.

### 9.3 Bulk import (locked intent)

Comparable operational quality to existing bulk upload workflows (matching, review rows, company creation, logo enrich, display order preservation). Import **never** creates a version implicitly. Import **never** sets a version as current — admin must explicitly use **Set as current** after import (OQ9). See [phase-partner-alumni-scope.md](./phase-partner-alumni-scope.md).

### 9.4 Admin company detail

Read-only Partner Alumni recognition (deferred). Write surface remains series detail.

### 9.5 Gates

| Workflow | Partner Alumni required? |
|----------|-------------------------|
| Save series / create edition / sponsor import | **No** |
| Set as current | Requires version with **≥1 member** (OQ8) |
| Bulk import commit | Does **not** auto-set current (OQ9) |

---

## 10. `last_reviewed_at` policy (locked)

Partner Alumni changes do **not** auto-touch edition `last_reviewed_at` (unchanged from v1).

---

## 11. Resolved decisions (v2)

| # | Decision | Resolution |
|---|----------|------------|
| 1 | Feature name | **Partner Alumni** |
| 2 | Storage level | **Event Series** |
| 3 | Roster model | **Versions** — editable, deletable |
| 4 | Draft table | **Removed** — no `event_partner_alumni_companies` |
| 5 | Verify / snapshots | **Removed** — no Verify action |
| 6 | Public pointer | **`current_version_id`** |
| 7 | Public visibility | **Current version only** |
| 8 | Version creation | **Explicit Create New Version only** |
| 9 | Checked date | **Metadata per version** — not a version trigger |
| 10 | vs Sponsors | **Orthogonal** — separate tables; counts unaffected |
| 11 | Series hub | **Out of scope** |
| 12 | Bulk import | **Version-scoped** — in scope v2 |
| 13 | Large rosters | **Supported** (400+ via bulk import) |
| 14 | Edition `last_reviewed_at` | **No** auto-touch |
| 15 | Tier gate | **None** |
| 16 | Create New Version default | **Copy current** (header + members) |
| 17 | Delete current version | **Blocked** — reassign current first |
| 18 | Schema evolution | **Rename** snapshot tables → versions (no parallel system) |
| 19 | v1 draft rows at migration | **Discard** (no production data) |
| 20 | Public current resolution | **Server-side** via `current_version_id` |
| 21 | Set as current on empty version | **Blocked** — requires ≥1 member (OQ8) |
| 22 | Bulk import auto-set current | **No** — explicit Set as current only (OQ9) |

---

## 12. Deprecated v1 model (reference only)

The following v1 concepts are **deprecated** and must not be implemented in new work:

- `event_partner_alumni_companies` (draft roster)
- **Verify** action and `/partner-alumni/verify` API
- `latest_snapshot_id` public pointer
- Immutable snapshots
- `verified_at` as publication timestamp
- Draft vs public separation

Existing v1 migration and code may exist in the repository until PA1′ corrective migration and application retarget are complete.

---

## 13. Related documents

| Document | Path |
|----------|------|
| Implementation scope (v2) | [phase-partner-alumni-scope.md](./phase-partner-alumni-scope.md) |
| Migration design (v2) | [partner-alumni-migration-design.md](./partner-alumni-migration-design.md) |
| Project state | [project-state.md](./project-state.md) |

---

## 14. Maintenance rule

| Step | Document | Action |
|------|----------|--------|
| 1 | This file | **Done** — v2 approved design (PA0′) |
| 2 | [phase-partner-alumni-scope.md](./phase-partner-alumni-scope.md) | **Done** — v2 scope |
| 3 | [partner-alumni-migration-design.md](./partner-alumni-migration-design.md) | **Done** — v2 target + PA1′ path |
| 4 | [project-state.md](./project-state.md) | Updated PA0′ |
| 5 | [README.md](./README.md) | Updated index |

---

**End of Partner Alumni design (v2 approved).**
