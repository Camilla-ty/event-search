# EventPixels Factual Summary Engine — Design

**Status:** Design only — no implementation
**Date:** 2026-07-17
**Phase:** IR2 (`docs/plans/seo-implementation-roadmap.md`), with forward-compatible coverage of series and company summaries used by IR3
**Authority:**

| Doc | Role |
|-----|------|
| `docs/plans/seo-implementation-roadmap.md` | IR2 scope: visible, factual, DB-derived event summaries + public last reviewed |
| `docs/plans/indexability-policy.md` | What may be indexed; summaries never override the gate |
| `docs/plans/seo-foundation.md` §6 | Structured-field content philosophy |
| `docs/plans/protection-v1.md` | Anonymous-visible data constraints |

---

## 1. Purpose

Generate a short, visible, on-page summary paragraph for public entity pages, built **exclusively from public structured database fields**. The summary gives each page real, unique, indexable body content — the "earn indexing through visible facts" requirement of IR2 — without any editorial or AI-generated prose.

The engine is a pure text-assembly layer. It never queries, never invents, and never rephrases curated marketing copy. If a fact is not in the database, the sentence that would express it simply does not exist.

---

## 2. Principles

1. **Factual only.** Every sentence must be traceable to a named DB field. No adjectives of scale or quality ("largest", "leading", "premier") unless they are literal field values — and engine templates never add them.
2. **No marketing language.** No calls to action, no superlatives, no audience claims, no "join us".
3. **No invented claims.** No topics, rankings, attendance figures, "official" status, or industry labels that are not stored fields.
4. **Omission over placeholder.** A missing field removes its sentence or clause entirely. Never "Date TBD", "Location unknown", or "0 sponsors" phrased as an absence apology in indexable copy.
5. **Tense-aware.** Past, currently running, and future editions read naturally, derived from dates versus the render date.
6. **Deterministic and pure.** Same inputs → same output. Implementable as server-safe pure functions (mirroring `src/lib/seo/indexability.ts`), unit-testable without a database.
7. **Protection-compliant.** Summaries expose only anonymously visible facts. Aggregate counts are allowed; gated rosters, tier assignments per company, and restricted-company names are not.
8. **Summaries do not affect indexability.** IR1's gate decides `noindex`/sitemap; the engine only renders content. A zero-sponsor edition may still render a (shorter) summary on its `noindex` page.

---

## 3. Public structured data inventory

Only these fields feed the engine. All are already loaded by existing public loaders — no new queries are required for v1.

### 3.1 Event edition (`getEventDetailData` / `EVENT_EDITION_DETAIL_SELECT`)

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | Required for a summary at all |
| `year` | number \| null | Usually redundant with dates; fallback only |
| `start_date`, `end_date` | date \| null | Drive tense and date-range phrasing |
| `cities` → `formatLocationLabel` | string \| "" | City, country label per `phase-1.1-location-scope.md` |
| `venues.name` | string \| null | Only non-archived venues |
| `event_series.name` | string \| null | Series membership sentence |
| `event_sponsors` (aggregate) | count | Total links, **including restricted companies** (confirmed decision); names never used |
| `event_sponsors.tier_label`/`tier_rank` (aggregate) | distinct count | Number of distinct tiers, when any link has a tier |
| `last_reviewed_at` | timestamp \| null | Manual-only field; public trust signal (decision 3) |

### 3.2 Event series (`getSeriesHubData`)

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | Required |
| `lifecycle_status` | active \| discontinued \| merged \| null | null/blank ⇒ active; merged series never render a summary (redirect/tombstone per IR1) |
| `editions[]` | array | Count, min/max year, next upcoming edition (name + start date), most recent past edition |
| `topics[]` (public keywords) | array | Names only, as stored |

### 3.3 Company (`getSponsorDetailData`, `company_sponsor_stats`)

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | Required |
| `summary.sponsoredEditionCount` | number | Authoritative view-backed count (confirmed decision 1) |
| `summary.sponsoredEditionCountUnknown` | boolean | Stats query failed → suppress the count sentence entirely |
| `website` / `domain` | string \| null | Stated as a plain fact, not a link pitch |
| `short_description` / `description` | string \| null | **Not consumed** — curated copy renders separately |
| `restricted_at` | timestamp \| null | Restricted companies have no public page ⇒ no summary path exists |

Gated and therefore **never** in a summary: sponsored-event names and history, per-company tier labels, `latestActivityAt`, anything from the authenticated-only branch.

---

## 4. Architecture

```
src/lib/content/factualSummary.ts        (pure, server-safe, no I/O)
├── buildEventEditionSummary(input): string | null
├── buildEventSeriesSummary(input): string | null
└── buildCompanySummary(input): string | null
```

