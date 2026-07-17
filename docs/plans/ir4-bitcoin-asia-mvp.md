# IR4 MVP — Keyword + Region Hub: Bitcoin × Asia

**Status:** Design only — no implementation  
**Date:** 2026-07-17  
**Phase:** IR4 first ship candidate (`docs/plans/seo-implementation-roadmap.md`)  
**Pattern name:** **KeywordRegionHub** (reusable for FinTech × Asia, AI × Asia, etc.)

**Authority**

| Doc | Role |
|-----|------|
| `docs/plans/ir3-revised-plan.md` | Type C geo+keyword event hub; Type B sponsor lens embed |
| `docs/plans/research-page-strategy.md` | Protection, sponsor-list rules, linking |
| `docs/plans/factual-summary-engine.md` | Factual-only copy; omission over placeholder |
| `docs/plans/indexability-policy.md` | Hub vs edition vs sponsor gates |
| IR4 catalog audit (2026-07-17) | Density proof for Bitcoin + Asia |

---

## 1. Why this hub first

| Signal | Bitcoin × Asia |
|--------|----------------|
| Search intent | “bitcoin events in asia” — product-confirmed IR4 priority |
| Editions in lens | **7** |
| Indexable editions (≥1 sponsor) | **3** (meets ≥3 gate) |
| Distinct sponsors in lens | **769** (meets ≥5 gate) |
| Series in lens | **4** |
| Countries with editions | **3** (China, Singapore, South Korea) |
| Year span | **2025–2026** |

This combination is the **smallest macro-region hub that passes both event and sponsor gates** while exercising multi-country macro-region logic (not a single-country shortcut).

**Not in scope for MVP:** Singapore-only or Crypto-only hubs (thin or duplicate TOKEN2049 canonical risk — see §12).

---

## 2. Page purpose

**One indexable URL** that answers:

1. **Event discovery:** “What Bitcoin-tagged events are recorded in Asia on EventPixels?”
2. **Sponsor intelligence (lens):** “Which companies sponsor Bitcoin events in Asia?” — without exposing per-company event history to anonymous users.

The page is a **stable canonical** replacing the noindex filter URL  
`/events?topic=bitcoin&region=China&region=Singapore&region=South+Korea` (and similar multi-param variants).

It must become the **template** for `{keywordSlug} × {regionSlug}` hubs.

---

## 3. URL

### Canonical

```text
/events/topics/bitcoin/regions/asia
```

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Namespace | Under `/events/` | Consistent with IR3 Type C; signals event-first intent |
| Keyword segment (URL path still `topics/`) | `topics/{keywordSlug}` | Path frozen for now; value mirrors keyword slug (`bitcoin`) |
| Region segment | `regions/{regionSlug}` | Uses `regions.slug` from DB (`asia`), not display name |
| Trailing slash | No | Match existing marketing routes |
| Query params on canonical | None | `?page=` / filters stay off the indexable URL for MVP |

### Non-canonical equivalents (must remain `noindex`)

| URL | Treatment |
|-----|-----------|
| `/events?topic=bitcoin&region=…` | `noindex`; `rel=canonical` → hub when hub exists |
| `/topics/bitcoin` | Separate purpose (global Keyword page); not a duplicate canonical |
| Future `/sponsors/regions/asia` | Complementary sponsor-only lens; cross-link, do not canonical-merge |

### Sitemap

Include `/events/topics/bitcoin/regions/asia` when:

- Hub indexability gate passes (§8), and
- Page is published (not a stub).

---

## 4. Metadata

### Title

```text
Bitcoin Events in Asia | EventPixels
```

**Template (reusable):** `{KeywordName} Events in {RegionName} | EventPixels`

- Keyword name from `keyword.name` (`Bitcoin`)
- Region name from `regions.name` (`Asia`)
- No year in title (year span belongs in body/summary)

### Meta description

```text
EventPixels records 7 Bitcoin events in Asia (2025–2026) across China, Singapore, and South Korea, with 769 companies recorded as sponsors of those events.
```

**Template rules:**

- Lead with catalog attribution (“EventPixels records…”)
- Include: event count, year span, countries **that have events in the lens** (not every country in macro-region)
- Include: distinct sponsor count in the Keyword + Region hub (aggregate only)
- Max ~155 characters; trim clauses in fixed priority order (drop sponsor clause last)
- No superlatives (“leading”, “top”, “best”)

### H1

```text
Bitcoin Events in Asia
```

**Template:** `{KeywordName} Events in {RegionName}`

