# Sponsor Intelligence SEO — IR3 Design

**Status:** Design only — no implementation  
**Date:** 2026-07-17  
**Phase:** IR3 (`docs/plans/seo-implementation-roadmap.md`)  
**Host:** `https://app.eventpx.com`

**Authority stack**

| Doc | Role |
|-----|------|
| `docs/plans/seo-implementation-roadmap.md` | IR3 delivery scope; sponsor intelligence as primary SEO focus |
| `docs/plans/indexability-policy.md` | Who may be indexed; research routes deferred from sitemap until published |
| `docs/plans/factual-summary-engine.md` | IR2 factual on-page copy; company summary baseline |
| `docs/plans/protection-v1.md` | Anonymous vs gated sponsor facts |
| `docs/plans/seo-foundation.md` | Metadata templates (to be corrected away from dead `industry`) |
| `docs/plans/seo-copy-examples.md` | Sponsor metadata quality-gate examples |

---

## 0. Product philosophy (confirmed)

These decisions govern every IR3 choice. Where earlier SEO docs conflict, this philosophy wins.

| # | Decision | SEO implication |
|---|----------|-----------------|
| 1 | **Sponsor intelligence is the primary product focus** | Sponsor profiles, discovery, and sponsor-centric research assets get priority over generic catalog polish. QA, internal linking, and content depth start here. |
| 2 | **Sales-team research is the highest-value search intent** | Optimize for people researching *who sponsors what*, *how often*, and *how recently* — not for consumer “attend this event” marketing. |
| 3 | **Event names are important but secondary** | Events and series remain first-class entities, but they exist largely to **ground** sponsor intelligence. Cross-links should pull users toward sponsor value, not bury it. |
| 4 | **Research pages are strategic SEO assets** | Dedicated research destinations (when shipped) are intentional organic products, not blog leftovers. They share the public-value gate and sitemap discipline. |
| 5 | **Facts only — no invented insights** | Every public claim must map to a stored or aggregate field. No rankings, “leading,” competitive narratives, or AI-inferred industry claims. |

**Protection boundary (non-negotiable):** Anonymous surfaces may show aggregate sponsorship **counts** and company identity. They must **not** expose gated sponsorship history (event names, series lists, per-edition tiers) in metadata, summaries, JSON, or SSR HTML. Restricted companies stay inaccessible and non-indexable.

**Dependency posture:** IR1 (indexability + sitemap) and IR2 (factual summaries) are shipped. IR3 builds on those surfaces. JSON-LD (IR5), AI bios (IR7), and topic polish (IR4) stay out of IR3 implementation scope except where this design defines interfaces they will later consume.

---

## 1. Sponsor profile SEO enhancements

### 1.1 Goal

Make `/sponsors/{slug}` the strongest organic expression of EventPixels: a page a sales researcher can land on from Google or an AI answer and immediately see **who this company is** and **how much sponsorship signal EventPixels has recorded** — without leaking gated history.

### 1.2 Current baseline (post-IR1/IR2)

| Surface | Today |
|---------|--------|
| Indexability | `company_sponsor_stats.sponsored_edition_count ≥ 1` and not restricted → index + sitemap |
| On-page factual summary | IR2 `buildCompanySummary`: identity, website, count, login note for full list |
| Visible count (anon) | “Sponsored N events” in Sponsorship history + summary paragraph |
| Metadata | Still prefers dead `industry` field; often falls through to generic “Company and sponsor intelligence…” |
| Curated copy | `short_description` / `description` render when present; not used in IR2 engine |
| Gated history | Login-only series/edition groups |

### 1.3 Metadata preference order (replace foundation’s industry step)

Emit descriptions from **real public fields only**:

| Priority | Source | Rule |
|----------|--------|------|
| 1 | Quality-gated `short_description` | Use when informative (see §1.4) |
| 2 | Domain / website label | `{name} — {domain}. Company and sponsor intelligence on EventPixels.` |
| 3 | Public count enrichment | When count ≥ 1 and known: append or weave `Sponsored {N} recorded event editions on EventPixels.` without naming events |
| 4 | Generic | `{name}. Company and sponsor intelligence on EventPixels.` |

**Remove:** any dependency on `industry` (not a reliable DB column).

