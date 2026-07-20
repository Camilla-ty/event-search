# EventPixels — Project State

> Single source of truth for current project status.
> Last updated: 2026-07-06 (Partner Alumni import PA-IMP-4 admin UI complete; PA-IMP-5 next)

**Naming:** The product is **EventPixels**. The repository and npm package are named **handshakes**.

## 1. Project Summary

EventPixels is a directory of business events and their sponsors — a public marketing site (event editions, sponsor rosters, sponsor profiles; searchable by event, industry, and location) plus an admin console for curating that data at scale.

Admins maintain the catalog through bulk Excel imports and direct roster editing on each edition's Live sponsors tab.

## 2. Current Architecture

Next.js (App Router) + Supabase (Postgres, RLS). Server components fetch data; admin mutations go through `/api/admin/...` routes gated by `requireAdminApi()` (`profiles.role = admin`). Manual validators in `src/lib/validation/`; no server actions, no Zod, no generated DB types. Strict TypeScript; `npm run build` is the merge gate.

### Domain model

| Entity | Table | Notes |
|---|---|---|
| **Event Series** | `event_series` | Recurring event brand (name, slug, description, website, logo). |
| **Event Editions** | `event_editions` | Series occurrence (year, dates, city, website, globally unique slug). Multiple editions per series + year allowed. Optional `venue_id` → `venues`. `last_reviewed_at` auto-updates on meaningful admin curation. |
| **Venues** | `venues` | Reusable named location (name, slug, city, address, website, logo). Linked to editions via nullable `event_editions.venue_id`; `city_id` retained on editions. Archive-only lifecycle (`archived_at`). See [venue-design.md](./venue-design.md) and [phase-venue-scope.md](./phase-venue-scope.md). |
| **Companies** | `companies` | Canonical company entity. No separate sponsors table — "sponsor" = company linked to an edition. |
| **Event Sponsors** | `event_sponsors` | Edition-scoped join: `tier_rank`, `tier_label`, `display_order` (dense 1..n within edition + tier). `UNIQUE (event_editions_id, company_id)`. |
| **Event Edition Organizers** | `event_edition_organizers` | Edition-scoped join: company as organizer with `role_label` (default "Organizer") and `display_order`. `UNIQUE (event_editions_id, company_id)`. Replaces rejected legacy `event_organizers` → `organizers` architecture (those tables were never shipped). See [organizer-design.md](./organizer-design.md) and [phase-organizer-scope.md](./phase-organizer-scope.md). |
| **Keywords** | `keyword`, `event_series_keyword` | Attach to series; editions inherit (read-only chips on edition profile). |
| **Partner Alumni** *(v2 — PA5 complete)* | `event_partner_alumni`, `event_partner_alumni_versions`, `event_partner_alumni_version_companies` | Series-scoped **versioned** roster; **`current_version_id`** public pointer (server-side resolution); version-scoped bulk import; company merge repoints version members. Separate from sponsors. Migrations: `20260710120000_partner_alumni_v1.sql`, `20260711120000_partner_alumni_v2_versions.sql`, `20260712120000_company_merge_partner_alumni.sql`. See [partner-alumni-design.md](./partner-alumni-design.md), [phase-partner-alumni-scope.md](./phase-partner-alumni-scope.md). |
| **Logos** | columns on `companies`; `event_series.logo_url`; `venues.logo_url` | Companies: Logo.dev ingest + metadata. Event series and venues: manual HTTP URL and/or file upload to `COMPANY_LOGO_BUCKET` (`venues/{id}/logo.{ext}`). Event edition logos are manual-only. |
| **Imports** | `sponsor_import_*` (4 tables) | Excel pipeline → validate/match → draft links → publish RPC. One active batch per edition. |

### Access rules (RLS)

- `event_sponsors`: anon SELECT only where `tier_rank = 1`; authenticated SELECT all tiers; no client writes.
- `event_edition_organizers`: anon and authenticated SELECT all rows (no tier gate); no client writes.
- `event_partner_alumni` / draft tables (v1): RLS enabled; **no** anon/authenticated SELECT — **draft table removed in v2 (PA1′)**.
- `event_partner_alumni_snapshots` / snapshot members (v1): anon SELECT all rows — **v2: current version only (or server-resolved)**.
- Core catalog tables: public SELECT; admin writes via service role.
- Import tables: service role only.

### Canonical ordering

Roster reads use `getCompaniesByEventEdition`: `tier_rank ASC NULLS LAST, display_order ASC NULLS LAST, id ASC`. The `/sponsors` explorer applies the same tiebreaks client-side.

## 3. Completed Features

**Public site** — Event explorer, event detail with tiered sponsors, sponsor search and detail, city pages, global search.

**Admin — catalog** — Series, editions, companies: CRUD with slug-change guards, location/city support, profile-completeness warnings and filters. Series keywords with edition inheritance.

**Admin — sponsor roster** (edition detail → Live sponsors tab)
- Edit tier label / tier rank via drawer (rank 1–1000 when edited; label clearable, ≤ 80 chars).
- Add sponsor: company search picker (already-attached companies disabled), required rank, optional label; escape-hatch link to Companies.
- Remove sponsor: confirm modal ("removed from this edition only"; rank-1 visibility warning).
- Same-tier ordering: Move Up / Down (server-managed `display_order`; no manual numeric input).
- Import-conflict banner when an active import batch exists.

**Admin — companies** — Read-only Sponsorships section (edition + series links, tier label, rank).

**Admin — sponsor imports** — Full Excel pipeline through atomic publish and history. Spreadsheet columns: Sponsor Tier (`tier_rank`), Sponsor Label (`tier_label`), Name, Website. Publish writes both rank and label from draft links; blank spreadsheet labels publish as NULL. Qualifying publish auto-updates edition `last_reviewed_at`.

