# SEO Foundation — Gap Audit

**Status:** Audit only (no code changes)  
**Compared against:** `docs/plans/seo-foundation.md`  
**Code baseline:** `src/lib/metadata/site.ts`, public `generateMetadata` routes, `src/app/sitemap.ts`, `src/app/robots.ts`  
**Date:** 2026-07-15

Legend:

| Status | Meaning |
|--------|---------|
| **Implemented** | Matches the plan closely enough for production use |
| **Partially implemented** | Present but incomplete vs the plan’s recommended end state |
| **Missing** | Not present in code |

Effort band: **S** (&lt;1 day) · **M** (1–3 days) · **L** (1–2 weeks) · **XL** (multi-week / content-ops).

---

## Executive summary

Crawl basics (S0) are largely in place: production origin, robots, single sitemap, shared metadata helper, Open Graph / Twitter fields, and canonical URLs on public pages.

The largest gaps vs the foundation plan are **metadata template richness**, **`noindex`**, **JSON-LD**, **raster / per-entity social images**, **SEO health reporting**, **sitemap sharding**, and **content-generation workflow**. Those map cleanly to planned phases **S1–S5**.

---

## Capability matrix

| # | Capability | Status |
|---|------------|--------|
| 1 | Metadata generation system | **Partially implemented** |
| 2 | Canonical strategy | **Partially implemented** |
| 3 | `noindex` strategy | **Missing** |
| 4 | JSON-LD | **Missing** |
| 5 | Open Graph | **Partially implemented** |
| 6 | Twitter cards | **Partially implemented** |
| 7 | Sitemap architecture | **Partially implemented** |
| 8 | SEO health monitoring | **Missing** |
| 9 | Content generation readiness | **Partially implemented** |

---

## 1. Metadata generation

### Status: Partially implemented

| Planned item | Status | Evidence |
|--------------|--------|----------|
| Shared `createPageMetadata` / title template | **Implemented** | `src/lib/metadata/site.ts` — `%s \| EventPixels` |
| Event `generateMetadata` | **Partial** | Name + optional location only; no dates / series / richer template |
| Series `generateMetadata` | **Partial** | Name + description fallback; no edition-count enrichment; no merged handling |
| Sponsor `generateMetadata` | **Partial** | Name + optional industry; no domain / short_description preference order |
| Hub metadata (`/`, `/events`, `/sponsors`) | **Implemented** | Static `createPageMetadata` on listing pages |
| Anon-only sponsor metadata load | **Implemented** | `getSponsorDetailData(..., { isAuthenticated: false })` |
| Helper extensions (`images`, `robots`) | **Missing** | Input type is only `title` / `description` / `path` |

### Event template — current vs plan

| Plan | Current |
|------|---------|
| Include date range / year when known | Not used in metadata |
| Prefer series context when useful | Not used |
| Location in description | **Yes** (city embed) |

### Sponsor template — current vs plan

| Plan | Current |
|------|---------|
| Prefer short description / about | Not used |
| Fall back to industry | **Yes** |
| Fall back to website_label / domain | Not used |

### Series template — current vs plan

| Plan | Current |
|------|---------|
| Prefer curated description | **Yes** |
| Enrich with edition count / year | Not used |
| Merged → successor canonical | Not used |

### Missing / partial follow-ups

| Item | Why it matters | Phase | Effort | Dependencies |
|------|----------------|-------|--------|--------------|
| Richer event/series/sponsor description builders | Distinct snippets → better CTR and less duplicate SERP text | **S1** | **M** | Public date/location/logo fields already mostly available |
| Extend `createPageMetadata` for `robots` + optional `images` | Unblocks noindex + entity OG without forking helpers | **S1** | **S** | None |
| Length / uniqueness soft caps in builders | Avoid truncated or near-duplicate snippets | **S1** | **S** | Template builders |

---

## 2. Canonical strategy

### Status: Partially implemented