Canonical remains `https://app.eventpx.com/sponsors/{slug}`. Metadata generation continues to load **anonymous** profile data only.

### 1.4 Short-description quality gate

Skip `short_description` when any of the following hold (escalate to domain / count / generic):

- Empty / whitespace
- Placeholder patterns: “partner profile”, “company profile”, name-only echo
- Ultra-thin slogans (&lt; ~40 characters) that convey no category or function
- Pure marketing fluff that adds no entity fact (optional later: banned-phrase list shared with IR2)

When short text passes the gate, trim to ~120–155 characters for SERP.

### 1.5 On-page layout priorities (design intent)

Above the fold for anonymous users should answer sales-research questions in this order:

1. **Identity** — name, logo, website/domain  
2. **Sponsorship magnitude** — authoritative sponsored-edition count (`company_sponsor_stats`)  
3. **Factual summary** — IR2 paragraph (keep; may be lightly extended with public-safe aggregates from §3)  
4. **Trust / access** — clear statement that full sponsorship history requires login (already present)  
5. **Curated about** — `short_description` / long `description` when present (editorial, not invented)

Do **not** invent “sponsor score,” “tier reputation,” or “competitor set” blocks.

### 1.6 Relationship to IR2 company summary

- IR2 remains the deterministic factual paragraph.  
- IR3 may **feed additional public-safe aggregates** into the same builder (or a sibling fragment list) once those aggregates are approved in §3.  
- Curated descriptions stay separate; they never replace the factual block (IR7 may later choose supersede-with-review; until then, both may coexist with factual first).

### 1.7 Acceptance criteria (profile SEO)

- [ ] Metadata preference order uses short_description → domain → count → generic; zero `industry` dependency  
- [ ] Quality gate skips placeholder/thin short descriptions  
- [ ] Indexable profiles show count as a primary visible fact (header and/or summary)  
- [ ] Anon HTML/metadata never contain sponsored event or series names  
- [ ] Restricted / zero-count profiles remain `noindex` and sitemap-excluded (IR1 unchanged)

---

## 2. Sponsor intelligence metrics

### 2.1 What “sponsor intelligence” means for SEO

For EventPixels, a **sponsor intelligence metric** is a **catalog-attributed fact** that helps a sales researcher judge sponsorship activity. Metrics are not marketing KPIs and not world-absolute claims (“this company sponsors 40 events globally”). Prefer:

> “EventPixels has recorded **N** sponsored event editions for {Company}.”

### 2.2 Metric classes

| Class | Examples | Public (anon)? | Notes |
|-------|----------|----------------|-------|
| **A. Core magnitude** | `sponsored_edition_count` | **Yes** | Already authoritative via `company_sponsor_stats`; drives IR1 indexability |
| **B. Activity window** | Earliest / latest sponsorship year; optional `latest_activity_at` as year-only | **Candidate** | Years are aggregates; do not name the underlying events. Align with Protection before shipping year window on profiles. |
| **C. Breadth aggregates** | Distinct series count; distinct topic count across sponsored editions | **Candidate** | Counts only — never list series/topic **names** on anon company pages if that would reconstruct history |
| **D. Roster-side metrics** (on **event** pages) | Sponsor count, tier count | **Yes** | Already public on editions (IR2); secondary to sponsor profiles but feed internal linking |
| **E. Gated detail** | Event names, series groups, per-link tiers, full timeline | **No** (login) | Never in SEO metadata or anon SSR |

### 2.3 Metrics that must not be invented

Banned for IR3 (even if useful for sales):

- “Top sponsor,” “tier-1 brand,” market share, attendance-derived ROI  
- Industry / category labels not stored as first-class public fields  
- Competitor comparison (“unlike Coinbase, …”)  
- Predicted future sponsorships  
- Scores or rankings without an explicit, documented, reproducible formula grounded in public counts — **prefer no scores in IR3**

### 2.4 Single source of truth

| Metric | Source of truth |
|--------|-----------------|
| Sponsored edition count | `company_sponsor_stats.sponsored_edition_count` (same as IR1/IR2/discovery) |
| Stats unavailable | `sponsoredEditionCountUnknown` → omit count claims (fail open on robots already) |
| Edition sponsor / tier counts | Edition sponsor links (restricted companies included in counts; profiles still gated) |

