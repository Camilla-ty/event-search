# IR1 Indexability Audit

**Status:** Audit only — no code changes  
**Date:** 2026-07-17  
**Compared against:** `docs/plans/indexability-policy.md` (confirmed IR1 rules)  
**Also reviewed:** `docs/plans/seo-implementation-roadmap.md` (IR1), `docs/plans/seo-foundation.md`  
**Code baseline:** `src/app/sitemap.ts`, `src/app/robots.ts`, `src/lib/metadata/site.ts`, public marketing routes

---

## Executive summary

IR1 indexability is **not implemented**. The shared metadata helper cannot emit `robots: noindex`. The sitemap includes many URLs that fail the confirmed public-value gate, and omits strategic assets (topics). Merged series are not redirected. Filter/search URLs are only partially compliant (clean canonical, but still indexable).

**Live catalog snapshot (Supabase, 2026-07-17)** — URLs that would be wrong under current sitemap rules:

| Bucket | Count | Policy |
|--------|------:|--------|
| Active non-restricted companies in sitemap today | 3,380 | — |
| …with **0** sponsored editions (should exclude) | **110** | Over-included |
| …with **1+** sponsored editions (should keep) | 3,270 | OK if also indexable |
| Editions in sitemap today | 75 | — |
| …with **0** sponsors (should exclude) | **39** | Over-included |
| …with **1+** sponsors (should keep) | 36 | OK |
| Series in sitemap today | 35 | — |
| …`lifecycle_status = merged` (should exclude) | **1** | Over-included |
| Topics in sitemap | **0** (≈16 keyword slugs exist) | Under-included |
| Research page routes | **0** | Not shipped as pages |

**Note:** Roadmap IR1’s early “dates OR location OR sponsors” edition gate is **superseded** by `indexability-policy.md` (sponsors ≥ 1 only). This audit uses the policy doc + confirmed rules in the request.

---

## Shared infrastructure (affects all page types)

| Area | Current | Expected (IR1) | Gap |
|------|---------|----------------|-----|
| `createPageMetadata` | `title` / `description` / `path` only; always indexable defaults | Optional `robots: { index: false, follow: true }` | **No `robots` API** |
| `robots.ts` | `Allow: /` for all; no path Disallow | Auth/admin may use Disallow and/or meta noindex | **No path-level disallow** |
| Soft-404 metadata | “not found” titles still use normal indexable metadata | `noindex` | **Missing** |
| Sitemap principle | Broad slug dump (with company restricted filter only) | Membership ⇔ indexable | **Not aligned** |

**Files likely to change (shared):**

- `src/lib/metadata/site.ts` (+ `site.test.ts`)
- `src/app/sitemap.ts`
- `src/app/robots.ts` (optional auth Disallow)
- Possibly a small shared helper e.g. `src/lib/seo/indexability.ts` for gate predicates

---

## 1. Company pages (`/sponsors/{slug}`)

### Current behavior

- Page exists for non-restricted companies resolved by slug (or UUID fallback). Restricted companies resolve to `null` → `notFound()` (no public page).
- `generateMetadata` always indexable via `createPageMetadata`; no count-based gate.
- Anon UI already shows **public total** `sponsoredEditionCount` from `company_sponsor_stats`; **full list** only when authenticated (`getSponsorDetailData`).
- Sitemap: all `status = active` + `restricted_at IS NULL` + non-empty slug — **no** `sponsored_edition_count > 0` filter → **~110 zero-sponsor companies included**.

### Expected behavior

| Condition | Page | Index | Sitemap |
|-----------|------|-------|---------|
| 0 sponsored events | May exist | noindex | Excluded |
| 1+ sponsored events | May exist | index | Included |
| Restricted | Per Protection (today: not found) | noindex | Excluded |
| Public count OK; full list login-only | Already product behavior | — | — |

### Gap

- No `noindex` for 0-sponsor companies.
- Sitemap over-includes ~110 companies.
- Soft-404 “Sponsor not found” metadata is still indexable.
- Restricted: effectively 404 (acceptable vs explicit noindex document); sitemap already excludes — **mostly OK**, defense-in-depth `noindex` if a document response ever appears is missing.

### Files likely to change

- `src/app/(marketing)/sponsors/[slug]/page.tsx` (`generateMetadata`)
- `src/app/sitemap.ts` (`fetchPublicSponsorEntries`)
- `src/features/sponsors/server/getSponsorDetailData.ts` (optional: expose count for metadata without double-fetch)
- `src/lib/queries/sponsors.ts` (`getCompanySponsorStats`)

