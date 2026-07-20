# EventPixels Research Page Strategy

**Status:** Design only — no implementation  
**Date:** 2026-07-17  
**Audience:** Product and engineering  
**Host:** `https://app.eventpx.com`

**Related**

| Doc | Role |
|-----|------|
| `docs/plans/sponsor-intelligence-seo.md` | IR3 sponsor SEO; L0–L4 research layers; GEO principles |
| `docs/plans/seo-implementation-roadmap.md` | IR4 owns topic/research build; decision 6 |
| `docs/plans/indexability-policy.md` | Index + sitemap only for published research; no placeholder URLs |
| `docs/plans/protection-v1.md` | Anon may see sponsorship **counts**; not sponsored-event **lists** |
| `docs/plans/factual-summary-engine.md` | Factual, catalog-attributed copy patterns |

---

## Confirmed philosophy (non-negotiable)

| Principle | Implication for research pages |
|-----------|--------------------------------|
| **Sponsor intelligence first** | Research destinations exist to help people understand **sponsors**, not to market event attendance. |
| **Sales-team research intent first** | Pages answer “who is active?”, “in which theme/region?”, “who repeats?” — not “buy tickets.” |
| **Facts only** | Every claim maps to EventPixels-recorded structured data or a documented aggregate. No rankings theater, no invented insights. |
| **EventPixels-recorded data attribution** | Copy attributes activity to the catalog (“recorded on EventPixels”), never as a world-absolute census. |
| **No gated event history exposure** | Research pages may list **companies** and **public aggregates**. They must **not** reveal which events or series a company sponsored for anonymous users. |

**Entity priority:** Sponsor profiles (`/sponsors/{slug}`) remain the primary research unit. Dedicated research pages are **hubs and lenses** that route into those profiles. Event names appear only as supporting context on **event** pages, or as optional secondary links that do not reconstruct a company’s gated history.

---

## 1. Research page taxonomy

### 1.1 Definition

A **research page** is a public, indexable destination whose primary job is to answer a **sales-research question** using EventPixels facts.

It is not:

- A blog post or thought-leadership essay (unless later curated under editorial L4 with human review)
- A duplicate of `/sponsors/{slug}` under a vanity URL
- A filter URL on `/sponsors?…` (those stay `noindex` + canonical to clean hub per IR1)
- A soft-empty shell published “for SEO”

### 1.2 Taxonomy by job-to-be-done

| Type ID | Research question | Page family | Primary objects listed |
|---------|-------------------|-------------|------------------------|
| **R-INDEX** | “What research does EventPixels publish?” | Research index | Links to published research destinations |
| **R-METHOD** | “How does EventPixels record sponsorships?” | Methodology / trust | Static factual methodology |
| **R-TOPIC-SPONSORS** | “Which sponsors are recorded in {topic}?” | Topic-based sponsor research | Companies + public counts |
| ~~**R-ACTIVE**~~ | ~~“Which sponsors are most active in the catalog?”~~ | **Cancelled (IR3B)** — use `/sponsors` discovery (`sort=count`) | — |
| **R-REGION** | “Which sponsors are recorded in {region}?” | Region-based sponsor research | Companies + public counts |
| **R-REPEAT** | “Which sponsors appear repeatedly in the catalog?” | Repeat-sponsor research | Companies meeting a documented repeat rule |
| **R-ENTITY** | “What do we know about {Company}?” | **Not a new URL** — canonical `/sponsors/{slug}` | Profile (L1) |

### 1.3 Layer map (consistent with IR3)

| Layer | What | Research types |
|-------|------|----------------|
| L0 | Signals on entity pages (last reviewed, factual summaries) | Trust fragments — not standalone research URLs |
| L1 | Sponsor profiles | **R-ENTITY** (canonical product URL) |
| L2 | `/sponsors` discovery | Canonical sponsor browse; sort by count = activity lens (no separate research URL) |
| L3 | `/topics/{slug}` | Today: series/editions; target: feed **R-TOPIC-SPONSORS** + geo/event context |
| L4 | Dedicated `/research/…` routes | R-INDEX, R-METHOD, R-TOPIC-SPONSORS, R-REGION, R-REPEAT — **not R-ACTIVE** (see `ir3-revised-plan.md`) |

