# Phase — Public Sponsor Roster Lazy Load: Implementation Scope

**Status:** Proposed (design only — not implemented)  
**Version:** v1  
**Last updated:** 2026-07-21  

Implementation Design Spec for **tier-by-tier lazy loading** of the public event edition sponsor roster, per [ADR-003](./adr/ADR-003-tier-lazy-loaded-event-sponsors.md).

**Source of truth:** [ADR-003](./adr/ADR-003-tier-lazy-loaded-event-sponsors.md) — if this document conflicts with the ADR, the ADR wins.

**Related:** sponsor-roster lazy-load audit (2026-07-21), [project-state.md](./project-state.md) (RLS tier gate, canonical ordering)

**Permissions:** Public read path. No admin roster changes. No RLS / migration / Cloudflare changes in this phase.

**This document is design only.** It does not modify application code.

---

## 0. Locked ADR decisions (do not redesign)

| Decision | Value |
|----------|--------|
| Initial SSR/RSC | Event shell + tier summaries + **Tier 1 page 1 only** |
| Tier 2+ identities | Absent from initial HTML, RSC, hidden DOM, preload, client state |
| Anonymous | Tier 1 visible; Tier 2+ requires login; API **401** |
| Authenticated | Other tiers load **on click only** |
| Accordion | One open tier; discard previous rows on switch; no closed-tier prefetch |
| Page size | Fixed **20**; server hard-caps at 20 |
| Paging UX | **Load more** |
| Transport | Session-aware **GET** API; no Server Actions; no browser→Supabase roster |
| Client | Session `createClient()`; `Cache-Control: no-store` |
| Ordering / restricted | Unchanged |
| SEO | Tier 1 SSR; counts OK; Tier 2+ identities never in metadata / JSON-LD / OG / Twitter / summaries / generated SEO text |
| RLS / Cloudflare | Unchanged here; CF rate limit is a separate deploy step |

---

## 1. Target data flow (SSR vs lazy loading)

### 1.1 Today (baseline)

```
EventDetailPage
  → getEventDetailData → getCompaniesByEventEdition (all RLS-visible rows)
  → getTotalSponsorCount (admin, count-only)
  → filterDisplayableSponsors
  → PublicEventEditionTabs({ overviewPanel, sponsorsPanel, ... })
       └─ EventSponsorsSection → PublicSponsorTierGroupedRoster (all groups open)
```

Authenticated users receive **all** tier identities in RSC props even when Overview is active.

### 1.2 Target

```
EventDetailPage (SSR)
  → edition shell (existing)
  → getTotalSponsorCount (existing; count-only OK)
  → getPublicSponsorTierSummaries(editionId, { isAuthenticated })
  → getPublicSponsorTierPage(editionId, { tierRank: 1, page: 1 })  // session client
  → Overview: preview from Tier 1 page-1 rows only (pending open Q §12.3)
  → Sponsors panel props:
        summaries + initialTier1Page (no Tier 2+ rows)

Client (Sponsors accordion)
  → open Tier 1: use SSR rows (no fetch) or refetch page 1 if needed after auth change
  → open Tier N (auth): GET /api/events/{key}/sponsors?tier_rank=N&page=1
  → Load more: GET ...&page=2 (append; server returns ≤20)
  → switch tier: drop previous rows from React state; fetch new tier page 1
  → anon open Tier N: no GET; show lock + signup/login CTA
```

### 1.3 What must never be in the initial document

- Any `EventSponsorRow` / company identity for `tier_rank !== 1`
- Prefetched API responses for closed tiers
- Hidden DOM containing Tier 2+ company names

Counts and tier labels (per unresolved chrome Q) may appear without identities.

---

## 2. API design and response contracts

### 2.1 Route

`GET /api/events/[editionIdOrSlug]/sponsors`

Mirror `/events/[id]` resolution: accept UUID or public slug (open Q §12.2 may narrow this; default design = **either**, same as the page).

**Headers:** `Cache-Control: no-store`

### 2.2 Query parameters