Any new aggregate must be defined as a view/query over existing tables, tested for Protection compliance, and wired into both UI and metadata from one helper — mirror the IR1 indexability pattern.

### 2.5 Acceptance criteria (metrics)

- [ ] Documented metric inventory with public vs gated labels  
- [ ] No metric appears in SEO output unless its source and Protection status are listed here  
- [ ] Core magnitude remains identical across profile, discovery, indexability, and sitemap

---

## 3. Public sponsor statistics

### 3.1 Already public (shipped)

| Stat | Where shown | SEO use |
|------|-------------|---------|
| `sponsored_edition_count` | Discovery rows, profile summary / history teaser, IR2 company summary | Primary snippet enrichment; indexability gate |
| Company name, slug, logo, website/domain | Profile + discovery | Identity |
| `short_description` / `description` | Profile when curated | Metadata preference §1.3 |

Discovery RPC also exposes `latest_activity_at` for **sort/display on `/sponsors`**. IR3 should explicitly decide whether profile pages may show a **year-granularity** “last recorded sponsorship activity” line for anon users. Default recommendation:

- **Allow** year-only activity on profiles if derived from the same stats path and **does not** reveal event names.  
- **Do not** show ISO timestamps that imply a specific edition without naming it in a way that becomes a puzzle for competitors — year is enough for sales research intent.

### 3.2 Proposed public-safe additions (IR3 design; Protection review required)

| Stat | Definition | Why sales researchers care | Risk |
|------|------------|----------------------------|------|
| **Sponsorship year span** | Min/max year of sponsored editions | Longevity of event presence | Low if years only |
| **Distinct series count** | Count of distinct series among sponsored editions | Breadth without naming brands | Medium — high counts are fine; avoid listing names |
| **Recorded tier usage** | Count of sponsorship links that have a tier label/rank | Signals structured sponsor programs exist | Low as a count; never list tier names tied to events for anon |

**Explicitly not public in IR3:** named co-sponsors, named events, named series on company pages, exportable history tables.

### 3.3 Presentation rules

1. Attribute to the catalog (“recorded on EventPixels”).  
2. Omit zeros and unknowns (same omission philosophy as IR2).  
3. Pluralize correctly; no “0 events sponsored.”  
4. Stats outage → omit statistics block content that depends on the failed source.  
5. Visible stats ⊆ metadata-eligible stats (no meta claim stronger than the page).

### 3.4 Discovery hub (`/sponsors`)

- Clean `/sponsors` remains indexable; filtered/search URLs stay `noindex` + canonical to clean hub (IR1).  
- Hub copy should emphasize **sponsor intelligence / research**, not “find brands to follow.”  
- Sort by count / activity continues to surface high-value profiles for internal discovery and crawl paths.

### 3.5 Acceptance criteria (public stats)

- [ ] Profile and discovery agree on sponsored-edition count  
- [ ] Any new anon stat has a Protection sign-off note in this doc or a linked ADR  
- [ ] No anon profile response includes event/series name arrays

---

## 4. Research page architecture

### 4.1 Problem

Roadmap decision 6 calls research pages **strategic SEO assets**, but **no dedicated public research routes exist yet** (IR1 correctly deferred inventing `/research` URLs). IR4 owns topic + research implementation; IR3 must **define the architecture** so sponsor intelligence leads that work.

### 4.2 Definition — what a “research page” is

A research page is a **public, indexable destination whose primary job is to answer a sales-research question** using EventPixels facts — not to promote attendance at a single event.

| Layer | Role | Sponsor-intelligence weight |
|-------|------|----------------------------|
| **L0 — Research signals on entity pages** | Last reviewed, source URL, factual summaries, public counts (IR2 + event Research Information) | Supporting trust on events; secondary |
| **L1 — Sponsor profiles** | Primary research unit: “What do we know about this sponsor?” | **Primary** |
| **L2 — Sponsor discovery hub** | Browse/rank sponsors by recorded activity | Primary gateway |
| **L3 — Topic hubs** | Thematic entry (`/topics/{slug}`) that should surface sponsors and high-signal events | Bridge (IR4 polish) |
| **L4 — Dedicated research routes** | Curated or aggregated research destinations under a stable URL namespace | Strategic when shipped (IR4+) |

