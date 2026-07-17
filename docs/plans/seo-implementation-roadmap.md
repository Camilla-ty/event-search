# SEO Implementation Roadmap

**Status:** Roadmap only — no implementation  
**Date:** 2026-07-16  
**Audience:** Product and engineering  
**Authority stack:**

| Doc | Role |
|-----|------|
| `docs/plans/seo-foundation.md` | Architecture, templates, phases S0–S6, constraints |
| `docs/plans/seo-gap-audit.md` | Live vs plan gaps (2026-07-15) |
| `docs/plans/seo-copy-examples.md` | Illustrative S1 metadata examples |
| **This document** | **Delivery order** incorporating confirmed product decisions |

**Host:** `https://app.eventpx.com`  
**Constraint:** SEO output reflects **anonymous-visible** content only (align with `docs/plans/protection-v1.md`). Never invent claims; never surface gated roster detail in public metadata or summaries.

---

## Confirmed product decisions

These decisions govern this roadmap and override vague ordering in earlier SEO docs where they conflict.

| # | Decision | Implication |
|---|----------|-------------|
| 1 | **Public value gate before indexing** | A page is indexable only when it meets a defined public-value threshold. Thin, empty, not-found, restricted, merged, auth, and admin URLs are not treated as index targets. |
| 2 | **Sponsor intelligence is the primary product focus** | Sponsor/company public pages and sponsor-centric facts on events get priority over generic catalog polish. |
| 3 | **Last reviewed must be publicly visible** | `last_reviewed_at` is part of the public event surface (UI + eligible for factual summaries / signals), not admin-only metadata. |
| 4 | **Sponsor counts and sponsorship history are core facts** | Public-safe sponsor counts and publicly allowed sponsorship-history signals are first-class SEO/content facts—not optional enrichment. |
| 5 | **Event summaries must be factual and generated from DB content** | On-page event summary paragraphs are auto-built from structured fields only (e.g. dates, location, sponsor count, tier count, last reviewed). No marketing invention. |
| 6 | **Topic pages and research pages are strategic SEO assets** | `/topics/...` and research-oriented public pages are deliberate organic destinations—not leftovers. |
| 7 | **Sitemap contains only indexable public pages** | Sitemap membership = pages that pass the public value gate and are allowed to be indexed. Sitemap is not a dump of every routable URL. |

---

## Relationship to foundation phases (S0–S6)

Foundation phases remain useful architecture labels. This roadmap **resequences delivery** around the decisions above.

| This roadmap | Rough foundation map | Notes |
|--------------|----------------------|-------|
| **IR0** | S0 | Mostly done; verify only |
| **IR1** | S1 (`noindex`) + S4 inclusion rules early | Value gate + sitemap/indexability first |
| **IR2** | S1 event templates + §6 structured fields | Factual event summaries + last reviewed public |
| **IR3** | S1 sponsor templates + sponsor facts | **Primary product SEO focus** |
| **IR4** | Topics / research (under-specified in foundation) | Strategic hubs |
| **IR5** | S2 | JSON-LD after public facts are visible |
| **IR6** | S3 + S4 scale | Health + sharding when needed |
| **IR7** | S5 / S6 | Curated/AI depth and advanced schema — later |

---

## Phase IR0 — Crawl baseline verification

### Goal

Confirm production crawl basics remain correct before investing in richer SEO.

### Scope

- Verify production `robots.txt` and `sitemap.xml` resolve on `app.eventpx.com`.
- Spot-check canonical / `og:url` on sample event, series, and sponsor pages (no `*.vercel.app`).
- Document current sitemap membership vs the new public-value gate (gap list only).

### Dependencies

- Live deploy + Search Console property (already asserted in foundation).
- `seo-gap-audit.md` as starting checklist.

### Acceptance criteria

- [ ] Production robots + sitemap fetchable (ops note if Cloudflare challenges tooling).
- [ ] Sample public pages emit `https://app.eventpx.com` canonical and OG URL.
- [ ] Short written list of current sitemap URLs that would **fail** a public-value gate (for IR1).

