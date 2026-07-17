# Indexability Policy

**Status:** Confirmed product policy — documentation only (not yet fully implemented)  
**Date:** 2026-07-16  
**Audience:** Product and engineering  
**Host:** `https://app.eventpx.com`

**Related:** `docs/plans/seo-foundation.md`, `docs/plans/seo-implementation-roadmap.md`, `docs/plans/protection-v1.md`

---

## 1. Purpose

This document defines which public EventPixels pages may be indexed by search engines, which URLs belong in the sitemap, and how canonicals and redirects behave for catalog entities.

It separates three concerns that must not be conflated:

| Concern | Meaning |
|---------|---------|
| **Page existence** | The URL may resolve and show a public (or soft) page |
| **Indexability** | Crawlers may index the page (`index` vs `noindex`) |
| **Sitemap membership** | The URL is listed in `sitemap.xml` |

**Sponsor intelligence** is the primary public value signal for indexability. **Last reviewed** is a trust signal on qualifying pages; it is **not** required for a page to be indexable.

---

## 2. Public value gate philosophy

A page is indexable only when it carries enough **public product value** for a stranger landing from search.

- For **companies/sponsors** and **event editions**, that value is primarily **sponsorship signal** (sponsored-event count / sponsor count ≥ 1).
- Thin catalog shells (zero sponsorship signal) may still exist for product UX, deep links, and authenticated flows—but they must not compete in organic search.
- Restricted companies never enter the public index, regardless of sponsorship counts.
- The sitemap is an allowlist of **indexable** URLs only—not a dump of every routable path.

**Hard rules**

1. Page existence ≠ indexability.
2. Sitemap contains only indexable pages.
3. `noindex` pages must not appear in the sitemap.
4. Canonical URLs must point to the preferred public URL.
5. Sponsor intelligence is the primary public value signal.
6. Last reviewed is a trust signal, not an indexability requirement.

---

## 3. Rules by page type

### 3.1 Company / sponsor pages (`/sponsors/{slug}`)

| Condition | Page may exist | Index | Sitemap |
|-----------|----------------|-------|---------|
| **0 sponsored events** | Yes | **noindex** | **Excluded** |
| **1+ sponsored events** | Yes | **index** | **Included** |
| **Restricted** | Per product/Protection (typically not a public catalog page) | **noindex** | **Excluded** |

Notes:

- “Sponsored events” means public-safe count of distinct event editions the company sponsors (anonymous-visible signal).
- Restricted overrides sponsorship count: always `noindex` + sitemap exclude.
- Metadata and on-page copy must not claim gated sponsorship history.

### 3.2 Event edition pages (`/events/{slug}`)

| Condition | Page may exist | Index | Sitemap |
|-----------|----------------|-------|---------|
| **0 sponsors** | Yes | **noindex** | **Excluded** |
| **1+ sponsors** | Yes | **index** | **Included** |

Notes:

- “Sponsors” means public sponsor-link count for that edition (≥ 1).
- Dates, location, and last reviewed enrich trust and snippets on indexable pages; they do **not** by themselves make a zero-sponsor edition indexable.

### 3.3 Event series pages (`/events/series/{slug}`)

| Lifecycle | Page may exist | Index | Sitemap | Other |
|-----------|----------------|-------|---------|--------|
| **Active** | Yes | **index** | **Included** | — |
| **Discontinued** | Yes | **index** | **Included** | Remains a valid brand hub |
| **Merged** | Prefer not as destination | **noindex** | **Excluded** | **Redirect to successor** when available |

Notes:

- Merged series without a resolvable successor: keep `noindex` + sitemap exclude until redirect or tombstone policy is applied.
- Series indexability does **not** currently require a minimum edition or sponsor count (unlike editions and companies).

### 3.4 Topic pages (`/topics/{slug}`)

| Rule | Value |
|------|--------|
| Index | **index** |
| Sitemap | **Included** |

Topic hubs are strategic SEO assets. Empty or unpublished topic shells, if they exist as soft pages, should follow the global soft-404 pattern (`noindex` + sitemap exclude)—default published topics are indexable.

### 3.5 Research pages

| Rule | Value |
|------|--------|
| Index | **index** |
| Sitemap | **Included** |

Research-oriented public pages are strategic SEO assets. Exact URL inventory is product-defined; once a research URL is a published public destination, it is indexable and sitemap-eligible.

**IR1 deferral:** No dedicated public research routes exist in the app yet. Do **not** invent placeholder `/research` URLs in sitemap or metadata. Track under SEO roadmap **IR4**.

### 3.6 Hubs and other public surfaces

| Page | Index (default) | Sitemap |
|------|-----------------|---------|
| Home `/` | index | Included |
| Events hub `/events` | index | Included |
| Sponsors hub `/sponsors` | index | Included |

Listing query variants (`?q=`, filters) must **not** receive distinct canonicals or sitemap entries; canonical to the clean hub.

### 3.7 Explicitly non-indexable surfaces

