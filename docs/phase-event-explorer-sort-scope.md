# Phase — Event Explorer Sort: Implementation Scope

**Status:** Proposed  
**Version:** v1  
**Last updated:** 2026-07-03  

Implementation scope for **Event Explorer sort improvements** on the public `/events` page. Defines product decisions, sort semantics, implementation boundaries, and verification — not application code.

**Related code (current):** `src/features/events/lib/eventExplorerOrdering.ts`, `src/features/events/components/explorer/EventExplorerPage.tsx`, `src/components/common/explorer/ExplorerResultsToolbar.tsx`

**Permissions:** Public read-only. No admin changes.

---

## 1. Background

The Event Explorer (`/events`) is EventPixels’ primary public discovery surface for event editions. Users narrow the result set with filters; they change how results are ordered with sort.

### 1.1 Current filter model (complete)

| Filter | UI location | State |
|--------|-------------|-------|
| Keyword | Left filter panel | `topics[]` — checkbox multi-select; URL `topic=` |
| Country | Left filter panel | `regions[]` — checkbox multi-select; URL `region=` |
| Start / End date | Left filter panel | `startDate` / `endDate`; URL `start=` / `end=` |
| Search (`q`) | Global / URL | Text search across edition name, series name, domains |

The **Event Series filter was removed** from the explorer. Series discovery is covered by:

- **Search (`q`)** — matches edition and series names (and domains)
- **Series Hub** — `/events/series/[slug]` for a dedicated series destination

### 1.2 Why sort stays in the results toolbar

| Concern | Filter panel | Results toolbar |
|---------|--------------|-----------------|
| Changes which editions match | Yes | No |
| Changes order of matched editions | No | Yes |
| Applies to list + calendar result sets | Filters yes | Sort applies after filter (list view today) |

**Sort belongs in the results toolbar** because it changes **ordering**, not the **result set**. Moving sort into the left filter panel would blur “what to show” vs “how to order it” and conflict with the established explorer layout (filters left, results + toolbar right).

### 1.3 Current sort implementation (as of this document)

- **Options:** Recommended, Event Date, Event Name
- **Default (initial load):** Recommended
- **Reset Filters quirk:** Reset currently sets sort to Event Date — **to be fixed** in this phase (see §5)
- **State:** Client-only React state; **not** in URL
- **Engine:** `sortEventExplorerResults()` in `eventExplorerOrdering.ts` (client-side, in-memory)

---

## 2. Product decision

### 2.1 Sort is needed

Researchers and operators need to control result order without changing filters. Alphabetical and chronological sorts are insufficient for EventPixels’ core workflow: finding editions with **usable sponsor and research data**.

### 2.2 Sort stays in the results toolbar

- **Locked:** Sort control remains in `ExplorerResultsToolbar` (list view), not in `FilterPanel`.
- Mobile: same toolbar pattern; filters open via drawer — sort stays with results.

### 2.3 Product principle — research freshness over popularity

EventPixels sorting should prioritize **research freshness** and **sponsor data readiness**, not:

- Event popularity
- Raw sponsor count as a primary ranking signal
- Generic “upcoming first” discovery (home page and date filters serve other discovery goals)

**Rationale:**

- Sponsor rosters are often completed **after** an event ends; high sponsor count does not mean “more important” or “better researched.”
- **Last Reviewed** (`event_editions.last_reviewed_at`) and admin research metadata are the strongest signals that an edition’s data is current and trustworthy.
- Upcoming-first ordering optimizes calendar marketing, not sponsor-research workflows.

---

## 3. Sort options for v1

### 3.1 Included

| Mode | UI label | Purpose |
|------|----------|---------|
| `recommended` | **Recommended** | Default; data-readiness oriented browse/search order |
| `recently_reviewed` | **Recently Reviewed** | Explicit sort by last research review timestamp |
| `date` | **Event Date** | Chronological by edition start date (existing behavior) |
| `name` | **Event Name** | Alphabetical by edition name (existing behavior) |

### 3.2 Excluded (v1)