| Param | Required | Behavior |
|-------|----------|----------|
| `tier_rank` | Yes | Positive integer. Invalid → 400. Unranked (`null`) out of v1 scope unless ADR open Q resolved. |
| `page` | No | 1-based; default `1`; invalid → 400 |
| `pageSize` | No | Ignored for sizing; server always uses **20** |

### 2.3 Response — 200

Reuse existing public row type from `src/features/events/components/detail/types.ts`.

```ts
type PublicSponsorTierPageResponse = {
  editionId: string;
  tierRank: number;
  tierLabel: string | null;
  page: number;
  pageSize: 20;
  totalInTier: number;
  totalPages: number;
  hasMore: boolean;
  rows: EventSponsorRow[];
};
```

Invariant: `rows.length ≤ 20` and `pageSize === 20` even if client sent `pageSize=9999`.

### 2.4 Errors

| Status | Body (JSON) | When |
|--------|-------------|------|
| 401 | `{ ok: false, error: string }` | Anonymous + `tier_rank !== 1` |
| 404 | `{ ok: false, error: string }` | Edition not found |
| 400 | `{ ok: false, error: string }` | Bad `tier_rank` / `page` |
| 500 | `{ ok: false, error: string }` | Unexpected failure |

### 2.5 Tier summary (SSR prop; not required as a separate public API in v1)

```ts
type PublicSponsorTierSummary = {
  editionId: string;
  totalSponsorCount: number;
  tiers: Array<{
    tierRank: number | null;
    tierLabel: string | null;
    count: number;
    locked: boolean; // anon && tierRank !== 1
  }>;
};
```

No company ids/names/domains/slugs/logos in summary objects.

---

## 3. Server query flow

### 3.1 Shared constants / helpers (new)

Suggested module: `src/features/events/server/publicSponsorRoster.ts` (or split under `src/lib/queries/` if preferred — keep feature ownership next to detail).

| Export | Responsibility |
|--------|----------------|
| `PUBLIC_SPONSOR_TIER_PAGE_SIZE = 20` | Hard cap |
| `clampPublicSponsorTierPageSize(_requested)` | Always returns 20 |
| `parsePublicSponsorTierRank(raw)` | Validate integer |
| `getPublicSponsorTierSummaries(editionId, { isAuthenticated })` | Counts + labels; set `locked` |
| `getPublicSponsorTierPage(editionId, { tierRank, page, user })` | Auth gate + paged rows |
| `resolveEditionIdForPublicSponsors(editionIdOrSlug)` | Reuse edition detail lookup |

### 3.2 Tier page algorithm

1. Resolve edition → `editionId` (404 if missing).
2. If `tierRank !== 1` and `user == null` → throw/return **401** (before roster query).
3. Session client:  
   `from("event_sponsors").select(link columns).eq("event_editions_id", editionId).eq("tier_rank", tierRank)`  
   Order: `tier_rank ASC NULLS LAST` (redundant when filtered), `display_order ASC NULLS LAST`, `id ASC`.  
   Count for `totalInTier` (same filters; head/count).  
   `.range((page-1)*20, page*20 - 1)`.
4. `mergeCompaniesOntoEventSponsorLinks` (existing) for company hydration + restricted masking.
5. `filterDisplayableSponsors` (existing) if still required for missing `company_id`.
6. Build response; never use `createAdminClient()` for row bodies.

### 3.3 Tier summary algorithm

Preferred (identity-safe):

- Admin or session aggregate that returns **only** `(tier_rank, tier_label sample, count)` — no company columns.
- Practical v1 approach consistent with ADR open Q §5: use admin count helpers / a dedicated aggregate query that selects `tier_rank, tier_label, count(*)` grouped by tier for the edition (service-role count path is acceptable **only** if it never returns company identities). Document the chosen helper in implementation PR.

Derive `tierLabel` from the edition’s stored labels on links (e.g. `MIN(tier_label)` / any non-null label per rank — match current `groupSponsorsByTier` behavior of taking the first seen label).

Set `locked = !isAuthenticated && tierRank !== 1`.

### 3.4 SSR wiring on `EventDetailPage`

Replace full-roster load:

