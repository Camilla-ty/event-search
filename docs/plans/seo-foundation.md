# SEO Foundation

**Status:** Foundation started (crawl basics live); rich SEO and scale architecture planned  
**Primary host:** `https://app.eventpx.com`  
**Audience:** Product, engineering, and content operations  
**Horizon:** Multi-year roadmap for EventPixels public discovery (events, series, sponsors)

---

## Goals

1. Make EventPixels pages reliably discoverable and shareable without leaking preview/deploy URLs.
2. Produce distinct, accurate metadata and structured data that match **public** (anonymous) content only.
3. Scale sitemaps and health monitoring as catalog size grows from thousands to tens of thousands of URLs.
4. Grow organic traffic through better templates, schemas, and eventually high-quality entity descriptions—without sacrificing data trust.

---

## Current state (as of 2026-07)

| Capability | State |
|------------|--------|
| Google Search Console | Configured |
| `robots.txt` | Configured (`Allow: /`, sitemap reference) |
| `sitemap.xml` | Single sitemap via `src/app/sitemap.ts` (~3,500 URLs) |
| Canonical URLs | `https://app.eventpx.com/...` |
| Open Graph / Twitter URLs | Same production origin (no `*.vercel.app`) |
| Metadata helper | `createPageMetadata` / `rootSiteMetadata` in `src/lib/metadata/site.ts` |
| JSON-LD | Not implemented |
| Per-entity social images | Not implemented (shared wordmark) |
| SEO health admin reporting | Not implemented |

**Expected growth:** tens of thousands of event editions, event series hubs, and sponsor/company profiles.

**Hard constraint:** SEO output must never use Vercel preview deployment hosts. Public origin remains `https://app.eventpx.com`.

**Privacy / product constraint:** Metadata and structured data must reflect **anonymous-visible** content only (e.g. no gated sponsorship history on sponsor profiles). Align with Protection / Data Access rules for restricted companies.

---

## Architecture overview

```text
                    ┌─────────────────────────────┐
                    │  Google / social crawlers   │
                    └──────────────┬──────────────┘
                                   │
              robots.txt + sitemap index / shards
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         ▼                         ▼                         ▼
   Event edition            Event series hub            Sponsor profile
   /events/{slug}           /events/series/{slug}       /sponsors/{slug}
         │                         │                         │
         └──────────── generateMetadata + JSON-LD ───────────┘
                                   │
                     createPageMetadata (shared)
                     metadataBase = app.eventpx.com
```

Shared principles:

- One **metadata system** (`createPageMetadata` + thin per-route generators).
- One **canonical origin**.
- One **sitemap pipeline** that can shard when needed.
- Optional **admin health surfaces** that score SEO readiness—not public.

---

## 1. Metadata generation system

### 1.1 Shared system

| Piece | Role |
|-------|------|
| `getSiteUrl` / `PRODUCTION_SITE_ORIGIN` | Stable absolute base for canonical + OG |
| `rootSiteMetadata` | Default title template `%s \| EventPixels`, site-level OG/Twitter |
| `createPageMetadata({ title, description, path })` | Per-page title, description, canonical, `og:url`, Twitter fields |
| Route `generateMetadata` | Loads entity, builds title/description/path, calls helper |

**Do not** invent parallel metadata stacks per feature. Extend the shared helper (e.g. optional `images`, `robots`) when needed.

### 1.2 Event pages (`/events/{slug}`)

**Purpose:** Rank and share individual editions (dates, place, brand).

**Recommended title template**

```text
{editionName}
→ HTML title: {editionName} | EventPixels
```

Optional richer form when unambiguous:

```text
{editionName} ({year})
```

**Recommended description template**

```text
{editionName} — {location}. {dateRange}. Sponsors and event intelligence on EventPixels.
```

Fallbacks when fields missing: omit empty segments; always keep a one-sentence product line.

**Canonical strategy**

- Prefer **slug** path: `https://app.eventpx.com/events/{slug}`.
- If the URL was opened by UUID, metadata `path` must still use the **canonical slug** when known.
- Query tabs (`?tab=sponsors`) stay on the same canonical path (no tab-specific canonicals).

### 1.3 Event series pages (`/events/series/{slug}`)

**Purpose:** Brand hubs that collect editions.

**Title:** `{seriesName}`  
**Description preference order**

1. Length-capped factual series summary from `buildEventSeriesSummary` / `buildSeriesMetadataDescription` (~150–160 chars for SERP).
2. Fallback: `{seriesName} — all events and editions on EventPixels.`

Public body copy uses the same factual summary engine (no curated or AI-generated `event_series.description` column).

