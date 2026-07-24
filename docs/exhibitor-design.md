# EventPixels — Exhibitor Design Document

**Status:** Approved
**Version:** v1.1
**Last updated:** 2026-07-24 (E6 Bulk Import marked shipped)

Canonical design for **Exhibitor** as an edition-scoped relationship between an **Event Edition** and a **Company**. Exhibitors answer *who exhibited at this occurrence* — inside the Event Edition and company-profile experiences, not as a standalone Exhibitor Discovery product.

**Source roster columns (research):** Exhibitor Tier, Exhibitor Label, Name, Website. Name and Website remain on `companies`; tier metadata lives on the join.

**Authority:** This document remains the product-design source of truth for exhibitor rules. Implementation status for phases E0–E6 is recorded in §10 (do not treat older “future / deferred” wording elsewhere as current delivery state without checking §10).

**Related architecture (do not duplicate):**

| Topic | Source of truth |
|-------|-----------------|
| Company as canonical entity | [ADR-001](./adr/ADR-001-company-identity.md), [project-state.md](./project-state.md) |
| Website / domain identity | [ADR-002](./adr/ADR-002-company-website-canonical-identity.md) |
| Sponsor join + tier visibility | [project-state.md](./project-state.md), [ADR-003](./adr/ADR-003-tier-lazy-loaded-event-sponsors.md) |
| Organizer join (closest structural twin for RLS) | [organizer-design.md](./organizer-design.md) |
| Hide-when-empty public tab pattern | Partner Alumni — [partner-alumni-design.md](./partner-alumni-design.md), `shouldShowPublicPartnerAlumniTab` |
| Research freshness | [phase-edition-last-reviewed-automation-scope.md](./phase-edition-last-reviewed-automation-scope.md) |
| Import matching | [sponsor-import-database-design.md](./sponsor-import-database-design.md), `companyImportMatching` (reused by shipped E6 exhibitor import) |

---

## 1. Why Exhibitors

Exhibitors are **rare in current research data** — many editions will have none. They remain an important **event↔company role** and are expected to grow as coverage expands.

v1 does **not** build Exhibitor Discovery, stats, or SEO landers. It establishes the **correct foundation** so exhibitor rows can be curated whenever lists become available, without inventing a parallel company model or folding exhibitors into sponsors.

---

## 2. Product model

### 2.1 Definitions

| Concept | Meaning |
|---------|---------|
| **Company** | Global organization (`companies`) — identity, website, domains, logo |
| **Sponsor** | Company linked to an edition via `event_sponsors` (tiered; public tier-gated) |
| **Organizer** | Company linked to an edition via `event_edition_organizers` |
| **Exhibitor** | Company linked to an edition via `event_exhibitors` (tier metadata; **full public read**) |

There is **no** separate exhibitor company type, exhibitor logo, or exhibitor website.

### 2.2 Principles (locked)

| # | Principle | Implication |
|---|-----------|-------------|
| 1 | **Company is canonical** | Exhibitor is a **role on an edition**, not a new catalog entity |
| 2 | **Edition-centric** | Links reference `event_editions.id` only — never Event Brand / `event_series` |
| 3 | **Orthogonal to Sponsors and Organizers** | Separate join tables; uniqueness is **per table** |
| 4 | **Multi-role allowed** | Same company may be Sponsor **and** Exhibitor **and** Organizer on one edition |
| 5 | **Sponsor-like tier metadata; not sponsor visibility** | Join stores `tier_rank` / `tier_label` / within-tier `display_order`. Do **not** copy sponsor anon RLS, ADR-003 lazy load, Discovery, or sponsor-only APIs |
| 6 | **Reuse identity stack** | Matching / create-company / domains use existing Company Identity code |
| 7 | **Public hide-when-empty** | Public Exhibitors tab and Exhibitor History appear only when count ≥ 1 |
| 8 | **Admin always available** | Admin can manage exhibitors when count is zero |

### 2.3 Relationship matrix

