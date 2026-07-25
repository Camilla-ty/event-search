# Phase — Sponsor Search v1: Implementation Scope

**Status:** Approved — S1 server + S2 UI implemented (S3 rate-limit release gate pending)
**Version:** v1.1
**Last updated:** 2026-07-25

Short implementation scope for **Sponsor Search** on the public event edition Sponsors tab. Based on the approved architecture and security audit (2026-07-24); **authenticated-only** as of v1.1.

**Related:** [ADR-003](./adr/ADR-003-tier-lazy-loaded-event-sponsors.md), [phase-public-sponsor-roster-lazy-load-scope.md](./phase-public-sponsor-roster-lazy-load-scope.md), [plans/protection-v1.md](./plans/protection-v1.md), [project-state.md](./project-state.md)

**Permissions:** **Authenticated users only.** Visibility for search results matches authenticated public sponsor roster permissions (all tiers under existing RLS). No admin changes. No RLS migration in this phase.

**Implementation choice (S1):** `event_edition_sponsor_search` **SECURITY INVOKER** RPC + authenticated session client. Session-only PostgREST filters cannot cleanly express alias `unnest` ILIKE or verified-domain matching via `__company_matches_verified_domain_search` without loading oversized candidate sets. **`anon` has no EXECUTE** on the search RPC; no new EXECUTE grants on the verified-domain helper for this feature.

---

## 1. Purpose

Allow **authenticated** users to **verify whether a company sponsors the current event** without manually expanding every sponsor tier or repeatedly clicking “Show more.”

This is **not** company discovery and **not** a full-roster download. It must preserve the current anti-scraping / progressive-disclosure strategy (ADR-003). Anonymous visitors do not get Sponsor Search (UI or API).

---

## 2. Locked decisions

### 2.1 API

```http
GET /api/events/[id]/sponsors/search?q={query}
```

| Rule | Value |
|------|--------|
| Transport | Next.js route handler; **authenticated** session Supabase client |
| Unauthenticated | **`401`** `{ ok: false, error: "Authentication required." }` |
| Cache | `Cache-Control: no-store` |
| Success body | `{ ok: true, query, items: [...] }` only |
| Item fields (required for roster row) | Include `tier_rank` and `tier_label` from `event_sponsors` (exact stored label; blank/null allowed) |
| Forbidden response fields | `total`, `hasMore`, `next`, `page`, client-controlled `page_size` |

`[id]` resolves the same way as the existing roster API (edition UUID or public slug).

### 2.2 Search rules

| Rule | Value |
|------|--------|
| Minimum query | **3** trimmed characters, enforced **server-side** |
| Maximum query length | **200** |
| Matching | Case-insensitive **partial** match |
| Match fields | Company `name`, `domain`, `website`, `aliases`; verified `company_domains` **only if** matching can use a DEFINER helper (or equivalent) **without** granting callers SELECT on `company_domains` and **without** returning those rows |
| Result cap | **Maximum 20** items; server hard-caps; ignore any client page-size input |
| Ordering | **Stable** (recommend: canonical roster order among matches — `tier_rank ASC NULLS LAST`, `display_order ASC NULLS LAST`, link `id ASC`) |

Queries shorter than 3 trimmed characters must not run a roster scan (return empty `items` or `400` — pick one in implementation and test it consistently). Unauthenticated requests still receive **`401`** before search runs.

### 2.3 Visibility

| Caller | Behavior |
|--------|----------|
| Anonymous | **No search** — API **`401`**; UI must not offer Sponsor Search; RPC **not** executable by `anon` |
| Authenticated | May search **all tiers**, matching current authenticated public sponsor roster permissions |

| Boundary | Rule |
|----------|------|
| Database | Existing `event_sponsors` **RLS** remains the DB boundary |
| RPC grants | `EXECUTE` on `event_edition_sponsor_search` for **`authenticated`** (and `service_role` if needed for ops); **`REVOKE` from `anon`**; do **not** add new EXECUTE grants on `__company_matches_verified_domain_search` for this feature |
| Forbidden | Service role for result sets; admin company search helpers (`searchCompaniesAdmin`, `companyIdentitySearch` ranking/hints) |