**Canonical strategy**

- `https://app.eventpx.com/events/series/{slug}`.
- **Merged series:** canonical should point to the **successor** series hub when `lifecycle_status = merged` and a merged-into target exists; otherwise `noindex` (see below).

### 1.4 Sponsor pages (`/sponsors/{slug}`)

**Purpose:** Company/sponsor identity pages.

**Title:** `{companyName}`  
**Description preference order**

1. Public short description / about blurb (when allowed on public surface).
2. `{companyName} — {industry}. Company and sponsor intelligence on EventPixels.`
3. `{companyName} — {website_label}. Company and sponsor intelligence on EventPixels.`
4. Generic: `{companyName}. Company and sponsor intelligence on EventPixels.`

**Canonical strategy**

- `https://app.eventpx.com/sponsors/{slug}`.
- Restricted / merged / non-public companies must not appear in sitemap or should `noindex` if the URL is hit.

**Auth note:** Metadata generation must continue to load **anonymous** profile data only.

### 1.5 Canonical strategy (global)

| Rule | Detail |
|------|--------|
| Host | Always `https://app.eventpx.com` |
| Paths | Slash-normalized; encode slugs consistently with routers |
| Listing pages | Canonical to clean hub: `/`, `/events`, `/sponsors` (no filter/query variants) |
| Preview deploys | Must not emit `*.vercel.app` in canonical or OG |
| Duplicates | Prefer 301/canonical to the surviving entity after merges |

### 1.6 `noindex` strategy

Use `robots: { index: false, follow: true }` (or equivalent) when:

| Case | Reason |
|------|--------|
| Not-found / soft-404 metadata | Avoid indexing “Event not found” shells |
| Restricted companies | Not public catalog |
| Merged entities (until redirect exists) | Prevent competing duplicates |
| Login / signup / admin | Thin or private (confirm with robots Allow policy — may rely on auth + robots later) |
| Empty or policy-thin sponsor stubs (optional later) | Quality threshold |

Default public catalog pages remain **indexable**.

### 1.7 Title and description quality bars

| Constraint | Target |
|------------|--------|
| Title uniqueness | Distinct per entity; avoid mass-identical titles |
| Title length | Prefer ≤ ~60 characters visible |
| Description length | Prefer ~120–160 characters |
| Branding | Site name via layout template, not stuffed into every H1 |
| Accuracy | Never claim gated data (full sponsorship lists) in public snippets |

---

## 2. Structured data (JSON-LD)

Emit JSON-LD in page markup (`application/ld+json`) matching **visible** public content.

### 2.1 `Event` (edition detail)

| Property | Source (conceptual) |
|----------|---------------------|
| `@type` | `Event` |
| `name` | Edition name |
| `url` | Canonical edition URL |
| `startDate` / `endDate` | Edition dates when present |
| `location` | City / venue when public |
| `image` | Series or edition logo when public |
| `organizer` / brand | Series `Organization`/`Brand` reference when available |

Only include properties with known values; do not invent venues or tickets.

### 2.2 `Organization` (sponsor profile)

| Property | Source |
|----------|--------|
| `@type` | `Organization` |
| `name` | Company name |
| `url` | Canonical sponsor URL and/or company website |
| `logo` | Public logo URL when available |
| `sameAs` | Official website when available |

Do **not** encode restricted companies or internal aliases lists as public sameAs spam.

### 2.3 `WebSite` (home)

| Property | Source |
|----------|--------|
| `@type` | `WebSite` |
| `name` | EventPixels |
| `url` | `https://app.eventpx.com/` |
| `potentialAction` | Optional `SearchAction` targeting `/events?q=` or `/sponsors?q=` once stable |

### 2.4 Future schemas

| Schema | Where | When |
|--------|-------|------|
| `Brand` / `Organization` for series | Series hub | After Event + Organization ship |
| `ItemList` | Series hub edition lists; discovery hubs | When list markup is stable |
| `BreadcrumbList` | Detail pages | With consistent breadcrumb UI |
| `FAQPage` | Only if real FAQ content exists | Content-led |

**Validation:** Google Rich Results Test / Schema Markup Validator in QA checklists.

---

## 3. Open Graph and social sharing strategy

### 3.1 Defaults

| Field | Policy |
|-------|--------|
| `og:url` / Twitter URL | Production canonical URL |
| `og:site_name` | EventPixels |
| `og:type` | `website` for hubs; keep simple unless product needs `article` |
| Default image | **Raster** share card (≈1200×630 PNG/JPG), not SVG-only wordmark |
| Twitter card | `summary_large_image` |

### 3.2 Per-entity images