| Aspect | Sponsors | Organizers | Exhibitors (v1) |
|--------|----------|------------|-----------------|
| Join table | `event_sponsors` | `event_edition_organizers` | `event_exhibitors` |
| Extra fields | `tier_rank`, `tier_label`, within-tier `display_order` | `role_label`, edition `display_order` | `tier_rank`, `tier_label`, within-tier `display_order` |
| Public visibility | Tier-gated (ADR-003) | Full public; **tab always visible** | Full public; **tab hidden when empty** |
| Admin surface | Live sponsors tab | Profile section | Dedicated **Exhibitors** admin tab (peer to Live sponsors) |
| Import (v1) | Excel pipeline | None | **None** — deferred (§11) |
| Same company + other roles | Allowed | Allowed | **Allowed** |

---

## 3. Database schema (locked)

### 3.1 Table: `event_exhibitors`

Name mirrors `event_sponsors` (short join name). Columns:

| Column | Nullable | Notes |
|--------|----------|-------|
| `id` | NO | UUID PK |
| `event_editions_id` | NO | FK → `event_editions.id` |
| `company_id` | NO | FK → `companies.id` |
| `tier_rank` | YES | Same app rules as sponsors: integer 1–1000 on create/update; DB nullable |
| `tier_label` | YES | Same app rules as sponsors: trim empty → NULL; max **80** chars |
| `display_order` | YES | Dense 1..n **within** `(edition, tier_rank)` (including null tier partition) |
| `created_at` | NO | |
| `updated_at` | NO | |

**Name and Website** are **not** stored on this table — they live on `companies`.

**Excluded from v1:** booth/hall, categories, floor-plan coordinates, package types, provenance/import FKs, soft-archive, series_id, per-link logos/websites, sponsor RLS / Discovery / ADR-003.

### 3.2 Integrity (locked)

| Rule | Policy |
|------|--------|
| One link per company per edition | `UNIQUE (event_editions_id, company_id)` |
| No series FK | Edition only |
| FK delete | `ON DELETE RESTRICT` on edition and company (same family as organizers) |
| Indexes | `(event_editions_id, tier_rank, display_order)`, `(company_id)` |

### 3.3 RLS / access (locked)

Mirror **organizers**, not sponsors:

| Role | Access |
|------|--------|
| `anon` / `authenticated` | `SELECT` all rows (**no** `tier_rank = 1` gate) |
| Client writes | **None** |
| Admin writes | Service role via `/api/admin/...` + `requireAdminApi()` |

### 3.4 What is not stored

| Concept | Derivation |
|---------|------------|
| Public exhibitor list | Rows for edition ordered by `tier_rank`, `display_order`, embed `companies` |
| Exhibitor count | `COUNT(*)` by `event_editions_id` |
| Company exhibitor history | Rows by `company_id` |

---

## 4. Admin behavior (locked)

### 4.1 Edition admin — Exhibitors tab

Peer to **Live sponsors** on edition detail (not Profile embed):

| Capability | Behavior |
|------------|----------|
| List | Ordered by tier then `display_order`; show company + tier rank/label |
| Add existing company | Company search picker (`status = active`); disable already-linked exhibitors; require `tier_rank`; optional `tier_label` |
| Edit tier | Inline or drawer PATCH on the link (sponsor-like validation) |
| Remove | Confirm modal — removes **exhibitor link only** (does not affect sponsor/organizer links or the company) |
| Reorder | Move Up / Down **within tier**; server-managed dense `display_order`; no free numeric input |
| Empty roster | Panel still usable — clear empty state + Add control |

Adding as exhibitor **must not** block or remove sponsor/organizer links, and vice versa.

### 4.2 Company admin

Read-only **Exhibitor history** on company detail when the company has ≥1 exhibitor link; **omit the section entirely when empty** (stricter than Sponsorships / Organizer roles empty-state pattern).

### 4.3 Linkability (locked)

