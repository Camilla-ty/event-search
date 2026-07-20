# IR3 Revised Plan — Sponsor Intelligence SEO

**Status:** Planning only — no implementation  
**Date:** 2026-07-17  
**Supersedes:** IR3B (Most Active Sponsors research page) — **cancelled, not approved**

**Authority**

| Doc | Role |
|-----|------|
| `docs/plans/seo-implementation-roadmap.md` | Delivery phases IR0–IR7 |
| `docs/plans/sponsor-intelligence-seo.md` | IR3 design baseline (profile + discovery focus) |
| `docs/plans/research-page-strategy.md` | Research taxonomy (R-ACTIVE removed) |
| `docs/plans/indexability-policy.md` | Indexability + sitemap rules |

---

## 1. Decision: cancel IR3B

### What IR3B was

Uncommitted work that would have shipped:

- `/research/sponsors/most-active` — fixed top-50 list ordered by `sponsored_edition_count`
- `/research/methodology` — static methodology page
- Sitemap entries, internal links from `/sponsors`, tests

### Why it is cancelled

| Issue | Detail |
|-------|--------|
| **Low unique value** | The same data and sort order already exist on `/sponsors` (default `sort=count`). Discovery already answers “who has the most recorded sponsorships?” |
| **Not an approved destination** | Product did not approve a standalone “Most Active Sponsors” research URL as a user-facing page |
| **Wrong SEO bet** | Head-term “most active sponsors” competes with a generic leaderboard, not with the geo/topic intents that match sales research |
| **Duplicates L2** | `research-page-strategy.md` already noted L2 discovery has partial R-ACTIVE behavior; L4 added chrome without a new lens |

### What to do with uncommitted code

- **Do not commit** IR3B.
- Discard or leave unstaged until a future explicit decision.
- Remove `/research/sponsors/most-active` from any planning prioritization.

### What remains valid from IR3 work already shipped

- **IR3A** (committed): sponsor metadata preference order — domain → count → generic; no `industry` / description columns.
- **IR1 / IR2** (committed): indexability, factual summaries, public sponsor counts.

---

## 2. Actual goals (re-stated)

These are the intents IR3 and IR4 should optimize for — not generic catalog leaderboards.

| Goal | Example query | Job-to-be-done |
|------|---------------|----------------|
| **Geo + topic events** | “crypto events in singapore” | Find **events** in a place + theme for planning and prospecting |
| **Regional + thematic events** | “bitcoin events in asia” | Find **events** across a region + theme (broader than one country) |
| **Sponsor intelligence** | “who sponsors bitcoin conferences” / “does {Company} sponsor crypto events” | Research **companies** and sponsorship activity for sales outreach |
| **Topic-driven demand** | “web3 sponsors”, “payments event sponsors” | Enter through a **theme** and reach events + sponsors |

**Implication:** SEO investment should strengthen **topic hubs**, **event discovery lenses**, and **sponsor profiles/discovery** — not a duplicate global sponsor ranking page.

---

## 3. Re-evaluated IR3 scope

IR3 remains **sponsor intelligence as the primary SEO focus**, but its deliverables are **profiles + discovery polish**, not new `/research/*` routes.

### IR3 — in scope (continue)

| Item | Status | Notes |
|------|--------|-------|
| Sponsor metadata (domain → count → generic) | **Done (IR3A)** | Committed |
| Public sponsor count on profiles | Done (IR1/IR2) | Keep as primary fact |
| Factual company summary | Done (IR2) | Keep |
| `/sponsors` discovery as primary sponsor browse | Exists | Default sort by count is sufficient |
| Event roster → sponsor profile links | Exists | QA / linking audit |
| Protection boundary (no gated history on anon) | Policy | Non-negotiable |

### IR3 — out of scope (explicit)

| Item | Reason |
|------|--------|
| `/research/sponsors/most-active` (IR3B) | Cancelled — duplicates discovery |
| Global sponsor leaderboard URLs | Same |
| Dedicated `/research/methodology` as SEO destination | Optional trust copy can live on `/sponsors` or `/about` later; not a priority |
| JSON-LD, AI bios | IR5 / IR7 |