- Match user query shape; do not append “| EventPixels” in H1
- Optional eyebrow above H1 for this MVP: `BITCOIN · ASIA` (instance labels, not a generic “Keyword · Region” product label)

### Robots

`index, follow` when hub gate passes (§8).

---

## 5. Factual summary (hub-level)

New summary type: **`buildKeywordRegionHubSummary`** (design; extends IR2 factual-summary principles).

Rendered as a visible paragraph directly under the H1 block — not used as the meta description.

### Positioning requirement (product-confirmed 2026-07-17)

EventPixels is a **sponsor intelligence platform**, not only an event directory. The summary must communicate that this page is **both**:

- an **event lens** (editions, brands, countries, year span), and
- a **sponsor intelligence lens** (769 recorded sponsoring companies).

Rules:

1. **First sentence is sponsor-first.** The distinct sponsor count leads the paragraph — it is the differentiator and the sentence most likely to be snippeted or cited verbatim.
2. **Event context follows immediately** in the second sentence. The page must not read as a sponsor directory only; the H1 promises events and the summary must deliver both frames within two sentences.
3. The sponsor count must never be reduced, hidden, or demoted below event facts.

### Input facts (all from DB, computed once per request)

| Fact | Bitcoin × Asia value | Source |
|------|----------------------|--------|
| `keywordName` | Bitcoin | `keyword.name` |
| `regionName` | Asia | `regions.name` |
| `editionCount` | 7 | Distinct `event_editions.id` in lens |
| `indexableEditionCount` | 3 | Editions with ≥1 `event_sponsors` row |
| `seriesCount` | 4 | Distinct `event_series.id` in lens |
| `yearMin`, `yearMax` | 2025, 2026 | From editions in lens |
| `countryNames` | China, Singapore, South Korea | Distinct countries with ≥1 edition in lens (sorted) |
| `distinctSponsorCount` | 769 | Distinct non-restricted `companies` linked via lens editions |

### Sentence assembly (four sentences only)

The summary is **concise** — no macro-region disclosure, no extra geography explanation. The second sentence names the countries; that defines geographic scope.

1. **Sponsor count:** “{distinctSponsorCount} sponsoring companies are recorded on {keywordName} events in {regionName} on EventPixels.” (omit only if `distinctSponsorCount` is 0 — hub fails gate and does not ship)
2. **Event scope:** “They appear across {editionCount} {keywordName} events ({yearMin}–{yearMax}) spanning {seriesCount} event brands in {countryNames joined}.” (drop the brands clause if `seriesCount ≤ 1`)
3. **Public roster availability:** “{indexableEditionCount} editions have public sponsor rosters.”
4. **Catalog attribution:** “Counts reflect EventPixels-recorded sponsorship data.”

Sentences 1 and 2 assert dual identity: sponsor intelligence, then event intelligence (including countries). Do not add a fifth sentence explaining macro-regions or catalog coverage gaps.

### Example output (Bitcoin × Asia)

> **769 sponsoring companies are recorded on Bitcoin events in Asia on EventPixels.** They appear across 7 Bitcoin events (2025–2026) spanning 4 event brands in China, Singapore, and South Korea. 3 events have public sponsor rosters. Counts reflect EventPixels-recorded sponsorship data.

### Rejected alternatives (copy review 2026-07-17)

| Version | Shape | Why not chosen |
|---------|-------|----------------|
| Event-first split (“EventPixels records 7 editions… Behind those events: 769 companies…”) | Event sentence leads | Sponsor count lands second — truncated snippets may cut the differentiator |
| Intelligence framing (“This lens combines event and sponsor intelligence…”) | Category statement leads | “Lens” is product-internal vocabulary; single dense sentence |
| Macro-region disclosure (“Asia includes 7 countries in EventPixels…”) | Extra geography sentence | Redundant — countries already named in sentence 2; reads like internal DB copy |

### Prohibited

- Marketing tone, attendance claims, rankings
- Per-company or per-sponsor event names (Protection)
- “Official” or “complete list of all Bitcoin events in Asia”

---

## 6. Last reviewed logic

### Hub-level `lastReviewedAt`

```text
hubLastReviewedAt = MAX(event_editions.last_reviewed_at)
  over all editions in the keyword×region lens
```

| Bitcoin × Asia | Value |
|----------------|-------|
| `hubLastReviewedAt` | **2026-07-08** (from Korea Blockchain Week 2025) |

### Display