| Surface | Index | Sitemap |
|---------|-------|---------|
| Soft-404 / not-found shells (“Event not found”, etc.) | **noindex** | Excluded |
| Login / signup | **noindex** (or robots disallow—implementation choice) | Excluded |
| Admin | **noindex** / disallow | Excluded |
| API routes | N/A | Excluded |
| Legacy non-destination redirects (e.g. city → `/events`) | Prefer noindex if a document response exists | Excluded |

---

## 4. Sitemap inclusion rules

**Principle:** Sitemap membership ⇔ indexable under this policy.

| Include | Exclude |
|---------|---------|
| Home, `/events`, `/sponsors` | Auth, admin, API |
| Company pages with **1+** sponsored events and **not** restricted | Companies with **0** sponsored events |
| Restricted companies | Always |
| Event editions with **1+** sponsors | Editions with **0** sponsors |
| Active series | — |
| Discontinued series | — |
| Merged series | Always (redirect target is the successor URL) |
| Published topic pages | Unpublished / empty topic shells |
| Published research pages | Draft or non-public research |
| Soft-404 URLs | Always |

Additional:

- Prefer slug-based absolute URLs under `https://app.eventpx.com`.
- `lastModified` may use `last_reviewed_at` (or equivalent) when available; freshness does not change inclusion.
- When URL volume approaches platform limits, shard by type; **inclusion rules stay the same**.

---

## 5. Canonical rules

| Rule | Detail |
|------|--------|
| Host | Always `https://app.eventpx.com` (never preview / `*.vercel.app`) |
| Company | `https://app.eventpx.com/sponsors/{slug}` |
| Event edition | `https://app.eventpx.com/events/{slug}` (slug, not UUID, when known) |
| Event series | `https://app.eventpx.com/events/series/{slug}` |
| Topic | `https://app.eventpx.com/topics/{slug}` (or product-stable topic path) |
| Research | Preferred public research URL for that document |
| Hubs | Clean paths without filter/query variants |
| Tabs | `?tab=` (and similar) do not create alternate canonicals |
| Merged series | Canonical / redirect target = **successor** series URL when available |
| `noindex` pages | Still emit a self-canonical to the preferred public URL of that resource (or successor); do not canonical-point thin pages at unrelated hubs unless redirecting |

Canonical URLs must always point to the **preferred public URL** for the entity.

---

## 6. Redirect rules

| Case | Behavior |
|------|----------|
| **Merged series → successor available** | HTTP redirect to successor series hub; merged URL `noindex` + sitemap exclude |
| **Merged series → no successor** | Do not invent a destination; `noindex` + sitemap exclude until product defines tombstone/redirect |
| **Merged company** (when product supports public successor) | Same pattern as series: redirect to surviving sponsor URL; tombstone `noindex` + sitemap exclude |
| **UUID or alternate event URL → slug** | Prefer redirect or canonical to slug URL |
| **Legacy city (or other) browse URLs** | Redirect to product destination (e.g. `/events`); do not sitemap the legacy URL |

Redirects establish the preferred public URL; sitemap and index signals must follow the **destination**, not the retired path.

---

## 7. Examples

### Company — zero sponsored events

- URL may render a public profile.
- `robots`: `noindex`.
- Not listed in sitemap.
- Canonical: `/sponsors/{slug}`.

### Company — three sponsored events, not restricted

- Indexable.
- Included in sitemap.
- Canonical: `/sponsors/{slug}`.
- Last reviewed on related events is irrelevant to this company’s indexability.

### Company — restricted (even with sponsors)

- `noindex`, excluded from sitemap.
- Must not appear as a public catalog SEO target.

### Event edition — zero sponsors

- Page may exist (overview empty roster, etc.).
- `noindex`, excluded from sitemap.
- Having dates/location/last reviewed does **not** flip indexability.

### Event edition — 40 sponsors

- Indexable; included in sitemap.
- Factual summary / last reviewed may appear as trust content; they are not gate inputs.

### Series — discontinued

- Remains indexable and in sitemap (brand/history hub).

### Series — merged into successor S

- Request to merged slug redirects to S.
- Merged slug not in sitemap; treat as `noindex` if a document response is ever served without redirect.

### Topic / research

- Published topic or research URL: index + sitemap include.

---

## 8. Future considerations

| Topic | Note |
|-------|------|
| **Stricter sponsor quality filter** | Optional later: require stronger public signal than “≥ 1 sponsored event” (e.g. recency, verified stats) before indexing companies |
| **Series value gate** | Today active/discontinued series are indexable without a sponsor-count floor; revisit if thin series hubs dilute search |
| **Topic/research emptiness** | Formalize automated detection of empty shells → `noindex` + sitemap exclude |
| **Merged companies** | Align public redirect + tombstone SEO with admin merge once public successor URLs are stable |
| **Auth indexing mechanism** | Choose meta `noindex` vs `robots.txt` `Disallow` (or both) for login/signup/admin |
| **GEO / AI crawlers** | Separate policy if answer-engine visibility diverges from Google indexability |
| **Implementation** | Enforce via shared metadata `robots`, sitemap query filters, and merge redirects—see `seo-implementation-roadmap.md` IR1 |

---

## Change log

| Date | Note |
|------|------|
| 2026-07-16 | Initial confirmed indexability policy (companies, editions, series, topics, research + global rules) |
