# EventPixels — Project State

> Single source of truth for current project status.
> Last updated: 2026-07-24 (Exhibitors E1–E6 shipped; Partner Alumni batch import shipped; legacy PA drawer still present)

**Naming:** The product is **EventPixels**. The repository and npm package are named **handshakes**.

## 1. Project Summary

EventPixels is a directory of business events and their sponsors — a public marketing site (event editions, sponsor rosters, sponsor profiles; searchable by event, industry, and location) plus an admin console for curating that data at scale.

Admins maintain the catalog through bulk Excel imports and direct roster editing on each edition's Live sponsors tab (and parallel exhibitor / Partner Alumni import flows where those domains apply).

## 2. Current Architecture

Next.js (App Router) + Supabase (Postgres, RLS). Server components fetch data; admin mutations go through `/api/admin/...` routes gated by `requireAdminApi()` (`profiles.role = admin`). Manual validators in `src/lib/validation/`; no server actions, no Zod, no generated DB types. Strict TypeScript; `npm run build` is the merge gate.

### Domain model

| Entity | Table | Notes |
|---|---|---|
| **Event Series** | `event_series` | Recurring event brand (name, slug, description, website, logo). |
| **Event Editions** | `event_editions` | Series occurrence (year, dates, city, website, globally unique slug). Multiple editions per series + year allowed. Optional `venue_id` → `venues`. `last_reviewed_at` auto-updates on meaningful admin curation (exhibitors excluded — manual-only). |
| **Venues** | `venues` | Reusable named location (name, slug, city, address, website, logo). Linked to editions via nullable `event_editions.venue_id`; `city_id` retained on editions. Archive-only lifecycle (`archived_at`). See [venue-design.md](./venue-design.md) and [phase-venue-scope.md](./phase-venue-scope.md). |
| **Companies** | `companies` | Canonical company entity. No separate sponsors table — "sponsor" = company linked to an edition. Optional `restricted_at` excludes public discovery/profile. |
| **Event Sponsors** | `event_sponsors` | Edition-scoped join: `tier_rank`, `tier_label`, `display_order` (dense 1..n within edition + tier). `UNIQUE (event_editions_id, company_id)`. |
| **Event Exhibitors** | `event_exhibitors` | Edition-scoped join: `tier_rank`, `tier_label`, within-tier `display_order`. Orthogonal to sponsors/organizers. Migration: `20260725130000_event_exhibitors_v1.sql`. See [exhibitor-design.md](./exhibitor-design.md). |
| **Event Edition Organizers** | `event_edition_organizers` | Edition-scoped join: company as organizer with `role_label` (default "Organizer") and `display_order`. `UNIQUE (event_editions_id, company_id)`. Replaces rejected legacy `event_organizers` → `organizers` architecture (those tables were never shipped). See [organizer-design.md](./organizer-design.md) and [phase-organizer-scope.md](./phase-organizer-scope.md). |
| **Keywords** | `keyword`, `event_series_keyword` | Attach to series; editions inherit (read-only chips on edition profile). |
| **Partner Alumni** *(v2 — program/admin shipped)* | `event_partner_alumni`, `event_partner_alumni_versions`, `event_partner_alumni_version_companies` | Series-scoped **versioned** roster; **`current_version_id`** public pointer (server-side resolution); version-scoped bulk import; company merge repoints version members. Separate from sponsors. Migrations: `20260710120000_partner_alumni_v1.sql`, `20260711120000_partner_alumni_v2_versions.sql`, `20260712120000_company_merge_partner_alumni.sql`. See [partner-alumni-design.md](./partner-alumni-design.md), [phase-partner-alumni-scope.md](./phase-partner-alumni-scope.md). |
| **Logos** | columns on `companies`; `event_series.logo_url`; `venues.logo_url` | Companies: Logo.dev ingest + metadata. Event series and venues: manual HTTP URL and/or file upload to `COMPANY_LOGO_BUCKET` (`venues/{id}/logo.{ext}`). Event edition logos are manual-only. |
| **Imports** | `sponsor_import_*`; Partner Alumni import tables; `exhibitor_import_*` | Excel pipelines → validate/match → draft → publish. Sponsor: one active batch per edition. Exhibitor: edition-scoped independent pipeline (writes `event_exhibitors` only). Partner Alumni: version-scoped batch import. |

### Access rules (RLS)

- `event_sponsors`: anon SELECT only where `tier_rank = 1`; authenticated SELECT all tiers; no client writes.
- `event_edition_organizers`: anon and authenticated SELECT all rows (no tier gate); no client writes.
- `event_exhibitors`: anon and authenticated SELECT all rows (organizer-like; no sponsor tier gate); no client writes.
- `event_partner_alumni` / draft tables (v1): RLS enabled; **no** anon/authenticated SELECT — **draft table removed in v2 (PA1′)**.
- `event_partner_alumni_snapshots` / snapshot members (v1): anon SELECT all rows — **v2: current version only (or server-resolved)**.
- Core catalog tables: public SELECT; admin writes via service role.
- Import tables: service role only.

### Canonical ordering