| Planned item | Status | Evidence |
|--------------|--------|----------|
| Host `https://app.eventpx.com` | **Implemented** | `PRODUCTION_SITE_ORIGIN`; no `VERCEL_URL` fallback |
| Reject `*.vercel.app` site URL override | **Implemented** | `getSiteUrl` hostname guard + tests |
| Per-page `alternates.canonical` | **Implemented** | Always set in `createPageMetadata` |
| Event canonical uses slug (not UUID) when known | **Implemented** | `path: `/events/${slug}`` after resolve |
| Sponsor / series slug canonical | **Implemented** | Profile/series slug in `path` |
| Listing pages canonical without filter query variants | **Implemented** | Hubs use clean `/events`, `/sponsors`, `/` |
| Tab query ignored for canonical | **Implemented** (implicit) | Metadata ignores `?tab=` |
| Merged series → successor canonical | **Missing** | No lifecycle branch in series metadata |
| Merged company → successor canonical | **Missing** | Not implemented in sponsor metadata |
| HTTP redirects for merged entities (beyond meta) | **Partial / unknown as SEO strategy** | Product merge flows exist; SEO redirect policy not wired as plan specifies |

### Missing / partial follow-ups

| Item | Why it matters | Phase | Effort | Dependencies |
|------|----------------|-------|--------|--------------|
| Merged series canonical (or noindex until redirect) | Prevents competing duplicate brand URLs | **S1** | **S–M** | `lifecycle_status` / `merged_into_series` on public series |
| Merged company canonical / noindex | Same for sponsor graph after merges | **S1** | **M** | Merge tombstone fields; public profile rules |
| Document + verify listing pages never canonicalize to `?q=` URLs | Query result pages should not dilute hub equity | **S1** | **S** | Confirm explore/discovery URL UX |

---

## 3. `noindex` strategy

### Status: Missing

| Planned item | Status | Evidence |
|--------------|--------|----------|
| Not-found soft pages `noindex` | **Missing** | “Event/Sponsor/Brand not found” still emit normal indexable metadata |
| Restricted companies `noindex` | **Missing** (page 404s; no explicit robots) | Restricted filtered in loaders/sitemap, but no `robots` metadata API |
| Merged entities `noindex` until redirect | **Missing** | — |
| Login / signup / admin indexing policy | **Missing** | Still use `createPageMetadata` without `noindex`; robots allows `/` |

`createPageMetadata` has **no** `robots` option today.

### Missing / partial follow-ups

| Item | Why it matters | Phase | Effort | Dependencies |
|------|----------------|-------|--------|--------------|
| `noindex` on not-found metadata paths | Stops soft-404 indexation | **S1** | **S** | Helper `robots` support |
| Policy for `/login`, `/signup`, `/admin` | Avoid thin/private URL index noise | **S1** | **S** | Product decision: disallow in robots vs meta noindex |
| Restricted / merged entity robots | Defense in depth if URL still resolves | **S1** | **S–M** | Entity status fields |

---

## 4. JSON-LD

### Status: Missing

| Planned item | Status |
|--------------|--------|
| `Event` on edition pages | **Missing** |
| `Organization` on sponsor pages | **Missing** |
| `WebSite` (+ optional `SearchAction`) on home | **Missing** |
| Future `Brand` / `ItemList` / `BreadcrumbList` | **Missing** |
| Shared JsonLd component / builders | **Missing** |

No `application/ld+json` usage under `src/`.

### Missing / partial follow-ups

| Item | Why it matters | Phase | Effort | Dependencies |
|------|----------------|-------|--------|--------------|
| `Event` + `Organization` JSON-LD | Rich-result eligibility; clearer entity understanding | **S2** | **M** | Public-safe field mapping; Rich Results Test in QA |
| `WebSite` on home | Site identity + optional sitelinks search | **S2** | **S** | Stable search URL shapes |
| Advanced schemas (ItemList, BreadcrumbList, Brand) | Incremental; only after core types stable | **S6** | **M** | Stable breadcrumbs/lists UI; S2 |

---

## 5. Open Graph

### Status: Partially implemented

