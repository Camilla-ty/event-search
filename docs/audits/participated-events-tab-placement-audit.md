# Audit — Participated Events Tab Placement

**Status:** Documentation-only (no implementation authorized by this document)  
**Date:** 2026-08-01  
**Context:** ADR-004 same-brand link; existing Series-hub Participated Events UX prototype; public Event Edition tab architecture  

**Related:** [ADR-004](../adr/ADR-004-event-series-company-same-brand-link.md) · [Phase same-brand scope §7.4](../phase-event-series-company-same-brand-scope.md) · [Same-brand architecture audit](./event-series-company-same-brand-architecture-audit.md)

---

## 1. Verdict

**Keep Participated Events on the Event Series (Event Brand) hub as the primary surface.** Do **not** add it as a default Event Edition tab.

Reasoning in one line: the data is **brand-level sponsorship of other events**, not edition roster content — repeating it on every Edition of the same Series would duplicate identical lists and confuse visitors with the edition **Sponsors** tab.

The current Series-hub prototype is the right *placement* for a reversible experiment. Product still must decide naming, empty-state policy, relationship to Company/Sponsor pages, and whether reciprocal profile chrome returns.

**Do not** treat this audit as approval to move the feature onto Editions, to hide/redirect Company profiles, or to batch-link more same-brand candidates.

---

## 2. Current architecture findings

### 2.1 Public Event Edition tabs

| Item | Finding |
|------|---------|
| Route | `/events/[slug]` · `?tab=` for non-overview |
| Always-on tabs | Overview · Sponsors · Venue · Organizers |
| Conditional tabs | **Exhibitors** (edition has ≥1 public exhibitor) · **Partner Alumni** (series current version has ≥1 member) |
| Visibility pattern | Tab omitted when empty; deep link to hidden tab redirects/falls back to Overview |
| Scope mix | Sponsors / Exhibitors / Venue / Organizers = **edition-scoped**. Partner Alumni = **series-scoped** (same roster on every edition of that series). Overview mixes edition facts with series lifecycle (“Event History” status rows) and related editions |

Key files: `PublicEventEditionTabs.tsx`, `publicEditionTabUrls.ts`, `src/app/(marketing)/events/[id]/page.tsx`.

### 2.2 Series-level features on Edition pages today

| Feature | Where | Scope | Notes |
|---------|--------|-------|-------|
| **Partner Alumni** | Edition tab | Series current version | Intentionally series-scoped; not on Series hub today (PA design: Series hub out of scope) |
| **Related Editions** | Overview section “More from {series}” | Other editions of same series | Caps list; “View all events” → Series hub |
| **Event History** (naming) | Overview status rows | Series lifecycle / merge | Not a participation history list |
| Series hub links | Header badge, Event brand card, related/merged links | Navigation | Established cross-link pattern |

**Implication:** Series-scoped content *can* appear on Editions (Partner Alumni proves it), but only when the story is “about this Event Brand’s program,” not when the list is identical sponsorship history unrelated to *this* edition’s roster.

### 2.3 Participated Events prototype (Series hub)

| Item | Finding |
|------|---------|
| Placement | `/events/series/[slug]` — optional tab **Participated Events** (`?tab=participated`) |
| Shown when | Linked Company has ≥1 publicly mapped `event_sponsors` row |
| Data path | `event_series.company_profile_id` → `event_sponsors.company_id` → `event_editions` (+ `tier_label` / `tier_rank`) |
| Own editions | Remain under default **Events** tab (`SeriesEditionsList`) |
| Filtering | Drops missing/unresolvable editions and editions under **merged** series lifecycle |
| Role labels | Prefer `tier_label`; else `Tier N` |
| Reciprocal chrome | Header Series↔Company links **hidden** for the prototype; Company `/sponsors/...` pages **remain** |
| Schema | **No new columns** — reuses ADR-004 FK + existing joins |

Key files: `SeriesHubBody.tsx`, `SeriesParticipatedEventsList.tsx`, `loadSeriesParticipatedEvents.ts`, `seriesParticipatedEvents.ts`, `getSeriesHubData.ts`.

### 2.4 Can Series-level Participated Events safely appear on every Edition?

**Technically yes** (same load pattern as Partner Alumni). **Product-wise no as a default Edition tab:**

- The list does not change per edition of Series A; every Edition of A would show the same “A sponsored B and C” rows.
- Visitors opening Edition A’s **Sponsors** tab expect companies that sponsored *this* event — not events that *this brand* sponsored elsewhere.
- Low-volume brands (e.g. Singapore FinTech Festival: **2** rows) still inflate every edition chrome if the tab is always present when non-empty.

