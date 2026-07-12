# Navigation & data fetching

Policy for client navigation and data refresh in EventPX (Next.js App Router). Goal: avoid redundant RSC / layout work when the user changes UI state or list parameters on the **same pathname**.

## Interaction categories

| Cat | Name | When | Mechanism |
|-----|------|------|-----------|
| **A** | URL-only UI state | Data already on the client (tabs, wizard steps, client-side filters) | Local state + History API (`pushState` / `replaceState`) |
| **B** | Targeted collection fetch | New rows/results required (pagination, admin list filters) | `fetch` / route handler / server action — **not** full page soft nav |
| **C** | Mutation refresh | Data changed after a write | Prefer mutation response → local state; section refetch if needed; `router.refresh` only when global server state changed |
| **D** | Real route navigation | Actual page change | `Link` / `router.push` to a new pathname |

### Decision flow

1. Does the **pathname** change? → **D** (`Link` / `router.push`).
2. Same pathname — do you need **new server rows**? → **B** (targeted fetch).
3. Same pathname — only UI / URL state? → **A** (`useUrlSyncedState` or tab pattern).
4. After a **mutation** — can the response update local state? → **C** (local update first).

## Shared utilities (`src/lib/navigation/`)

| Export | Use |
|--------|-----|
| `useUrlSyncedState` | Category **A** — multi-param search state on current pathname |
| `shouldInterceptInPageAnchorClick` | Skip Next navigation for plain left-clicks on `<a href>` |
| `pushHistoryUrl` / `replaceHistoryUrl` | Write URL without `router.*` |
| `buildPathWithSearchParams` | `pathname` + `URLSearchParams` → relative URL |
| `useInstantTabNavigation` | Category **A** for single `tab` param (edition detail tabs) |

### `useUrlSyncedState` — responsibility

- Owns React state mirrored to `window.location` search params.
- Handles `popstate` (browser back/forward).
- Suppresses History writes when state comes from server props or `popstate`.
- **Does not** fetch data, parse feature-specific filter rules, or call Next router.

```ts
const [filters, setFilters] = useUrlSyncedState({
  initial: initialFilters,
  pathname,
  parse: parseEventExplorerFiltersFromSearchParams,
  serialize: buildEventExplorerSearchParams,
  equals: (a, b) => buildEventExplorerFilterKey(a) === buildEventExplorerFilterKey(b),
  history: "replace",
});
```

### Tab pattern (reference)

Edition tabs use `useInstantTabNavigation` + `<a href>` + `pushHistoryUrl`. Custom href rules (e.g. overview without `?tab=`) stay in feature URL builders — not in `useUrlSyncedState`.

## Router API policy

| API | Use | Avoid |
|-----|-----|-------|
| `Link` | Cross-route navigation, cold-load list filters (until Category B) | Same-page filter/tab sync |
| `router.push` | New pathname, post-create redirect | Same pathname query-only updates |
| `router.replace` | Auth URL cleanup, server redirect parity | Filters, sort, pagination, wizard steps on same page |
| `router.refresh` | Session/layout changed, unrecoverable mutation error | After successful local roster/order update |
| `history.pushState` | Steps user should undo with Back | — |
| `history.replaceState` | Filter URL sync (default) | — |
| `fetch` / route handlers | Category **B** list refetch | Replacing whole page for list changes |

### Examples in this repo

| Pattern | Category | Location |
|---------|----------|----------|
| Edition tab click | A ✓ | `PublicEventEditionTabs`, `EditionDetailTabs` |
| Event Explorer filter URL | A (Phase B) | `EventExplorerPage` — today uses `router.replace` ✗ |
| Sponsor Discovery sort/page | B ✓ (Phase C) | `SponsorSearchPage` — targeted `GET /api/sponsors/discovery` |
| Reorder save success | C | `EditionSponsorsPanel` — should drop success `refresh` |
| Import wizard `?step=` | A (Phase E) | `SponsorImportFlow` steps — today `router.push` ✗ |
| Global search → `/events?q=` | D | `GlobalSearchBar` |
| Admin companies search submit | B (Phase E) | `AdminCompaniesSearchForm` |

## Loading feedback

| Category | Loading UI |
|----------|------------|
| A | No route skeleton; optional inline status if compute > ~1 frame |
| B | List-level skeleton / `loading` prop (`PageLoadingSkeleton` variant `list`) |
| C | Inline save state; preserve visible content |
| D | `loading.tsx` / `PageLoadingSkeleton` |

## Audit & review

```bash
bash scripts/audit-soft-navigation.sh
```

See [PR checklist](#pr-checklist) below.

## PR checklist

- [ ] Same-pathname UI state uses History API (`useUrlSyncedState` / tab pattern), not `router.push` / `router.replace`
- [ ] New list data uses targeted fetch (B), not full-page soft navigation
- [ ] Mutations update local state from the response; any `router.refresh` is justified in the PR description
- [ ] Cold-load URLs still render correct server HTML (SEO / share links)
- [ ] `popstate` handled for URL-synced state
- [ ] No new layout/session refetch for Category A interactions

## Phased rollout

| Phase | Scope |
|-------|--------|
| **A** | This doc + `src/lib/navigation` utilities + audit script |
| **B** | Event Explorer — full catalog + client filter + `useUrlSyncedState` |
| **C** | Sponsor Discovery targeted fetch |
| **D** | `EditionSponsorsPanel` mutation/local update |
| **E** | Import wizards + admin lists |
| **F** | Remeasure layout/session cost |

## Tests

- Unit: `src/lib/navigation/historyUrl.test.ts`
- Tab regression: `PublicEventEditionTabs.test.ts`
- Future: Playwright — filter/tab interaction produces no `document` navigation request