### Data / query dependencies

- `company_sponsor_stats.sponsored_edition_count` (or equivalent distinct edition count from `event_sponsors`)
- `companies.slug`, `status`, `restricted_at`
- Risk if stats row missing while links exist → treat as 0 unless query joins `event_sponsors`

### Risks / edge cases

- Stats view lag / missing rows → false `noindex` or false exclude.
- Merged company tombstones (`status = merged`) not in sitemap today (filtered by `active`); public redirect to survivor not implemented (future / out of series-focused IR1).
- UUID `/sponsors/{uuid}` may resolve without redirect to slug (canonical uses profile slug when found).

---

## 2. Event edition pages (`/events/{slug}` or UUID)

### Current behavior

- Page exists for any resolvable edition; sponsors loaded for display; `getTotalSponsorCount` used for UI count (admin client, all tiers).
- Metadata: name + location; **always indexable**; no sponsor-count gate.
- Soft-404 “Event not found” still indexable metadata.
- Canonical path uses slug when known; **no HTTP redirect** from UUID → slug.
- Sitemap: every non-empty `event_editions.slug` — **no** sponsor-count filter → **~39 zero-sponsor editions included**.

### Expected behavior

| Condition | Page | Index | Sitemap |
|-----------|------|-------|---------|
| 0 sponsors | May exist | noindex | Excluded |
| 1+ sponsors | May exist | index | Included |

Last reviewed / dates / location are trust/snippet signals only — not gate inputs.

### Gap

- No `noindex` when sponsor count is 0.
- Sitemap over-includes ~39 editions.
- Soft-404 not `noindex`.
- UUID→slug redirect preferred by policy; only canonical today.

### Files likely to change

- `src/app/(marketing)/events/[id]/page.tsx`
- `src/app/sitemap.ts` (`fetchPublicEventEditionEntries`)
- `src/lib/queries/companies.ts` (`getTotalSponsorCount` / `getSponsorCountsByEditionIds`)
- `src/features/events/server/getEventDetailData.ts` (optional count for metadata)

### Data / query dependencies

- Count of `event_sponsors` rows per `event_editions_id` (same semantics as `getTotalSponsorCount`)
- `event_editions.slug`, `last_reviewed_at` (sitemap `lastModified` only)

### Risks / edge cases

- Admin count includes sponsors that anon UI may hide (restricted companies / tier gating) → edition indexable while public roster looks empty.
- Zero public-visible sponsors but count &gt; 0 — product may still want index; confirm whether gate uses **raw link count** (current count helper) vs **displayable** sponsors.
- Editions without slug won’t be in sitemap (already); UUID URLs can still be crawled if linked.

---

## 3. Event series pages (`/events/series/{slug}`)

### Current behavior

- Hub renders for any slug/id resolved by `getSeriesHubData`.
- `getEventSeriesBySlug` selects **without** `lifecycle_status` / `merged_into_series` — hub cannot detect merged state.
- Metadata always indexable; no redirect for merged.
- Sitemap: all non-empty series slugs, **no lifecycle filter** → includes **1 merged** series today.
- `lifecycle_status` null (~20 series) treated like active for product purposes.

### Expected behavior

| Lifecycle | Index | Sitemap | Redirect |
|-----------|-------|---------|----------|
| Active | index | Included | — |
| Discontinued | index | Included | — |
| Merged | noindex | Excluded | **HTTP redirect to successor when available** |

### Gap

- No merge redirect.
- No `noindex` for merged (if ever served without redirect).
- Sitemap includes merged series.
- Series public select must load lifecycle + successor slug for policy enforcement.

### Files likely to change

- `src/lib/queries/events.ts` (`EVENT_SERIES_PUBLIC_SELECT`, `getEventSeriesBySlug` / `ById`)
- `src/features/events/server/getSeriesHubData.ts`
- `src/app/(marketing)/events/series/[slug]/page.tsx`
- `src/app/sitemap.ts` (`fetchPublicEventSeriesEntries`)
- `src/features/events/server/mapPublicEditionRow.ts` (mapping already knows merge embed on editions)

### Data / query dependencies

- `event_series.lifecycle_status`
- `event_series.merged_into_series_id` → successor `slug`
- Treat `NULL` lifecycle as **active** for index/sitemap (matches admin validation defaults)

### Risks / edge cases

- Merged without successor: policy says noindex + exclude; do not invent redirect.
- Chains of merges (A→B→C): redirect should resolve to final survivor.
- Discontinued with zero editions: still indexable per policy (thin hub risk — future consideration).

---

## 4. Topic pages (`/topics/{slug}`)