| Concern | Policy |
|---------|--------|
| Merged / non-active companies | Excluded from picker **and** rejected on create/link — **search filtering alone is not sufficient** |
| Restricted companies | May be linked in admin (research may need the row); public display scrubbed (§7) |
| Shared assert | Exhibitor create/link **must** call `assertCompanyLinkable` (company `status = active` and not merged). Prefer sharing the helper with other roles later |

---

## 5. Public behavior (locked)

### 5.1 Event Detail — Exhibitors tab

| Rule | Policy |
|------|--------|
| Show tab | Only when exhibitor count ≥ 1 |
| Hide tab | When count = 0 — **no** in-tab empty state (unlike Organizers / Sponsors) |
| Deep link | `?tab=exhibitors` when hidden → fall back to Overview (same family as Partner Alumni) |
| Content | Company name, logo, profile link when public; tier label/rank as curated; within-tier order |
| Overview | **No** exhibitor block in v1 |
| Explorer / series hubs | **No** exhibitor chips or filters in v1 |
| Lazy loading | **No** — do not copy ADR-003 |

**Suggested tab order:**

```
Overview | Sponsors | Exhibitors* | Venue | Organizers | Partner Alumni*
```

\* Exhibitors and Partner Alumni only when their show predicates pass.

### 5.2 Access model

Full public read of exhibitor links (no auth gate on the roster itself). Company profile links and restricted scrubbing follow §7.

---

## 6. Company Profile behavior (locked)

Public company pages remain at `/sponsors/[slug]` (existing company URL namespace).

| Surface | Policy |
|---------|--------|
| Public **Exhibitor history** | Shown only when ≥1 exhibitor link; **hidden when empty** |
| Auth gating | **Visible without authentication** (no sign-in gate). Still **hidden when empty** |
| Admin company detail | §4.2 — hide section when empty |
| Exhibitor-specific public routes | **None** (`/exhibitors/[slug]` not introduced) |
| Marketing `/exhibitors` stub | **Do not modify or activate** — discovery remains out of scope |

---

## 7. Restricted company handling (locked)

Follow the **stronger Sponsor roster** masking behavior (`isCompanyRestricted` / `companyPublicRestriction.ts`), not the weaker organizer public path:

| Context | Policy |
|---------|--------|
| Public exhibitor row | If `restricted_at` set: show policy message; **no** logo, domain, or profile link |
| Public company page | Restricted companies already 404 / excluded from discovery — unchanged |
| Admin | Restricted companies remain visible and linkable for curation |

---

## 8. Company merge behavior (locked)

When merging companies, exhibitor links follow the same **repoint / conflict** family as **sponsors** (edition-level tier package):

| Situation | Policy |
|-----------|--------|
| Only duplicate has exhibitor on edition | Repoint `company_id` to canonical (tier fields unchanged on that row) |
| Only canonical has exhibitor | Leave canonical row |
| **Both** have exhibitor on same edition | Conflict — admin chooses strategy below, then delete the duplicate row |

### 8.1 Same-edition strategies (locked)

| Strategy | Behavior |
|----------|----------|
| `keep_canonical` | Keep canonical row as-is; delete duplicate link |
| `keep_duplicate_tier` | Copy duplicate `tier_rank`, `tier_label`, and `display_order` onto the canonical link; then delete duplicate |

Ordinary same-edition exhibitor tier edits are **E2 CRUD**, not Company Merge.

### 8.2 Resolutions shape

Preview lists **every** edition where both companies have an exhibitor link.
`required_resolutions.exhibitor_conflicts` is an array of **edition UUIDs** (same shape as sponsorship conflicts).
Admin resolutions: `{ event_edition_id, strategy }` with `keep_canonical` \| `keep_duplicate_tier`.

**Ordering (locked):** Company merge **preview** and **conflict resolution** for exhibitors must ship before (or in the same release as) the merge **commit** path that writes `event_exhibitors`. Merge must not silently drop or duplicate exhibitor links.

Merge may collect affected edition IDs for tooling (`collectExhibitorMergeEditionIds`), but does **not** auto-touch `last_reviewed_at` (manual-only product policy).

---

## 9. `last_reviewed_at` policy (locked)