### IR3 — deferred to IR4 (topic/geo research)

Topic- and region-shaped **indexable destinations** that add value beyond filter URLs.

---

## 4. Proposed page types (aligned to goals)

Each type below must pass the public-value gate, use catalog-attributed copy, and respect Protection (anon: counts and identities; not per-company event lists).

### Type A — Topic event hub (existing, strengthen)

**URL:** `/topics/{slug}` (e.g. `/topics/bitcoin`, `/topics/crypto`)

**Answers:** “What events are recorded for {topic} on EventPixels?”

**Today:** Series + editions lists; no sponsor lens; weak metadata.

**Target enhancements (IR4)**

- Factual summary paragraph (topic name, edition count, year span, geography breadth if computable)
- Metadata: `{Topic} events — brands and editions recorded on EventPixels`
- **Sponsors in this topic** module: count of distinct sponsoring companies + link to Type B (below); list only if product approves count-only teaser
- Internal links from matching event editions/series

**Supports goals:** topic-driven search, bitcoin/crypto thematic entry

---

### Type B — Topic sponsor lens (new, high priority)

**URL:** `/topics/{slug}/sponsors` or embed as primary section on `/topics/{slug}` (product choice: **prefer single URL** with two sections to avoid thin duplicates)

**Answers:** “Which companies sponsor {topic} events recorded on EventPixels?”

**Public fields per row:** company name, logo, domain, **topic-lens sponsorship count** (distinct editions in topic), link to `/sponsors/{slug}`

**Sort:** topic-lens count desc → global `sponsored_edition_count` desc → name

**Metadata example:** `Sponsors recorded on {Topic} events — EventPixels`

**Gate:** ≥ 5 non-restricted companies with topic-lens count ≥ 1

**Supports goals:** sponsor intelligence for sales teams, topic-driven demand (“web3 sponsors”, “bitcoin sponsors”)

**Not:** global activity rank; not “top” or “leading” language

---

### Type C — Geo + topic event discovery (new, high priority)

**URL pattern (design):** `/events` with stable indexable paths, **or** dedicated hubs:

- `/events/regions/{countrySlug}` — e.g. `singapore`
- `/events/topics/{topicSlug}/regions/{countrySlug}` — e.g. `crypto` + `singapore`
- `/events/topics/{topicSlug}/regions/asia` — macro-region only when backed by a **documented country set** (not invented)

**Answers:** “crypto events in singapore”, “bitcoin events in asia”

**Today:** `/events?topic=…&region=…` exists but is **noindex** (filter URL). Strategic value requires **clean canonical hub URLs** for high-intent combinations that pass a content gate.

**Public fields:** edition name, dates, location, public sponsor count, link to edition + series; factual summary per edition where indexable

**Gate:** minimum edition count per hub (recommend ≥ 3 indexable editions)

**Supports goals:** crypto events in singapore, bitcoin events in asia

**Implementation note:** Reuse event explorer data + indexability rules; do not expose new gated fields.

---

### Type D — Region sponsor lens (medium priority)

**URL:** `/sponsors/regions/{countrySlug}` or query-free hub equivalent

**Answers:** “Which sponsors are recorded on events in {country}?”

**Public fields:** same as discovery table — company, website, **region-lens count** (distinct editions in country)

**Gate:** ≥ 5 qualifying companies

**Supports goals:** sales teams planning regional coverage (e.g. Singapore sponsors)

**Defer:** city-level, macro-region (APAC) until mapping table + density exist

---

### Type E — Sponsor profile (existing, primary sink)

**URL:** `/sponsors/{slug}`

**Answers:** “Does {Company} sponsor events?” / company-specific research

**Already the canonical sponsor intelligence unit.** IR3A improved metadata; IR2 added factual summary.

**Optional later (Protection review):** year-only “last recorded activity” — not event names on anon.

**Supports goals:** sponsor intelligence for sales teams (direct company lookup)

---

### Type F — Sponsor discovery (existing, primary browse)

**URL:** `/sponsors` (clean URL indexable); `?sort=count` etc. remain noindex

