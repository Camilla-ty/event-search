# ADR-003: Tier-by-Tier Lazy Loading for Public Event Sponsor Rosters

**Status:** Proposed  
**Date:** 2026-07-21  
**Related:** [project-state.md](../project-state.md) (RLS tier gate, canonical roster ordering), sponsor-roster lazy-load audit (2026-07-21)

---

## 1. Context and problem

Public event edition pages (`/events/[id]`, Sponsors tab) show sponsors grouped by sponsorship tier.

**Current behavior (audit source of truth):**

- SSR/RSC loads the full session-visible roster in one query via `getCompaniesByEventEdition`.
- Anonymous users receive only `tier_rank = 1` rows because of Postgres RLS.
- Authenticated users receive **all** tiers in the initial page props / RSC payload, including when another tab is active.
- All returned tiers render expanded; there is no accordion, no per-tier fetch, and no public pagination.
- Header / factual summary / indexability already expose an auth-independent **full sponsor count** via `getTotalSponsorCount` (admin client, identities not included).
- Restricted companies remain listed by name with logo/domain/profile suppressed.
- Project convention: App Router server components + `/api/...` routes; **no Server Actions**.

**Problem:**

Authenticated initial HTML/RSC already contains Tier 2+ company identities. Large editions ship the entire roster at once. The product wants Tier 1 available for SEO and anonymous browsing, while making Tier 2+ identities available only after login and only after an explicit tier open — without putting unopened tier companies into the initial document, hidden DOM, preload, or client state.

This ADR locks that product and technical contract. It does **not** change RLS, migrations, or Cloudflare in the same change set.

---

## 2. Decision

EventPixels adopts **tier-by-tier lazy loading** for the public event sponsor roster.

| Rule | Decision |
|------|----------|
| Initial SSR/RSC | Event edition shell data + **tier summaries** + **Tier 1 page 1 only** |
| Tier 2+ identities | Must **not** appear in initial HTML, RSC payload, hidden DOM, preload, or client state |
| Anonymous | See Tier 1; Tier 2+ requires login |
| Authenticated | Load non–Tier-1 tiers **only when that tier is clicked open** |
| Accordion | **Only one** tier open at a time |
| Client state on switch | Previous tier’s sponsor **rows are removed** from active client state when opening another tier |
| Prefetch | **No** prefetch of unopened tiers |
| Page size | Fixed **20**; server **must enforce max 20** regardless of client input (`pageSize=100` / `9999` still return ≤20 rows) |
| Within-tier paging | **“Load more”** (append next page of the open tier) |
| Transport | Session-aware **GET API route**; not Server Actions; not direct browser→Supabase roster queries |
| Anonymous Tier 2+ API | **401** |
| Data client | Session Supabase client (`createClient()`); **`Cache-Control: no-store`** |
| Ordering | Preserve current: `tier_rank ASC NULLS LAST`, `display_order ASC NULLS LAST`, `id ASC` |
| Restricted companies | Preserve current masking (name visible; logo/domain/profile suppressed) |
| SEO | Tier 1 remains **server-rendered**; full sponsor count and per-tier **counts** may stay public |
| Metadata / summaries / SEO text | Tier 2+ **company identities** must **never** appear in HTML metadata, JSON-LD, Open Graph, Twitter/X cards, automatic summaries, or generated SEO text. **Only Tier 1** sponsor identities may appear in server-rendered public content. |
| Security posture | Raises scraping cost for roster identities; **does not** prevent authenticated direct Supabase `SELECT` while current RLS (`authenticated` → all tiers) remains unchanged |
| Cloudflare | Rate limiting for the new endpoint is a **separate deployment step** |

---

## 3. API and tier-summary contracts

### 3.1 Tier summary (SSR + optional API)

Used for accordion chrome without shipping company identities.

```ts
type PublicSponsorTierSummary = {
  editionId: string;
  totalSponsorCount: number; // all tiers; may remain public
  tiers: Array<{
    tierRank: number | null;
    tierLabel: string | null;
    count: number;           // public count; no company fields
    locked: boolean;         // true for anonymous when tierRank !== 1
  }>;
};
```

Rules:

- Summaries list tiers that exist for the edition (including Tier 2+ **counts**).
- Summary objects must not embed company ids, names, domains, logos, or slugs.
- For anonymous viewers, tiers with `tierRank !== 1` are `locked: true` (UI shows login CTA; no row fetch).

### 3.2 Paged tier roster API

**Method / path (proposed):**

`GET /api/events/[editionIdOrSlug]/sponsors`

**Query:**