### 1.4 Proposed URL patterns (design only — do not ship or sitemap until published)

```text
/research                              → R-INDEX
/research/methodology                  → R-METHOD (optional; may inline on hubs instead)
/research/sponsors/repeat              → R-REPEAT
/research/sponsors/topics/{topicSlug}  → R-TOPIC-SPONSORS (or `/topics/{slug}` section — prefer latter)
/research/sponsors/regions/{regionSlug}→ R-REGION

**Removed:** `/research/sponsors/most-active` (IR3B cancelled — duplicate of `/sponsors` discovery).
```

**Canonical rules**

- `/research/sponsors/{companySlug}` → **301 / canonical to** `/sponsors/{companySlug}` (no duplicate entity URLs).
- Filtered discovery URLs (`/sponsors?sort=count`) remain **noindex**; named research pages are the **indexable** expression of the same intent when they meet the public-value gate.
- Until L4 content is published: **zero** `/research` URLs in sitemap (indexability policy unchanged).

### 1.5 Shared page anatomy

Every L4 research page should share the same factual skeleton:

1. **H1** — research question / lens name (not a marketing slogan)  
2. **Attribution sentence** — “Based on sponsorships recorded on EventPixels as of {generation or last-built date}.”  
3. **Methodology blurb** — one short paragraph linking to R-METHOD (how counts are defined)  
4. **Public-safe leaderboard or list** — company name → profile link → public aggregates only  
5. **Omission rules** — skip empty regions/topics; `noindex` if below minimum roster size  
6. **Login note** — full sponsorship history remains on profiles for signed-in users; research pages never substitute for gated lists  
7. **Related research links** — sibling lenses (§7)

### 1.6 Public-value gate for research URLs

A research page may be **index + sitemap** only if all hold:

| Requirement | Rule |
|-------------|------|
| Published | Explicitly marked published / not draft |
| Minimum roster | At least **N** non-restricted companies with `sponsored_edition_count ≥ 1` (recommend N = 5 for v1; tune later) |
| Real lens | Topic/region/repeat definition resolves to real catalog data — not a placeholder slug |
| No gated leakage | SSR HTML contains no per-company event or series name lists |
| Factual copy only | Titles/descriptions/body use catalog attribution; no invented insights |

Below gate → page may 404, or exist as `noindex` excluded from sitemap (product choice; prefer not creating thin URLs).

---

## 2. Topic-based sponsor pages (R-TOPIC-SPONSORS)

### 2.1 Intent

Sales researchers ask: *“Who sponsors events in {topic} according to EventPixels?”*  
Examples: Bitcoin, AI, banking — aligned with existing public topic hubs (~16 topics today).

### 2.2 Data derivation (facts only)

**Proposed join (conceptual):**

```text
keyword (topic)
  → event_series_keyword → event_series
  → event_editions
  → event_sponsors → companies
```

**Public output per company (anonymous):**

| Field | Allowed |
|-------|---------|
| Company name, slug, logo | Yes |
| Profile href `/sponsors/{slug}` | Yes if non-restricted and (typically) count ≥ 1 |
| `sponsored_edition_count` (global catalog count) | Yes — already public |
| **Optional lens metric:** count of recorded sponsorship links (or distinct editions) **within this topic** | Yes as a **number** — do not list the editions |
| Event names / series names for that company | **No** |

**Restricted companies:** excluded from lists and counts that would surface them as research destinations; they may still inflate **event-side** sponsor counts elsewhere per confirmed product rules, but they must not appear as clickable research rows.

### 2.3 Relationship to `/topics/{slug}`

| Surface | Role |
|---------|------|
| `/topics/{slug}` | Brand/edition hub for the topic (exists today) |
| `/research/sponsors/topics/{slug}` | Sponsor-intelligence lens for the same topic |

**Link both ways.** Do not replace topic hubs; research pages **add** the sponsor-first view that topic hubs currently lack.