| Entity | Preferred image | Fallback |
|--------|-----------------|----------|
| Event edition | Series logo or edition art | Default share card |
| Event series | Series logo | Default share card |
| Sponsor | Company logo (square acceptable; may letterbox on card) | Default share card |

Requirements:

- Absolute HTTPS URLs under a public CDN/storage path.
- Skip broken / private storage objects.
- Prefer purpose-built OG crops later if logos look poor in large-card previews.

### 3.3 Twitter cards

Mirror OG title, description, and image. Add `twitter:site` only when an official brand handle exists.

---

## 4. Sitemap architecture

### 4.1 Current (v1)

- Single `sitemap.xml` from `src/app/sitemap.ts`.
- Includes: `/`, `/events`, `/sponsors`, public editions, series, active non-restricted sponsors.
- `lastModified` when available.
- `revalidate` hourly.
- Fits Google’s **≤50,000 URLs / ≤50MB** per sitemap limit today (~3.5k URLs).

### 4.2 Scaling thresholds

| Signal | Action |
|--------|--------|
| Approaching **~40k–45k** URLs in one file | Plan sharding |
| Generate time / memory pressure on deploy or request | Shard earlier |
| Sponsors dominate file size | Type-split sitemaps |

### 4.3 Future sharding

Use Next.js `generateSitemaps()` (or equivalent) to publish:

```text
/sitemap/0.xml
/sitemap/1.xml
...
```

Suggested shard size: **10k–45k** URLs per file (stay under 50k with headroom).

### 4.4 Sitemap index strategy

Prefer an index that lists:

| Sitemap | Contents |
|---------|----------|
| `sitemap-static` | Home, `/events`, `/sponsors`, other thin hubs |
| `sitemap-events` | Edition detail URLs |
| `sitemap-series` | Series hub URLs |
| `sitemap-sponsors` | Sponsor profile URLs (largest; may need multiple shards) |

`robots.txt` should reference the **index** (or the primary sitemap entry that points crawlers correctly) once the index exists.

### 4.5 Inclusion / exclusion policy

| Include | Exclude |
|---------|---------|
| Active public editions with slug | Empty / invalid slugs |
| Public series hubs | Restricted companies |
| Active non-restricted companies | Merged tombstones (prefer live successor only) |
| Core hubs | Admin, auth, API routes |

Optional later: only sponsors with real public signal (e.g. sponsorship stats) if quality dilutes.

---

## 5. SEO health monitoring

Treat SEO readiness as an **ops signal**, not only Search Console.

### 5.1 Automated checks (batch or admin)

| Check | Why |
|-------|-----|
| Missing / duplicate titles | Ranking and CTR |
| Missing / generic descriptions | Snippet quality |
| Missing logos (series/company) | Social + trust |
| Missing schema on detail templates | Rich-result eligibility |
| Canonical host ≠ `app.eventpx.com` | Misconfiguration guard |
| Indexed URL not in sitemap (sample) | Coverage drift |
| Restricted company still in sitemap | Privacy / policy |

### 5.2 Suggested admin reporting

A read-only admin “SEO health” panel (or nightly report) with:

- Counts: pages missing description, missing logo, missing dates (events).
- Top offenders list (link to edit screens).
- Sitemap size + shard status.
- Last successful sitemap generation timestamp.

Do **not** require production DB writes for crawl-time SEO; admin reports can use service role.

### 5.3 External monitoring

- Google Search Console: coverage, enhancements, Core Web Vitals.
- Spot-check Rich Results after JSON-LD ships.
- Alert when sitemap fetch fails (Cloudflare / 5xx).

---

## 6. Future content generation

Metadata and schema only go so far—**distinct body content** drives long-term organic value.

### 6.1 Event descriptions

| Source | Notes |
|--------|-------|
| Curated admin copy | Preferred |
| Structured fields (dates, venue, topics) | Always render truthfully |
| AI-assisted draft | Optional; must be reviewed before publish |

### 6.2 Company descriptions

| Source | Notes |
|--------|-------|
| Short description / about | Public fields only |
| AI-assisted draft from website | Optional; citation and review required |
| No invention of sponsorship claims | Never assert unverified sponsor history in public prose |

### 6.3 AI-assisted content generation (policy)

Allowed as **draft assist**, not silent publish:

1. Input: allowed public fields + fetched website text (when licensed/ToS-safe).
2. Output: draft short description with provenance (`source`, `model`, `generated_at`).
3. Human accept/edit in admin before public.
4. Regeneration must not overwrite accepted copy without confirmation.

### 6.4 Quality controls