### 2.4 Restricted companies

Restricted-company fields must be **scrubbed in the API response**, not only hidden in the UI.

For a restricted company, do **not** return:

- domain, website, logo fields
- profile link / href
- aliases
- match metadata (`matched_alias`, match reason, verified-domain hints)

Name (and a policy/restricted label consistent with the public roster row) may remain. Unrestricted items may include the minimum fields needed to render a roster-equivalent row.

### 2.5 Client behavior

| Rule | Value |
|------|--------|
| Surface | **Sponsors tab only**, and **only when the viewer is authenticated** |
| Anonymous UI | Do **not** show the search control |
| Query state | **Local component state** — no URL `?q=` (or other search query param) |
| Trigger | Debounced request **after ≥3** characters |
| Results UX | Search results **replace** the tier accordion temporarily |
| Tier badge | Show each result’s **exact** stored `tier_label` as a subtle badge on the roster row; **hide** when `tier_label` is null or blank; do **not** normalize/rename labels from `tier_rank` |
| Pagination | **No** “Load more” in search mode |
| Clear | Clearing the query **restores** the existing tier roster state (accordion + previously loaded tier page data as before search) |

### 2.6 Reuse (later)

Only these may be extracted for Exhibitors / Partner Alumni later:

- Search param parsing / normalization
- Request debounce / abort / stale-response state
- Safe company matching helpers (without leaking match metadata)

**Remain separate:** eligibility sets (which join table / which tiers / which version) and roster renderers.

### 2.7 Security

| Rule | Value |
|------|--------|
| Roster shipping | **Never** send the complete sponsor roster to the browser for search |
| Auth gate | App **`401`** + RPC not granted to `anon` |
| Cache | `no-store` |
| Ordering | Stable (see §2.2) |
| Rate limiting | Cloudflare and/or app rate limiting on `/api/events/*/sponsors*` (including `/search`) remains an **operational requirement before public release** — not solved by this phase’s application acceptance alone (`ARC-007` / protection P3) |

### 2.8 Non-goals

- Changing `event_sponsors` RLS
- Preventing authenticated PostgREST enumeration of all tiers
- Changing tier visibility / accordion / Load more rules for the non-search roster
- Building Exhibitor or Partner Alumni search now
- Reusing `/api/sponsors/discovery` or `/api/sponsors/suggest` as the Sponsors-tab endpoint
- Updating unrelated stale documentation (including ADR-003 “not started” labels)
- Offering Sponsor Search to anonymous visitors

---

## 3. Implementation choice (locked in S1)

**Chosen:** edition-scoped **SECURITY INVOKER** RPC `event_edition_sponsor_search(uuid, text)` called from an **authenticated** session Supabase client.

| Option | Outcome |
|--------|---------|
| Session-scoped queries only | Rejected for v1 — alias `unnest` ILIKE and verified-domain matching are not expressible cleanly in PostgREST filters without oversized server-side candidate loads |
| **SECURITY INVOKER RPC** | **Selected** — RLS on `event_sponsors` remains the DB boundary; verified domains via existing boolean DEFINER helper; `LIMIT 20` in SQL; **authenticated-only EXECUTE** |

Still required:

- No service-role result sets
- No SELECT grant on `company_domains` to anon/authenticated
- No new EXECUTE grant on `__company_matches_verified_domain_search` for this feature
- Public mapper still scrubs restricted fields
- App returns **401** when unauthenticated

Migration: `supabase/migrations/20260727120000_event_edition_sponsor_search.sql`.

---

## 4. Proposed implementation phases

| Phase | Deliverable |
|-------|-------------|
| **S0 — Contract lock** | This document approved; API shape + visibility + scrub rules frozen |
| **S1 — Server search** | ✅ Route `GET /api/events/[id]/sponsors/search`; auth **401**; INVOKER RPC (no anon EXECUTE); hard cap 20; `tier_rank`/`tier_label` on items; restricted scrub; `no-store`; unit/wiring tests |
| **S2 — Sponsors tab UI** | ✅ Search input **for authenticated users only**; debounce ≥3; results replace accordion; exact `tier_label` badge on rows; clear restores roster; reuse roster row presentation |
| **S3 — Release gate** | Confirm CF/app rate-limit path coverage for the new endpoint before calling the feature publicly released |

