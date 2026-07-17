# SEO Copy Examples (Current vs Proposed S1)

**Status:** Examples only — no implementation  
**Source:** Live catalog data via linked Supabase (2026-07-15)  
**Plans:** `docs/plans/seo-foundation.md`, `docs/plans/seo-gap-audit.md`  
**Host:** `https://app.eventpx.com`

Notes:

- **Current** matches today’s `generateMetadata` + `createPageMetadata` behavior.
- **Document title** also applies the root template: `{title} | EventPixels`.
- **Proposed S1** follows the foundation plan templates (dates, richer descriptions, short_description / domain fallbacks, series edition-count enrichment). Copy is illustrative for S1 — not shipped code.
- Sponsor **industry** is referenced in current code but is **not a DB column**; live profiles therefore almost always hit the generic sponsor description today.

---

## Templates used

### Current — Event edition

| Field | Rule |
|-------|------|
| Title | `{editionName}` |
| Description | `{name} — {location}. View sponsors…` if location; else `{name}. View sponsors…` |
| Canonical | `https://app.eventpx.com/events/{slug}` |

### Proposed S1 — Event edition

| Field | Rule |
|-------|------|
| Title | `{editionName}` (year usually already in the name; avoid redundant `(year)` when present) |
| Description | `{name} — {location}. {dateRange}. Sponsors and event intelligence on EventPixels.` |
| Canonical | unchanged |

### Current — Event series

| Field | Rule |
|-------|------|
| Title | `{seriesName}` |
| Description | curated `description`, else `{name} — all events and editions on EventPixels.` |
| Canonical | `https://app.eventpx.com/events/series/{slug}` |

### Proposed S1 — Event series

| Field | Rule |
|-------|------|
| Title | `{seriesName}` |
| Description | Prefer curated text trimmed ~155 chars; if thin/empty, `{name} — {N} editions through {latestYear}. Event series intelligence on EventPixels.` |
| Canonical | unchanged (merged successor policy out of scope for these examples) |

### Current — Sponsor

| Field | Rule |
|-------|------|
| Title | `{companyName}` |
| Description | `{name} — {industry}…` if industry; else `{name}. Company and sponsor intelligence on EventPixels.` |
| Canonical | `https://app.eventpx.com/sponsors/{slug}` |

### Proposed S1 — Sponsor

| Field | Rule |
|-------|------|
| Title | `{companyName}` |
| Description | Prefer `short_description` (trimmed ~155 chars); else `{name} — {domain}. Company and sponsor intelligence on EventPixels.`; else generic |
| Canonical | unchanged |

---

## 1. Event page examples

### 1. BTC Prague 2026

| | |
|--|--|
| **Canonical** | `https://app.eventpx.com/events/btc-prague-2026` |
| **Current title** | `BTC Prague 2026` → doc: `BTC Prague 2026 \| EventPixels` |
| **Current description** | `BTC Prague 2026 — Prague, Czech Republic. View sponsors and event intelligence on EventPixels.` |
| **Proposed S1 title** | `BTC Prague 2026` → same document title |
| **Proposed S1 description** | `BTC Prague 2026 — Prague, Czech Republic. Jun 11–13, 2026. Sponsors and event intelligence on EventPixels.` |
| **Why better** | Adds precise dates so search/social snippets distinguish 2026 from 2025/2027 editions without opening the page. |

### 2. Consensus Miami 2026

| | |
|--|--|
| **Canonical** | `https://app.eventpx.com/events/consensus-miami-2026` |
| **Current title** | `Consensus Miami 2026` |
| **Current description** | `Consensus Miami 2026 — Miami, United States. View sponsors and event intelligence on EventPixels.` |
| **Proposed S1 title** | `Consensus Miami 2026` |
| **Proposed S1 description** | `Consensus Miami 2026 — Miami, United States. May 5–7, 2026. Sponsors and event intelligence on EventPixels.` |
| **Why better** | Date range answers “when is it?” in the SERP; reduces confusion with Consensus Austin/Hong Kong/Toronto URLs. |