**Manual-only** — same product policy as live sponsors and organizers. Do **not** auto-touch `event_editions.last_reviewed_at` on exhibitor create, update, delete, reorder, import publish, or company-merge exhibitor side effects. Researchers set **Last reviewed** on the edition Profile form when appropriate. Guarded by `editionLastReviewedManualOnly.test.ts`.

| Action | Auto-touch `last_reviewed_at` |
|--------|-------------------------------|
| Add / edit / remove exhibitor | **No** |
| Reorder only (`display_order`) | **No** |
| Company merge exhibitor side effects | **No** |
| Future import publish (when built) | **No** |

---

## 10. Phased implementation plan

| Phase | Deliverable | Status |
|-------|-------------|--------|
| **E0 — Design lock** | This document approved; open decisions closed | Complete |
| **E1 — Schema + merge** | `event_exhibitors` + RLS/grants; company-merge preview/commit for exhibitor conflicts | Shipped (`20260725130000_event_exhibitors_v1.sql`) |
| **E2 — Admin CRUD** | Edition Exhibitors tab: add / edit tier / remove / within-tier reorder; `assertCompanyLinkable` on create; **no** auto last-reviewed | Shipped |
| **E3 — Public Event Detail** | Gated Exhibitors tab; restricted scrubbing; deep-link fallback | Shipped |
| **E4 — Public company profile** | Exhibitor history section; hide when empty; auth parity documented | Shipped |
| **E5 — Hardening** | Tests, merge QA; no discovery product | Shipped |
| **E6 — Bulk import** | Independent draft→publish into `event_exhibitors` only (writes exhibitor tiers; **no** writes to `event_sponsors`); reuses `companyImportMatching` + identity/create/domain link | **Shipped** (`20260726120000_exhibitor_import_v1.sql`, `src/features/exhibitor-import/**`, `/admin/exhibitor-imports`; commit `a33f304`) |

**History:** E0–E5 were scoped as **Exhibitors v1**. E6 was originally labeled post-v1 / future in this document; it is now shipped. Do not revert E6 to “future” without a deliberate product decision.

---

## 11. Out of scope (v1)

| Item | Notes |
|------|-------|
| Exhibitor Discovery / marketing productization of `/exhibitors` | Stub may remain; do not expand (`PROD-002`) |
| Homepage or public exhibitor statistics | |
| Exhibitor SEO landing pages | |
| Booth / hall / floor-plan coordinates | |
| Advanced booth packages | |
| Separate exhibitor logos, websites, or company records | |
| Series-level exhibitors | Edition only |
| Sponsor RLS / ADR-003 lazy-load / Sponsor Discovery APIs | Do not copy |
| Folding exhibitors into `event_sponsors` | Forbidden |
| Bulk import | **Was** deferred to E6; **E6 is now shipped** (see §10) |
| Overview / Explorer exhibitor UI | |
| Changing event indexability to depend on exhibitor count | Keep sponsor-driven unless product revisits |

---

## 12. Open items for later phases only

Product decisions above are locked. Residual engineering follow-ups (not new phases):

1. When to extend `assertCompanyLinkable` to sponsor/organizer create paths (follow-up hardening).
2. Marketing `/exhibitors` stub framing vs live product language (`PROD-002`).

---

## 13. Success criteria (v1)

- Researchers can record exhibitors on an edition with zero prior exhibitor data.
- Public visitors never see an empty Exhibitors tab.
- A company can be sponsor + exhibitor (+ organizer) on the same edition without conflict.
- Restricted companies do not leak logos/links on public exhibitor rows.
- Company merge cannot silently drop or duplicate exhibitor links without resolution.
- No Exhibitor Discovery surface ships.
- Researchers can bulk-upload exhibitors via the independent E6 pipeline without writing `event_sponsors`.

---

## Document history

| Date | Change |
|------|--------|
| 2026-07-24 | E2 locked: manual-only `last_reviewed_at` |
| 2026-07-24 | E6 Bulk Import marked **shipped**; E0–E5 status column added; preserved post-v1 history note for E6 |
