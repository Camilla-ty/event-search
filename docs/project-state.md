# EventPixels — Project State

> Single source of truth for current project status.
> Last updated: 2026-07-03 (Edition last reviewed automation)

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
| **Keywords** | `keyword`, `event_series_keyword` | Attach to series; editions inherit (read-only chips on edition profile). |
| **Logos** | columns on `companies`; `event_series.logo_url`; `venues.logo_url` | Companies: Logo.dev ingest + metadata. Event series and venues: manual HTTP URL and/or file upload to `COMPANY_LOGO_BUCKET` (`venues/{id}/logo.{ext}`). Event edition logos are manual-only. |
| **Imports** | `sponsor_import_*` (4 tables) | Excel pipeline → validate/match → draft links → publish RPC. One active batch per edition. |

### Access rules (RLS)

- `event_sponsors`: anon SELECT only where `tier_rank = 1`; authenticated SELECT all tiers; no client writes.
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

**Admin — edition research metadata** — `last_reviewed_at` auto-updates on meaningful profile saves, live sponsor add/remove/tier edits, and qualifying import publish. Edition create keeps `last_reviewed_at` NULL. Manual-only Last reviewed / Primary source saves are preserved. Reorder/move and draft import steps do not touch. See [phase-edition-last-reviewed-automation-scope.md](./phase-edition-last-reviewed-automation-scope.md).

**Admin — venues** — List, create, edit, archive/unarchive at `/admin/venues`. Optional venue picker on edition create/edit (city-filtered; inline Add venue). Logo via HTTP URL paste or file upload on edit. Duplicate names in same city warn only. `city_id` immutable when editions linked.

**Public — venue** — Event edition detail tabs: Overview (default), Sponsors (`?tab=sponsors`), Venue (`?tab=venue`). No public `/venues/...` routes; Explorer cards unchanged (city only).

## 4. In Progress

Nothing is mid-flight.

**Known limitations**
- Import publish can overwrite manual `tier_rank` and re-add removed sponsors for companies in the batch (warning banner only).
- No pagination/search on admin lists (editions, companies, venues, edition roster).
- Venue logo URL paste stores the URL as-is (no automatic ingest into Storage); file upload writes to `COMPANY_LOGO_BUCKET`. External URL ingest deferred to a future enhancement.
- Company merge does not yet auto-touch affected editions' `last_reviewed_at` (optional follow-up).
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

**Other sources:** schema in `supabase/migrations/` (applied through `20260704120000_venues_v1`); phase design docs in `docs/` for detail beyond this file.

## 6. Operations

- **Migrations:** apply with `supabase db push` against the linked project. Deploy migrations before code that depends on new columns or RPC changes.
- **Verification:** `npm run build` plus `npx tsx --test` on policy/wiring tests and manual API/UI checks.
- **Auth:** admin layout requires `profiles.role = admin`; public reads use RLS on the anon/authenticated Supabase client.

## 7. Next Priorities

1. Server-side pagination + search for edition roster and admin lists.
2. Create-and-attach company from Add-sponsor drawer (with dedupe safeguards).
3. Import publish hardening (preserve manual rank edits when unchanged in batch).
4. Edition form helper text for Last reviewed automation (optional UX polish).
5. Company merge — auto-touch `last_reviewed_at` on affected editions (optional Phase 4).
6. Cleanups: remove dead stubs (`EditionImportsStub.tsx`, `/admin/events/new` redirect); consolidate duplicated tier-label helpers.
7. Venue logo URL ingest into Storage (mirror Event Series `resolveEventManualLogoUrl` pattern) and storage cleanup on logo clear.

---

**Maintenance rule:** Update this file in the same change that completes any approved scope. Keep §5 (decisions) and §7 (priorities) as the sections that grow; revise other sections in place rather than appending history.