Optional later: embed a “Sponsors recorded in this topic” module **on** the topic hub that deep-links to the research page — still counts-only for anon.

### 2.4 Copy pattern (illustrative)

> Sponsors recorded in {Topic} on EventPixels.  
> {N} companies have at least one recorded sponsorship on editions tagged with this topic.  
> Counts reflect EventPixels research, not a complete market census.  
> Open a company profile for identity and total recorded sponsorships; sign in on the profile to view full sponsorship history.

### 2.5 Sort / display

Default sort: **topic-lens sponsorship count** desc, tie-break **global `sponsored_edition_count`** desc, then name.  
Cap initial render (e.g. top 50) with factual “Showing top {K} of {N}” — not “best sponsors.”

---

## 3. ~~Most-active sponsor pages (R-ACTIVE)~~ — CANCELLED

**Status:** Removed from roadmap (2026-07-17). IR3B was not approved and duplicates Sponsor Discovery.

Use `/sponsors` with default `sort=count` as the canonical browse surface. See `docs/plans/ir3-revised-plan.md`.

---

## 4. Region-based sponsor pages (R-REGION)

### 4.1 Intent

*“Which sponsors are recorded on events in {region}?”*  
Sales researchers plan regional coverage (e.g. United States, Singapore, Europe — exact region grain TBD).

### 4.2 Region grain (open product choice)

| Grain | Pros | Cons |
|-------|------|------|
| **Country** | Matches city→country embeds already used in location labels | Many thin countries |
| **City** | High specificity | Extreme sparsity; legacy city browse already deprioritized |
| **Macro-region** (editorial: DACH, APAC, …) | Strong SEO heads | Requires curated mapping — must be documented, not invented ad hoc |

**Recommendation for v1:** **country**-level research pages for countries that pass the minimum-roster gate; defer city and macro-region until data density justifies them. Do not revive legacy city browse URLs as research destinations.

### 4.3 Data derivation

```text
companies ← event_sponsors ← event_editions → cities → country
```

**Lens metric:** distinct sponsored editions (or sponsorship links) whose edition location falls in the region — exposed as a **count only**.

**Do not** list those editions on the research page for anon users.

Company global `sponsored_edition_count` may appear as secondary context (“{N} editions recorded overall”) — still no event names.

### 4.4 Indexability

Only publish countries (or regions) with ≥ N qualifying sponsors. Empty or tiny regions: no URL, or `noindex` — prefer **no URL**.

### 4.5 Copy pattern

> Sponsors recorded on EventPixels for events located in {Country}.  
> {N} companies have at least one recorded sponsorship on editions in this country.  
> Location uses EventPixels edition location data. Counts are catalog facts, not a claim of all sponsorships in the market.

---

## 5. Repeat-sponsor pages (R-REPEAT)

### 5.1 Intent

*“Which companies sponsor repeatedly (per EventPixels records)?”*  
Useful for sales teams prioritizing accounts that show **sustained** event presence — without exposing which events.

### 5.2 Documented definitions (choose one for v1; do not blur)

| ID | Rule | Public fields shown |
|----|------|---------------------|
| **REP-A (recommended v1)** | `sponsored_edition_count ≥ K` (e.g. K = 3 or 5) | Company + global count |
| **REP-B** | Sponsored **2+ editions within the same series** at least once | Company + **count of series where repeat occurred** (number only) — **never** series names on anon page |
| **REP-C** | Sponsored in **2+ distinct calendar years** | Company + year span / year count |

**Recommendation:** Ship **REP-A** first (identical source of truth as IR1/discovery). Add REP-B/C only after Protection confirms that series-repeat or multi-year aggregates cannot be abused to reconstruct gated history in combination with other public pages.

### 5.3 Naming

Prefer factual titles:

- `Repeat sponsors recorded on EventPixels`  
- Subhead: `Companies with {K}+ sponsored event editions recorded`

Avoid “loyal sponsors,” “always-on partners,” or CRM-style scoring labels.

### 5.4 Relationship to sponsor discovery

`/sponsors` discovery (sort by count) is the canonical global activity browse.  
R-REPEAT = membership set under a **threshold rule** (may be sorted by count, but the page’s meaning is the rule, not a global leaderboard).

