# SEO / GEO / Discoverability Documents Inventory

**Status:** Audit inventory only — no implementation  
**Date:** 2026-07-15  
**Scope:** All repository planning docs, ADRs, operations, backlog, roadmaps, and architecture notes related to SEO, GEO, indexing, metadata, sitemaps, structured data, search/AI visibility, and content generation. Code paths are listed only when documentation references them.

**Search coverage:** `docs/`, `docs/plans/`, `docs/adr/`, `docs/operations/`, `docs/architecture/`, `docs/implementation/`, `docs/backlog.md`, root/project README-style docs, plus targeted code-comment / script references named by plans.

---

## Executive finding

SEO planning is concentrated in **three dedicated docs under `docs/plans/`** (foundation, gap audit, copy examples), plus **constraint and entity-scope docs** that affect what can be indexed. There is **no dedicated GEO / AI-visibility plan**, **no `docs/audits/` SEO history before this file**, and **no SEO items in `docs/backlog.md` or `docs/implementation-roadmap.md`**. `docs/README.md` does not yet index the SEO plans.

---

## 1. Primary SEO documents

### 1.1 `docs/plans/seo-foundation.md`

| Field | Value |
|-------|--------|
| **Title** | SEO Foundation |
| **Status** | **Draft / living plan** — labeled “Foundation started (crawl basics live); rich SEO and scale architecture planned” (not marked Approved) |
| **Purpose** | Long-horizon architecture for public discovery: metadata system, canonicals, `noindex`, JSON-LD, OG/Twitter, sitemap scale-out, SEO health monitoring, and AI-assisted content policy (phases S0–S6). |
| **Key decisions already made** | Production origin always `https://app.eventpx.com` (never `*.vercel.app`); shared `createPageMetadata`; event/series/sponsor metadata templates; canonical slug paths; `noindex` cases (not-found, restricted, merged, auth/admin); JSON-LD types (`Event`, `Organization`, `WebSite`); sitemap inclusion/exclusion rules and ~40–45k shard threshold; AI copy is draft-assist only with human accept; SEO must reflect anon-visible data only. |
| **Related documents** | `seo-gap-audit.md`, `seo-copy-examples.md`, `protection-v1.md`; code: `src/lib/metadata/site.ts`, `src/app/sitemap.ts`, `src/app/robots.ts` |
| **Overlaps / conflicts** | Authoritative phase roadmap — overlaps with gap audit (progress tracking) and copy examples (S1 template illustration). Conflicts none documented; implementation lag is tracked in gap audit, not contradicted here. |

### 1.2 `docs/plans/seo-gap-audit.md`

| Field | Value |
|-------|--------|
| **Title** | SEO Foundation — Gap Audit |
| **Status** | **Audit / draft point-in-time** — “Audit only (no code changes)”; dated 2026-07-15 |
| **Purpose** | Compare live code to `seo-foundation.md`; classify Implemented / Partial / Missing; recommend next work order. |
| **Key decisions already made** | None new — **records** S0 largely complete; S1 highest ROI next; JSON-LD/`noindex`/health/`sharding`/AI workflow missing or deferred; industry column referenced in sponsor metadata code but not present in DB. |
| **Related documents** | `seo-foundation.md`, `protection-v1.md` |
| **Overlaps / conflicts** | Intentionally mirrors foundation section-for-section. Will **drift** if foundation updates without re-audit. Complements (does not replace) copy examples. |

### 1.3 `docs/plans/seo-copy-examples.md`

| Field | Value |
|-------|--------|
| **Title** | SEO Copy Examples (Current vs Proposed S1) |
| **Status** | **Examples only / illustrative** — explicitly “no implementation” |
| **Purpose** | Show current vs proposed S1 metadata titles/descriptions for real events, series, and sponsors. |
| **Key decisions already made** | Illustrates S1 templates (dates in event descriptions; series edition-count enrichment; sponsor `short_description` / domain preference). Documents that live sponsor **industry** is not a real DB column. |
| **Related documents** | `seo-foundation.md`, `seo-gap-audit.md` |
| **Overlaps / conflicts** | Overlaps foundation §1 templates. **Gap:** examples focus on **metadata**, not on-page body summaries from structured fields (dates, sponsor counts, tiers, last reviewed) — incomplete vs full “content depth” philosophy in foundation §6. |