### 3. WebX Tokyo 2026

| | |
|--|--|
| **Canonical** | `https://app.eventpx.com/events/webx-tokyo-2026` |
| **Current title** | `WebX Tokyo 2026` |
| **Current description** | `WebX Tokyo 2026 — Tokyo, Japan. View sponsors and event intelligence on EventPixels.` |
| **Proposed S1 title** | `WebX Tokyo 2026` |
| **Proposed S1 description** | `WebX Tokyo 2026 — Tokyo, Japan. Jul 13–14, 2026. Sponsors and event intelligence on EventPixels.` |
| **Why better** | Same slug family as 2023–2025; dates make the 2026 page the obvious pick. |

### 4. Avalanche Summit New York 2026

| | |
|--|--|
| **Canonical** | `https://app.eventpx.com/events/avalanche-summit-new-york-2026` |
| **Current title** | `Avalanche Summit New York 2026` |
| **Current description** | `Avalanche Summit New York 2026 — New York, United States. View sponsors and event intelligence on EventPixels.` |
| **Proposed S1 title** | `Avalanche Summit New York 2026` |
| **Proposed S1 description** | `Avalanche Summit New York 2026 — New York, United States. Sep 16–17, 2026. Sponsors and event intelligence on EventPixels.` |
| **Why better** | Location is already in the title; dates give the snippet incremental information instead of repeating “view sponsors” alone. |

### 5. Bitcoin Las Vegas 2026

| | |
|--|--|
| **Canonical** | `https://app.eventpx.com/events/bitcoin-las-vegas-2026` |
| **Current title** | `Bitcoin Las Vegas 2026` |
| **Current description** | `Bitcoin Las Vegas 2026 — Las Vegas, United States. View sponsors and event intelligence on EventPixels.` |
| **Proposed S1 title** | `Bitcoin Las Vegas 2026` |
| **Proposed S1 description** | `Bitcoin Las Vegas 2026 — Las Vegas, United States. Apr 27–29, 2026. Sponsors and event intelligence on EventPixels.` |
| **Why better** | Separates conference-week timing from similarly named Bitcoin Conference editions (Nashville, etc.). |

### 6. Devcon 8

| | |
|--|--|
| **Canonical** | `https://app.eventpx.com/events/devcon-8-2026` |
| **Current title** | `Devcon 8` |
| **Current description** | `Devcon 8 — Mumbai, India. View sponsors and event intelligence on EventPixels.` |
| **Proposed S1 title** | `Devcon 8` |
| **Proposed S1 description** | `Devcon 8 — Mumbai, India. Nov 3–6, 2026. Sponsors and event intelligence on EventPixels.` |
| **Why better** | Title lacks a year; description currently has place but not when. Dates compensate for ambiguous naming. |

### 7. ETHDenver 2026

| | |
|--|--|
| **Canonical** | `https://app.eventpx.com/events/ethdenver-2026` |
| **Current title** | `ETHDenver 2026` |
| **Current description** | `ETHDenver 2026 — Denver, United States. View sponsors and event intelligence on EventPixels.` |
| **Proposed S1 title** | `ETHDenver 2026` |
| **Proposed S1 description** | `ETHDenver 2026 — Denver, United States. Feb 18–21, 2026. Sponsors and event intelligence on EventPixels.` |
| **Why better** | Multi-year ETHDenver catalog; concrete dates help users pick the correct edition in search results. |

### 8. ETHGlobal Lisbon 2026

| | |
|--|--|
| **Canonical** | `https://app.eventpx.com/events/ethglobal-lisbon-2026` |
| **Current title** | `ETHGlobal Lisbon 2026` |
| **Current description** | `ETHGlobal Lisbon 2026 — Lisbon, Portugal. View sponsors and event intelligence on EventPixels.` |
| **Proposed S1 title** | `ETHGlobal Lisbon 2026` |
| **Proposed S1 description** | `ETHGlobal Lisbon 2026 — Lisbon, Portugal. Jul 24–26, 2026. Sponsors and event intelligence on EventPixels.` |
| **Why better** | City+brand series produces many near-duplicate pages; schedule is the best differentiator. |