Both may link to discovery; they must not duplicate identical H1/intent without a distinct definition.

---

## 6. SEO and GEO value

### 6.1 Classic SEO value

| Value | How research pages help |
|-------|-------------------------|
| **Intent coverage** | Capture mid-tail queries entity pages miss (“sponsors in bitcoin events”, “crypto events singapore”) |
| **Indexable hubs** | Clean canonical URLs for topic/geo lenses — not noindex filter URLs |
| **Internal PageRank** | Concentrate links onto high-value `/sponsors/{slug}` profiles |
| **Snippet uniqueness** | Each lens has distinct factual framing + roster context |
| **Sitemap quality** | Only published, gate-passing research URLs — aligned with IR1 |

Metadata templates (illustrative):

| Type | Title pattern | Description pattern |
|------|---------------|---------------------|
| R-TOPIC | {Topic} sponsors recorded on EventPixels | Companies with sponsorships recorded on {Topic}-tagged editions. Facts from EventPixels research. |
| R-REGION | Sponsors recorded in {Country} on EventPixels | Companies with sponsorships recorded on editions located in {Country}. |
| R-REPEAT | Repeat sponsors recorded on EventPixels | Companies with {K}+ sponsored event editions recorded on EventPixels. |
| Geo+topic events | {Topic} events in {Country} — EventPixels | Editions recorded for {Topic} in {Country}. Catalog facts only. |

### 6.2 GEO / AI-answer value

Research pages should be **citeable units**:

1. **One clear metric definition** near the top (sort key or membership rule).  
2. **Atomic rows** — `{Company}: {N} sponsored event editions recorded`.  
3. **Catalog attribution** on every page — reduces model hallucination of market completeness.  
4. **Explicit non-claims** — not a ranking of quality; not a full market list; history details require login on profiles.  
5. **Stable URLs** — answer engines can cite `/topics/{slug}` or geo+topic hubs rather than ephemeral `?sort=` / `?region=` links.

**GEO anti-patterns:** prose that invents “dominance,” unlabeled ranks, mixing gated facts into public HTML, or thin pages that only restate the H1.

### 6.3 What research pages must never do for SEO/GEO

- Publish anon-visible sponsored **event lists** to “richen” content  
- Invent industry/region claims not in the join path  
- Create thousands of city micro-pages below the roster gate  
- Duplicate every discovery filter as an indexable URL  

---

## 7. Internal linking strategy

### 7.1 Principle

Research pages are **lenses**; sponsor profiles are **sinks**. Events and topics are **feeders**.

```text
R-INDEX
   ├─ R-METHOD (optional / inline)
   ├─ R-REPEAT ──────────────┐
   ├─ R-TOPIC-SPONSORS ──────┼──→ /sponsors/{slug}  (PRIMARY)
   └─ R-REGION ──────────────┘
          ▲
          │
   /topics/{slug}   /sponsors   /events/{edition}   /events/series/{slug}
```

### 7.2 Link matrix

| From | To | Anchor / module |
|------|----|-----------------|
| R-INDEX | All published research types | Factual index list |
| R-REPEAT / R-TOPIC / R-REGION | Sponsor profiles | Company name |
| R-TOPIC-SPONSORS | Matching `/topics/{slug}` | “Topic hub: {Topic}” |
| `/topics/{slug}` | R-TOPIC-SPONSORS | “Sponsors recorded in this topic” |
| `/sponsors` | Topic/region research hubs | “Sponsors in {topic}” / regional lenses — not a global leaderboard link |
| Sponsor profile | Relevant topic/region research | Optional “Related research” — only when membership is public-safe |
| Event edition (sponsors tab) | Sponsor profiles | Existing |
| R-METHOD | All research types | Footer / methodology link on every research page |
| Home / nav | `/sponsors` + R-INDEX (when live) | Sponsor-intelligence priority |

### 7.3 Rules