- Show trust line when non-null: **“Last reviewed {formatted date}”** (edition-level field, aggregated for hub)
- Placement: header meta row beside or below factual summary
- **Not** an indexability requirement (`indexability-policy.md`)

### Per-edition last reviewed

- Edition cards show their own `last_reviewed_at` when set (IR2 pattern)
- Hub aggregate does not replace edition-level signals

### Recompute

- On every SSR render (no cache of hub last-reviewed separate from edition query)
- When any edition in lens is reviewed, hub date advances automatically

---

## 7. Event selection rules

### Lens definition (inclusion)

An edition is **in lens** iff **all** hold:

1. Its series has `keyword.slug = {keywordSlug}` via `event_series_keyword`
2. Its `city → country → region.slug = {regionSlug}`

For **macro-region** `asia`, `regionSlug` resolves through `countries.region_id → regions.slug` (not free-text).

**Macro-region country set (lens SQL only):** China, India, Japan, Singapore, South Korea, Taiwan, Thailand (`regions.slug = asia`). New countries added to the region in DB are included automatically. **Public summary copy** names only countries with editions in the lens (sentence 2) — no separate macro-region explanation on the page.

### Exclusion

- Do **not** exclude zero-sponsor or future editions from the **events list** (product value: planning calendar)
- Do **not** include editions whose series lacks this keyword (even if thematically related)
- Restricted companies do not affect edition inclusion

### Sort order

1. `start_date` DESC NULLS LAST (upcoming/future first when dated)
2. `year` DESC (fallback when dates null)
3. `name` ASC (stable tie-break)

### Bitcoin × Asia roster (reference)

| Edition | Country | Year | Sponsors | Indexable |
|---------|---------|------|----------|-----------|
| Consensus Hong Kong 2026 | China | 2026 | 123 | Yes |
| Digital Asset Summit Asia 2026 | Singapore | 2026 | 0 | No |
| Korea Blockchain Week 2026 | South Korea | 2026 | 0 | No |
| TOKEN2049 Singapore 2026 | Singapore | 2026 | 0 | No |
| Consensus Hong Kong 2025 | China | 2025 | 0 | No |
| Korea Blockchain Week (KBW) 2025 | South Korea | 2025 | 217 | Yes |
| TOKEN2049 Singapore 2025 | Singapore | 2025 | 517 | Yes |

### Card fields (public)

| Field | Rule |
|-------|------|
| Edition name | Link to `/events/{editionSlug}` |
| Dates | IR2 tense-aware formatting |
| Location | `formatLocationLabel(city, country)` |
| Sponsor count | Public link count on edition (integer; omit clause if 0 on card subtitle) |
| Series | Link to `/events/series/{seriesSlug}` |
| Indexability badge | Do not show “noindex” to users; 0-sponsor editions still listed |

### Pagination

- **≤ 20 editions:** show all (Bitcoin × Asia = 7 → no pagination)
- **> 20:** page size 20; paginated views use `?page=` → **noindex** child pages with canonical to page 1 (defer until needed)

### Empty state

If lens drops below hub gate (§8): hub returns **404** (preferred) or `noindex` soft page — not an empty indexed shell.

---

## 8. Hub indexability gate

The **hub page** is indexable iff:

| Gate | Threshold | Bitcoin × Asia |
|------|-----------|----------------|
| Indexable editions in lens | ≥ **3** | **3** ✓ |
| Distinct sponsors in lens | ≥ **5** | **769** ✓ |

Both must pass. Sponsor gate prevents thin event-only shells; edition gate prevents sponsor-only shells.

**Child pages** keep existing IR1 rules:

- Edition with 0 sponsors → `noindex` (may still appear on hub list)
- Sponsor profile → indexable per global sponsor count
- Series → indexable per lifecycle rules

---

## 9. Sponsor section rules

Embedded on the **same URL** (one page, two sections — per IR3 preference). Anchor: `#sponsors`.

This is the **Keyword sponsor section** for the Keyword + Region page (not a separate sponsor URL in MVP).

### Section heading (H2)

```text
Sponsors on these Bitcoin events
```

**Template:** `Sponsors on these {KeywordName} events`

### Inclusion

A company appears in the sponsor section iff:

1. `companies.restricted_at IS NULL`
2. ≥1 `event_sponsors` row on an edition **in lens** (§7)

### Public column headers (desktop table)

| COMPANY | WEBSITE | BITCOIN EVENTS IN ASIA | TOTAL RECORDED |

### Public fields per row