**Answers:** browse/search sponsors; sort by count = de facto “most recorded” without a separate research URL

**Enhancement (IR3):** optional one-line methodology attribution in footer (“Counts reflect EventPixels-recorded editions”) — not a separate page required

**Supports goals:** sponsor intelligence without duplicating Type cancelled (IR3B)

---

### Type G — Event editiondividual (existing feeder)

**URL:** `/events/{id}`

**Answers:** “Who sponsors {Event}?” — roster links to profiles (signed-in detail per Protection)

**Supports goals:** ties sponsors to events for sales context

---

### Deprioritized / removed types

| Type | Verdict |
|------|---------|
| **R-ACTIVE / Most Active Sponsors** | **Removed** — use Type F |
| **R-REPEAT** | Defer — niche; verify search demand before build |
| **R-METHOD standalone** | Defer — short attribution can inline on hubs |
| **R-INDEX** `/research` | Defer until ≥ 2 real hub types ship |
| **Duplicate `/research/sponsors/{slug}`** | Never — canonical stays `/sponsors/{slug}` |

---

## 5. Priority order (revised)

| Priority | Page type | Example URLs / intents |
|----------|-----------|-------------------------|
| **P0** | E — Sponsor profiles | `/sponsors/{slug}` (IR3A done) |
| **P0** | F — Sponsor discovery | `/sponsors` |
| **P1** | A — Topic event hubs | `/topics/bitcoin`, `/topics/crypto` |
| **P1** | B — Topic sponsor lens | “bitcoin sponsors”, “crypto sponsors” |
| **P1** | C — Geo + topic event hubs | “crypto events singapore”, “bitcoin events asia” |
| **P2** | D — Region sponsor lens | “sponsors in singapore” |
| **P3** | G — Event editions | feeder links (maintain) |
| **—** | IR3B / R-ACTIVE | **Cancelled** |

---

## 6. IR3 vs IR4 split (revised)

| Phase | Owns |
|-------|------|
| **IR3** (complete + maintain) | Sponsor profile metadata (done), discovery as primary browse, linking QA, Protection compliance, optional inline methodology copy on `/sponsors` |
| **IR4** | Topic hub enrichment (A), topic sponsor lens (B), geo+topic event hubs (C), region sponsor lens (D); metadata + sitemap for **new** indexable hubs only |

---

## 7. SEO / GEO principles (unchanged)

- Facts only; catalog attribution (“recorded on EventPixels”)
- No gated event names on anonymous company lists
- Filter URLs (`?topic=`, `?region=`, `?sort=`) stay **noindex**; hubs get **clean canonicals**
- Topic + geo pages are citeable because they combine **lens + roster** discovery cannot express as one stable URL

---

## 8. Open product decisions (before IR4 build)

| Decision | Options | Recommendation |
|----------|---------|----------------|
| Topic sponsors: separate URL vs section on `/topics/{slug}` | `/topics/{slug}/sponsors` vs one page | **One page, two sections** unless SEO testing favors split |
| Geo+topic URL shape | `/events/...` nested vs flat slugs | Nested under `/events/` for consistency with explorer |
| Asia macro-region | Curated country list vs no macro page | **Curated list** in DB/config; no free-text “asia” without definition |
| Minimum roster gates | 3 / 5 / 10 | **5** sponsors, **3** editions for event hubs (tune with data) |
| Methodology | Standalone page vs inline | **Inline** on sponsor/topic hubs; no IR3B page |

---

## 9. Acceptance criteria (revised IR3)

- [x] Sponsor metadata uses real public fields only (IR3A)
- [x] IR3B not shipped; not in roadmap
- [ ] `/sponsors` remains the canonical browse for sponsor activity (no duplicate research URL)
- [ ] Planning docs updated: R-ACTIVE removed; IR4 scoped to topic/geo hubs
- [ ] Next build candidate documented: **Type B or C** based on product pick

---

## Change log

| Date | Note |
|------|------|
| 2026-07-17 | IR3B cancelled; IR3 re-scoped to profiles + discovery; IR4 proposal aligned to geo/topic/sponsor sales intents |