---

## 2. Constraint and adjacent product documents

### 2.1 `docs/plans/protection-v1.md`

| Field | Value |
|-------|--------|
| **Title** | Protection v1 |
| **Status** | **In progress / approved for security work** — P1/P2 implemented notes; not an SEO plan |
| **Purpose** | Data-access and public-surface protection (restricted companies, discovery RPC, RLS). |
| **Key decisions already made (SEO-relevant)** | Restricted companies excluded from public discovery; SEO/metadata/schema must not leak gated or restricted data; public sponsor discovery remains intentionally public within policy. |
| **Related documents** | `seo-foundation.md` (explicit link), gap audit |
| **Overlaps / conflicts** | Soft conflict risk if SEO copy/schema asserts full sponsorship history while Protection keeps lists gated — foundation already forbids this. |

### 2.2 `docs/venue-design.md` (+ `docs/phase-venue-scope.md`, `docs/venue-migration-design.md`)

| Field | Value |
|-------|--------|
| **Title** | Venue Design / Phase Venue v1 / Venue Migration |
| **Status** | **Approved / implemented** |
| **Purpose** | Venue entity model and public UX. |
| **Key decisions already made (SEO-relevant)** | **No standalone `/venues/...` public pages**; city remains geographic canonical for discovery; SEO metadata may keep city-based location strings; venue content lives on edition **Venue** tab only. |
| **Related documents** | `phase-1.1-location-scope.md`, SEO foundation (Event `location` may include venue when public) |
| **Overlaps / conflicts** | Foundation JSON-LD may include venue on `Event` **when public** — consistent with tab content, not with dedicated venue URLs. **Venue SEO category = out of scope by product decision.** |

### 2.3 `docs/phase-1.1-location-scope.md`

| Field | Value |
|-------|--------|
| **Title** | Phase 1.1 — Location Usability |
| **Status** | **Implemented / approved** |
| **Purpose** | Location display formatter + admin Add City. |
| **Key decisions already made** | `formatLocationLabel` rules (US city+state; non-US city+country; city-state collapse). Explicit consumers include **event edition detail + SEO metadata**. |
| **Related documents** | Venue design; SEO metadata templates |
| **Overlaps / conflicts** | Defines the location string SEO should use; foundation assumes this formatter. No conflict. |

### 2.4 `docs/phase-organizer-scope.md` (+ organizer design / UX amendment)

| Field | Value |
|-------|--------|
| **Title** | Phase — Organizer v1 Scope (and related) |
| **Status** | **Implemented / approved** |
| **Purpose** | Edition organizers as companies. |
| **Key decisions already made (SEO-relevant)** | Explicitly **unchanged**: global search and **SEO metadata** when organizers shipped; no organizer fields on explorer/series hub. |
| **Related documents** | SEO foundation (optional `organizer` in Event JSON-LD later) |
| **Overlaps / conflicts** | Future S2 Event JSON-LD with `organizer` would be a **new** decision vs current “SEO metadata unchanged” — needs review before implementation. |

### 2.5 `docs/phase-edition-last-reviewed-automation-scope.md`

| Field | Value |
|-------|--------|
| **Title** | Phase — Edition Last Reviewed Automation |
| **Status** | **Implemented / approved** |
| **Purpose** | When `last_reviewed_at` auto-updates. |
| **Key decisions already made (SEO-relevant)** | Research metadata freshness on editions; sitemap uses `last_reviewed_at` (fallback `created_at`) for `lastModified` per gap audit. Valuable signal for factual page summaries / trust. |
| **Related documents** | `event-admin-workflow.md`, `project-state.md`, sitemap implementation |
| **Overlaps / conflicts** | Not an SEO plan; inventory relevant because freshness is a crawl/content signal. |