| Remove / stop | Replace with |
|---------------|--------------|
| `getEventDetailData` embedding full `event_sponsors` **or** page ignoring full list | Edition shell without full roster **or** stop passing full list into panels |
| Passing all sponsors into `EventSponsorsSection` / Overview | `summaries` + `initialTier1Page` |

`getEventDetailData` should be split or parameterized so callers that need the old “all visible links” behavior (if any remain) do not force detail SSR to load everything. Prefer a dedicated public roster loader used only by the detail page.

### 3.5 Factual summary / metadata

- `sponsorCount`: keep `getTotalSponsorCount` (identity-free).
- `sponsorshipTierCount`: derive from **summary.tiers.length** (or distinct ranks), **not** from a full identity list.
- Never interpolate Tier 2+ company names into `buildEventEditionSummary`, `generateMetadata`, OG, or Twitter fields.

---

## 4. Component architecture

Reuse existing detail components; evolve the sponsors subtree.

| Component | Change |
|-----------|--------|
| `EventSponsorsSection` | Accept `summaries`, `initialTier1Page`, `isAuthenticated`, `editionKey`; host accordion shell |
| `PublicSponsorTierGroupedRoster` | Replace “map all groups fully open” with accordion controller **or** retire in favor of new shell |
| `PublicSponsorTierSection` | Become one accordion panel: header button + conditional body |
| `PublicSponsorRosterRow` | **Reuse as-is** (restricted masking) |
| `EditionSponsorNote` | Unchanged (empty roster note) |
| `EventOverviewSummarySection` | Preview from Tier 1 page-1 rows only (or drop identities — open Q) |
| `PublicEventEditionTabs` | Unchanged pattern; sponsors panel props must not include Tier 2+ rows |

### 4.1 New / thin client pieces

| Piece | Role |
|-------|------|
| `PublicSponsorRosterAccordion` (client) | One-open state; locked vs loadable headers; wires fetch |
| `usePublicSponsorTierLoader` (client hook) | GET fetch, abort on switch, append Load more, discard rows |
| `fetchPublicSponsorTierPage` (client) | `fetch` helper → API URL builder |

Prefer colocating under `src/features/events/components/detail/` and `src/features/events/client/`.

### 4.2 Accessibility

- Header control: `button` with `aria-expanded`, `aria-controls`.
- Locked tier: non-fetching control + signup/login link (`buildSignupEntryUrl` / existing auth entry helpers).
- Load more: `button`; optional polite status when rows append.

---

## 5. Client state model

```ts
type OpenTierState = {
  tierRank: number;
  rows: EventSponsorRow[];
  page: number;          // last successfully loaded page
  totalInTier: number;
  hasMore: boolean;
  status: "idle" | "loading" | "loading-more" | "error";
  errorMessage: string | null;
};

type RosterUiState = {
  summaries: PublicSponsorTierSummary;
  openTierRank: number | null; // null = all collapsed; default Tier 1 open
  openTier: OpenTierState | null;
};
```

**Rules (ADR):**

- Default: Tier 1 open with SSR `initialTier1Page` seeded into `openTier` (no GET).
- Opening another tier: set `openTier = null` (discard rows), then load new tier page 1.
- Eviction is active React state only — not Network/DevTools history.
- No prefetch of closed tiers.
- Abort in-flight fetch when switching tiers (AbortController), same pattern as explorer collection.

### 5.1 Client State Flow

Runtime transitions for `usePublicSponsorTierLoader` / accordion controller. Status values: `idle` | `loading` | `loading-more` | `error`.

Supporting fields (not shown in every step): `requestId` (monotonic), `AbortController`, `openTierRank`, `openTier.rows|page|hasMore|errorMessage`.

```text
                    ┌─────────────────────┐
                    │ SSR hydrate Tier 1  │
                    │ status=idle         │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
        open locked      open other         Load more
        (anon Tier2+)    loadable tier      (hasMore)
              │                │                │
              │                ▼                ▼
              │         discard rows      status=loading-more
              │         abort prior            │
              │         status=loading         │
              │                │                │
              │         ┌──────┴──────┐  ┌─────┴─────┐
              │         ▼             ▼  ▼           ▼
              │      success       fail/abort  success    fail
              │     status=idle   status=error idle/append error
              │     seed rows     keep open     keep rows  keep rows
              └─► CTA only; no GET
```