- Each builder takes a plain input object (already-loaded public fields) and returns a paragraph string, or `null` when even the minimum facts are absent (then the page renders no summary block).
- Builders assemble **fact fragments** — independent sentences/clauses, each guarded by its own field-presence check — then join the surviving fragments in a fixed order. There is no template with holes; there is a list of optional sentences.
- A single injected `now: Date` parameter drives tense (defaulting to render time), so tests are deterministic.
- The same builder output is used for on-page rendering; meta descriptions stay on their existing S1 templates (a summary is body content, not metadata duplication — IR2 scope note).

### 4.1 Tense resolution (editions)

| Condition (dates vs `now`, date-only comparison in UTC) | Tense | Verb phrasing |
|---|---|---|
| `end_date` (or `start_date` when no end) `< today` | Past | "took place", "was held" |
| `start_date ≤ today ≤ end_date` (or single-day today) | Current | "is taking place", "runs through {end}" |
| `start_date > today` | Future | "will take place", "is scheduled for" |
| No dates | Tenseless | Neutral phrasing without a time claim |

Series and companies use present-tense catalog phrasing ("has N recorded editions", "has sponsored N event editions") plus past tense for historical clauses.

### 4.2 Count phrasing

Counts are always attributed to the catalog — "recorded on EventPixels" / "listed on EventPixels" — because the honest claim is about our records, not the world ("47 sponsors are recorded for this edition", never "this event has 47 sponsors" as a universal truth). This also keeps restricted-inclusive counts truthful: they are counts of recorded sponsorship relationships.

Singular/plural handled per fragment ("1 sponsor is recorded" / "12 sponsors are recorded"; "1 sponsorship tier" / "3 sponsorship tiers").

### 4.3 Fragment order

**Edition:** identity+series → date+location (tensed) → venue → sponsor count (+ tier count) → last reviewed.
**Series:** identity+lifecycle → edition count + year span → next upcoming or most recent edition → topics.
**Company:** identity (+ website fact) → sponsored-edition count → access note (fixed factual sentence about the gated list).

---

## 5. Fragment grammar

### 5.1 Event edition

| # | Fragment | Requires | Template |
|---|----------|----------|----------|
| E1 | Identity | `name` | `{name} is an event edition` + (`in the {series} series` when series) + `.` — tensed variants fold E1+E2 together when dates exist (see examples) |
| E2 | When/where | dates and/or location | Past: `{name} took place on {dateRange}[ in {location}].` Current: `{name} is taking place {dateRange}[ in {location}].` Future: `{name} will take place on {dateRange}[ in {location}].` Location-only (no dates): `{name} is held in {location}.` (tenseless) |
| E3 | Venue | `venue.name` | `The venue is {venue}.` / past: `The venue was {venue}.` |
| E4 | Sponsors | sponsorCount ≥ 1 | `{N} sponsor(s) {is/are} recorded for this edition` + (`across {M} sponsorship tier(s)` when M ≥ 1) + ` on EventPixels.` |
| E5 | Last reviewed | `last_reviewed_at` | `Sponsor information was last reviewed on {date}.` |

Zero sponsors ⇒ E4 omitted entirely (page is `noindex` anyway per IR1; we do not advertise emptiness). Minimum viable summary = E1 or E2; if only `name` exists with nothing else, return the bare E1 sentence or `null` per rendering preference (recommended: render E1 — still factual).

### 5.2 Event series

| # | Fragment | Requires | Template |
|---|----------|----------|----------|
| S1 | Identity | `name` | `{name} is an event series` + (` marked as discontinued` when lifecycle = discontinued) + ` on EventPixels.` |
| S2 | Catalog span | editions ≥ 1 | `{N} edition(s) {is/are} recorded` + (`, from {minYear} to {maxYear}` when span > 1 year; `, in {year}` when single year) + `.` |
| S3 | Next / latest | upcoming or past edition | Upcoming: `The next recorded edition, {editionName}, will take place on {dateRange}[ in {location}].` Otherwise most recent past: `The most recent recorded edition, {editionName}, took place in {year}[ in {location}].` |
| S4 | Topics | topics ≥ 1 | `The series is associated with the topic(s) {list}.` |

Merged series: no summary — the page 301s to the successor or renders the non-indexable tombstone (IR1); the tombstone uses its own fixed copy, not this engine.

### 5.3 Company