---

## Phase IR1 — Indexability and public value gate

### Goal

Define and enforce what may be indexed; make the sitemap a list of **indexable public pages only**.

### Scope

**Product rule — public value gate (minimum viable definition to lock in IR1):**

A public entity page may be indexable only if all of the following hold:

| Entity | Minimum public value (v1) |
|--------|---------------------------|
| **Event edition** | Valid public slug; enough identity to be useful (name); at least one of: dates, location, or public sponsor count &gt; 0; not a soft-404 |
| **Event series** | Valid public slug; active/public lifecycle (not merged tombstone without successor handling) |
| **Sponsor** | Active, non-restricted; valid public slug; enough identity (name); prefer pages with public sponsorship signal when tightening later |
| **Topic / research** | Published public page with real topic/research content (not empty shell) |
| **Hubs** | `/`, `/events`, `/sponsors` (and later topic/research indexes if product ships them) |

**Explicitly not indexable:**

- Not-found / soft-404 shells
- Restricted companies
- Merged entities until successor canonical/redirect policy is applied
- Login, signup, admin, APIs
- Legacy thin redirects that are not destinations (e.g. city → `/events` unless product revisits)

**Engineering scope (planning level):**

- Extend shared metadata helper to support `robots` (`noindex` where required).
- Apply `noindex` to not-found and non-public cases.
- Align sitemap inclusion with the gate (remove or never add non-indexable URLs).
- Decide auth-page policy: meta `noindex` and/or robots path rules.
- Document successor canonical / `noindex` for merged series and companies.

### Dependencies

- IR0 verification notes.
- Protection rules for restricted companies (`protection-v1.md`).
- Lifecycle / merge fields for series and companies.

### Acceptance criteria

- [ ] Written public-value gate table approved (v1 above or refined).
- [ ] Soft-404 and non-public entity metadata are `noindex`.
- [ ] Sitemap includes only pages that pass the gate (decision 7).
- [ ] Restricted companies remain excluded from sitemap and public index targets.
- [ ] Auth/admin indexing policy documented and applied.

---

## Phase IR2 — Event factual surface (summaries + last reviewed)

### Goal

Make event pages earn indexing through **visible, factual** content derived from the database—not metadata alone.

### Scope

- **Public last reviewed:** show `last_reviewed_at` on the public event surface when present (decision 3).
- **Core facts on page:** date range, location, public sponsor count, sponsorship tier count when available (decision 4 + 5). Skip fields that are null/unavailable.
- **Auto-generated page summary paragraph:** visible body copy built only from those structured fields (see philosophy in copy-examples discussions / foundation §6 structured fields). Not meta description duplication alone—**on-page** content.
- **Metadata (S1-aligned):** title = edition name; description includes location + date range when known + product line; still no invented marketing.
- Omit empty segments; never claim gated sponsor roster detail.

**Out of scope for IR2:** AI-written blurbs; curated long-form essay fields (→ IR7).

### Dependencies

- IR1 gate (so thin events without facts can be excluded or deprioritized).
- Existing public loaders for dates, location, sponsor aggregates, `last_reviewed_at`.
- `formatLocationLabel` rules (`phase-1.1-location-scope.md`).

### Acceptance criteria

- [ ] Public event pages show last reviewed when the field is set.
- [ ] Public event pages show sponsor count (and tier count when available) as visible facts.
- [ ] Each qualifying event page renders a factual auto-summary paragraph from DB fields only.
- [ ] Event metadata descriptions include date/location when present (aligned with `seo-copy-examples.md` proposed S1).
- [ ] Spot-check: summary never includes fields missing in DB; never invents topics, rankings, or “official” claims.

---

## Phase IR3 — Sponsor intelligence SEO (primary focus)

### Goal

Make sponsor/company public pages the strongest organic and shareable expression of EventPixels’ core product: **sponsor intelligence**.

### Scope

