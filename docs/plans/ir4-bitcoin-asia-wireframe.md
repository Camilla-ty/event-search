# IR4 Wireframe — Bitcoin Events in Asia

**Status:** Wireframe only — no implementation  
**Date:** 2026-07-17  
**Related:** `docs/plans/ir4-bitcoin-asia-mvp.md`

This document renders the first KeywordRegionHub (Keyword + Region Hub) using the approved public copy and current catalog data. It is a design artifact only.

---

## Page identity

| Field | Copy |
|-------|------|
| URL | `/events/topics/bitcoin/regions/asia` |
| Title | `Bitcoin Events in Asia | EventPixels` |
| Meta description | `EventPixels records 7 Bitcoin events in Asia (2025–2026) across China, Singapore, and South Korea, with 769 companies recorded as sponsors of those events.` |
| H1 | `Bitcoin Events in Asia` |

### Approved summary

> **769 sponsoring companies are recorded on Bitcoin events in Asia on EventPixels.** They appear across 7 Bitcoin events (2025–2026) spanning 4 event brands in China, Singapore, and South Korea. 3 events have public sponsor rosters. Counts reflect EventPixels-recorded sponsorship data.

### Last reviewed

`Last reviewed 8 July 2026`

Placement: inside the hero summary card, below the summary paragraph. The hero contains no secondary CTA.

---

## Exact section order

```text
0. Global site header
1. Breadcrumb
2. Hero: eyebrow, H1, approved summary, last reviewed
3. Events in this lens (7)
4. Event-section CTA: View all Bitcoin events →
5. Sponsors on these Bitcoin events (#sponsors)
6. Footer attribution
```

The hero stays focused on the page title, approved summary, and last reviewed date. `View all Bitcoin events →` appears **only after** the seven event cards.

---