### 9. Digital Asset Summit New York 2026

| | |
|--|--|
| **Canonical** | `https://app.eventpx.com/events/digital-asset-summit-new-york-2026` |
| **Current title** | `Digital Asset Summit New York 2026` |
| **Current description** | `Digital Asset Summit New York 2026 — New York, United States. View sponsors and event intelligence on EventPixels.` |
| **Proposed S1 title** | `Digital Asset Summit New York 2026` |
| **Proposed S1 description** | `Digital Asset Summit New York 2026 — New York, United States. Mar 24–26, 2026. Sponsors and event intelligence on EventPixels.` |
| **Why better** | Distinguishes NY / London / Asia DAS pages that otherwise share the same marketing phrase. |

### 10. Future Blockchain Summit 2025

| | |
|--|--|
| **Canonical** | `https://app.eventpx.com/events/future-blockchain-summit-2025` |
| **Current title** | `Future Blockchain Summit 2025` |
| **Current description** | `Future Blockchain Summit 2025 — Dubai, United Arab Emirates. View sponsors and event intelligence on EventPixels.` |
| **Proposed S1 title** | `Future Blockchain Summit 2025` |
| **Proposed S1 description** | `Future Blockchain Summit 2025 — Dubai, United Arab Emirates. Oct 12–15, 2025. Sponsors and event intelligence on EventPixels.` |
| **Why better** | GITEX-adjacent naming is crowded; dates + place make the snippet scannable and year-specific. |

---

## 2. Event series examples

### 1. BTC Prague

| | |
|--|--|
| **Canonical** | `https://app.eventpx.com/events/series/btc-prague` |
| **Current title** | `BTC Prague` |
| **Current description** | `One of Europe’s largest Bitcoin conferences bringing together Bitcoin enthusiasts, developers, and companies. The event focuses exclusively on Bitcoin technology, education, and adoption.` |
| **Proposed S1 title** | `BTC Prague` |
| **Proposed S1 description** | `One of Europe’s largest Bitcoin conferences for enthusiasts, developers, and companies—focused on Bitcoin technology, education, and adoption. 4 editions through 2027.` |
| **Why better** | Keeps curated voice but adds **catalog scale** (edition count / latest year) so the hub page isn’t interchangeable with a single edition SERP. |

### 2. ETHDenver

| | |
|--|--|
| **Canonical** | `https://app.eventpx.com/events/series/ethdenver` |
| **Current title** | `ETHDenver` |
| **Current description** | `The largest Ethereum hackathon and community innovation festival in the world. ETHDenver combines developer competitions, workshops, startup showcases, and Web3 networking.` |
| **Proposed S1 title** | `ETHDenver` |
| **Proposed S1 description** | `The largest Ethereum hackathon and community innovation festival—competitions, workshops, startup showcases, and Web3 networking. 5 editions through 2027.` |
| **Why better** | Signals that EventPixels has a multi-year series page, not only one event URL. |

### 3. Consensus by CoinDesk

| | |
|--|--|
| **Canonical** | `https://app.eventpx.com/events/series/consensus-by-coindesk` |
| **Current title** | `Consensus by CoinDesk` |
| **Current description** | `A globally recognized crypto and blockchain conference organized by CoinDesk. Consensus brings together policymakers, institutions, builders, and investors for discussions on the digital asset industry.` |
| **Proposed S1 title** | `Consensus by CoinDesk` |
| **Proposed S1 description** | `CoinDesk’s global crypto and blockchain conference for policymakers, institutions, builders, and investors. 4 editions through 2026 on EventPixels.` |
| **Why better** | Slightly tighter length plus catalog context; differentiates brand hub from city-year edition pages. |