**Admin — edition research metadata** — `last_reviewed_at` auto-updates on meaningful profile saves, live sponsor add/remove/tier edits, organizer add/remove/role-label edits, and qualifying import publish. Edition create keeps `last_reviewed_at` NULL. Manual-only Last reviewed / Primary source saves are preserved. Sponsor/organizer reorder/move and draft import steps do not touch. Company merge auto-touches editions when organizer links are repointed. See [phase-edition-last-reviewed-automation-scope.md](./phase-edition-last-reviewed-automation-scope.md).

**Admin — organizers** — **Organizers** section on edition **Profile** (edition metadata alongside venue, website, city, dates): list, add via company search, edit role label, Move Up/Down, remove. Read-only **Organizer roles** on company detail. Company merge repoints organizer links with conflict resolution. See [phase-organizer-scope.md](./phase-organizer-scope.md) and [phase-organizer-ux-amendment-scope.md](./phase-organizer-ux-amendment-scope.md).

**Admin — venues** — List, create, edit, archive/unarchive at `/admin/venues`. Optional venue picker on edition create/edit (city-filtered; inline Add venue). Logo via HTTP URL paste or file upload on edit. Duplicate names in same city warn only. `city_id` immutable when editions linked.

**Admin — Partner Alumni (v2)** — Version-centric admin on series detail: create version (copy-from-current default), set current, delete (block current), member CRUD. **Bulk import (PA3′ drawer) superseded:** [partner-alumni-import-redesign.md](./partner-alumni-import-redesign.md) **approved 2026-07-06** — batch workflow modeled on Sponsor Import; implement PA-IMP-1–6. **Do not re-import NFT NYC until golden-file QA (§19) passes.** NFT NYC corrupt import (2026-07-05) cleaned up — no current public version. Public edition tab reads `current_version_id` only. Company merge repoints `event_partner_alumni_version_companies` with same-version dedupe. See [phase-partner-alumni-scope.md](./phase-partner-alumni-scope.md).

**Public — venue** — Event edition detail tabs: Overview (default), Sponsors (`?tab=sponsors`), Venue (`?tab=venue`). No public `/venues/...` routes; Explorer cards unchanged (city only).

**Public — organizers** — Event edition detail tabs: Overview, Sponsors, Venue, **Organizers** (`?tab=organizers`). Organizers tab always visible; list or standard empty state inside tab. Fully public (no tier gate). No organizers block on Overview. No `/organizers/...` routes; no “Events organized” on public company pages in v1.

## 4. In Progress

**Partner Alumni import (PA-IMP-1–6)** — PA-IMP-4 admin UI complete (full-page stepper, match summary, create-new ack). Next: PA-IMP-5 deprecate legacy drawer. Redesign complete only when NFT NYC golden file QA passes (§19).

**Known limitations (catalog-wide)**
- Import publish can overwrite manual `tier_rank` and re-add removed sponsors for companies in the batch (warning banner only).
- No pagination/search on admin lists (editions, companies, venues, edition roster).
- Venue logo URL paste stores the URL as-is (no automatic ingest into Storage); file upload writes to `COMPANY_LOGO_BUCKET`. External URL ingest deferred to a future enhancement.
- Company merge does not yet auto-touch editions when **sponsorship** links change (organizer merge touch is implemented; sponsorship touch remains optional follow-up).
- Concurrent admin edits are last-write-wins.

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
| **Edition `last_reviewed_at` automation** | Meaningful profile + live roster + qualifying import publish set `now()`; create stays NULL; manual-only research saves preserved; reorder/move excluded | Feeds Event Explorer **Recommended** / **Recently Reviewed** sort signals |
| API routes + service role; manual validation; hand-rolled UI | Existing codebase conventions; build is the gate. |

**Other sources:** schema in `supabase/migrations/`; phase design docs in `docs/` for detail beyond this file; recurring engineering reviews and the live [Findings Register](./health/findings-register.md) under [`docs/health/`](./health/README.md).

## 6. Operations

- **Migrations:** apply with `supabase db push` against the linked project. Deploy migrations before code that depends on new columns or RPC changes.
- **Verification:** `npm run build` plus `npx tsx --test` on policy/wiring tests and manual API/UI checks.
- **Auth:** admin layout requires `profiles.role = admin`; public reads use RLS on the anon/authenticated Supabase client.

## 7. Next Priorities

1. Apply PA5 merge migration (`20260712120000_company_merge_partner_alumni.sql`) + verify script on linked Supabase.
2. **Partner Alumni import (PA-IMP-1–6)** — PA-IMP-5 deprecate legacy drawer next. NFT NYC re-import only after golden-file QA sign-off (§19).
3. Server-side pagination + search for edition roster and admin lists.
4. Create-and-attach company from Add-sponsor drawer (with dedupe safeguards).
5. Import publish hardening (preserve manual rank edits when unchanged in batch).
6. Edition form helper text for Last reviewed automation (optional UX polish).
7. Company merge — auto-touch `last_reviewed_at` when **sponsorship** links change (organizer path done; optional Phase 4).
8. Organizer O5 / v1 manual QA per [phase-organizer-ux-amendment-scope.md §7](./phase-organizer-ux-amendment-scope.md).
9. Public company detail Partner Alumni recognition section (deferred).
10. Cleanups: remove dead stubs (`EditionImportsStub.tsx`, `/admin/events/new` redirect); consolidate duplicated tier-label helpers.
11. Venue logo URL ingest into Storage (mirror Event Series `resolveEventManualLogoUrl` pattern) and storage cleanup on logo clear.

---

**Maintenance rule:** Update this file in the same change that completes any approved scope. Keep §5 (decisions) and §7 (priorities) as the sections that grow; revise other sections in place rather than appending history.