### 4.3 Proposed URL architecture (design only — do not implement or sitemap until published)

Recommended namespace when product is ready to ship L4:

```text
/research                          → index of published research destinations (optional)
/research/sponsors                 → alias or editorial gateway into sponsor intelligence
/research/sponsors/{slug}          → optional long-form research view of a sponsor
                                     OR canonical-redirect to /sponsors/{slug}
/research/topics/{slug}            → research framing of an existing topic hub
/research/{editorial-slug}         → named studies / methodology / dataset explainers
```

**Canonical rule:** Prefer **one indexable URL per research intent**. If `/research/sponsors/{slug}` duplicates `/sponsors/{slug}`, either:

- **301 / canonical to `/sponsors/{slug}`** (recommended for v1 — avoid duplicate sponsor URLs), or  
- Make `/research/sponsors/{slug}` a **superset** page with additional published research modules and keep `/sponsors/{slug}` as the product profile with `rel`/internal links both ways.

Until L4 ships: **zero** research URLs in sitemap or metadata (unchanged IR1 policy).

### 4.4 Content modules for a sponsor research destination

Whether on `/sponsors/{slug}` (L1) or a future L4 page, modules are fact-shaped:

| Module | Content | Gating |
|--------|---------|--------|
| Identity | Name, domain, logo | Public |
| Recorded sponsorship magnitude | Count (+ optional year span) | Public aggregates |
| Factual summary | IR2/IR3 engine | Public |
| Methodology / trust | How EventPixels records sponsorships; last-reviewed on related editions when shown | Public, non-promotional |
| Full history | Series → editions → tiers | **Login** |
| Related topics | Topic chips linked from series the company sponsors | Prefer login or aggregate-only until Protection-reviewed |
| Related high-signal events | Only if publicly listable without violating company-history gating — typically linked **from event pages to sponsors**, not the reverse for anon | See §5 |

### 4.5 Sales-research intents to design for

| Intent (example queries) | Best destination |
|--------------------------|------------------|
| “Does {Company} sponsor events?” / “{Company} sponsorships” | Sponsor profile (L1) |
| “Most active crypto event sponsors” | `/sponsors` discovery sorted by count (L2) — no separate research URL |
| “Who sponsors {Event}?” | Event edition sponsors tab (secondary entity; links out to profiles) |
| “Sponsors in {topic}” | Topic hub → sponsors module (IR4) |
| “How EventPixels research works” | Methodology L4 page |

### 4.6 Indexability for research routes (when they exist)

Align with `indexability-policy.md` §3.5:

- Published research with real content → **index** + sitemap  
- Empty shells / drafts → **noindex** + exclude  
- Research that merely mirrors a thin sponsor stub (0 sponsored editions) → do not create a second indexable URL; rely on IR1 company gate

### 4.7 Acceptance criteria (architecture)

- [ ] L0–L4 layers documented and agreed  
- [ ] URL namespace chosen before IR4 build; duplicate-URL policy locked  
- [ ] No placeholder research routes in production sitemap before publish  
- [ ] Every research module tagged public vs gated

---

## 5. Internal linking opportunities

Internal links should **bias crawl and user paths toward sponsor intelligence**, while keeping event names available as supporting context.

### 5.1 Priority graph

```text
                    ┌──────────────┐
                    │ /sponsors    │  discovery hub
                    └──────┬───────┘
                           │
              ┌────────────▼────────────┐
              │ /sponsors/{slug}        │  PRIMARY SEO ASSET
              └────────────▲────────────┘
                           │
     ┌─────────────────────┼─────────────────────┐
     │                     │                     │
┌────┴─────┐        ┌──────┴──────┐       ┌──────┴──────┐
│ /events/ │        │ /events/    │       │ /topics/    │
│ {edition}│        │ series/{s}  │       │ {slug}      │
└──────────┘        └─────────────┘       └─────────────┘
```

Events and series are **feeders**; sponsor profiles are the **sink** for sales-research intent.

### 5.2 Concrete link patterns