Roster reads use `getCompaniesByEventEdition`: `tier_rank ASC NULLS LAST, display_order ASC NULLS LAST, id ASC`. The `/sponsors` explorer applies the same tiebreaks client-side. Exhibitor public/admin lists use the same tier + `display_order` family.

## 3. Completed Features

**Public site** — Event explorer, event detail with tiered sponsors, sponsor search and detail, city pages, global search.

**Admin — catalog** — Series, editions, companies: CRUD with slug-change guards, location/city support, profile-completeness warnings and filters. Series keywords with edition inheritance.

**Admin — sponsor roster** (edition detail → Live sponsors tab)
- Edit tier label / tier rank via drawer (rank 1–1000 when edited; label clearable, ≤ 80 chars).
- Add sponsor: company search picker (already-attached companies disabled), required rank, optional label; escape-hatch link to Companies.
- Remove sponsor: confirm modal ("removed from this edition only"; rank-1 visibility warning).
- Same-tier ordering: Move Up / Down (server-managed `display_order`; no manual numeric input).
- Import-conflict banner when an active import batch exists.

**Admin — companies** — Read-only Sponsorships section (edition + series links, tier label, rank). Read-only Exhibitor history when the company has ≥1 exhibitor link (section omitted when empty). Restrict / unrestrict for public-policy companies.

**Admin — sponsor imports** — Full Excel pipeline through atomic publish and history. Spreadsheet columns: Sponsor Tier (`tier_rank`), Sponsor Label (`tier_label`), Name, Website. Publish writes both rank and label from draft links; blank spreadsheet labels publish as NULL. Qualifying publish auto-updates edition `last_reviewed_at`.

**Admin — exhibitors (E1–E6)** — Edition **Exhibitors** tab: add / edit tier / remove / within-tier reorder; `assertCompanyLinkable` on create; company-merge exhibitor conflict resolution. **Manual-only** `last_reviewed_at` (no auto-touch on exhibitor CRUD/reorder/import publish). **Bulk Upload (E6):** edition-scoped independent pipeline (`src/features/exhibitor-import/**`, `/admin/exhibitor-imports`, migration `20260726120000_exhibitor_import_v1.sql`) — spreadsheet Exhibitor Tier | Exhibitor Label | Name | Website; publish writes **`event_exhibitors` only** (never `event_sponsors`). Entry from edition Exhibitors tab (no global exhibitor-imports hub). See [exhibitor-design.md](./exhibitor-design.md).

**Admin — edition research metadata** — `last_reviewed_at` auto-updates on meaningful profile saves, live sponsor add/remove/tier edits, organizer add/remove/role-label edits, and qualifying **sponsor** import publish. Edition create keeps `last_reviewed_at` NULL. Manual-only Last reviewed / Primary source saves are preserved. Sponsor/organizer reorder/move and draft import steps do not touch. **Exhibitor** mutations and exhibitor-import publish do **not** auto-touch. Company merge auto-touches editions when organizer links are repointed. See [phase-edition-last-reviewed-automation-scope.md](./phase-edition-last-reviewed-automation-scope.md).

**Admin — organizers** — **Organizers** section on edition **Profile** (edition metadata alongside venue, website, city, dates): list, add via company search, edit role label, Move Up/Down, remove. Read-only **Organizer roles** on company detail. Company merge repoints organizer links with conflict resolution. See [phase-organizer-scope.md](./phase-organizer-scope.md) and [phase-organizer-ux-amendment-scope.md](./phase-organizer-ux-amendment-scope.md).

**Admin — venues** — List, create, edit, archive/unarchive at `/admin/venues`. Optional venue picker on edition create/edit (city-filtered; inline Add venue). Logo via HTTP URL paste or file upload on edit. Duplicate names in same city warn only. `city_id` immutable when editions linked.

**Admin — Partner Alumni (v2)** — Version-centric admin on series detail: create version (copy-from-current default), set current, delete (block current), member CRUD. **Batch import shipped** (full-page stepper under version import routes; modeled on Sponsor Import per [partner-alumni-import-redesign.md](./partner-alumni-import-redesign.md)). Legacy PA3′ **drawer bulk upload still present** in series admin (deprecation incomplete — PA-IMP-5). Public edition tab reads `current_version_id` only. Company merge repoints `event_partner_alumni_version_companies` with same-version dedupe. See [phase-partner-alumni-scope.md](./phase-partner-alumni-scope.md).

**Public — venue** — Event edition detail tabs include Venue (`?tab=venue`). No public `/venues/...` routes; Explorer cards unchanged (city only).

**Public — organizers** — Event edition detail tabs include **Organizers** (`?tab=organizers`). Organizers tab always visible; list or standard empty state inside tab. Fully public (no tier gate). No organizers block on Overview. No `/organizers/...` routes; no “Events organized” on public company pages in v1.

**Public — exhibitors** — Event edition detail **Exhibitors** tab hide-when-empty (`?tab=exhibitors`); restricted-company scrubbing on rows. Company public **Exhibitor history** when non-empty. Marketing `/exhibitors` stub remains; Exhibitor Discovery out of scope (`PROD-002`).