## Desktop layout

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ [Logo]    Discover    Events    Sponsors                     Sign Up  Log in │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Events › Bitcoin › Asia                                                     │
│                                                                              │
│ BITCOIN · ASIA                                                               │
│ Bitcoin Events in Asia                                                       │
│                                                                              │
│ ┌─ Summary card ───────────────────────────────────────────────────────────┐ │
│ │ 769 sponsoring companies are recorded on Bitcoin events in Asia on        │ │
│ │ EventPixels. They appear across 7 Bitcoin events (2025–2026) spanning     │ │
│ │ 4 event brands in China, Singapore, and South Korea. 3 events have        │ │
│ │ public sponsor rosters. Counts reflect EventPixels-recorded sponsorship   │ │
│ │ data.                                                                     │ │
│ │                                                                          │ │
│ │ Last reviewed 8 July 2026                                                 │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│ Events in this lens (7)                                                      │
│                                                                              │
│ ┌─ Event card ─────────────────────────────────────────────────────────────┐ │
│ │ Digital Asset Summit Asia 2026                              [View edition]│ │
│ │ 7 October 2026 · Singapore, Singapore                                    │ │
│ │ Series: Digital Asset Summit                                             │ │
│ │ Sponsors recorded: —                                                     │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│ ┌─ Event card ─────────────────────────────────────────────────────────────┐ │
│ │ TOKEN2049 Singapore 2026                                    [View edition]│ │
│ │ 7–8 October 2026 · Singapore, Singapore                                  │ │
│ │ Series: TOKEN2049                                                        │ │
│ │ Sponsors recorded: —                                                     │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│ ┌─ Event card ─────────────────────────────────────────────────────────────┐ │
│ │ Korea Blockchain Week 2026                                  [View edition]│ │
│ │ 29 September – 1 October 2026 · Seoul, South Korea                       │ │
│ │ Series: Korea Blockchain Week                                            │ │
│ │ Sponsors recorded: —                                                     │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│ ┌─ Event card ─────────────────────────────────────────────────────────────┐ │
│ │ Consensus Hong Kong 2026                                    [View edition]│ │
│ │ 10–12 February 2026 · Hong Kong, China                                   │ │
│ │ Series: Consensus Hong Kong                                              │ │
│ │ 123 sponsors recorded · Last reviewed 7 July 2026                        │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│ ┌─ Event card ─────────────────────────────────────────────────────────────┐ │
│ │ TOKEN2049 Singapore 2025                                    [View edition]│ │
│ │ 7–8 October 2025 · Singapore, Singapore                                  │ │
│ │ Series: TOKEN2049                                                        │ │
│ │ 517 sponsors recorded · Last reviewed 6 July 2026                        │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│ ┌─ Event card ─────────────────────────────────────────────────────────────┐ │
│ │ Korea Blockchain Week (KBW) 2025                            [View edition]│ │
│ │ 22–28 September 2025 · Seoul, South Korea                                │ │
│ │ Series: Korea Blockchain Week                                            │ │
│ │ 217 sponsors recorded · Last reviewed 8 July 2026                        │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│ ┌─ Event card ─────────────────────────────────────────────────────────────┐ │
│ │ Consensus Hong Kong 2025                                    [View edition]│ │
│ │ 18–20 February 2025 · Hong Kong, China                                   │ │
│ │ Series: Consensus Hong Kong                                              │ │
│ │ Sponsors recorded: — · Last reviewed 7 July 2026                         │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│ View all Bitcoin events →                                                    │
│                                                                              │
│ Sponsors on these Bitcoin events                                             │
│ 769 companies recorded as sponsors of the Bitcoin events listed above.        │
│                                                                              │
│ ┌─ Sponsor table ──────────────────────────────────────────────────────────┐ │
│ │ Company                   Website          Bitcoin events in Asia  Total │ │
│ │                                                    recorded              │ │
│ │ TRON DAO                  trondao.org                         3       10 │ │
│ │ Listing.Help              listing.help                        3        9 │ │
│ │ Kraken                    kraken.com                          3        8 │ │
│ │ Ault Blockchain           aultblockchain.com                  3        3 │ │
│ │ OpenLedger                openledger.xyz                      3        3 │ │
│ │ Ripple                    ripple.com                          2       12 │ │
│ │ BitGo                     bitgo.com                           2       11 │ │
│ │ Fireblocks                fireblocks.com                      2       11 │ │
│ │ Ledger                    ledger.com                          2        9 │ │
│ │ Solana Foundation         solana.com                          2        9 │ │
│ │ … 10 more rows                                                             │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│ Showing 20 of 769 companies.                                                 │
│ Browse sponsor profiles for companies recorded on these events.              │
│ Sponsor discovery →                                                          │
│                                                                              │
│ Counts reflect EventPixels-recorded sponsorship data.                         │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Mobile layout

