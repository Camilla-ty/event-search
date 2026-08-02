# SEO Implementation Roadmap

**Status:** Partially implemented — delivery order still authoritative; phase statuses below refreshed 2026-08-02
**Date:** 2026-07-16
**Last status refresh:** 2026-08-02
**Audience:** Product and engineering
**Authority stack:**

| Doc | Role |
|-----|------|
| `docs/plans/seo-foundation.md` | Architecture, templates, phases S0–S6, constraints |
| `docs/plans/seo-gap-audit.md` | Live vs plan gaps (2026-07-15) — historical snapshot |
| `docs/plans/seo-copy-examples.md` | Illustrative S1 metadata examples |
| `docs/plans/indexability-policy.md` | Confirmed IR1 rules + current implementation status |
| **This document** | **Delivery order** incorporating confirmed product decisions |

**Host:** `https://app.eventpx.com`
**Constraint:** SEO output reflects **anonymous-visible** content only (align with `docs/plans/protection-v1.md`). Never invent claims; never surface gated roster detail in public metadata or summaries.

**Implementation snapshot (2026-08-02):** **IR1** largely shipped (`src/lib/seo/indexability.ts`, sitemap membership, collection noindex, soft-404/login/admin noindex). **IR4** MVP research hubs shipped (topic × region ± year). **IR5** core JSON-LD shipped (Event, Organization, BreadcrumbList). Residual: empty `/topics/{slug}` shells (`SEO-001`); optional admin `robots.txt` Disallow; later IR health/sharding and richer IR4 lenses.

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

- [x] Written public-value gate table approved (v1 above or refined) — see `indexability-policy.md`.
- [x] Soft-404 and non-public entity metadata are `noindex`.
- [x] Sitemap includes only pages that pass the gate (decision 7) — **residual:** empty topic hubs may still be listed (`SEO-001`).
- [x] Restricted companies remain excluded from sitemap and public index targets.
- [x] Auth/admin indexing policy documented and applied (meta `noindex`; optional `robots.txt` Disallow still open).

**Implementation status (2026-08-02):** **Largely shipped** via `src/lib/seo/indexability.ts` + sitemap builders. Do not re-plan IR1 as greenfield.

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

Make sponsor/company public pages and **Sponsor Discovery** (`/sponsors`) the strongest organic expression of EventPixels’ core product: **sponsor intelligence** for sales-team research.

### Scope

- Prefer sponsor routes in prioritization, QA, and health metrics over peripheral catalog polish.
- Sponsor metadata preference order: **domain/website → sponsored edition count → generic** (IR3A — shipped; no `industry` or removed description columns).
- Surface **core public facts** on sponsor pages: public sponsorship counts that Protection allows anonymously (decision 4). Do **not** expose gated full history in metadata or above-the-fold claims.
- Treat `/sponsors` discovery (sort by count, search, event scope) as the canonical browse surface for sponsor activity — **not** a separate global “most active sponsors” research URL.
- Ensure sponsor pages that fail the public-value gate are not indexed and not in the sitemap.
- Align series/event cross-links so sponsor intelligence remains discoverable from events (internal linking), without leaking restricted companies.

**Out of scope for IR3:** Full AI company bios (→ IR7); changing Protection gating rules; **IR3B Most Active Sponsors research page** (cancelled — see `docs/plans/ir3-revised-plan.md`).

### Dependencies

- IR1 indexability rules.
- Protection / anon sponsor profile contracts.
- Confirmed public fields: name, slug, logo, website/domain, public stats.

### Acceptance criteria

- [x] Sponsor metadata preference order uses real public fields only (IR3A).
- [x] Public-safe sponsor count appears as visible page content where policy allows (IR1/IR2).
- [x] Restricted sponsors remain non-indexable and absent from sitemap (IR1).
- [ ] `/sponsors` remains the canonical sponsor browse; no duplicate leaderboard research URL shipped.
- [ ] QA priority list for SEO spot-checks is sponsor-first, then high-sponsor-count events.

---

## Phase IR4 — Topic, geo, and lens hubs (strategic SEO)

### Goal

Ship **indexable hub pages** that answer real search intent — geo + topic events, topic sponsors, regional sponsors — without duplicating Sponsor Discovery or inventing thin leaderboard URLs.

**Primary intents (product-confirmed):**

- “crypto events in singapore”, “bitcoin events in asia” → **geo + topic event hubs**
- “who sponsors {topic}” / topic-driven sponsor demand → **topic sponsor lens** on or alongside `/topics/{slug}`
- Sales-team sponsor research → **profiles + `/sponsors`** (IR3); hubs route into those sinks

**Cancelled:** IR3B `/research/sponsors/most-active` (low unique value vs `/sponsors?sort=count`; not an approved destination). See `docs/plans/ir3-revised-plan.md`.

### Scope

- Strengthen `/topics/{slug}` (factual summaries, metadata, sponsor module).
- Define clean canonical URLs for high-intent **topic + region** event combinations (not noindex filter URLs).
- Optional region sponsor hubs where roster gates pass.
- Metadata templates + sitemap inclusion only for published hubs that pass the public-value gate.
- Internal links: topic hubs ↔ events ↔ sponsor profiles; no gated history on anon surfaces.

### Dependencies

- IR1 gate + sitemap policy.
- Topic keyword model, event location fields, `company_sponsor_stats` / topic joins.
- `docs/plans/ir3-revised-plan.md` page-type priorities (Types A–D).

### Acceptance criteria

- [x] No `/research/sponsors/most-active` or equivalent global leaderboard URL.
- [ ] At least one topic hub ships with sponsor-intelligence module or lens.
- [x] Geo + topic event hub pattern documented with minimum edition gate — Bitcoin × Asia / topic×region hubs + quality gate.
- [x] Qualifying hub URLs in sitemap; filter URLs remain `noindex` — research hubs gated; **residual:** empty `/topics/{slug}` shells (`SEO-001`).
- [ ] Internal-linking pattern from events/series to topic hubs documented.

**Implementation status (2026-08-02):** **Partially shipped** — public research routes at `/events/topics/.../regions/...` (± `/years/...`); further topic-lens polish may remain.

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

- [x] Sample event + sponsor emit core JSON-LD types in markup (`Event`, `Organization`; plus `BreadcrumbList` on events) — validate in Rich Results as needed.
- [x] JSON-LD builders omit gated/restricted graphs (restricted companies emit no Organization graph).
- [ ] Default share image is raster PNG/JPG (not SVG-only wordmark).
- [x] Schema fields are a subset of publicly visible facts (builders skip incomplete graphs).

**Implementation status (2026-08-02):** **Partially shipped** — Event / Organization / BreadcrumbList via `src/lib/seo/*JsonLd.ts` + `JsonLd` component. `WebSite` home schema and raster OG defaults may still be open.

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
| Topic/geo hub URL patterns and roster gates | IR4 | See `docs/plans/ir3-revised-plan.md`; IR3B cancelled |
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
| `docs/plans/ir3-revised-plan.md` | IR3B cancellation; revised page-type priorities |
| `docs/plans/protection-v1.md` | Public data / restriction constraints |

---

## Change log

| Date | Note |
|------|------|
| 2026-07-16 | Initial implementation roadmap from foundation, gap audit, copy examples + seven confirmed product decisions |
| 2026-07-17 | IR3B (Most Active Sponsors research page) cancelled; IR3 scoped to profiles + discovery; IR4 redefined as topic/geo lens hubs (`ir3-revised-plan.md`) |
| 2026-08-02 | Status → partially implemented; IR1/IR4/IR5 acceptance + implementation notes refreshed against shipped code (`DOC-001`) |