#### Initial page load

- Seed `summaries` from SSR.
- Set `openTierRank = 1` (or sole available Tier 1).
- Set `openTier` from `initialTier1Page`: `rows`, `page = 1`, `totalInTier`, `hasMore`, `status = idle`, `errorMessage = null`.
- **No** network request for Tier 1 page 1.
- `requestId = 0`; no active `AbortController`.

#### Tier open (loadable, not yet open)

1. If target is already open → no-op (or toggle-collapse if product allows collapse; v1 default keeps one open and re-click on open tier may leave it open).
2. If target is **locked** (anonymous, `tierRank !== 1`) → do **not** fetch; UI shows login/signup CTA only; `openTier` / fetch state unchanged for roster rows (optional: leave Tier 1 open).
3. Otherwise (authenticated Tier N, or Tier 1 reopen after collapse):
   - Abort any in-flight request.
   - Discard previous `openTier.rows` (set `openTier = null` briefly or replace).
   - `openTierRank = N`.
   - `openTier = { tierRank: N, rows: [], page: 0, …, status: "loading", errorMessage: null }`.
   - `requestId += 1`; new `AbortController`; GET `page=1`.

#### Tier switch (A → B)

Identical to opening B while A is open:

- Abort A’s in-flight GET (if any).
- Remove A’s rows from active client state.
- Enter `loading` for B page 1.
- Do not prefetch C.

#### Load More

Preconditions: open tier exists, `status` is `idle` (or `error` after a failed load-more — Retry uses same path), `hasMore === true`.

1. Ignore click if `status` is `loading` or `loading-more` (see Fast repeated clicks).
2. `status = "loading-more"`; keep existing `rows`.
3. `requestId += 1`; new controller; GET `page = openTier.page + 1`.
4. On success → append; on failure → keep rows, `status = "error"`.

#### Request cancellation (AbortController)

| Trigger | Action |
|---------|--------|
| Tier switch / open another loadable tier | `controller.abort()` on prior request |
| Unmount Sponsors accordion | abort prior request |
| New Load more while previous Load more still in flight | abort prior **or** ignore new click (prefer **ignore** while `loading-more`; abort on **tier switch** only) |

On `AbortError` / aborted signal:

- Do **not** set `status = "error"`.
- Do **not** apply aborted payload.
- Leave state as superseded by the newer `requestId` transition (usually already `loading` for the new tier).

#### Successful response

Guard: apply only if `response.requestId === current requestId` **and** `response.tierRank === openTierRank` **and** signal not aborted.

**Page 1 (open / switch):**

- `rows = response.rows` (replace, do not merge with previous tier).
- `page = response.page`, `totalInTier`, `hasMore` from response.
- `status = "idle"`, `errorMessage = null`.

**Load more:**

- `rows = [...rows, ...response.rows]` (append; still ≤20 new rows).
- `page = response.page`, update `hasMore`.
- `status = "idle"`, `errorMessage = null`.

#### Failed response (non-abort)

Guard: same `requestId` / `openTierRank` checks; ignore stale failures.

- **Open / switch failure:** keep accordion on target tier; `rows` stay empty (or prior empty); `status = "error"`; set `errorMessage`; show Retry.
- **Load more failure:** keep existing `rows` and `page`; `status = "error"`; error on Load more / Retry control.
- Never re-attach discarded rows from another tier.

#### Retry

- If last failure was page-1 open: re-run open fetch for `openTierRank` with `status = "loading"` (same discard rules; new `requestId`).
- If last failure was Load more: re-request `page = openTier.page + 1` with `status = "loading-more"`.
- Locked anon tiers: Retry is N/A (no fetch).

#### Fast repeated clicks

| Click pattern | Behavior |
|---------------|----------|
| Rapid clicks on **same** loadable closed tier | First click starts load; further clicks while `loading` are no-ops |
| Rapid clicks across **tier A then B then C** | Each switch aborts prior; only C’s latest `requestId` may commit |
| Spam **Load more** | While `loading-more`, ignore extra clicks |
| Click locked tier repeatedly | No GET; CTA only |