### 2.6 `docs/adr/ADR-002-company-website-canonical-identity.md` (+ `docs/phase-company-website-identity-scope.md`, `docs/adr/ADR-001-company-identity.md`)

| Field | Value |
|-------|--------|
| **Title** | ADR-002 — Company website canonical identity (and related) |
| **Status** | **Approved / in product** |
| **Purpose** | One canonical **company website URL** / domain identity — **data model identity**, not HTTP SEO canonicals. |
| **Key decisions already made** | Single `companies.website`; domain derived; alias domains for matching. |
| **Related documents** | Sponsor SEO description fallbacks (domain / website_label in foundation) |
| **Overlaps / conflicts** | Terminology clash: “canonical” here ≠ `rel=canonical`. Easy confusion when inventorying “Canonical URLs.” |

### 2.7 `docs/architecture/navigation-and-data-fetching.md`

| Field | Value |
|-------|--------|
| **Title** | Navigation & data fetching |
| **Status** | **Architecture guidance** (checklist items still open) |
| **Purpose** | Navigation classes and fetch policy. |
| **Key decisions already made (SEO-relevant)** | Checklist: cold-load URLs must still render correct server HTML for **SEO / share links**. |
| **Related documents** | Marketing SSR routes; metadata generators |
| **Overlaps / conflicts** | Reinforces SSR metadata; not an SEO strategy. |

### 2.8 `docs/admin-information-architecture.md`

| Field | Value |
|-------|--------|
| **Title** | Admin Information Architecture |
| **Status** | **Approved (admin IA)** |
| **Purpose** | Admin nav, journeys, **in-app** search discoverability. |
| **Key decisions already made** | Global admin search across editions/series/companies — **not** Google/organic SEO. |
| **Related documents** | Implementation roadmap |
| **Overlaps / conflicts** | “Discoverability” here is admin UX, not crawl visibility. |

### 2.9 `docs/backlog.md` / `docs/implementation-roadmap.md` / `docs/README.md` / `docs/project-state.md`

| Field | Value |
|-------|--------|
| **Titles** | Product Backlog; Implementation Roadmap; Project documentation index; Project State |
| **Status** | Living / approved delivery docs |
| **Purpose** | Delivery tracking and future ideas. |
| **Key decisions already made (SEO-relevant)** | **None for SEO** — no SEO phase in roadmap; backlog has no SEO/GEO items; README does not list `docs/plans/seo-*.md`; project-state does not summarize SEO S0. |
| **Related documents** | Would be natural homes to link foundation once SEO is scheduled |
| **Overlaps / conflicts** | **Discovery gap:** SEO work exists only under `docs/plans/` and is easy to miss from README/roadmap. |

### 2.10 `docs/operations/*`

| Field | Value |
|-------|--------|
| **Paths** | `backup-policy.md`, `disaster-recovery.md`, `backup-github-drive-setup.md` |
| **Status** | Operations |
| **Purpose** | Backup/DR — not SEO. |
| **SEO finding** | **No** Search Console ops runbooks, sitemap monitoring, or crawl-failure alerting docs. Foundation §5.3 assumes GSC externally. |

---

## 3. Documentation-referenced code (not planning docs)

Listed because plans cite them as system of record for current crawl behavior:

| Path | Role | Status vs plans |
|------|------|-----------------|
| `src/lib/metadata/site.ts` | `PRODUCTION_SITE_ORIGIN`, `getSiteUrl`, `createPageMetadata`, root OG/Twitter | S0 host guards **implemented**; no `robots`/`images` helper inputs yet |
| `src/app/sitemap.ts` | Single sitemap (~3.5k URLs), hubs + editions + series + sponsors | S0 **implemented**; sharding **not** |
| `src/app/robots.ts` | `Allow: /`, sitemap URL | S0 **implemented**; no path Disallow strategy documented as done |
| `scripts/verify-sitemap.ts` | Local sitemap entry count helper | Ops convenience; not a health dashboard |
| Public `generateMetadata` routes | `/`, `/events`, `/events/[id]`, `/events/series/[slug]`, `/sponsors`, `/sponsors/[slug]`, `/topics/[slug]`, `/exhibitors`, login/signup/admin | Partial S1 templates; topics/exhibitors not detailed in foundation phases |
| `src/app/cities/[slug]/page.tsx` | Legacy city route → redirect `/events` | City SEO destination effectively **retired** |