| Proposed mode | Excluded because |
|---------------|------------------|
| **Most Sponsors** | Sponsor count ≠ event importance; count reflects import timing, not research priority |
| **Upcoming First** | Not the primary EventPixels workflow; date filter + Event Date sort cover chronological needs |
| **Newest First** (`created_at`) | Catalog “newness” ≠ data readiness; out of scope for this phase |

These may be reconsidered only with an explicit product decision that does not conflict with the research-freshness principle.

---

## 4. Sort definitions

All modes operate on the **already-filtered** client-side `EventRecord[]` passed to `EventExplorerPage`. Tie-breakers should remain stable (name, then `id`) unless noted below.

### 4.1 Recommended (default)

**Intent:** Data-readiness oriented default for browse and search.

**Browse (empty `q`) — align with and document existing `compareEventBrowseRecommendedOrder`:**

1. **Reviewed editions first** — `last_reviewed_at` present before absent
2. **Temporal bucket** (secondary) — recently ended → ongoing → upcoming → older ended → dateless (`RECENTLY_ENDED_DAYS = 180`)
3. **Within bucket** — existing date tie-breaks per bucket
4. **Sponsor count** — may remain as a **tertiary** tie-break within the same review + bucket group only (not a user-facing sort mode)
5. **Name**, then **id**

**Search (non-empty `q`) — unchanged unless explicitly approved later:**

- Search relevance tier first (`compareEventSearchOrder`)
- Then temporal bucket and within-bucket dates
- Then name, id
- Do **not** elevate unreviewed upcoming events above reviewed editions when relevance tier is equal unless current tests/product require it — **reviewed-first must not be overridden by “upcoming” within the same relevance tier**

**Product rule:** Unreviewed / upcoming events must **not dominate** over reviewed events in Recommended browse mode.

### 4.2 Recently Reviewed

**Intent:** Explicit “what did we research lately?” ordering.

| Order | Rule |
|-------|------|
| Primary | `last_reviewed_at` DESC (most recently reviewed first) |
| Last | Editions with **no** `last_reviewed_at` (NULL / empty) after all reviewed rows |
| Tie-break | Among same timestamp or among unreviewed: edition name ASC, then id |

**Field:** `event_editions.last_reviewed_at` (already on `EventRecord` via server mapping).

### 4.3 Event Date

**Intent:** Strict chronological ordering for planning and timeline scans.

- **Keep existing** `compareChronologicalOrder`: `start_date` ASC (dateless last), then name, id
- No change to semantics in v1 unless a bug is found

### 4.4 Event Name

**Intent:** Stable alphabetical scan.

- **Keep existing** `compareNameOrder`: edition name ASC (case-insensitive), then id

---

## 5. Implementation scope

### 5.1 In scope

| # | Deliverable |
|---|-------------|
| 1 | Add **`recently_reviewed`** to `EventExplorerSortMode` and toolbar options |
| 2 | Implement **`compareRecentlyReviewedOrder`** (or equivalent) in `eventExplorerOrdering.ts` |
| 3 | Wire **Recently Reviewed** in `EventExplorerPage` `EVENT_SORT_OPTIONS` |
| 4 | **Keep Recommended as default** on initial load (`useState("recommended")`) |
| 5 | **Fix Reset Filters** — `handleReset()` must set sort to **`recommended`**, not `date` |
| 6 | **Keep sort client-side** — continue using `sortEventExplorerResults()` on the filtered in-memory array |
| 7 | **Tests** — add/update `eventExplorerOrdering.test.ts` for Recently Reviewed and reset behavior (via page test or ordering unit tests) |
| 8 | Document Recommended semantics in code comments only as needed for maintainers |

### 5.2 Explicit non-goals for this phase

| Item | Decision |
|------|----------|
| URL `sort=` persistence | **Out of scope** — add only if explicitly approved in a later phase |
| Database schema | **No changes** |
| Migration | **None** |
| Server-side sort in `getEventExplorerData` | **No** — client re-sorts after server filter |
| `created_at` on `EventRecord` | **Not required** for v1 (Newest First excluded) |

### 5.3 Files expected to change (implementation reference)