| # | Fragment | Requires | Template |
|---|----------|----------|----------|
| C1 | Identity | `name` | `{name} is a company profiled on EventPixels` + (`; its website is {domain}` when website/domain) + `.` |
| C2 | Sponsor count | count ≥ 1 **and not** `sponsoredEditionCountUnknown` | `It has sponsored {N} event edition(s) recorded on EventPixels.` |
| C3 | Access note | count ≥ 1 | `The full list of sponsored events is available to logged-in users.` |

- Count = 0 ⇒ C2 and C3 omitted (page exists, `noindex`; no "no sponsorships" claim that could read as a market statement).
- `sponsoredEditionCountUnknown` ⇒ C2 and C3 omitted (fail-open on outage: no wrong number, no absence claim).
- Restricted company ⇒ unreachable (public not-found), no summary path.
- Domain is stated as a registry fact ("its website is bitgo.com"), never as promotion.

---

## 6. Example summaries

Entity names, slugs, dates, and locations come from the `seo-copy-examples.md` catalog snapshot (2026-07-15); sponsor counts, tier counts, venues, and review dates are **illustrative values** showing the intended shape (live values must be substituted at render time). Render date for tense: **2026-07-17**.

### 6.1 Event editions

**Future edition, full data — Avalanche Summit New York 2026** (Sep 16–17, 2026; sponsors recorded; reviewed)

> Avalanche Summit New York 2026 is an event edition in the Avalanche Summit series. It will take place on September 16–17, 2026 in New York, United States. 34 sponsors are recorded for this edition across 4 sponsorship tiers on EventPixels. Sponsor information was last reviewed on July 2, 2026.

**Future edition, no tiers — Devcon 8** (Nov 3–6, 2026, Mumbai)

> Devcon 8 is an event edition in the Devcon series. It will take place on November 3–6, 2026 in Mumbai, India. 12 sponsors are recorded for this edition on EventPixels.

*(No `last_reviewed_at` → E5 omitted; no tier labels → tier clause omitted.)*

**Currently running edition — hypothetical dates Jul 16–18, 2026**

> ETHGlobal Lisbon 2026 is an event edition in the ETHGlobal series. It is taking place July 16–18, 2026 in Lisbon, Portugal. 21 sponsors are recorded for this edition across 3 sponsorship tiers on EventPixels. Sponsor information was last reviewed on July 14, 2026.

**Past edition — BTC Prague 2026** (Jun 11–13, 2026; venue known)

> BTC Prague 2026 is an event edition in the BTC Prague series. It took place on June 11–13, 2026 in Prague, Czech Republic. The venue was PVA EXPO Praha. 81 sponsors are recorded for this edition across 6 sponsorship tiers on EventPixels. Sponsor information was last reviewed on June 20, 2026.

**Past edition, previous year — Future Blockchain Summit 2025** (Oct 12–15, 2025, Dubai)

> Future Blockchain Summit 2025 is an event edition in the Future Blockchain Summit series. It took place on October 12–15, 2025 in Dubai, United Arab Emirates. 47 sponsors are recorded for this edition on EventPixels.

**Sparse edition — name + location only** (no dates, no sponsors, no review; page is `noindex` per IR1 but still renders)

> WebSummit Rio 2027 is an event edition in the Web Summit series. It is held in Rio de Janeiro, Brazil.

*(No date claim invented; no "0 sponsors"; no "date TBD".)*

**Minimal edition — name only**

> Example Conference 2027 is an event edition on EventPixels.

### 6.2 Event series

**Active series with upcoming edition — Bitcoin Conference**

> Bitcoin Conference is an event series on EventPixels. 4 editions are recorded, from 2024 to 2027. The next recorded edition, Bitcoin Hong Kong 2027, will take place on January 12–14, 2027 in Hong Kong. The series is associated with the topics Bitcoin and Payments.

**Active series, all editions past — StartmeupHK Festival**

> StartmeupHK Festival is an event series on EventPixels. 6 editions are recorded, from 2019 to 2024. The most recent recorded edition, StartmeupHK Festival 2024, took place in 2024 in Hong Kong.

*(No public topics linked → S4 omitted. Curated description absent — irrelevant to the engine either way.)*

**Discontinued series**

> Token Forum is an event series marked as discontinued on EventPixels. 3 editions are recorded, from 2021 to 2023. The most recent recorded edition, Token Forum 2023, took place in 2023 in Singapore.

**Single-edition series, minimal**

> Nordic Fintech Week is an event series on EventPixels. 1 edition is recorded, in 2026.

**Merged series — no summary.** The URL permanently redirects to the successor, or renders the fixed non-indexable tombstone (IR1); the engine is not invoked.

### 6.3 Companies

**Indexable company with website — BitGo** (count from `company_sponsor_stats`)