#### Duplicate response protection

Stale responses must not mutate state. Require **all** of:

1. Monotonic `requestId` matches the request that is still current.
2. `tierRank` on the response equals `openTierRank`.
3. `page` is the expected page (`1` for open; `openTier.page + 1` for load-more) before commit.
4. AbortSignal not aborted.

If any check fails → drop the response silently (no error toast for stale/abort).

---

## 6. UX flows

### 6.1 Anonymous

1. Land on Sponsors: Tier 1 open with up to 20 SSR rows; Load more if `hasMore`.
2. Locked Tier 2+ headers visible (chrome A or B — open Q §12.8).
3. Click locked tier → no API call; show CTA to sign up / log in (existing signup entry URL with return path).
4. Signup CTA under roster (existing copy) may remain.

### 6.2 Authenticated

1. Same SSR: Tier 1 page 1 only + summaries (Tier 2+ not locked).
2. Click Tier 2 → single GET page 1; previous Tier 1 rows removed from state; Tier 2 body shows rows or loading/error.
3. Load more → GET page 2; append ≤20 rows.
4. Click Tier 3 → discard Tier 2 rows; GET Tier 3 page 1.

### 6.3 Empty / note

If `totalSponsorCount === 0` and `sponsorNoteType` set → keep `EditionSponsorNote`; no accordion.

---

## 7. SEO considerations

| Surface | Rule |
|---------|------|
| Sponsors tab SSR | Tier 1 page 1 identities present for crawlers/users |
| Overview preview | Tier 1 identities only if preview kept |
| `generateMetadata` / OG / Twitter | No Tier 2+ company identities |
| Factual summary | Counts + tier **count** OK; no Tier 2+ names |
| JSON-LD (if added later) | Same identity boundary |
| Indexability | Continue using full `sponsorCount` from `getTotalSponsorCount` |

---

## 8. Security boundary

| Control | Behavior |
|---------|----------|
| SSR trim | Primary UI/document leakage control |
| API 401 | Anonymous Tier 2+ |
| Session client + existing RLS | Anon cannot SELECT `tier_rank ≠ 1` |
| No admin client for row bodies | Counts may use existing admin count helpers |
| No Server Actions / no browser Supabase roster | Matches project convention |

**Non-goals:** RLS change; stopping authenticated JWT direct Supabase SELECT; hiding public counts.

**Ops follow-up (not this phase’s code):** Cloudflare rate limit on `/api/events/*/sponsors`.

---

## 9. Error handling

| Case | UI / API |
|------|----------|
| Anon Tier 2+ GET | 401; client should not call; if it does, show lock + login, do not paint rows |
| Network / 500 on open | Keep accordion open; inline error + Retry (prefer keep-open; ADR open Q §6) |
| Network / 500 on Load more | Keep existing rows; error on Load more control; Retry loads same next page |
| Abort on tier switch | Ignore abort; no error banner |
| 404 edition | Page already notFound; API returns 404 |

Do not roll back summaries. Do not reintroduce discarded tier rows on error.

---

## 10. Testing strategy

### 10.1 Unit / source contracts

- `clampPublicSponsorTierPageSize` / parser always yield page size 20.
- Summary builder never includes company identity fields.
- Accordion state: switch tier clears `rows`.
- `PublicSponsorRosterRow` restricted cases remain green.

### 10.2 API route tests

- Anon `tier_rank=1` → 200, ≤20 rows.
- Anon `tier_rank=2` → 401, no rows.
- Auth `tier_rank=2` → 200.
- `pageSize=9999` → still ≤20 rows, `pageSize: 20` in body.
- `Cache-Control: no-store` present.

### 10.3 SSR / leakage tests

- Render or source-inspect event detail props path: authenticated fixture must not serialize Tier 2+ names in Sponsors/Overview panel props.
- Factual summary / metadata builders: no Tier 2+ names when only summaries + Tier 1 page provided.

### 10.4 Manual QA