| Field | Public label | Source | Notes |
|-------|--------------|--------|-------|
| Company name | Company | `companies.name` | Link to `/sponsors/{slug}` |
| Logo | — | `companies.logo_url` (mapped) | Optional |
| Website / domain | Website | `domain` → `website` | Display only; no UTM |
| Hub event count | **Bitcoin events in Asia** | Distinct events in this keyword×region set | Primary sort key; avoid public “hub” wording |
| Global count | **Total recorded** | `company_sponsor_stats.sponsored_edition_count` | Secondary sort; catalog-wide sponsored events |

Mobile cards use the same public labels: `Bitcoin events in Asia: {n}` and `Total recorded: {n}`.

### Forbidden (Protection)

- Listing **which events** a company sponsored (even on this hub)
- Tier labels per company
- “Top”, “most active”, “leading” language
- Restricted or suppressed companies

### Sort

1. `hubEventCount` DESC
2. `sponsored_edition_count` DESC (global)
3. `name` ASC

### Display limit (MVP)

- Show **top 20** companies
- Above table: “769 companies recorded as sponsors of the Bitcoin events listed above.” (aggregate from query, not `rows.length`)
- Below table: “Browse sponsor profiles for companies recorded on these events.” — no link to noindex filter URL
- Phase 2: in-page pagination or `/events/topics/bitcoin/regions/asia/sponsors` only if SEO testing warrants a split URL

### Section gate

Render sponsor section only when `distinctSponsorCount ≥ 5`. Bitcoin × Asia qualifies.

---

## 10. Internal linking

### Outbound from hub (required)

| Target | Anchor text (example) | Placement |
|--------|----------------------|-----------|
| `/topics/bitcoin` | “View all Bitcoin events →” | End of Events section, after the seven event cards |
| `/events` | “All events” | Breadcrumb root |
| `/events/{editionSlug}` | Edition name | Events list |
| `/events/series/{seriesSlug}` | Series name | Edition card |
| `/sponsors/{companySlug}` | Company name | Sponsor table |
| `/sponsors` | “Sponsor discovery” | Footer of sponsor section (global browse) |

### Outbound (when sibling hubs ship)

| Target | When |
|--------|------|
| `/events/topics/fintech/regions/asia` | FinTech × Asia hub live |
| `/events/topics/ai/regions/asia` | AI × Asia hub live |
| `/events/regions/asia` | Macro-region event hub (no keyword) live |

### Inbound to hub (feeder links)

| Source | Rule | Anchor |
|--------|------|--------|
| `/topics/bitcoin` | Prominent link in Keyword page header or “By region” block | “Bitcoin events in Asia” |
| `/events/{editionSlug}` | When edition ∈ lens | Breadcrumb: `Bitcoin · Asia` or footer link |
| `/events/series/{seriesSlug}` | When ≥1 edition of series ∈ lens | “Bitcoin events in Asia” |
| Edition factual summary | Optional inline link when location ∈ Asia and series has Bitcoin keyword | Keyword+region chip |

### Canonical conflicts

- Do **not** add hub links using `?topic=` / `?region=` params in sitemap or primary nav
- Crypto × Asia / Bitcoin × Singapore hubs share TOKEN2049 editions — use **distinct canonicals**; cross-link as “Related lenses” only when both pass gates; never duplicate full sponsor tables without differentiation

---

## 11. Page structure (wireframe)

```text
[Breadcrumb] Events → Bitcoin → Asia

[Eyebrow] BITCOIN · ASIA
[H1] Bitcoin Events in Asia
[Factual summary paragraph]
[Last reviewed: 8 Jul 2026]

--- Events in this lens (7) ---
[Edition card grid/list — §7]
[View all Bitcoin events →]

--- Sponsors on these Bitcoin events (#sponsors) ---
[H2] Sponsors on these Bitcoin events
[Aggregate count line: 769 companies recorded as sponsors of the Bitcoin events listed above.]
[Sponsor table — top 20 — §9]

[Footer attribution] Counts reflect EventPixels-recorded sponsorship data.
```

---

## 12. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| TOKEN2049 dominates sponsor counts | Factual summary states edition count; sponsor table sorted by lens breadth not single-edition volume |
| Crypto/Bitcoin keyword overlap | Separate hubs only when copy/canonical differ; shared editions OK with distinct keyword labels |
| Upcoming 0-sponsor editions on indexed hub | Allowed in list; they remain `noindex` at edition level |
| Macro-region “Asia” vs 3 countries with data | Geographic scope stated in summary sentence 2 (`China, Singapore, and South Korea`); no macro disclosure copy |
| Filter URL cannibalization | `rel=canonical` from filter to hub for exact keyword+macro-region mapping (implementation detail) |