---

## 4. Documents **not found**

| Expected topic | Result |
|----------------|--------|
| Dedicated **GEO / generative-engine / AI answer visibility** plan (`llms.txt`, AI crawler policy, citation strategy) | **None** |
| `docs/audits/*` prior SEO audits | Folder did not exist before this inventory |
| Search Console ops playbook under `docs/operations/` | **None** |
| Venue public SEO strategy | Explicitly **rejected** in venue design |
| Standalone company SEO distinct from `/sponsors/{slug}` | Foundation treats sponsor pages as company SEO surface |
| Content-generation detailed scope (S5) beyond foundation §6 | **None** (policy only in foundation) |
| SEO entries in `docs/backlog.md` | **None** |

---

## Summary table

| Category | Documents Found | Status |
|----------|-----------------|--------|
| **Metadata** | `seo-foundation.md` §1; `seo-gap-audit.md` §1; `seo-copy-examples.md`; `phase-1.1-location-scope.md` (formatter); code `site.ts` + route generators | Plan draft; S0/partial S1 live; examples illustrative |
| **Sitemap** | `seo-foundation.md` §4; `seo-gap-audit.md` §7; code `sitemap.ts`, `verify-sitemap.ts` | Single-file live; sharding planned not needed yet |
| **Structured Data** | `seo-foundation.md` §2 + S2/S6; `seo-gap-audit.md` §4 | Planned; **not implemented** |
| **Indexability** | `seo-foundation.md` §1.6; gap audit §3; `robots.ts`; Protection (restricted exclusion) | robots allow-all live; **`noindex` missing** |
| **Canonical URLs** | Foundation §1.5; gap audit §2; `site.ts` host policy | Host/slug canonicals live; merged-entity successor policy **missing** |
| **Search Console** | Mentioned in foundation current state + §5.3 | Stated “Configured”; **no ops doc** in repo |
| **GEO / AI Visibility** | — | **None found** |
| **Content Generation** | Foundation §6 + S5; gap audit §9; copy examples (meta only) | Policy drafted; workflow **missing**; body summaries not documented |
| **Event SEO** | Foundation §1.2 + Event JSON-LD; copy examples §1; location/organizer notes | Templates planned; partial metadata live |
| **Sponsor SEO** | Foundation §1.4 + Organization JSON-LD; copy examples sponsors | Partial live; industry field mismatch documented |
| **Company SEO** | Same as sponsor public profile path; ADR-002 identity (non-SEO “canonical”) | Identity ADRs approved; SEO = sponsor route |
| **Venue SEO** | `venue-design.md` / `phase-venue-scope.md` | **No public venue SEO pages** (locked) |
| **Monitoring / Audits** | Foundation §5 + S3; `seo-gap-audit.md` (this planning audit); this inventory | Health reporting **missing**; gap audit is doc-only |

---

## Answers

### 1. What SEO/GEO decisions have already been finalized?

**Finalized enough to treat as product/engineering constraints** (from foundation + shipped S0 + approved entity scopes):