| From | To | Pattern | Protection |
|------|----|---------|------------|
| Event edition sponsors roster | Sponsor profile | Existing clickable (non-restricted) rows | Restricted stay masked, non-clickable |
| Event factual summary / overview | `/sponsors` or top public sponsors | Optional “Explore sponsors” CTA — factual, not hype | No gated names in meta |
| Series hub | Sponsor profiles | Only via edition pages unless a public aggregate module exists | Do not dump anon company↔series matrices if gated |
| Sponsor profile | `/sponsors` | “Back to Sponsors” + related high-count sponsors (optional) | Related sponsors = public profiles only; justify with shared public facts if shown |
| Sponsor profile | Login | Full history CTA | Already present |
| Topic hub | Sponsor profiles / high-sponsor editions | IR4: topic → editions → sponsors | Prefer paths that do not invent topic↔company edges without data |
| Home | `/sponsors` | Elevate sponsor discovery in primary nav/hero priority vs events-only framing | Product/design |

### 5.3 Link equity rules

1. Every indexable event with sponsors should expose at least one path to a sponsor profile or the sponsors hub.  
2. Do not orphan high-count sponsors (discovery + inbound from events).  
3. Avoid reciprocal spam: no sitewide “top sponsors” footers inventing rankings.  
4. Anchor text: prefer company name or “sponsor profile,” not “click here” or superlatives.

### 5.4 Acceptance criteria (linking)

- [ ] Documented sponsor-first link graph  
- [ ] Spot-check: high-sponsor-count editions link to real sponsor profiles  
- [ ] Restricted companies never gain public profile hrefs  
- [ ] QA checklist prioritizes sponsor inbound links over peripheral pages

---

## 6. GEO-focused sponsor content

### 6.1 Definition

**GEO** here means **Generative Engine Optimization / AI-answer visibility**: structuring public pages so answer engines can cite EventPixels as a factual source for sponsorship questions — without changing Protection rules or inventing insights.

This is adjacent to classic SEO (titles, sitemap) but emphasizes **citeable, atomic facts**.

### 6.2 GEO principles for EventPixels

| Principle | Practice |
|-----------|----------|
| **Atomic facts** | Short, self-contained sentences (IR2 engine style) that can be quoted |
| **Entity clarity** | Stable name, domain, canonical URL, logo |
| **Catalog attribution** | “recorded on EventPixels” prevents false world-absolute citations |
| **No hallucination surface** | Never publish speculative copy an AI would confidently repeat |
| **Visible = citable** | Do not put stronger claims in meta/JSON-LD than in HTML (IR5 must follow) |
| **Access honesty** | State what requires login so models do not invent full histories from teaser counts |

### 6.3 Sponsor-page GEO shape (target)

Ideal anon-visible structure for answer engines:

1. H1 = company name  
2. Factual summary paragraph (identity + count + access note)  
3. Explicit statistics list or definition list (`Sponsored editions recorded: N`)  
4. Website/domain as plain fact  
5. Optional curated about (human-reviewed only)  
6. Clear gate: full sponsorship list requires authentication  

Avoid burying the count below folds of marketing prose.

### 6.4 Query classes GEO should support

| Query class | Answerable from public facts? |
|-------------|-------------------------------|
| “How many events has {Company} sponsored (per EventPixels)?” | Yes — count |
| “What is {Company}’s website?” | Yes — domain/website |
| “Which events did {Company} sponsor?” | **Not** from anon page — must not be scrapeable; answer = login wall |
| “Is {Company} a leading sponsor?” | **Never** — no such field |

### 6.5 Out of scope for IR3 GEO

- Special `llms.txt` / AI-crawler robots policy (separate decision; do not silently Disallow)  
- Schema.org beyond what IR5 will add from **visible** fields  
- Paying for AI-search placements  
- Generating AI bios (IR7)

### 6.6 Acceptance criteria (GEO)

- [ ] Sponsor profiles expose at least one atomic, catalog-attributed count sentence in SSR HTML  
- [ ] No public copy uses ranking/superlative language from templates  
- [ ] Login gate for history is explicit in visible text  
- [ ] Future JSON-LD Organization properties ⊆ visible facts (hand-off to IR5)

---

## 7. Prioritization of sponsor intelligence assets

### 7.1 Priority tiers