Optional follow-up (out of v1): extract shared parse/match/request helpers for Exhibitors / Partner Alumni — eligibility and UI still separate.

---

## 5. Acceptance tests

### 5.1 API

1. Unauthenticated request → **`401`** (no search results).
2. `q` with fewer than 3 trimmed characters (authenticated) does not return roster matches (empty `items` or `400` per chosen rule).
3. `q` longer than 200 is rejected or truncated **server-side** consistently (prefer reject with `400`).
4. Matching is case-insensitive partial on name, domain, website, and aliases for eligible sponsors.
5. Verified-domain matches work only via a path that does not expose `company_domains` rows or grants.
6. Response contains at most **20** items.
7. Response JSON has **no** `total`, `hasMore`, `next`, or client-driven page size.
8. Authenticated caller: matching sponsors from **all tiers** may appear (parity with authenticated roster permissions).
9. Each item includes `tier_rank` and `tier_label` from the stored sponsor link (exact label text; null/blank when unset).
10. Restricted company in results: name/policy only; no domain, website, logo, profile link, aliases, or match metadata in JSON; `tier_rank`/`tier_label` may remain.
11. Unknown edition id/slug → `404` (when authenticated).
12. `Cache-Control: no-store` on responses.
13. Repeated identical queries return the same order for the same eligible set (stable ordering).
14. `anon` cannot `EXECUTE` `event_edition_sponsor_search`; migration does not grant new EXECUTE on `__company_matches_verified_domain_search`.

### 5.2 Client

15. Search UI exists only on the event **Sponsors** tab and **only for authenticated viewers**.
16. Anonymous viewers do not see the search control.
17. No URL query parameter is written for the search string.
18. Requests fire only after debounce and ≥3 characters.
19. While search is active, results replace the tier accordion; there is no Load more.
20. Each result row shows the exact stored `tier_label` as a subtle badge; badge omitted when label is null/blank; labels are not renamed from `tier_rank`.
21. Clearing the input restores the prior tier roster UI state.
22. The client never receives or accumulates a full-edition sponsor roster solely to power search.

### 5.3 Security / non-goals checks

23. Implementation does not use service role or admin search helpers for this endpoint.
24. Implementation does not call `/api/sponsors/discovery` or `/api/sponsors/suggest` as the Sponsors-tab search backend.
25. No `event_sponsors` RLS migration ships in this phase.
26. Rate limiting is explicitly called out as an ops prerequisite for public release (may be documented in the completion report even if configured outside the repo).

---

## 6. Related code (reference only — do not redesign)

| Area | Path |
|------|------|
| Roster API | `src/app/api/events/[id]/sponsors/route.ts` |
| Roster server | `src/features/events/server/publicSponsorRoster.ts` |
| Restricted helpers | `src/lib/companies/companyPublicRestriction.ts` |
| Discovery (do not reuse as tab backend) | `src/app/api/sponsors/discovery/route.ts` |
| Admin search (forbidden) | `src/features/companies/server/companyAdminSearch.ts` |

---

## Document history

| Date | Change |
|------|--------|
| 2026-07-24 | Initial v1 scope from approved Sponsor Search architecture/security audit |
| 2026-07-24 | S1: locked INVOKER RPC approach; server route + mapper + migration authored |
| 2026-07-25 | **Authenticated-only:** API 401 for anon; RPC EXECUTE revoked from anon; no helper EXECUTE grants; UI gated to signed-in users (S2) |
| 2026-07-25 | S2 UI: Sponsors tab search for authenticated viewers; roster kept mounted while searching |
| 2026-07-25 | Search results show exact stored `tier_label` badge (`tier_rank`/`tier_label` already on RPC/API) |