---

## 13. Reusable KeywordRegionHub pattern

Use this checklist for the next hub (e.g. FinTech × Asia, AI × Asia):

| Field | Template |
|-------|----------|
| **URL** | `/events/topics/{keywordSlug}/regions/{regionSlug}` (path segment `topics/` frozen until URL migration) |
| **Title** | `{KeywordName} Events in {RegionName} \| EventPixels` |
| **H1** | `{KeywordName} Events in {RegionName}` |
| **Eyebrow (MVP style)** | `{KEYWORDNAME} · {REGIONNAME}` instance labels (e.g. `BITCOIN · ASIA`) |
| **Lens SQL** | `keyword.slug = keywordSlug` ∧ `regions.slug = regionSlug` via edition city |
| **Hub index gate** | ≥3 indexable editions ∧ ≥5 lens sponsors |
| **Summary builder** | `buildKeywordRegionHubSummary` — 4 sentences: sponsor count → event scope (incl. countries) → roster availability → attribution |
| **Last reviewed** | `MAX(edition.last_reviewed_at)` in lens |
| **Events block** | All lens editions; sort by date desc |
| **Events CTA** | “View all {KeywordName} events →” after the event list, linking to `/topics/{keywordSlug}` |
| **Sponsors block** | Keyword sponsor section — heading: `Sponsors on these {KeywordName} events`; aggregate copy: `{N} companies recorded as sponsors of the {KeywordName} events listed above.`; top 20; hub event count + profile links; `#sponsors` |
| **404 below gate** | Do not ship indexed URL |

### Next hubs after MVP (by audit density)

1. **FinTech × Asia** — 14 editions, 7 indexable, 292 sponsors  
2. **AI × Asia** — 12 editions, 6 indexable, 832 sponsors  
3. **Asia** (region-only, no keyword) — `/events/regions/asia` — separate pattern, lower priority than keyword×region proof

---

## 14. Acceptance criteria (MVP)

- [ ] `/events/topics/bitcoin/regions/asia` resolves with metadata in §4
- [ ] Hub is `index` + sitemap when gates pass
- [ ] Factual summary matches §5 example facts (numbers may drift with catalog)
- [ ] All 7 lens editions listed; 3 indexable editions have correct sponsor counts
- [ ] `View all Bitcoin events →` appears after the Events section, not in the hero
- [ ] Sponsor section heading is `Sponsors on these Bitcoin events`
- [ ] Sponsor section shows ≤20 rows; aggregate copy reads `769 companies recorded as sponsors of the Bitcoin events listed above.`; no per-company event names
- [ ] Sponsor table headers are `Company` | `Website` | `Bitcoin events in Asia` | `Total recorded` (no public “In hub” / “Total” shorthand)
- [ ] Public eyebrow is `BITCOIN · ASIA` (not `TOPIC · REGION`)
- [ ] `last_reviewed` hub line matches max edition date in lens
- [ ] Inbound link from `/topics/bitcoin`; outbound links on qualifying edition pages
- [ ] `/events?topic=bitcoin&region=…` remains `noindex`
- [ ] Pattern doc section §13 copied for second hub without redesign

---

## Change log

| Date | Note |
|------|------|
| 2026-07-17 | Initial MVP design: Bitcoin × Asia as TopicRegionHub template |
| 2026-07-17 | Summary revised to sponsor-first (Version A): sponsor count leads, event context second; dual event/sponsor-lens positioning made an explicit requirement |
| 2026-07-17 | Macro-region disclosure removed; summary fixed at four sentences (sponsor count, event scope, roster availability, attribution) |
| 2026-07-17 | Wireframe copy refined: hero no longer links to all Bitcoin events; `View all Bitcoin events →` moved after event cards; sponsor section public copy changed to “Sponsors on these Bitcoin events” and “769 companies recorded as sponsors of the Bitcoin events listed above.” |
| 2026-07-17 | Sponsor table headers updated to `Company` \| `Website` \| `Bitcoin events in Asia` \| `Total recorded` (replacing public “In hub” / “Total”); ranking and counts unchanged |
| 2026-07-17 | Terminology: conceptual Topic → Keyword (KeywordRegionHub, Keyword page, Keyword sponsor section, Keyword + Region page); public eyebrow `BITCOIN · ASIA`; URLs unchanged |