1. Every research list row links to a real, non-restricted profile when possible.  
2. Do not link restricted companies.  
3. Do not build anon “related events for this sponsor” blocks on research pages.  
4. Cross-links between lenses are encouraged (topic ↔ region only when both pages exist and share companies — still without explaining *which* events overlap).  
5. Anchor text = company name or factual lens name; no superlatives.

---

## 8. Prioritization

### 8.1 Build order (recommended)

| Priority | Deliverable | Rationale |
|----------|-------------|-----------|
| **P0** | Keep strengthening L1 profiles + L2 discovery (IR3) | Primary sales-research destinations already exist |
| **P0** | Lock taxonomy + public-value gate + Protection review for lens metrics | Prevents bad URLs and gated leakage |
| **P1** | **R-TOPIC-SPONSORS** / topic hub sponsor module | Topic-driven sponsor demand; extends ~16 topics |
| **P1** | **Geo + topic event hubs** | “crypto events singapore”, “bitcoin events asia” — see `ir3-revised-plan.md` |
| **P2** | **R-REGION** (country, gate-passing only) | Regional sponsor lens |
| **P2** | **R-REPEAT** with REP-A threshold | Defer until demand validated |
| **P3** | R-METHOD, R-INDEX | Optional; methodology may inline on hubs |
| **Cancelled** | **R-ACTIVE** / IR3B most-active page | Duplicate of discovery; not approved |
| **Defer** | City-level region pages, macro-regions, REP-B/C, `/research/sponsors/{slug}` duplicates | Thin, risky, or redundant |

### 8.2 Parallelism with roadmap phases

| Phase | Research-strategy work |
|-------|------------------------|
| **IR3** | Philosophy, gates, profile/discovery polish; do not invent sitemap research URLs |
| **IR4** | Topic hub sponsor modules + geo/topic event hubs + region sponsor lens (not R-ACTIVE) |
| **IR5** | Optional `ItemList`/`Organization` JSON-LD **only** for visible research list facts |
| **IR6** | Health: empty research shells, gate failures, leakage tests |
| **IR7** | Optional curated explainers — never auto-publish invented insights |

### 8.3 QA priority when research ships

1. Anon HTML on research pages contains **no** per-company event/series names  
2. Restricted companies absent from lists  
3. Counts match `company_sponsor_stats` / documented lens query  
4. Below-gate topics/regions not in sitemap  
5. Every list row profile link resolves and is indexable when count ≥ 1  
6. Copy uses catalog attribution; banned marketing/ranking language tests green  

### 8.4 Non-goals

- Replacing sponsor profiles with research URLs  
- Publishing gated history to win SEO  
- Autogenerating thousands of low-density geo pages  
- AI-written “market outlook” research without human accept (IR7+)  
- Treating event-name keywords as the primary research-page strategy  

---

## 9. Open decisions

| Decision | Options | Recommendation |
|----------|---------|----------------|
| Minimum roster size N | 3 / 5 / 10 | **5** for v1 |
| Repeat rule | REP-A / B / C | **REP-A** with K = 3 or 5 |
| Region grain | Country / city / macro | **Country** only in v1 |
| Topic lens metric | Links vs distinct editions in topic | Distinct **editions** in topic |
| Topic hub embedding | Link-only vs inline top sponsors module | Inline sponsor module preferred |
| Research index | Ship with first page vs after 2+ | After **topic + geo hub** pair ships |

---

## 10. Acceptance criteria (design → build handoff)

- [ ] Taxonomy types R-* agreed  
- [ ] URL patterns and canonical-to-profile rule agreed  
- [ ] Public-value gate (N, no gated leakage, attribution) agreed  
- [ ] R-TOPIC / R-REGION / R-REPEAT / geo+topic event hub definitions written as implementable queries  
- [ ] Internal link matrix accepted  
- [ ] Prioritization P0–P3 accepted  
- [ ] Protection sign-off on any lens metric beyond global `sponsored_edition_count`  

---

## Change log

| Date | Note |
|------|------|
| 2026-07-17 | Initial research page strategy: taxonomy, topic/active/region/repeat lenses, SEO/GEO, linking, prioritization |
| 2026-07-17 | R-ACTIVE / IR3B cancelled; priorities aligned to `ir3-revised-plan.md` |