## 4. In Progress

**Partner Alumni import cleanup** — Full-page batch import is live; **PA-IMP-5** (deprecate / remove legacy drawer + old preview/commit paths) not finished while `PartnerAlumniBulkUploadDrawer` remains wired. Golden-file / production NFT NYC re-import discipline remains governed by [partner-alumni-import-redesign.md §19](./partner-alumni-import-redesign.md). Dashboard resume for Partner Alumni imports remains a product gap (`PROD-003`).

**Known limitations (catalog-wide)**
- Import publish can overwrite manual `tier_rank` and re-add removed sponsors for companies in the batch (warning banner only).
- No pagination/search on admin lists (editions, companies, venues, edition roster).
- Venue logo URL paste stores the URL as-is (no automatic ingest into Storage); file upload writes to `COMPANY_LOGO_BUCKET`. External URL ingest deferred to a future enhancement.
- Company merge does not yet auto-touch editions when **sponsorship** links change (organizer merge touch is implemented; sponsorship touch remains optional follow-up).
- Concurrent admin edits are last-write-wins.
- Three parallel import subsystems (sponsor / partner-alumni / exhibitor) — structural duplication tracked as `ARC-011`.

## 5. Key Decisions

| Decision | Rationale |
|---|---|
| Edition detail = primary roster surface; Company page = entity surface | Roster data is edition-scoped; identity is global. Each surface shows the other read-only. |
| Drawer editing, not inline tables or per-sponsor pages | Matches admin patterns; join record is two fields. |
| `tier_rank` cannot be cleared to null from the UI | Drives ordering and anon visibility (see RLS). |
| `display_order` is server-managed (Move Up/Down only) | Server owns dense numbering within each tier. |
| **Imports append, never reorder** | New/tier-changed rows land at end of tier; unchanged rows keep `display_order`. |
| **Spreadsheet owns import tier rank + label** | Column mapping requires Sponsor Label; publish syncs `tier_label` from draft links (NULL when blank). |
| Bulk via import, corrections via roster UI | Same page hosts both paths; banner when import is active. |
| "Remove from edition" never deletes the company | Modal language makes scope explicit. |
| Companies = entity; sponsor = company-on-an-edition | Reduces navigation ambiguity. |
| **Exhibitors orthogonal to sponsors** | Separate join + independent import; exhibitor publish never writes `event_sponsors`. |
| **Exhibitor `last_reviewed_at` is manual-only** | Exhibitor CRUD / reorder / import publish do not auto-touch research freshness. |
| **Edition `last_reviewed_at` automation** | Meaningful profile + live sponsor/organizer roster + qualifying sponsor import publish set `now()`; create stays NULL; manual-only research saves preserved; reorder/move excluded | Feeds Event Explorer **Recommended** / **Recently Reviewed** sort signals |
| API routes + service role; manual validation; hand-rolled UI | Existing codebase conventions; build is the gate. |

**Other sources:** schema in `supabase/migrations/`; phase design docs in `docs/` for detail beyond this file; project-wide roadmap index [implementation-roadmap.md](./implementation-roadmap.md); recurring engineering reviews and the live [Findings Register](./health/findings-register.md) under [`docs/health/`](./health/README.md).

## 6. Operations

- **Migrations:** apply with `supabase db push` against the linked project. Deploy migrations before code that depends on new columns or RPC changes.
- **Verification:** `npm run build` plus `npx tsx --test` on policy/wiring tests and manual API/UI checks.
- **Auth:** admin layout requires `profiles.role = admin`; public reads use RLS on the anon/authenticated Supabase client.

## 7. Next Priorities

1. **Partner Alumni import (PA-IMP-5)** — Deprecate/remove legacy drawer + old preview/commit routes; keep batch import as the only bulk path.
2. Partner Alumni golden-file / NFT NYC production re-import only per [partner-alumni-import-redesign.md §19](./partner-alumni-import-redesign.md).
3. Server-side pagination + search for edition roster and admin lists (admin global search also `PROD-001`).
4. Create-and-attach company from Add-sponsor drawer (with dedupe safeguards).
5. Import publish hardening (preserve manual rank edits when unchanged in batch).
6. Edition form helper text for Last reviewed automation (optional UX polish).
7. Company merge — auto-touch `last_reviewed_at` when **sponsorship** links change (organizer path done; optional Phase 4).
8. Organizer O5 / v1 manual QA per [phase-organizer-ux-amendment-scope.md §7](./phase-organizer-ux-amendment-scope.md).
9. Public company detail Partner Alumni recognition section (deferred).
10. Cleanups: remove dead stubs (`EditionImportsStub.tsx`, `/admin/events/new` redirect); consolidate duplicated tier-label helpers; Partner Alumni drawer removal (ties to item 1).
11. Venue logo URL ingest into Storage (mirror Event Series `resolveEventManualLogoUrl` pattern) and storage cleanup on logo clear.

---

**Maintenance rule:** Update this file in the same change that completes any approved scope. Keep §5 (decisions) and §7 (priorities) as the sections that grow; revise other sections in place rather than appending history.