| Area | Path |
|------|------|
| Sort engine | `src/features/events/lib/eventExplorerOrdering.ts` |
| Sort tests | `src/features/events/lib/eventExplorerOrdering.test.ts` |
| Toolbar options + reset | `src/features/events/components/explorer/EventExplorerPage.tsx` |
| Shared toolbar UI | `src/components/common/explorer/ExplorerResultsToolbar.tsx` (likely unchanged) |

**Not in scope:** `FilterPanel.tsx`, `eventExplorerQuery.ts`, filter URL builders, `getEventExplorerData.ts` (except no changes expected).

### 5.4 Calendar view

- Sort dropdown remains **hidden** in calendar view (`showSort={explorerView === "list"}`).
- **No calendar sort redesign** in v1 — day cells and agenda may continue local name ordering.

---

## 6. Out of scope

- Moving sort into the left filter panel
- **Most Sponsors** sort mode
- **Upcoming First** / **Newest First** sort modes
- Server-side sorting or DB `ORDER BY` changes for explorer
- URL sort persistence (`?sort=`)
- Calendar sub-view sort alignment with toolbar
- Database migration or new columns
- Changes to Keyword / Country / Date filters, active chips, or pagination mechanics
- Changes to Series Hub or search `q` behavior

---

## 7. Testing plan

### 7.1 Unit tests (`eventExplorerOrdering.test.ts`)

| Test | Expectation |
|------|-------------|
| Recommended default browse | Reviewed editions before unreviewed; temporal logic unchanged |
| Recently Reviewed — reviewed rows | `last_reviewed_at` DESC |
| Recently Reviewed — unreviewed | All NULL/empty `last_reviewed_at` rows **after** reviewed rows |
| Recently Reviewed — ties | Stable name / id tie-break |
| Event Date | Existing chronological tests **remain valid** |
| Event Name | Existing alphabetical tests **remain valid** |
| Search + Recommended | Existing relevance-first tests **remain valid** unless product explicitly changes §4.1 |

### 7.2 Integration / manual checks

| Check | Expectation |
|-------|-------------|
| Toolbar | Four options visible in list view: Recommended, Recently Reviewed, Event Date, Event Name |
| Default on load | Recommended selected |
| Reset Filters | Sort returns to **Recommended** (not Event Date) |
| Filters + sort | Changing sort does not alter filter URL or chip state |
| Pagination | Sort change does not break client pagination (9 per page) |
| Calendar | Sort control hidden; calendar still usable |

### 7.3 Regression

- Keyword / Country / Date filter tests unchanged
- Optimistic filter UX unchanged
- Server filter OR semantics for countries unchanged

---

## 8. Documentation path

| Document | Action |
|----------|--------|
| **This file** (`phase-event-explorer-sort-scope.md`) | **Created** — scope for sort v1 |
| [`project-state.md`](./project-state.md) | Update **only after implementation ships** (per maintenance rule) |
| [`README.md`](./README.md) | Optional: add link under public site / explorer when implementation starts |
| Migration design | **Not required** — no schema changes |

---

## 9. Verification checklist (post-implementation)

- [ ] `recently_reviewed` sort mode implemented and labeled **Recently Reviewed**
- [ ] Recommended remains default on load
- [ ] Reset Filters sets sort to Recommended
- [ ] Recently Reviewed: `last_reviewed_at` DESC; unreviewed last
- [ ] Event Date and Event Name behavior unchanged
- [ ] Search + Recommended behavior unchanged (unless §4.1 amendment approved)
- [ ] Sort remains in results toolbar only
- [ ] No URL `sort=` param added
- [ ] `npm run build` passes; ordering tests pass
- [ ] `project-state.md` updated in same change set as code

---

## 10. Summary

Event Explorer sort v1 adds **Recently Reviewed**, keeps **Recommended** as the research-oriented default, fixes **Reset → Recommended**, and leaves sort **client-side** without URL persistence. Sort stays in the **results toolbar**, separate from Keyword/Country/Date filters. Popularity-style sorts (Most Sponsors, Upcoming First, Newest First) are **explicitly excluded** in favor of research freshness and data readiness signals.
