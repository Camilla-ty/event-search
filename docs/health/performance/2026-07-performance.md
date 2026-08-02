# Performance Audit — 2026-07

**Review type:** Performance Audit
**Cadence:** Monthly
**Cycle:** 2026-07
**Date:** 2026-08-02
**Reviewer:** Performance (Automated)
**Baseline:** true
**Status:** Cycle report — remediations update this file; one cycle = one report (do not create separate closeout reports).

> Baseline Performance Health Check under Framework v1.2. No prior Performance report existed, so this run is Baseline. Cadence is **Monthly** per `docs/health/README.md` / `audit-catalog.md` (requested cycle token `2026-07` retained). **No new `PERF` Findings.** Hot-path runtime debt under normal load is already owned by Architecture IDs (`ARC-002`, `ARC-003`, `ARC-004`, `ARC-017`, `ARC-018`) — referenced, not cloned.

---

## Executive summary

First Performance cycle for EventPixels. Scope: runtime speed and wasted work under **normal production load today** — query/SSR cost, caching posture, fan-out, explorer/search paths — not schema redesign, trust-boundary correctness, or 10×–100× ceilings.

Methods: repository inspection of public marketing loaders and middleware; confirmation of `force-dynamic` / `React.cache` posture; read-only magnitude counts via linked Supabase; cross-check of Findings Register before minting PERF IDs.

Net change: **0 new** Findings. **0 resolved**. Under current magnitudes (~7.3k `event_sponsors`, ~4.6k active companies, ~93 editions, 1 published research page), anonymous explorer/detail/home latency and Function cost are dominated by already-tracked Architecture roots: full-table sponsor counts (`ARC-002`), public `force-dynamic` with almost no request dedup (`ARC-004`), middleware `getUser()` breadth (`ARC-017`), sponsor hydration miss path (`ARC-018`), and import full-directory match (`ARC-003`). This baseline records measured/current evidence against those IDs rather than cloning them under `PERF`.

Strengths: paginated `sponsor_discovery_page` RPC; `company_sponsor_stats` used on several discovery/detail paths; edition-scoped public sponsor tier paging; hourly sitemap `revalidate`; Event Brand destination index uses `React.cache()`; admin alias search no longer full-loads companies (retired `SCALE-001`).

---

## Surfaces in scope

| Surface | Notes |
|---|---|
| Public SSR | Home, `/events`, `/events/[id]`, `/sponsors`, `/sponsors/[slug]`, topic×region hubs, series/venue/topics |
| Hot queries | `getSponsorCountsByEditionIds`, discovery RPC, public roster helpers |
| Middleware | `src/lib/supabase/middleware.ts` / root matcher |
| Caching | `force-dynamic` vs `revalidate` / `React.cache` |
| Magnitudes | Live counts 2026-08-02 (read-only) |

**Exclusions:** Implementing query/cache fixes; Vercel dashboard p95 export (unavailable this cycle); speculative micro-optimizations; schema redesign (`DB`); future-only ceilings (`SCALE`).

---

## Cross-audit references (existing Findings — not duplicated)

These are the primary performance-relevant roots under normal load. PERF adds current evidence only.

| ID | Topic | PERF evidence this cycle (observation) |
|---|---|---|
| `ARC-002` | Hot-path full-table sponsor counts | Still present: `getSponsorCountsByEditionIds` paginates **all** `event_sponsors` (`event_editions_id` only) then filters in JS (`src/lib/queries/companies.ts`). ~7,342 rows today. Callers include event explorer, discover home, topic hubs, `getTotalSponsorCount` (event detail / metadata). |
| `ARC-004` | `force-dynamic`; no ISR; no request dedup | Marketing pages still export `force-dynamic` (home, events, sponsors, hubs, series, venues, topics). Near-zero `React.cache()` under `(marketing)` — exception: `getEventBrandPublicDestinationIndex`. Metadata + page body re-load patterns amplify `ARC-002` on event detail. |
| `ARC-017` | Middleware `getUser()` breadth | `updateSession` still awaits `supabase.auth.getUser()` on the broad middleware matcher (`src/lib/supabase/middleware.ts`). |
| `ARC-018` | Double-path sponsor company hydration | `mergeCompaniesOntoEventSponsorLinks` still session batch then admin miss-fill (`companies.ts`) — extra round-trips on public roster paths. |
| `ARC-003` | Import full-directory match | Unchanged structural cost on sponsor/exhibitor/PA match under normal batch sizes; not re-measured as PERF. |
| `SCALE-001` | Retired alias full-load | Closed — admin alias search uses RPC; not reopened. |

---

## Findings

*No new PERF Findings this cycle.*

Primary hot-path debt is already tracked under Architecture. Minting parallel `PERF-*` IDs for the same roots would violate cross-audit ownership (`audit-catalog.md` / Framework v1.2). Future PERF cycles should add latency/cost deltas against the IDs above, or open a PERF Finding only when a **distinct** untracked runtime root appears.

---

## Observations (not tracked)

### Strengths

- Sponsor discovery uses server-side paginated RPC (`sponsor_discovery_page`) rather than full-catalog client match.
- `company_sponsor_stats` is consumed on sponsor detail / hub eligibility / sitemap indexability paths (contrast: edition count helpers still bypass it — `ARC-002`).
- Public sponsor tier roster uses edition-scoped selects, SQL counts, and `.range` paging (`publicSponsorRoster.ts`).
- `sitemap.ts` uses `revalidate = 3600` (avoids per-hit rebuild).
- `getEventBrandPublicDestinationIndex` is request-memoized via `React.cache()`.
- Admin company alias search no longer loads all active companies (`SCALE-001` resolved).

### Report-only notes (amplifiers / under-track)

- **Event detail metadata + page** both need sponsor totals → can run `getTotalSponsorCount` / count path twice per request when undeduped (`ARC-004` × `ARC-002`).
- **Topic×region hub** always-admin graph + sponsor counts — runtime dominated by `ARC-002`/`ARC-004`; trust aspect remains `ARC-001`.
- **Sitemap research gating** may call hub loaders sequentially; with **1** published research page today, under-track (revisit if published hubs grow).
- **Explorer edition hydrate** reloads the small editions set (~93) per navigation — acceptable today; not a Finding beside `ARC-002`.
- **Rejected without Finding:** aesthetic code-splitting, speculative CDN tuning without path evidence, cloning ARC IDs under PERF, “will hurt at 100×” without current pain (`SCALE`).

### Limitations

- No Vercel Function duration / p95 export this cycle; evidence is code-path + catalog magnitudes + prior Architecture write-ups.
- No browser waterfall capture in this run.
- Cadence Monthly; cycle token `2026-07` as requested (review date 2026-08-02).

---

## Change log

| Date | Note |
|------|------|
| 2026-08-02 | Baseline Performance Audit published. **0** new `PERF` Findings. Cross-referenced `ARC-002`/`003`/`004`/`017`/`018`; noted retired `SCALE-001`. Cadence Monthly; cycle token `2026-07` as requested. |