> BitGo is a company profiled on EventPixels; its website is bitgo.com. It has sponsored 23 event editions recorded on EventPixels. The full list of sponsored events is available to logged-in users.

**Indexable company, single sponsorship, no website field**

> Nexus Analytics is a company profiled on EventPixels. It has sponsored 1 event edition recorded on EventPixels. The full list of sponsored events is available to logged-in users.

**Zero-sponsor company** (page exists, `noindex`, excluded from sitemap)

> Acme Robotics is a company profiled on EventPixels; its website is acmerobotics.com.

*(No count sentence, no "has not sponsored anything" claim.)*

**Stats outage (`sponsoredEditionCountUnknown`)** — identical output to the zero-sponsor case: identity sentence only. No number is shown because no number is known; the robots tag independently fails open to indexable (IR1 hardening).

**Restricted company** — no public page, no summary.

---

## 7. Omission rules (consolidated)

| Missing / condition | Effect |
|---------------------|--------|
| Dates | No time claim; tenseless phrasing; location may still anchor E2 |
| Location label empty | Drop ` in {location}` clause |
| Venue null or archived | Drop E3 |
| Sponsor count = 0 | Drop E4 / C2–C3 — never verbalize the zero |
| Tier labels absent | Drop tier clause only, keep sponsor count |
| `last_reviewed_at` null | Drop E5 |
| Series relation null | Drop "in the {series} series" clause |
| Topics empty | Drop S4 |
| Editions empty (series) | Drop S2–S3; identity sentence only |
| Website and domain null | Drop website clause |
| `sponsoredEditionCountUnknown` | Drop C2–C3 (treat count as unknown, not zero) |
| Entity name missing | No summary (`null`) — should be unreachable for public pages |

---

## 8. Banned constructions (test-enforced)

The engine's templates must never emit, and a unit test should assert the absence of:

- Superlatives / scale claims: "largest", "leading", "premier", "top", "best", "world-class", "renowned"
- Calls to action: "join", "register", "don't miss", "sign up", "book now"
- Invented attributes: attendance numbers, industry labels, "official", "annual" (recurrence is not a stored fact), speaker/agenda claims
- Absence apologies in indexable copy: "TBD", "unknown", "coming soon", "no sponsors yet"
- Gated data: sponsored-event names on company pages, per-company tier labels, restricted company names anywhere

---

## 9. Interaction with IR1 indexability

- The engine renders content; `src/lib/seo/indexability.ts` decides `robots` and sitemap membership. Neither consults the other.
- Zero-value pages (`noindex`) may still render their reduced summaries — content quality for humans, invisible to indexes.
- The company count sentence uses the **same** `company_sponsor_stats`-backed `sponsoredEditionCount` already flowing through `SponsorDetailSummary`, so the visible number, the robots decision, and the sitemap can never disagree (confirmed decision 1).
- Event sponsor counts use the same total-links count (restricted included) that drives edition indexability and the visible roster count (confirmed decision 2).

---

## 10. Testing strategy (for implementation phase)

1. Fragment-level unit tests per builder: every field present/absent permutation for the guards in §5.
2. Tense boundary tests with injected `now`: day before start, first day, last day, day after end, no dates.
3. Pluralization tests (1 vs many for sponsors, tiers, editions).
4. Banned-phrase regression test over all templates (§8 list against generated output corpus).
5. Protection tests: builder inputs typed so gated fields cannot be passed (compile-time), plus runtime assertion that output never contains sponsor company names for company summaries.
6. Snapshot examples mirroring §6 for reviewability.

---

## 11. Out of scope (deferred)

- AI-written or curated prose (IR7); curated `description` fields keep rendering separately, untouched.
- Meta-description changes (existing S1 templates remain authoritative for metadata).
- JSON-LD emission (IR5) — though builders' inputs intentionally overlap with future schema fields.
- Research pages (IR4 — routes do not exist).
- Localization / non-English output.
- Venue SEO destinations (not planned).

---

## 12. Acceptance criteria (design → implementation handoff)

- [ ] Builders exist as pure functions with the signatures in §4, no I/O.
- [ ] Every sentence in rendered summaries maps to a §3 field (spot-check per §6 examples).
- [ ] Tense correct at boundaries per §4.1.
- [ ] All §7 omission rules verified by tests; no placeholder text ever rendered.
- [ ] Banned-construction test green.
- [ ] Company summaries never name sponsored events; event summaries never name restricted companies.
- [ ] Zero-sponsor and stats-outage company pages render the identity sentence only.

---

## Change log

| Date | Note |
|------|------|
| 2026-07-17 | Initial design (IR2 event summaries + series/company extensions), grounded in current public loaders |