| Planned item | Status | Evidence |
|--------------|--------|----------|
| `og:title` / `og:description` / `og:url` | **Implemented** | Via `createPageMetadata` |
| Production host for `og:url` | **Implemented** | Same as canonical base |
| `og:type`, `locale`, `siteName` (root) | **Implemented** | `rootSiteMetadata` |
| Shared default image | **Partial** | `/brand/logo-wordmark.svg` — plan wants raster ≈1200×630 |
| Per-entity images (series/company logos) | **Missing** | Helper always uses default image |
| Absolute image resolution via `metadataBase` | **Implemented** (relative paths) | Works if asset is public |

### Missing / partial follow-ups

| Item | Why it matters | Phase | Effort | Dependencies |
|------|----------------|-------|--------|--------------|
| Raster default OG card (PNG/JPG) | SVG often fails or looks poor on major networks | **S1** | **S** | Design asset in `public/` |
| Per-entity `openGraph.images` | Better shares for events/sponsors | **S2** | **M** | Public logo URL mapping; helper `images` param |
| Optional dedicated OG crops | Logo-on-card quality | **S6** | **L** | Image pipeline / design system |

---

## 6. Twitter cards

### Status: Partially implemented

| Planned item | Status | Evidence |
|--------------|--------|----------|
| `summary_large_image` | **Implemented** | Root + page metadata |
| Title / description / images mirrored | **Implemented** | Same fields as OG |
| `twitter:site` brand handle | **Missing** | No handle configured |
| Entity-specific images | **Missing** | Same gap as OG |

### Missing / partial follow-ups

| Item | Why it matters | Phase | Effort | Dependencies |
|------|----------------|-------|--------|--------------|
| Inherit OG raster + entity images | Twitter uses the same preview assets | **S1 / S2** | bundled with OG | S1/S2 image work |
| Optional `twitter:site` | Brand attribution on cards | **S2** | **S** | Official X/Twitter handle decision |

---

## 7. Sitemap architecture

### Status: Partially implemented

| Planned item | Status | Evidence |
|--------------|--------|----------|
| Single `sitemap.xml` | **Implemented** | `src/app/sitemap.ts` |
| Static hubs + editions + series + sponsors | **Implemented** | — |
| Production absolute URLs | **Implemented** | `PRODUCTION_SITE_ORIGIN` |
| `lastModified` when available | **Implemented** | Editions: `last_reviewed_at` → `created_at`; others: `created_at` |
| `revalidate` | **Implemented** | `3600` |
| Exclude restricted companies | **Implemented** | `status = active` + `restricted_at IS NULL` |
| Exclude empty slugs | **Implemented** | Filters |
| Paginated DB fetch | **Implemented** | `fetchAllPaginatedSupabaseRows` |
| Sitemap index | **Missing** | — |
| `generateSitemaps` sharding | **Missing** | Single array return |
| Type-split sitemaps (static/events/series/sponsors) | **Missing** | — |
| Optional “sponsors with signal only” quality filter | **Missing** | All active unrestricted companies |
| Merged tombstone exclusion / successor-only | **Missing** / unclear | Series not filtered by lifecycle |

`robots.ts` points at `${PRODUCTION_SITE_ORIGIN}/sitemap.xml` (correct for current single-file design).

### Missing / partial follow-ups

| Item | Why it matters | Phase | Effort | Dependencies |
|------|----------------|-------|--------|--------------|
| Monitor URL count toward ~40–45k | Avoid hitting 50k/file limit blindly | **S3 / ops** | **S** | Logging or admin health |
| Sitemap index + shards (`generateSitemaps`) | Required before tens of thousands of sponsors | **S4** | **M–L** | Next.js sitemap APIs; Search Console resubmit |
| Lifecycle-aware series inclusion | Avoid indexing dead/merged hubs unnecessarily | **S4** (or S1) | **S** | Lifecycle fields |
| Optional sponsor quality filter | Keeps index high-signal as catalog grows | **S4** | **M** | Product rule (e.g. has sponsor stats) |

---

## 8. SEO health monitoring

### Status: Missing