### 4. Bitcoin Conference

| | |
|--|--|
| **Canonical** | `https://app.eventpx.com/events/series/bitcoin-conference` |
| **Current title** | `Bitcoin Conference` |
| **Current description** | `One of the world’s largest Bitcoin-only conferences attracting industry leaders, developers, and enthusiasts. The event focuses on Bitcoin technology, adoption, regulation, and culture.` |
| **Proposed S1 title** | `Bitcoin Conference` |
| **Proposed S1 description** | `One of the world’s largest Bitcoin-only conferences—technology, adoption, regulation, and culture. 4 editions through 2027.` |
| **Why better** | Edition span clarifies this is the series hub for Vegas/Nashville-style editions. |

### 5. WebX Tokyo

| | |
|--|--|
| **Canonical** | `https://app.eventpx.com/events/series/webx-tokyo` |
| **Current title** | `WebX Tokyo` |
| **Current description** | `Japan’s largest Web3 conference connecting blockchain startups, enterprises, regulators, and investors. The event explores crypto adoption, gaming, AI, and emerging technologies in Asia.` |
| **Proposed S1 title** | `WebX Tokyo` |
| **Proposed S1 description** | `Japan’s largest Web3 conference for startups, enterprises, regulators, and investors—crypto, gaming, AI, and Asian tech. 4 editions through 2026.` |
| **Why better** | Makes hub vs yearly `/events/webx-tokyo-20XX` distinction explicit. |

### 6. ETHGlobal

| | |
|--|--|
| **Canonical** | `https://app.eventpx.com/events/series/ethglobal` |
| **Current title** | `ETHGlobal` |
| **Current description** | `A series of Ethereum hackathons and community events designed for developers and builders. ETHGlobal encourages innovation through collaborative coding, workshops, and project demonstrations.` |
| **Proposed S1 title** | `ETHGlobal` |
| **Proposed S1 description** | `Ethereum hackathons and builder events—collaborative coding, workshops, and project demos. 4 editions through 2026 on EventPixels.` |
| **Why better** | Shorter SERP-friendly cut; edition count underscores multi-city series nature. |

### 7. Digital Asset Summit

| | |
|--|--|
| **Canonical** | `https://app.eventpx.com/events/series/digital-asset-summit` |
| **Current title** | `Digital Asset Summit` |
| **Current description** | `An institutional-focused conference covering digital assets, crypto markets, and blockchain infrastructure. It attracts major investors, financial firms, and industry leaders discussing the future of …` *(full DB text ~216 chars; rendered as-is today)* |
| **Proposed S1 title** | `Digital Asset Summit` |
| **Proposed S1 description** | `Institutional digital assets, crypto markets, and blockchain infrastructure for investors and financial firms. 4 editions through 2026.` |
| **Why better** | Planned ~155-char trim avoids mid-sentence ellipsis in SERPs while keeping institutional angle + catalog scale. |

### 8. Permissionless

| | |
|--|--|
| **Canonical** | `https://app.eventpx.com/events/series/permissionless` |
| **Current title** | `Permissionless` |
| **Current description** | `A developer and community-focused crypto conference centered on DeFi, infrastructure, and decentralized applications. The event is known for technical discussions and startup networking.` |
| **Proposed S1 title** | `Permissionless` |
| **Proposed S1 description** | `Developer- and community-focused crypto conference on DeFi, infrastructure, and dApps—technical talks and startup networking. 5 editions through 2026.` |
| **Why better** | Adds multi-edition proof without losing thematic keywords. |

### 9. Nordic Blockchain Conference