- Prefer sponsor routes in prioritization, QA, and health metrics over peripheral catalog polish.
- S1-quality sponsor metadata preference order (foundation): public short description → domain/website label → generic—**do not** depend on non-existent `industry` column.
- Surface **core public facts** on sponsor pages: public sponsorship counts / history signals that Protection already allows anonymously (decision 4). Do **not** expose gated full history in metadata or above-the-fold claims.
- Ensure sponsor pages that fail the public-value gate are not indexed and not in the sitemap.
- Align series/event cross-links so sponsor intelligence remains discoverable from events (internal linking), without leaking restricted companies.

**Out of scope for IR3:** Full AI company bios (→ IR7); changing Protection gating rules.

### Dependencies

- IR1 indexability rules.
- Protection / anon sponsor profile contracts.
- Confirmed public fields: name, slug, logo, short description / website, public stats.

### Acceptance criteria

- [ ] Sponsor metadata preference order uses real public fields only (no dead `industry` dependency).
- [ ] Public-safe sponsor count / history facts appear as visible page content where policy allows.
- [ ] Restricted sponsors remain non-indexable and absent from sitemap.
- [ ] QA priority list for SEO spot-checks is sponsor-first, then high-sponsor-count events.

---

## Phase IR4 — Topic pages and research pages

### Goal

Treat topic hubs and research-oriented public pages as **strategic SEO assets** (decision 6), with the same indexability discipline as events and sponsors.

### Scope

- Inventory existing `/topics/[slug]` (and any research routes) against the public-value gate.
- Define metadata templates for topic/research pages (title, description, canonical).
- Ensure pages with real topical/research content are indexable and **included in the sitemap** when they pass the gate.
- Empty or stub topic/research shells: `noindex` + excluded from sitemap.
- Internal links from events/series/sponsors to relevant topic/research pages where relationships exist.
- Product decision: what “research page” means in v1 (dedicated routes vs edition research signals vs future editorial). Lock before build.

### Dependencies

- IR1 gate + sitemap policy.
- Existing topic data model and public topic hub routes.
- Product definition of research page inventory.

### Acceptance criteria

- [ ] Topic (and agreed research) pages have explicit metadata templates.
- [ ] Qualifying topic/research URLs appear in sitemap; stubs do not.
- [ ] Soft-empty topic/research pages are `noindex`.
- [ ] At least one documented internal-linking pattern from events or series to topics.

---

## Phase IR5 — Structured data and social previews

### Goal

Add machine-readable and share-friendly signals that match **visible public content** after facts exist on the page.

### Scope

- JSON-LD: `Event` (editions), `Organization` (sponsors), `WebSite` (home)—foundation §2.
- Only properties with known public values; include public dates, location, and public-safe counts only if also visible/allowed.
- Raster default OG image (~1200×630); optional per-entity logo images later.
- Optional: topic/`ItemList` schema only after topic pages are stable (IR4).

### Dependencies

- IR2–IR4 public facts and templates (schema must not invent beyond page content).
- Public logo URL mapping where used.
- Rich Results Test / schema validator in QA.

### Acceptance criteria

- [ ] Sample event + sponsor pass Rich Results / schema validation for core types.
- [ ] JSON-LD contains no gated or restricted data.
- [ ] Default share image is raster PNG/JPG (not SVG-only wordmark).
- [ ] Schema fields are a subset of publicly visible facts.

---

## Phase IR6 — SEO health monitoring and sitemap scale

### Goal

Operate SEO as a catalog-scale system: measure readiness; shard sitemaps before limits bite.

### Scope

- Admin or scripted SEO health report: missing titles/descriptions, missing last reviewed on indexed events, missing sponsor facts, schema gaps, gate failures still in sitemap.
- Monitor sitemap URL count; introduce sitemap index + shards before ~40–45k URLs (foundation §4).
- Alerting note for sitemap fetch failures (Cloudflare / 5xx).
- Keep sitemap = indexable-only as membership rules evolve.

### Dependencies

- IR1–IR5 definition of “complete enough.”
- Admin auth surfaces for reports (if UI).
- Search Console for external coverage cross-checks.