| Planned item | Status |
|--------------|--------|
| Missing / duplicate titles report | **Missing** |
| Missing descriptions report | **Missing** |
| Missing logos report | **Missing** |
| Missing schema report | **Missing** |
| Canonical host misconfiguration guard | **Missing** (unit tests cover `getSiteUrl`; no prod monitor) |
| Admin SEO health panel / nightly script | **Missing** |
| Search Console / Rich Results QA checklist in ops | **External** (GSC configured per plan; not coded) |

No admin route or script named for SEO health (unrelated “audit” scripts are storage/identity ops).

### Missing / partial follow-ups

| Item | Why it matters | Phase | Effort | Dependencies |
|------|----------------|-------|--------|--------------|
| Read-only completeness query/report | Unlocks catalog-scale QA | **S3** | **M** | Definition of “complete” from S1/S2 |
| Admin UI linking to edit screens | Turns report into remediation | **S3** | **M–L** | Admin IA; S3 report API |
| Alert on sitemap fetch failure | Catch Cloudflare/5xx crawl blockers | **S3** | **S–M** | Ops channel; optional synthetic check |

---

## 9. Content generation readiness

### Status: Partially implemented

| Planned item | Status | Evidence |
|--------------|--------|----------|
| Series curated `description` field + public use | **Partial** | Used in series metadata when present |
| Company short/about fields in product | **Partial** | Fields exist in admin/public company model; **not** wired into sponsor `generateMetadata` preference order |
| Event edition long-form curated description in SEO | **Partial / weak** | Edition metadata does not use a rich description field today |
| AI draft generation + provenance | **Missing** | — |
| Human accept workflow before publish | **Missing** | — |
| Quality controls / banned claims | **Missing** | — |
| Audit log for AI acceptance | **Missing** | — |

Body content and admin fields can support human-written copy today; the **SEO content engine** (priority order, AI assist, gates) is not built.

### Missing / partial follow-ups

| Item | Why it matters | Phase | Effort | Dependencies |
|------|----------------|-------|--------|--------------|
| Wire existing descriptions into metadata preference chains | Cheap uniqueness win before AI | **S1** | **S–M** | Confirm which fields are public-safe |
| Event/company description coverage via admin | Foundation for organic depth | **S5** (content ops) | **L** | Editorial process |
| AI-assisted drafts + accept UI + provenance | Scale descriptions without silent hallucination | **S5** | **XL** | Policy/legal; S3 health; admin UX |
| Quality rules (length, uniqueness, banned claims) | Protect trust / brand | **S5** | **M** | S5 generation pipeline |

---

## Phase alignment (plan ↔ gaps)

| Phase | Plan goal | Gap audit verdict |
|-------|-----------|-------------------|
| **S0** Crawl foundation | Host, robots, sitemap, canonical/OG base | **Largely complete** — verify production fetch behind Cloudflare remains a deploy/ops check |
| **S1** Metadata quality | Templates, noindex, raster OG | **Not started as a package** — highest ROI next |
| **S2** JSON-LD + entity images | Event/Organization/WebSite; logo OG | **Missing** |
| **S3** SEO health | Admin/script reporting | **Missing** |
| **S4** Sitemap scale-out | Index + shards | **Not needed yet** (~3.5k URLs); design ready in plan |
| **S5** Content depth | Human + AI descriptions | **Fields partial; workflow missing** |
| **S6** Advanced schema | ItemList, BreadcrumbList, etc. | **Missing** (correctly deferred) |

---

## Recommended next work order

1. **S1** — Helper support for `robots` + images; richer templates; not-found `noindex`; raster default OG.  
2. **S2** — JSON-LD Event + Organization (+ WebSite); entity OG images.  
3. **S3** — Health report for missing descriptions/logos/schema.  
4. **S4** — When URL count or generate cost approaches limits.  
5. **S5 / S6** — Content engine and advanced schema when product prioritizes organic depth.

---

## Related documents

| Doc | Role |
|-----|------|
| `docs/plans/seo-foundation.md` | Target architecture and phases |
| `docs/plans/protection-v1.md` | Public data / restriction constraints for SEO content |

---

## Change log

| Date | Note |
|------|------|
| 2026-07-15 | Initial gap audit vs `seo-foundation.md` and current `src/` implementation |