### Current behavior

- Public hub exists (`getTopicHubData`); metadata indexable with clean `/topics/{slug}` canonical.
- Soft-404 “Topic not found” still indexable metadata.
- **Not included in sitemap at all.**

### Expected behavior

- Published topics: **index** + **included in sitemap**.
- Empty/unpublished shells: soft-404 pattern (`noindex` + sitemap exclude).

### Gap

- Sitemap **under-inclusion** (strategic asset missing).
- Soft-404 not `noindex`.
- No emptiness gate defined in code (all resolvable keyword slugs treated as published).

### Files likely to change

- `src/app/sitemap.ts` (new `fetchPublicTopicEntries`)
- `src/app/(marketing)/topics/[slug]/page.tsx`
- `src/features/events/server/topicHubPublic.ts`

### Data / query dependencies

- `keyword.slug` / `keyword.name` (and any publish flag if added later)
- Optional: only topics with ≥1 linked series/edition (not required by confirmed rules today)

### Risks / edge cases

- Indexing topics with zero linked series/editions (thin pages).
- Keyword renames / slug changes without redirects.

---

## 5. Research pages

### Current behavior

- **No** dedicated `/research/...` (or similar) public routes.
- “Research Information” is a **section** on event edition pages (`ResearchInformationSection`: last reviewed, primary source).
- Not in sitemap as a page type.

### Expected behavior

- Published research pages: **index** + **sitemap include**.
- Exact URL inventory is product-defined.

### Gap

- **Product/route gap:** research pages do not exist as indexable destinations yet.
- Cannot enforce index/sitemap rules until routes and content model exist (IR4 in roadmap).

### Files likely to change (when product defines them)

- New `src/app/(marketing)/research/...` (or chosen path)
- `src/app/sitemap.ts`
- Metadata helper usage on those routes

### Data / query dependencies

- Undefined until research entity/URL inventory is locked.

### Risks / edge cases

- Confusing edition “Research Information” section with standalone research SEO assets.
- Prematurely sitemap-ing stubs.

---

## 6. Restricted companies

### Current behavior

- Public loaders filter `restricted_at IS NULL`; admin fallback still rejects via `isPublicCompanyProfileRow` → **not found**.
- Sitemap excludes `restricted_at IS NOT NULL`.
- No explicit `robots: noindex` (page typically does not render).
- Live: ~1 restricted active company with slug (not in sitemap).

### Expected behavior

- `noindex` + sitemap excluded (restricted overrides sponsor count).

### Gap

- Sitemap/exclusion: **aligned**.
- Explicit `noindex` on a rendered document: **N/A / missing** if soft page ever returned.
- If RLS/admin fallback regresses, risk of indexing without meta noindex.

### Files likely to change

- `src/app/(marketing)/sponsors/[slug]/page.tsx` (defense-in-depth if restricted ever renders)
- `src/lib/queries/companies.ts` (keep restricted filter consistent)
- `src/app/sitemap.ts` (already filters — keep)

### Data / query dependencies

- `companies.restricted_at`

### Risks / edge cases

- `getCompaniesByIds` used in other surfaces may still hydrate restricted rows in some paths (Protection concern; separate from sitemap).
- Restricted with high `sponsored_edition_count` must never enter sitemap (currently OK).

---

## 7. Merged series

### Current behavior

- Merged series **still served** as a normal hub if slug resolves.
- Lifecycle/successor **not loaded** on series hub query.
- **No redirect** to successor.
- Sitemap **includes** merged series (~1 today).
- Metadata indexable.

### Expected behavior

- Redirect to successor when available.
- `noindex` + sitemap exclude for merged URL.
- Index/sitemap follow **successor** only.

### Gap

- **Full gap:** redirect, noindex, sitemap exclusion, and public select fields.

### Files likely to change

- Same as §3 (series hub + sitemap + `EVENT_SERIES_PUBLIC_SELECT`)

### Data / query dependencies

- `lifecycle_status = 'merged'`, `merged_into_series_id`, successor `slug`

### Risks / edge cases

- Successor also merged → need resolution loop with cycle guard.
- External links to old slug should 301/308, not soft render.

---

## 8. Filter / search URLs

### Current behavior

| Surface | Params | Metadata | Canonical |
|---------|--------|----------|-----------|
| `/events` | `q`, `industry`, `region`, `type`, `start`, `end`, `topic`, `sort`, `page` | Static `createPageMetadata({ path: "/events" })` | **Clean `/events`** |
| `/sponsors` | `event`, `q`, `sort`, `page` | Static `path: "/sponsors"` | **Clean `/sponsors`** |
| Event detail `?tab=` | tabs | Metadata ignores searchParams | Edition slug path |