| # | Check |
|---|--------|
| 1 | View source / disable JS: Tier 1 present; Tier 2+ company names absent |
| 2 | Auth: Network tab — opening Tier 2 = one GET; no prefetch of Tier 3 |
| 3 | Switch tiers — prior tier rows gone from React tree |
| 4 | Load more appends; never >20 per response |
| 5 | Anon locked tier — no GET |
| 6 | Restricted company masking on lazy-loaded page |

---

## 11. File implementation map

| Path | Action |
|------|--------|
| `src/app/api/events/[id]/sponsors/route.ts` | **Add** — GET handler |
| `src/features/events/server/publicSponsorRoster.ts` | **Add** — summaries, page loader, parsers, page size constant |
| `src/features/events/server/publicSponsorRoster.test.ts` | **Add** |
| `src/features/events/client/fetchPublicSponsorTierPage.ts` | **Add** — client fetch helper |
| `src/features/events/client/usePublicSponsorTierLoader.ts` | **Add** — accordion load/evict/load-more |
| `src/features/events/components/detail/PublicSponsorRosterAccordion.tsx` | **Add** — one-open UI |
| `src/features/events/components/detail/EventSponsorsSection.tsx` | **Edit** — new props; mount accordion |
| `src/features/events/components/detail/PublicSponsorTierGroupedRoster.tsx` | **Edit or replace** — stop eager full render |
| `src/features/events/components/detail/PublicSponsorTierSection.tsx` | **Edit** — disclosure header + conditional list + Load more slot |
| `src/features/events/components/detail/PublicSponsorRosterRow.tsx` | Reuse |
| `src/features/events/components/detail/EventOverviewSummarySection.tsx` | **Edit** — Tier 1–only preview input |
| `src/app/(marketing)/events/[id]/page.tsx` | **Edit** — SSR summaries + Tier 1 page 1; factual summary inputs |
| `src/features/events/server/getEventDetailData.ts` | **Edit** — stop attaching full roster by default (or split) |
| `src/lib/queries/companies.ts` | **Optional edit** — add paged/filtered query helpers; keep `getTotalSponsorCount` |
| `src/lib/content/factualSummary.ts` | **Verify / minor edit** — ensure callers do not pass Tier 2+ identities |
| Admin sponsor APIs / RLS migrations / Cloudflare | **Out of scope** |

---

## 12. Phased implementation plan

Matches ADR-003 §8 (no redesign):

| Phase | Deliverable | Exit criteria |
|-------|-------------|----------------|
| **P0** | Accept ADR-003; resolve blocking open questions that affect API/chrome (§12 unresolved) | Product answers for unranked, edition key, anon chrome A/B |
| **P1** | Server summaries + Tier 1 page 1 SSR; detail page stops shipping full roster in props | Auth SSR leakage test passes |
| **P2** | Accordion UI; anon locks; discard rows on switch | One-open + lock UX verified |
| **P3** | GET API + click-to-load wiring | 401/200/no-store tests green |
| **P4** | Load more within open tier; no closed-tier prefetch | Manual Network QA |
| **P5** | Full test suite + ops Cloudflare rate-limit checklist | Acceptance criteria ADR §9 |

---

## 13. Unresolved questions (from ADR-003)

Carry forward; do not invent answers in this design:

1. **Unranked** (`tier_rank IS NULL`) — exclude, lock like Tier 2+, or “Unranked” lazy section?
2. **Edition key** — UUID, slug, or either?
3. **Overview preview** — Tier 1 first-five vs count/link only?
4. **Follow-up RLS tighten ADR** — out of scope here.
5. **Summary count source** — admin aggregate vs session-safe group-by?
6. **Error UX** — banner + keep open vs collapse? (**Design default:** keep open + Retry.)
7. **Cloudflare** — budget/path owner for deploy step.
8. **Anonymous locked-tier chrome** — **A** `Gold (132)` vs **B** `Gold 🔒`?

Until §13.8 is decided, implement summaries with `count` available server-side; UI can hide count for anon locked headers if B is chosen without changing the API contract.

---

## Document control

| Field | Value |
|-------|--------|
| Status | Proposed |
| Source of truth | ADR-003 |
| Implementation | Not started |
| Supersedes | — |