| | |
|--|--|
| **Canonical** | `https://app.eventpx.com/events/series/nordic-blockchain-conference` |
| **Current title** | `Nordic Blockchain Conference` |
| **Current description** | Full curated paragraph (~238 chars) starting `A leading blockchain and Web3 conference in the Nordic region…` |
| **Proposed S1 title** | `Nordic Blockchain Conference` |
| **Proposed S1 description** | `Nordic blockchain and Web3 conference on innovation, regulation, and enterprise adoption—startups, investors, developers, and policymakers. 5 editions through 2027.` |
| **Why better** | Planned length control + edition count; current text can truncate awkwardly past ~155–160 chars. |

### 10. StartmeupHK Festival *(empty curated description)*

| | |
|--|--|
| **Canonical** | `https://app.eventpx.com/events/series/startmeuphk-festival` |
| **Current title** | `StartmeupHK Festival` |
| **Current description** | `StartmeupHK Festival — all events and editions on EventPixels.` |
| **Proposed S1 title** | `StartmeupHK Festival` |
| **Proposed S1 description** | `StartmeupHK Festival — 6 editions through 2024. Event series intelligence on EventPixels.` |
| **Why better** | Replaces a generic filler string with real catalog facts when curation is missing—still honest, more informative. |

---

## 3. Sponsor page examples

### 1. BitGo

| | |
|--|--|
| **Canonical** | `https://app.eventpx.com/sponsors/bitgo` |
| **Current title** | `BitGo` |
| **Current description** | `BitGo. Company and sponsor intelligence on EventPixels.` |
| **Proposed S1 title** | `BitGo` |
| **Proposed S1 description** | `The leading infrastructure provider of digital asset solutions, offering custody, wallets, staking, and trading. BitGo is the first public, federally chartered digital asset bank. Est. 2013.` |
| **Why better** | Uses existing public `short_description` instead of a near-empty generic template (industry field unused in DB). |

### 2. Fireblocks

| | |
|--|--|
| **Canonical** | `https://app.eventpx.com/sponsors/fireblocks` |
| **Current title** | `Fireblocks` |
| **Current description** | `Fireblocks. Company and sponsor intelligence on EventPixels.` |
| **Proposed S1 title** | `Fireblocks` |
| **Proposed S1 description** | `Fireblocks is the world’s most trusted digital asset infrastructure company, empowering organizations of all sizes to build, manage and grow their business on the blockchain.` |
| **Why better** | Distinct commercial positioning in the snippet; current copy is identical in structure for almost every sponsor. |

### 3. Circle

| | |
|--|--|
| **Canonical** | `https://app.eventpx.com/sponsors/circle` |
| **Current title** | `Circle` |
| **Current description** | `Circle. Company and sponsor intelligence on EventPixels.` |
| **Proposed S1 title** | `Circle` |
| **Proposed S1 description** | `Financial Services` *(short_description is thin — S1 should preferably escalate)* → better fallback: `Circle — circle.com. Company and sponsor intelligence on EventPixels.` **or** trim long `description` opening. **Recommended S1 pick:** `Circle — circle.com. Global fintech enabling digital currencies and stablecoin networks. Company and sponsor intelligence on EventPixels.` |
| **Why better** | Thin `short_description` (“Financial Services”) is weak alone; S1 preference order should skip poor short text and use domain + a short public blurb so snippets stay useful. |

### 4. OKX

| | |
|--|--|
| **Canonical** | `https://app.eventpx.com/sponsors/okx` |
| **Current title** | `OKX` |
| **Current description** | `OKX. Company and sponsor intelligence on EventPixels.` |
| **Proposed S1 title** | `OKX` |
| **Proposed S1 description** | `A new alternative for your crypto journey.` |
| **Why better** | Even a short brand line beats the universal default. *(Optional S1 polish: if short text &lt; ~40 chars, append domain for context.)* |

### 5. Ledger