### Acceptance criteria

- [ ] Weekly-operable list of incomplete or mis-indexed candidates with links to edit/fix.
- [ ] Sitemap membership continuously matches the public-value gate.
- [ ] Shard/index plan ready; implemented when URL count or generate cost requires it.
- [ ] Restricted / non-indexable URLs never appear in sitemap samples.

---

## Phase IR7 — Content depth (curated + AI-assisted) and advanced hubs

### Goal

Add durable differentiation beyond factual auto-summaries—without silent hallucination.

### Scope

- Curated event/company descriptions where editorial capacity exists.
- AI draft assist with provenance + human accept before publish (foundation §6.3).
- Quality controls: uniqueness, banned claims, restricted companies never auto-generate public SEO copy.
- Optional advanced schema: `BreadcrumbList`, series `Brand`, `SearchAction`, richer topic `ItemList` (foundation S6).

### Dependencies

- IR2–IR3 factual baseline live (AI must not replace core facts).
- IR6 health metrics to prioritize which entities need prose.
- Legal/policy review for AI assist.

### Acceptance criteria

- [ ] Generation never auto-publishes without human acceptance.
- [ ] Accepted descriptions appear on a meaningful set of high-value sponsors/events.
- [ ] Factual auto-summaries remain present even when curated copy exists (or curated copy explicitly supersedes with review—product choice documented).
- [ ] No invented sponsorship claims in generated text.

---

## Suggested delivery order

```text
IR0  Verify crawl baseline
 │
IR1  Public value gate + noindex + sitemap = indexable only
 │
 ├──────────────┬────────────────┐
 ▼              ▼                ▼
IR2            IR3              IR4
Event          Sponsor          Topics /
factual        intelligence     research
summaries      SEO (primary)    assets
+ last reviewed
 │              │                │
 └──────────────┴────────┬───────┘
                         ▼
                        IR5  JSON-LD + raster OG
                         │
                        IR6  Health + sitemap scale
                         │
                        IR7  Curated/AI depth + advanced schema
```

**Parallelism:** After IR1, IR2 / IR3 / IR4 may proceed in parallel with **IR3 prioritized** when capacity is limited (decision 2).

---

## Non-goals (this roadmap)

- Ranking guarantees or paid acquisition campaigns.
- Indexing admin, import tooling, or authenticated-only data.
- Changing Protection rules to publish gated sponsorship lists for SEO.
- Silently generated public AI copy.
- Standalone `/venues/...` SEO destinations (venue design: not planned).
- GEO / AI-answer-engine strategy (no dedicated plan yet—out of scope here).

---

## Open decisions to lock before or during early phases

| Decision | Needed by | Notes |
|----------|-----------|--------|
| Exact v1 thresholds for “sponsor count &gt; 0” vs “dates or location only” on events | IR1 | Affects how many editions stay indexable |
| Whether sponsors without sponsorship signal stay indexable | IR1 / IR3 | Foundation optional quality filter |
| Merged entity: 301 vs canonical-to-successor vs `noindex` | IR1 | Gap audit: missing today |
| Definition and URL inventory of “research pages” | IR4 | Strategic but under-specified in code/docs |
| Auth pages: robots `Disallow` vs meta `noindex` only | IR1 | Foundation left open |
| Whether curated copy replaces or sits beside factual auto-summary | IR7 | Document when IR2 ships |

---

## Related documents

| Doc | Role |
|-----|------|
| `docs/plans/seo-foundation.md` | Architecture and template authority |
| `docs/plans/seo-gap-audit.md` | Implementation gaps as of 2026-07-15 |
| `docs/plans/seo-copy-examples.md` | Metadata copy illustrations |
| `docs/audits/seo-documents-inventory.md` | Doc inventory |
| `docs/plans/protection-v1.md` | Public data / restriction constraints |

---

## Change log

| Date | Note |
|------|------|
| 2026-07-16 | Initial implementation roadmap from foundation, gap audit, copy examples + seven confirmed product decisions |