| Param | Required | Notes |
|-------|----------|--------|
| `tier_rank` | Yes | Integer tier to load. Unranked (`null`) out of scope for v1 unless explicitly added later. |
| `page` | No | 1-based; default `1` |
| `pageSize` | No | Product size is fixed at **20**. The server **must always enforce a maximum of 20** regardless of client input. Requests such as `pageSize=100` or `pageSize=9999` must still return **at most 20** sponsor rows (ignore or clamp the parameter; never honor a larger page). |

**Response (200):**

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
  rows: EventSponsorRow[]; // existing public row shape + restricted masking
};
```

**Errors:**

| Status | When |
|--------|------|
| 401 | Anonymous request for `tier_rank !== 1` |
| 404 | Unknown edition |
| 400 | Missing/invalid `tier_rank` or `page` |
| 500 | Unexpected server failure |

**Headers:** `Cache-Control: no-store`

**Server behavior:**

1. Resolve edition; 404 if missing.
2. `getUser()` — if `tier_rank !== 1` and no user → **401** (do not use admin client for body).
3. Query `event_sponsors` with **session** client: filter edition + `tier_rank`, canonical order, `.range` for a page of **at most 20** (hard server cap).
4. Hydrate companies via existing public merge/masking path.
5. Return JSON only for that page (`pageSize` in the body is always `20`; `rows.length ≤ 20`).

**Initial SSR:** same Tier 1 page-1 payload shape embedded in the page (or equivalent server props), not a client prefetch of other tiers.

### 3.3 Client state rules

- At most one open tier.
- Opening tier B discards tier A’s `rows` from active client state (counts/summaries may remain).
- “Load more” appends only within the open tier.
- No `<link rel=preload>`, Next.js Link prefetch, or speculative fetch for closed tiers.

**Client-state eviction note:** Removing sponsor rows from active client state is a performance optimization and a scraping-friction measure. It is not intended to erase responses already recorded by the browser (for example, Network history or DevTools).

---

## 4. Security boundary

| Layer | Role |
|-------|------|
| **SSR trim** | Prevents Tier 2+ identities in HTML/RSC for everyone until fetched |
| **API 401** | App-level gate for anonymous Tier 2+ |
| **Session client + RLS** | Defense in depth; anon still cannot read `tier_rank ≠ 1` via RLS |
| **No admin client on roster body** | Counts may use existing admin count helpers; identities must not |

**Explicit non-goals of this ADR:**

- Changing `event_sponsors` RLS (authenticated still `USING (true)` today).
- Stopping an authenticated browser from querying Supabase directly with its JWT.
- Hiding public **counts** (total or per-tier).

This design **raises scraping cost** (login + per-tier, per-page requests) for roster identities in the UI path. It is **not** a hard confidentiality boundary for authenticated role access under current RLS.

Cloudflare rate limiting on the new GET endpoint is required as a **follow-up deployment**, not as part of the application ADR acceptance.

---

## 5. Accessibility and SEO

### Accessibility

- Tier headers are real disclosures: `button` (or equivalent) with `aria-expanded` / `aria-controls`.
- Only one expanded region at a time.
- Locked tiers: clear copy + focusable Sign up / Log in control.
- “Load more”: keyboard operable; status text for appended results (e.g. polite live region optional).
- Restricted rows keep accessible name + policy message (existing pattern).

### SEO

- Tier 1 page 1 remains **server-rendered** on Sponsors (and Overview preview may continue to use Tier 1–only identities).
- Full sponsor **count** and tier **counts** may appear in UI and indexability inputs (counts are not identities).
- **Only Tier 1** sponsor identities may appear in server-rendered public content.
- Tier 2+ sponsor **identities** must **never** appear in:
  - HTML metadata (`<title>`, `<meta name="description">`, and related document head fields)
  - JSON-LD
  - Open Graph metadata
  - Twitter/X metadata
  - automatic summaries
  - generated SEO text
- Crawlers ≈ anonymous: RLS + SSR trim already keep Tier 2+ identities out of the document.

---

## 6. Alternatives rejected

| Alternative | Why rejected |
|-------------|--------------|
| Keep eager full-roster SSR for authenticated users | Violates “no Tier 2+ in initial payload” |
| Server Actions for tier pages | Against project convention (no Server Actions) |
| Direct browser → Supabase for tiers | Bypasses app 401 shaping; harder to standardize page size / masking; encourages client-held catalogs |
| Infinite scroll without explicit “Load more” | Harder a11y/control; product chose “Load more” |
| Prefetch next tier on idle / hover | Violates “no unopened tier prefetch” and reintroduces identities into client state |
| Keep previous tier rows when switching | Violates explicit discard rule; grows client memory and scrapable state |
| Hide counts until login | Product allows public counts; only identities are gated in the UI path |
| Tighten RLS in the same change | Separable security project; this ADR is UI/API payload contract first |
| Variable / client-chosen page sizes | Fixed 20 with a hard server max of 20 for predictable payloads and rate-limit planning |

---

## 7. Consequences

### Positive

- Tier 2+ identities leave the initial document for authenticated and anonymous users alike.
- Smaller first paint for large editions.
- Clear login gate for anonymous Tier 2+.
- Aligns transport with existing `/api/events/explorer`-style patterns.
- Preserves Tier 1 SEO and current ordering / restricted masking.

### Negative / accepted costs

- Extra round-trips for authenticated multi-tier browsing.
- Accordion + “Load more” UX complexity and loading/error states.
- Authenticated direct Supabase access remains possible under current RLS.
- Overview / factual “across K tiers” copy must be written from **counts/summaries**, not from a full identity list in SSR.
- Cloudflare / ops must rate-limit the new endpoint separately.
- Public `getCompaniesByEventEdition` callers (detail page, previews) must be split or parameterized so they no longer imply “full roster.”

---

## 8. Implementation phases

Documentation-only ADR; phases for a future implementation scope (not executed here):

| Phase | Work |
|-------|------|
| **P0** | Accept this ADR; draft phase scope if needed; confirm edition id/slug param style |
| **P1** | Server: tier summaries + Tier 1 page 1 only on event detail SSR; stop passing full roster into tab props |
| **P2** | UI: one-open accordion; anonymous locked tiers + CTA; discard rows on tier switch |
| **P3** | `GET` sponsors API (session client, 401, page size 20, no-store); wire click-to-load |
| **P4** | “Load more” within open tier; no closed-tier prefetch |
| **P5** | Tests (SSR leakage, 401, masking, state discard); deploy-time Cloudflare rate limit (ops) |

Admin live roster, imports, and RLS migrations are **out of scope** unless a later ADR revisits authenticated RLS.

---

## 9. Acceptance criteria

1. Anonymous SSR/RSC for an edition with multiple tiers contains **no** Tier 2+ company ids/names/domains/slugs/logos.
2. Authenticated SSR/RSC likewise contains only Tier 1 page 1 identities (+ non-identity tier summaries/counts).
3. Anonymous `GET` for `tier_rank ≥ 2` returns **401** and no rows.
4. Authenticated open of Tier 2 issues **one** GET for page 1; closed tiers are not requested.
5. Switching from Tier 2 to Tier 3 removes Tier 2 rows from active client state.
6. “Load more” requests `page=2`; even if the client sends a larger `pageSize`, the response contains **at most 20** rows and appends without loading other tiers.
7. Ordering matches current canonical order; restricted companies remain masked.
8. Tier 1 content remains in server-rendered Sponsors HTML for SEO; only Tier 1 identities appear in server-rendered public content.
9. HTML metadata, JSON-LD, Open Graph, Twitter/X metadata, automatic summaries, and generated SEO text contain no Tier 2+ company identities (counts allowed).
10. Response headers include `Cache-Control: no-store`.
11. No Server Actions and no browser-direct Supabase roster queries in the implemented UI path.

---

## 10. Open questions

1. **Unranked sponsors** (`tier_rank IS NULL`): exclude from public accordion in v1, treat as locked-for-anon like Tier 2+, or fold into a labeled “Unranked” section with the same lazy rules?
2. **Edition key in the API path:** prefer UUID `editionId`, public `slug`, or accept either (as `/events/[id]` does today)?
3. **Overview preview:** keep first-five from Tier 1 page 1 only, or drop identity preview and link only to Sponsors?
4. **Should a follow-up ADR tighten RLS** so authenticated `SELECT` on `event_sponsors` cannot list Tier 2+ except through server-mediated access? (Out of scope here; affects true confidentiality.)
5. **Tier summary source for counts:** continue admin/count helpers for all-tier counts, or derive counts from a session-safe aggregate that never returns identities?
6. **Error/retry UX** when a tier page GET fails (banner + keep accordion open vs collapse)?
7. **Cloudflare:** exact rate-limit budget and path match for `/api/events/*/sponsors` (deployment checklist owner)?
8. **Anonymous locked-tier chrome (unresolved product decision):** Should anonymous users see  
   **A.** Tier labels and sponsor counts — e.g. `Gold (132)`  
   or  
   **B.** Tier labels only with a login lock — e.g. `Gold 🔒`  
   Counts remain allowed in principle elsewhere (header total, etc.); this question is only about locked Tier 2+ accordion headers for anonymous viewers.

---

## Document control

| Field | Value |
|-------|--------|
| Status | Proposed |
| Supersedes | — |
| Implementation | Not started (ADR only) |
| Audit basis | Public event sponsor roster lazy-load audit, 2026-07-21 |