---

## 3. Recommended placement

| Surface | Recommendation |
|---------|----------------|
| **Event Series hub** | **Primary home** for Participated Events (keep / refine current prototype) |
| **Event Edition tabs** | **Do not add** as a standard tab in V1 |
| **Both** | Avoid duplication unless product explicitly wants a short Overview teaser (“Also sponsored N other events”) linking to the Series hub tab |
| **Company / Sponsor profile** | Out of this audit’s product lock; keep visible. Sponsor history already covers company-side sponsorship lists (auth-gated detail today). Do not hide/redirect |

**Prototype disposition:** **Keep on Series hub**; do **not** move to Edition as primary; do **not** remove until product rejects the experiment. Optional later: thin Edition Overview cross-link only — not a full second tab. Refined row UI (2026-08-01): full-row Event Edition links with year/dates/city and secondary sponsor role; newest first.

---

## 4. Risks and trade-offs

| Risk | Severity | Notes |
|------|----------|-------|
| Confusion with edition **Sponsors** | High if on Edition | Same word family (“participated” / “sponsored”); different subject |
| Identical list on every Edition | High if on Edition | Partner Alumni already sets a series-on-edition precedent; compounding that pattern here is worse UX |
| Empty / low-volume tabs | Medium | Hide-when-empty (current) is correct; many Series will never show the tab |
| Naming | Medium | “Participated Events” vs “Events sponsored” vs “As sponsor” — public must not imply organizer/owner |
| Ordering | Low | Prototype sorts by start date desc — align with Series Events list conventions |
| Reciprocal chrome vs tab | Medium | Hiding Series↔Company links reduces profile hopping but also hides ADR-004 SB2 nav; decide restore vs permanent |
| Overlap with Company sponsorship history | Medium | Two places can list the same sponsor appearances (Series brand view vs Company profile) — acceptable if framing differs (Event Brand vs Company) |
| PA inconsistency | Low | Partner Alumni lives on Edition only; Participated on Series only — document why (different product stories) |

---

## 5. Smallest reversible prototype

**Already closest match:** Series-hub conditional tab only.

| Do | Don’t |
|----|-------|
| Keep Series hub Events + Participated Events split | Add Edition `?tab=participated` |
| Keep hide-when-empty | Always show empty Participated tab |
| Keep sponsor→edition read path via `company_profile_id` | New schema / `public_profile_mode` |
| Keep Company profiles live | Redirect or hide `/sponsors/...` |
| Keep one linked test brand for UX review | Batch-link SB4 candidates for this experiment |

Revert path: remove `SeriesHubBody` participated branch + loader wiring; restore reciprocal header links if product wants SB2 chrome back.

---

## 6. Scope impact (if continuing Series-hub prototype only)

| Area | Impact |
|------|--------|
| Loaders | `getSeriesHubData`, `loadSeriesParticipatedEvents` (already) |
| Routes | Series hub `searchParams.tab` only — **no** edition route change |
| Components | `SeriesHubBody`, `SeriesParticipatedEventsList`, header (reciprocal off) |
| Tests | Prototype + ADR regression wiring (already) |
| Docs | Phase scope §7.4 prototype note; this audit |
| Schema | **None** |
| Company/Sponsor pages | **Unaffected** except optional reciprocal chrome already hidden |
| Search / SEO / canonical | **Out of scope** — unchanged |

Edition-tab placement would additionally touch `PublicEventEditionTabs`, `publicEditionTabUrls`, edition page loaders, redirects for hidden tabs, and a much larger test surface — **not** recommended for the smallest prototype.

---

## 7. Open product decisions

1. **Confirm Series hub as sole home** vs Edition Overview teaser vs both.  
2. **Final public name** for the tab (“Participated Events” vs clearer sponsor framing).  
3. **Restore, keep hidden, or replace** ADR-004 reciprocal profile links now that the tab exists.  
4. **Relationship to Company sponsorship history** — complementary copy or eventual consolidation.  
5. **Empty Series with a link but zero sponsor rows** — remain tab-hidden (current) or show empty educational state.  
6. **Include non-sponsor roles later?** (organizer / exhibitor appearances) — out of current prototype; would change framing.  
7. **SB4 linking policy** — keep one test link vs approve more high-confidence pairs after UX sign-off.  
8. **Partner Alumni on Series hub?** Orthogonal; do not conflate with Participated Events.

---

## 8. Document history

| Date | Change |
|------|--------|
| 2026-08-01 | Initial placement audit (Edition vs Series; prototype disposition; no implementation) |

---

**End of audit.**