- Minimum length / uniqueness checks.
- Banned claims list (funding, rankings, “official partner” unless sourced).
- Restricted companies never auto-generate public SEO copy.
- Diff + audit log for generated text acceptance.

---

## 7. Recommended implementation phases

### Phase S0 — Crawl foundation (mostly done)

| | |
|--|--|
| **Goal** | Stable host, robots, sitemap, canonical/OG base on `app.eventpx.com` |
| **Why** | Without this, richer SEO is wasted or mis-indexed on preview hosts |
| **Priority** | **P0** |
| **Dependencies** | DNS/Cloudflare access; Search Console property on production host |

**Exit criteria:** Production `robots.txt` + `sitemap.xml` fetchable; sample pages show `app.eventpx.com` canonical and `og:url`.

---

### Phase S1 — Metadata quality

| | |
|--|--|
| **Goal** | Stronger title/description templates for events, series, sponsors; `noindex` for not-found / non-public entities; raster default OG image |
| **Why** | Highest CTR/index quality gain per engineering hour |
| **Priority** | **P0 / P1** |
| **Dependencies** | S0; clean public location/date/logo fields |

**Exit criteria:** Spot-check SERP-like previews; not-found routes noindex; default share image is PNG/JPG.

---

### Phase S2 — Structured data + social entities

| | |
|--|--|
| **Goal** | JSON-LD for `Event`, `Organization`, `WebSite`; optional per-entity OG images from logos |
| **Why** | Eligibility for rich results and better link previews |
| **Priority** | **P1 / P2** |
| **Dependencies** | S1 templates; public logo URLs; validation tooling in QA |

**Exit criteria:** Rich Results Test passes on sample event + sponsor; no gated data in JSON-LD.

---

### Phase S3 — SEO health reporting

| | |
|--|--|
| **Goal** | Admin (or scripted) report for missing metadata, logos, descriptions, schema gaps |
| **Why** | Catalog growth makes manual QA impossible |
| **Priority** | **P2** |
| **Dependencies** | S1–S2 definition of “complete”; admin auth surfaces |

**Exit criteria:** Weekly-operable list of incomplete entities linked to edit flows.

---

### Phase S4 — Sitemap scale-out

| | |
|--|--|
| **Goal** | Sitemap index + type/id sharding before ~50k URL ceiling; exclude low-value/non-public URLs |
| **Why** | Avoid hard Google sitemap limits and timeout/memory failures |
| **Priority** | **P2** (bring forward if growth accelerates) |
| **Dependencies** | S0 sitemap; accurate inclusion rules; possibly Search Console re-submit |

**Exit criteria:** Index lists shards; each shard &lt; 50k URLs; robots points at index.

---

### Phase S5 — Content depth (human + AI-assisted)

| | |
|--|--|
| **Goal** | Curated/AI-drafted event and company descriptions with acceptance workflow and quality controls |
| **Why** | Durable differentiation vs thin catalog competitors |
| **Priority** | **P3** (product/content-led) |
| **Dependencies** | Admin copy fields; S3 health metrics; AI policy/legal review |

**Exit criteria:** Accepted descriptions live on a meaningful % of high-traffic entities; generation never auto-publishes without review.

---

### Phase S6 — Advanced schema & hubs (optional)

| | |
|--|--|
| **Goal** | `ItemList`, `BreadcrumbList`, series Brand schema, SearchAction; topical landing quality |
| **Why** | Incremental rich-result and internal discovery gains |
| **Priority** | **P3** |
| **Dependencies** | S2 stable; UI breadcrumbs/lists stable |

---

## Multi-year roadmap snapshot

| Year focus | Emphasis |
|------------|----------|
| Near term | S0 verify live · S1 metadata · default OG raster |
| Next | S2 JSON-LD + entity images · S3 health · S4 if growth requires |
| Later | S5 content engine · S6 advanced schema |

---

## Non-goals

- Ranking guarantees or paid SEO campaigns.
- Indexing admin, import tooling, or authenticated-only data.
- Blocking legitimate crawlers via aggressive `Disallow` on public catalog.
- Silently generated public AI copy without human acceptance.

---

## Related docs / code

| Artifact | Role |
|----------|------|
| `src/lib/metadata/site.ts` | Site URL, metadata helper |
| `src/app/sitemap.ts` | Current single sitemap |
| `src/app/robots.ts` | Crawl policy |
| `docs/plans/protection-v1.md` | Public data / protection constraints |
| Public routes | `events/[id]`, `events/series/[slug]`, `sponsors/[slug]` |

---

## Change log

| Date | Note |
|------|------|
| 2026-07-15 | Initial SEO foundation architecture and phased roadmap |