| | |
|--|--|
| **Canonical** | `https://app.eventpx.com/sponsors/ledger` |
| **Current title** | `Ledger` |
| **Current description** | `Ledger. Company and sponsor intelligence on EventPixels.` |
| **Proposed S1 title** | `Ledger` |
| **Proposed S1 description** | `Free from Compromise.` → **Recommended S1 with quality gate:** `Ledger — ledger.com. Company and sponsor intelligence on EventPixels.` *(or first sentence of long description trimmed)* |
| **Why better** | Slogan-only short text is cryptic in SERPs; S1 should apply a **minimum-information gate** (short_description only if it informs; else domain / long-desc extract). |

### 6. TRON DAO

| | |
|--|--|
| **Canonical** | `https://app.eventpx.com/sponsors/tron-dao` |
| **Current title** | `TRON DAO` |
| **Current description** | `TRON DAO. Company and sponsor intelligence on EventPixels.` |
| **Proposed S1 title** | `TRON DAO` |
| **Proposed S1 description** | `TRON is dedicated to building the infrastructure for a decentralized internet.` |
| **Why better** | Conveys mission immediately; current template wastes the indexed URL. |

### 7. crypto.news

| | |
|--|--|
| **Canonical** | `https://app.eventpx.com/sponsors/crypto-news` |
| **Current title** | `crypto.news` |
| **Current description** | `crypto.news. Company and sponsor intelligence on EventPixels.` |
| **Proposed S1 title** | `crypto.news` |
| **Proposed S1 description** | `Your go-to source for all things crypto and web3. #1 source #crypto & #blockchain news` |
| **Why better** | Category clarity for a media sponsor; hashtags optional to strip in a later polish pass. |

### 8. Listing.Help

| | |
|--|--|
| **Canonical** | `https://app.eventpx.com/sponsors/listing-help` |
| **Current title** | `Listing.Help` |
| **Current description** | `Listing.Help. Company and sponsor intelligence on EventPixels.` |
| **Proposed S1 title** | `Listing.Help` |
| **Proposed S1 description** | `№1 Full-Cycle Token Launch & Listing Agency.` |
| **Why better** | States the service category; generic template does not. |

### 9. Ripple

| | |
|--|--|
| **Canonical** | `https://app.eventpx.com/sponsors/ripple` |
| **Current title** | `Ripple` |
| **Current description** | `Ripple. Company and sponsor intelligence on EventPixels.` |
| **Proposed S1 title** | `Ripple` |
| **Proposed S1 description** | `Ripple — ripple.com. Company and sponsor intelligence on EventPixels.` *(short_description is “Ripple partner profile”—treat as non-informative and skip)* |
| **Why better** | Avoids publishing useless placeholder short text; domain fallback still unique vs other sponsors. |

### 10. Solana Foundation

| | |
|--|--|
| **Canonical** | `https://app.eventpx.com/sponsors/solana-foundation` |
| **Current title** | `Solana Foundation` |
| **Current description** | `Solana Foundation. Company and sponsor intelligence on EventPixels.` |
| **Proposed S1 title** | `Solana Foundation` |
| **Proposed S1 description** | `Solana Foundation — solana.com. Company and sponsor intelligence on EventPixels.` *(same skip rule for “partner profile” placeholders)* |
| **Why better** | Domain fallback keeps snippets differetiable until better copy is curated (Phase S5). |

---

## Cross-cutting takeaways for S1 implementation

1. **Events:** Biggest win is appending **date ranges** to descriptions; titles can stay as-is when year is already in the name.  
2. **Series:** When curated copy exists, **trim + lightly append edition count**; when missing, replace the generic “all events and editions” filler with **N editions through YYYY**.  
3. **Sponsors:** Prefer `short_description`, but add a **quality gate**—skip empty, placeholder (“partner profile”), or ultra-thin slogans when a **domain** fallback is clearer.  
4. **Canonical URLs** in these examples do not need to change for S1; they already use `https://app.eventpx.com/...`.  
5. HTML document titles remain `{page title} | EventPixels` via the root template.

---

## Change log

| Date | Note |
|------|------|
| 2026-07-15 | Initial current vs proposed S1 SEO copy examples from live catalog |