| Tier | Asset | Why | IR3 action |
|------|-------|-----|------------|
| **P0** | Indexable `/sponsors/{slug}` with count ≥ 1 | Primary sales-research landing page | Metadata fix, stats presentation, GEO-shaped facts |
| **P0** | `/sponsors` discovery hub | Gateway + crawl path to P0 profiles | Hub copy; keep IR1 filter `noindex` |
| **P1** | High sponsor-count event editions | Feeders that prove sponsorship context | Ensure roster → profile links; event summaries already IR2 |
| **P1** | `company_sponsor_stats` integrity | Single source of truth for count | Monitor/fail-open already hardened in IR1 |
| **P2** | Topic hubs with sponsor paths | Thematic research entry | Design only in IR3; build in IR4 |
| **P2** | Series hubs | Brand context for events | Secondary; link downward to editions/sponsors |
| **P3** | Dedicated `/research/*` routes | Strategic when content exists | Architecture in §4; implement IR4+ |
| **P3** | Zero-sponsor company pages | Exist but `noindex` | No SEO investment |
| **Excluded** | Restricted companies, auth, admin, gated history | Not public SEO assets | Never |

### 7.2 Suggested IR3 implementation sequence (when coding starts)

1. **Metadata preference order + quality gate** (fast SERP win; removes `industry`)  
2. **Public stats presentation polish** on profiles (count prominence; optional year span after Protection review)  
3. **Extend factual summary fragments** with approved aggregates only  
4. **Internal linking audit + fixes** (event roster → profiles; home/nav emphasis)  
5. **GEO pass** (definition lists / atomic stats; banned wording tests)  
6. **Research IA lock** with product (URL namespace + canonical policy) → hand to IR4  
7. **QA priority list** — sponsor-first spot-checks (acceptance in roadmap)

### 7.3 QA / health prioritization

When IR6 health reporting arrives, weight failures in this order:

1. Indexable sponsor missing count or emitting gated names  
2. Indexable sponsor with generic-only metadata despite usable short_description/domain  
3. High-count edition with broken/missing sponsor profile links  
4. Event/series metadata issues  
5. Topic/research shell issues  

### 7.4 Non-goals (IR3)

- Changing Protection to publish full anon history for SEO  
- AI-generated sponsor bios  
- Invented competitive insights or rankings  
- Sitemap inclusion of unpublished research URLs  
- Replacing IR2 factual summaries with marketing copy  
- Venue SEO destinations  

### 7.5 Acceptance criteria (prioritization)

- [ ] Engineering and SEO QA use the P0–P3 table above  
- [ ] Capacity conflicts resolve in favor of sponsor profiles over peripheral catalog polish  
- [ ] Research route build does not start until §4 canonical policy is signed off

---

## 8. Open decisions to lock before or during IR3 build

| Decision | Options | Recommendation |
|----------|---------|----------------|
| Profile display of `latest_activity` | Hide / year-only / full date | Year-only if Protection agrees |
| Distinct series count on anon profiles | Ship / defer | Defer until clear it cannot reconstruct gated lists |
| `/research/sponsors/{slug}` vs canonical profile | Redirect to profile / superseding research URL | v1: canonical to `/sponsors/{slug}` |
| Related-sponsors module | None / shared-topic / shared-event | None until a public-safe edge exists |
| Hub messaging | Events-first vs Sponsors-first | Sponsors-first for sales-research positioning |

---

## 9. Relationship to later phases

| Phase | Hand-off from this design |
|-------|---------------------------|
| **IR4** | Research URL namespace, topic→sponsor linking, publish/sitemap rules for L4 |
| **IR5** | `Organization` JSON-LD from visible sponsor facts only; no gated properties |
| **IR6** | Sponsor-first health scoring (§7.3) |
| **IR7** | Curated/AI bios beside — not instead of — factual stats; human accept required |

---

## 10. Summary

IR3 makes **sponsor profiles and discovery** the center of EventPixels SEO. Sales-team research intent drives metadata, public statistics, internal links, and GEO-shaped factual content. Events remain essential context but secondary destinations. Research pages are designed as a layered architecture culminating in dedicated routes — without inventing indexable URLs before content exists. Every public claim stays a **catalog fact**; gated sponsorship history stays behind login.

---

## Change log

| Date | Note |
|------|------|
| 2026-07-17 | Initial IR3 design: profile SEO, metrics, public stats, research IA, linking, GEO, prioritization |