```text
┌─────────────────────────────┐
│ [Menu] EventPixels   Log in │
└─────────────────────────────┘

┌─────────────────────────────┐
│ Events › Bitcoin › Asia     │
│                             │
│ BITCOIN · ASIA              │
│ Bitcoin Events in Asia      │
│                             │
│ ┌─ Summary card ──────────┐ │
│ │ 769 sponsoring          │ │
│ │ companies are recorded  │ │
│ │ on Bitcoin events in    │ │
│ │ Asia on EventPixels.    │ │
│ │ They appear across 7    │ │
│ │ Bitcoin events          │ │
│ │ (2025–2026) spanning 4  │ │
│ │ event brands in China,  │ │
│ │ Singapore, and South    │ │
│ │ Korea. 3 events have    │ │
│ │ public sponsor rosters. │ │
│ │ Counts reflect          │ │
│ │ EventPixels-recorded    │ │
│ │ sponsorship data.       │ │
│ │                         │ │
│ │ Last reviewed           │ │
│ │ 8 July 2026             │ │
│ └─────────────────────────┘ │
│                             │
│ Events in this lens (7)     │
│                             │
│ ┌─ Event card ────────────┐ │
│ │ Digital Asset Summit    │ │
│ │ Asia 2026               │ │
│ │ 7 October 2026          │ │
│ │ Singapore, Singapore    │ │
│ │ Series: Digital Asset   │ │
│ │ Summit                  │ │
│ │ Sponsors recorded: —    │ │
│ │ View edition →          │ │
│ └─────────────────────────┘ │
│                             │
│ (6 more event cards)        │
│                             │
│ View all Bitcoin events →   │
│                             │
│ Sponsors on these Bitcoin   │
│ events                      │
│                             │
│ 769 companies recorded as   │
│ sponsors of the Bitcoin     │
│ events listed above.        │
│                             │
│ ┌─ Sponsor card ──────────┐ │
│ │ TRON DAO                │ │
│ │ trondao.org             │ │
│ │ Bitcoin events in Asia: │ │
│ │ 3                       │ │
│ │ Total recorded: 10      │ │
│ │ View profile →          │ │
│ └─────────────────────────┘ │
│ ┌─ Sponsor card ──────────┐ │
│ │ Listing.Help            │ │
│ │ listing.help            │ │
│ │ Bitcoin events in Asia: │ │
│ │ 3                       │ │
│ │ Total recorded: 9       │ │
│ │ View profile →          │ │
│ └─────────────────────────┘ │
│                             │
│ (18 more sponsor cards)     │
│                             │
│ Showing 20 of 769.          │
│ Sponsor discovery →         │
│                             │
│ Counts reflect              │
│ EventPixels-recorded        │
│ sponsorship data.           │
└─────────────────────────────┘
```

---

## Public-copy rules for this wireframe

| Surface | Approved copy |
|---------|---------------|
| Post-events CTA | `View all Bitcoin events →` |
| Sponsor section H2 | `Sponsors on these Bitcoin events` |
| Sponsor aggregate line | `769 companies recorded as sponsors of the Bitcoin events listed above.` |
| Sponsor table headers | `Company` \| `Website` \| `Bitcoin events in Asia` \| `Total recorded` |
| Hero eyebrow | `BITCOIN · ASIA` |
| Sponsor footer line | `Browse sponsor profiles for companies recorded on these events.` |

Avoid public-facing use of:

- `TOPIC · REGION`
- `Sponsors in this lens`
- `769 companies recorded across the editions listed above`
- `769 companies recorded in this lens`
- `In hub` / `In this hub`
- `All Bitcoin events →` in the hero

Technical docs may still use “lens” and “edition” where those terms describe query logic or database rows.

---

## Component notes

### Event cards

- One-column list on desktop and mobile.
- Full edition name links to `/events/{slug}`.
- `View edition →` aligned right on desktop; full-width tap target on mobile.
- Show sponsor count only as public roster count (`123 sponsors recorded`); show `Sponsors recorded: —` when count is zero.
- Show edition-level last reviewed only when present.

### Sponsor module

- Desktop uses a table.
- Mobile uses stacked cards, not a horizontally scrolling table.
- Desktop table headers: `Company` | `Website` | `Bitcoin events in Asia` | `Total recorded`.
- Mobile stat labels: `Bitcoin events in Asia: {n}` and `Total recorded: {n}`.
- Sort remains hub event count desc → global total desc → company name.
- No event names per company, tier labels, “top”, “most active”, or “leading” language.

### Last reviewed placement

- Hub last reviewed appears inside the hero summary card, under the approved summary.
- No last-reviewed value appears in the title or meta description.

---

## Change log

| Date | Note |
|------|------|
| 2026-07-17 | Initial wireframe captured from approved Bitcoin × Asia page direction |
| 2026-07-17 | UX/copy refinements applied: hero CTA removed, post-events CTA added, sponsor heading and aggregate copy made public-facing |
| 2026-07-17 | Sponsor table headers updated to `Company` \| `Website` \| `Bitcoin events in Asia` \| `Total recorded`; mobile labels match |
| 2026-07-17 | Terminology: TopicRegionHub → KeywordRegionHub; public eyebrow `TOPIC · REGION` → `BITCOIN · ASIA`; URLs unchanged |