- Public SEO host is **`https://app.eventpx.com`**; never emit Vercel preview hosts in canonical/OG.
- Shared metadata helper + title template `%s | EventPixels`.
- Public entity URL shapes: `/events/{slug}`, `/events/series/{slug}`, `/sponsors/{slug}`; hubs `/`, `/events`, `/sponsors`.
- Sitemap v1: single file including those hubs + public editions/series + active non-restricted sponsors; hourly revalidate; exclude empty slugs / restricted companies.
- `robots.txt`: allow `/`, point at production sitemap.
- SEO output must match **anonymous-visible** content; no gated sponsorship lists in public snippets/schema.
- Restricted companies stay out of public catalog/sitemap (aligned with Protection).
- **No public `/venues/...` SEO destinations**; city is geographic display/canonical for edition location strings.
- Location strings for metadata follow `formatLocationLabel`.
- AI-generated public copy (if ever) requires human accept — no silent publish (policy in foundation; not built).
- Google Search Console is asserted as configured (external; not documented in ops/).

**GEO / AI crawler / answer-engine visibility:** nothing finalized (no docs).

### 2. What SEO/GEO decisions are still missing?

- **`noindex` vs robots Disallow** for login/signup/admin (and soft-404s) — planned but not product-locked in code or ops.
- **Merged series/company** SEO: successor canonical vs `noindex` + redirects.
- **Raster default OG** asset + optional `twitter:site` handle.
- Exact **JSON-LD property mapping** QA checklist and what optional fields (venue, organizers) ship in S2.
- **Sponsor quality filter** for sitemap (all active vs “has signal”).
- **On-page auto-summary** rules (dates, location, sponsor count, tier count, last reviewed) — philosophy exists; no approved template doc or examples in `seo-copy-examples.md`.
- **S5 content fields** for editions (curated long description), acceptance UX, provenance schema, banned-claims list.
- Topics / exhibitors / other marketing routes: inclusion in sitemap and metadata strategy.
- Legacy **city redirect** pages: indexing/redirect SEO policy for `/cities/{slug}`.
- Entire **GEO / AI visibility** stack: crawler allowlists, `llms.txt`, citation-friendly summaries, bot-specific robots.
- Search Console: property ownership, sitemap submit/resubmit process, ownership of coverage monitoring.
- Promotion of SEO into README / roadmap / backlog once scheduled.

### 3. Which documents appear outdated or duplicated?

| Document | Issue |
|----------|--------|
| `seo-foundation.md` vs `seo-gap-audit.md` | Duplicated structure by design; gap audit ages quickly if code changes. |
| `seo-copy-examples.md` vs foundation §1 | Duplicate of template rules; useful as examples but incomplete for full content philosophy. |
| ADR-002 “canonical” wording | Overlaps vocabulary with SEO canonicals without being SEO. |
| Venue / older notes mentioning “city pages” | Product city browse is redirected; language in venue/location docs can read outdated for public SEO. |
| `docs/README.md` / roadmap / project-state | Outdated relative to reality — omit SEO S0/S1 plan set entirely. |
| Sponsor metadata “industry” in code + examples note | Product assumption outdated vs schema. |

Nothing is marked **obsolete** officially; closest are **illustrative** copy examples and **point-in-time** gap audit.

### 4. What should be reviewed before implementation begins?

1. **Treat `seo-foundation.md` as the design authority** and reconfirm phase order (gap audit: S1 → S2 → S3 → S4 as needed → S5/S6).
2. **Re-read Protection v1** so S1/S2 never advertise restricted or gated data.
3. **Lock open product choices:** auth page indexing; merged-entity redirects; OG raster asset; whether Event JSON-LD includes venue/organizers; topics/exhibitors sitemap inclusion.
4. **Update or extend copy examples** to cover on-page factual summaries if S1 includes body content — current examples are metadata-only.
5. **Reconcile sponsor description sources** (`short_description` vs dead `industry` reference).
6. **Index SEO plans from `docs/README.md`** (and optionally backlog/roadmap) so work isn’t orphaned under `plans/`.
7. **Decide GEO scope separately** — do not assume SEO foundation covers AI-answer visibility.
8. Refresh `seo-gap-audit.md` against tip of `main` immediately before coding so effort estimates match current code.

---

## Change log

| Date | Note |
|------|------|
| 2026-07-15 | Initial inventory of SEO/GEO/discoverability-related documents |