- Sitemap does **not** list query variants (good).
- Parameterized URLs are **not** `noindex`; they inherit indexable hub/detail metadata with clean canonical.

### Expected behavior

- Filter/search parameter URLs: **noindex**.
- Canonical to clean base page where appropriate (hubs already do).

### Gap

- **Canonical: largely OK** for hubs and tabs.
- **`noindex` on parameterized requests: missing.**
- Static `metadata` export cannot vary by `searchParams`; needs `generateMetadata({ searchParams })` (or middleware headers) to set `noindex` when any filter/search param is present.
- `/exhibitors` is a thin marketing page, indexable, **not** in sitemap (orphan index target — adjacent, not in confirmed list).

### Files likely to change

- `src/app/(marketing)/events/page.tsx`
- `src/app/(marketing)/sponsors/page.tsx`
- Possibly `src/app/(marketing)/events/[id]/page.tsx` if `?tab=` should be noindex (policy: tabs share canonical; confirmed list says filter/search noindex — product choice whether tabs count)
- `src/lib/metadata/site.ts`

### Data / query dependencies

- None (URL-shape only).

### Risks / edge cases

- Over-noindex if `generateMetadata` treats empty vs missing params inconsistently.
- Social shares of filtered URLs still get clean canonical (good) but crawlers may see indexable + canonicalized URLs — Google usually consolidates; explicit noindex is the confirmed rule.
- Pagination (`?page=2`) should be noindex + canonical to hub (or to page 1 policy — confirm; default: canonical clean hub).

---

## Sitemap inclusion vs policy (checklist)

| Included today? | Should be? | Verdict |
|-----------------|------------|---------|
| `/`, `/events`, `/sponsors` | Yes | OK |
| All active non-restricted sponsors | Only 1+ sponsored events | **Over-includes ~110** |
| Restricted sponsors | No | OK (excluded) |
| All edition slugs | Only 1+ sponsors | **Over-includes ~39** |
| All series slugs | Active + discontinued only | **Over-includes merged (~1)** |
| Topic slugs | Yes (published) | **Missing all** |
| Research pages | Yes when they exist | **N/A (no routes)** |
| Filter/query URLs | No | OK (not listed) |
| Auth/admin | No | OK (not listed) |
| `/exhibitors` | Not in confirmed IR1 include list | Not in sitemap (OK); page still indexable |
| `/cities/{slug}` | No (redirect) | Not in sitemap (OK) |

---

## Cross-cutting gaps vs foundation / roadmap

| Item | Foundation / IR1 roadmap | Confirmed policy | Code |
|------|--------------------------|------------------|------|
| Metadata `robots` helper | Required for IR1 | Required | **Missing** |
| Edition gate | Roadmap draft allowed dates/location alone | **Sponsors ≥ 1 only** | Neither enforced; implement **policy** |
| Sponsor gate | “Prefer” sponsorship signal | **Hard ≥ 1** | Sitemap ignores count |
| Merged series redirect | Documented | Required | **Missing** |
| Topics in sitemap | Strategic (IR4) | Required in policy now | **Missing** |
| Research pages | IR4 | Required when published | **No pages** |
| Auth noindex | Open choice | noindex or Disallow | **Neither** |

---

## Suggested IR1 implementation order (no code in this audit)

1. Extend `createPageMetadata` with `robots` (and tests).
2. Sitemap filters: sponsors via `company_sponsor_stats` (or exists-on-`event_sponsors`); editions via sponsor link exists; series exclude `merged`; add topics.
3. Route metadata gates + soft-404 `noindex`.
4. Series hub: load lifecycle, redirect merged → successor.
5. Hub `generateMetadata(searchParams)` → `noindex` when filters present (keep clean canonical).
6. Define research URL inventory before sitemap work for that type.

---

## Related documents

| Doc | Role |
|-----|------|
| `docs/plans/indexability-policy.md` | Confirmed rules (source of truth) |
| `docs/plans/seo-implementation-roadmap.md` | IR1 phase framing |
| `docs/plans/seo-foundation.md` | Architecture / helpers / sitemap scale |
| `docs/plans/seo-gap-audit.md` | Earlier gap snapshot (pre-policy counts) |
| `docs/plans/protection-v1.md` | Restricted / anon-visible constraints |

---

## Change log

| Date | Note |
|------|------|
| 2026-07-17 | Initial IR1 audit vs confirmed indexability policy + live over/under-inclusion counts |
