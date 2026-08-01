# Audit — Same-Brand Event Company Public Profile Redirect

**Status:** Documentation-only (no implementation authorized)  
**Date:** 2026-08-01  
**Test case (conceptual only):** Singapore FinTech Festival  
- Series: `/events/series/singapore-fintech-festival` (linked `company_profile_id`)  
- Company: `/sponsors/singapore-fintech-festival`  
- Proposed destination: `/events/series/singapore-fintech-festival?tab=participated`

**Related:** [ADR-004](../adr/ADR-004-event-series-company-same-brand-link.md) · [Participated Events placement audit](./participated-events-tab-placement-audit.md) · [Same-brand architecture audit §12](./event-series-company-same-brand-architecture-audit.md) · [Phase scope §7.4](../phase-event-series-company-same-brand-scope.md) · [Indexability policy](../plans/indexability-policy.md)

---

## 1. Verdict

**Do not adopt a default public redirect (or hard hide) from same-brand Company `/sponsors/...` pages to the Series Participated Events tab.**

ADR-004 V1 explicitly keeps **two public destinations** and defers “single shared public URL / merged indexability.” The Participated Events Series-hub prototype already surfaces brand sponsorship elsewhere; collapsing the Company URL into that tab overloads Series with Company identity, breaks a wide link graph, and drops Company-only surfaces (notably exhibitor history on the sponsor page).

**Safest experiment order (if product still wants to try):**

1. **Keep both pages** (status quo + Series Participated Events) — preferred  
2. **Soft SEO only:** keep `200` Company page; optional **noindex** + sitemap exclude for an **allowlisted** test company — reversible, links still work  
3. **Temporary allowlisted redirect (SFF only)** — only as a short UX probe with hard fallbacks; not a catalog-wide rule  
4. **Permanent redirect / 404 hide** — **not recommended** without a new ADR amending ADR-004

---

## 2. Affected routes, components, and data paths

### 2.1 Direct `/sponsors/[slug]`

| Item | Today |
|------|--------|
| Page | `src/app/(marketing)/sponsors/[slug]/page.tsx` |
| Load | `getSponsorDetailData` → company by slug; restricted/missing → **404** |
| Render | Organization JSON-LD + `SponsorDetailView` + exhibitor history (independent loader) |
| Same-brand | `sameBrandSeriesLink` still loaded; **header chrome hidden** (prototype) |
| Canonical | Self `/sponsors/{slug}` via `createPageMetadata` |

A redirect would need to run **before** notFound/render, after resolving `company_profile_id` reverse lookup (Series where `company_profile_id = company.id`).

### 2.2 Roster and discovery link graph

All of these emit `/sponsors/...` today via `buildSponsorProfilePath` (or equivalent):

| Surface | Path / note |
|---------|-------------|
| Edition Sponsors roster | `PublicSponsorRosterRow` |
| Edition sponsor search | `publicSponsorSearch` |
| Exhibitors roster | `PublicExhibitorRosterRow` |
| Organizers list | `EventOrganizerListItem` (restricted_at mapping gap pre-exists) |
| Partner Alumni | `EventPartnerAlumniSection` |
| Sponsor Discovery cards | `mapSponsorDiscoveryPublicRow` (`href`) |
| Global sponsor suggest | `SponsorSearchCombobox` → `router.push` |
| Topic×Region hubs | `TopicRegionHubView` |
| Event / Organization JSON-LD | `eventJsonLd`, `organizationJsonLd` |
| Admin “view public” | raw `/sponsors/{slug}` |

Centralizing “linked Event Company → Series URL” in `buildSponsorProfilePath` would retarget **every** role join and discovery card — not only direct profile visits. That is a much larger product change than a page-level redirect.

### 2.3 SEO / sitemap / indexability

| Gate | Company today | Series today |
|------|---------------|--------------|
| Indexable when | Not restricted **and** sponsored editions ≥ 1 | Not merged (active/discontinued ok) |
| Sitemap | Active, unrestricted, slug, ≥1 sponsorship | Non-merged series |
| Robots | Per-page via `getCompanyIndexability` | Via series access |

SFF-class linked pairs can be **two indexable sitemap URLs**. Redirect-without-sitemap/robots updates creates duplicate/orphan signals. Closest existing redirect model is **merged Series** (`permanentRedirect` + noindex source), **not** restricted companies (404) or unused `company_slug_redirects`.

### 2.4 Admin / internal Company access

| Surface | Impact of public redirect |
|---------|---------------------------|
| `/admin/companies/[id]` | Must remain; link/unlink same-brand, domains, merge |
| Role joins (`event_sponsors`, organizers, exhibitors, PA) | **Must keep Company FK** — redirect is public-routing only |
| Imports / matching | Unchanged (Company identity) |

### 2.5 Organizer / Exhibitor / Partner uses of the same Company

Same Company ID can appear as sponsor on foreign editions **and** as organizer/exhibitor/PA elsewhere. Public hrefs still point at `/sponsors/...`. Retargeting those links to `?tab=participated` mislabels “this organization” as “this Event Brand’s participated events,” which is wrong for pure organizer-only or exhibitor-only contexts.

### 2.6 Restricted / merged / unavailable Series fallback

| Case | Required behavior if any redirect exists |
|------|------------------------------------------|
| Series missing / tombstone / unresolved merge | **Do not** redirect into a dead Series; keep Company page or 404 by existing company rules |
| Series discontinued but public | Redirect target may still work; product must accept discontinued hub as destination |
| Company restricted | Today: no public profile / null path — leave as-is |
| Company merged | Public redirect table unused → 404; do not invent same-brand redirect onto loser |
| Participated tab empty | Redirecting to `?tab=participated` when tab is hidden falls back to Events — weak UX |

### 2.7 Manual per-Company override options (design space only)

| Option | Pros | Cons |
|--------|------|------|
| Allowlist (SFF id/slug only) | Smallest probe | Ops debt; easy to forget |
| Column e.g. `public_profile_mode` | Explicit Admin control | **New schema** — out of current ADR V1; user/phase said not to add yet |
| “Hide public profile” flag | Like soft restricted without roster scrub | Easy to confuse with `restricted_at` |
| No flag — global rule for all `company_profile_id` | Simple | Highest blast radius; conflicts with ADR two-destination model |

---

## 3. Risks

| Risk | Severity |
|------|----------|
| Violates ADR-004 “two SEO documents / no single shared URL in V1” without a new ADR | High |
| Roster/discovery/JSON-LD still advertise `/sponsors/...` while page 301s — or worse, all hrefs jump to Series and blur Company vs Event Brand | High |
| Loses Company-page exhibitor history and sponsor-page framing | High |
| `?tab=participated` is a weak canonical destination (tab query, hide-when-empty) | Medium |
| Organizer-only linked brands (TOKEN2049-class) may be **noindex** on Company but indexable on Series — redirect rules must not assume sponsorship | Medium |
| Permanent redirect hard to reverse in search consoles | Medium |
| Confuses “Participated Events” (brand as sponsor elsewhere) with “Company profile” (organization identity) | High |
| Pre-existing organizer `restricted_at` drop amplified if href rewriting is naive | Low–medium |

---

## 4. Redirect vs noindex vs simple public hiding

| Approach | What it does | Safety |
|----------|--------------|--------|
| **Keep both + Series tab** | Status quo prototype | **Safest** |
| **noindex + sitemap exclude** (allowlisted) | Page still 200; crawlers de-emphasize | **Safer SEO probe**; links intact |
| **Soft hide** (404 without restricted_at) | Breaks bookmarks & unupdated hrefs | **Unsafe** unless all builders change |
| **Temporary 302/307 allowlist → Series `?tab=participated`** | UX probe for direct visits only | **Conditional** — only with Series-available checks + leave roster hrefs on `/sponsors` or accept double hop |
| **308/301 global for all linked Companies** | Catalog-wide URL merge | **Not recommended** now |

**Recommendation:** Prefer **no redirect**. If measuring “do users need the Company page?”, use analytics on SFF + optional **noindex allowlist** before any redirect. If a redirect prototype is insisted on, use **SFF allowlist + temporary redirect + Series public OK check + fallback to Company 200 + do not rewrite roster hrefs in v0**.

---

## 5. Recommended reversible prototype (if exploring further)

**Preferred prototype:** none beyond current Series Participated Events tab + both profiles live.

**Next-safest SEO-only probe (still docs-gated to implement later):**

1. Allowlist Company `f85bff6d-…` / slug `singapore-fintech-festival` only  
2. Keep page rendering **or** serve a thin “This brand’s public event profile lives on …” interstitial with link to Series hub (not necessarily `?tab=participated`)  
3. Emit **noindex** + exclude from company sitemap for that id  
4. Do **not** change `buildSponsorProfilePath` yet  
5. Kill-switch: remove allowlist  

**Redirect probe (higher risk, only if product explicitly chooses):**

1. Same allowlist  
2. On `/sponsors/[slug]` only: if reverse same-brand Series is publicly OK → **302** to Series hub (prefer bare hub or `?tab=participated` only if tab guaranteed visible)  
3. Else render Company page as today  
4. Sitemap/robots: noindex sponsor URL while redirected  
5. Leave roster links pointing at `/sponsors/...` (one hop) initially — avoids rewriting every consumer  
6. Time-box and measure; do not 301 until ADR amended  

---

## 6. Required tests (when/if implemented)

| Layer | Cases |
|-------|--------|
| Allowlist redirect | SFF slug → expected Series URL; non-allowlisted linked company **unchanged** |
| Fallback | Linked but Series merged/tombstone/missing → Company page or controlled 404 — **never** broken Series |
| Empty participated | Redirect target still usable (hub Events) or skip redirect |
| Restricted company | Still 404 / null path — no leak |
| SEO | Metadata robots + sitemap exclusion for allowlisted id; Series indexability unchanged |
| Regression | Discovery/roster still return `/sponsors/...` until product opts into href rewrite |
| Admin | Company admin + same-brand link/unlink unaffected |
| Negative | Unlinked companies; random sponsors; `/companies` → `/sponsors` rename redirect still works |

---

## 7. What must remain out of scope

- Batch-linking more same-brand candidates for this experiment  
- Schema `public_profile_mode` (or equivalent) until product + ADR say so  
- Rewriting all `buildSponsorProfilePath` consumers in the first probe  
- Hiding/redirecting Company profiles **globally** for every `company_profile_id`  
- Merging Series + Company canonicals / JSON-LD into one entity  
- Changing Sponsor Discovery ranking or global search  
- Using `restricted_at` as a stand-in for “Event Company public hide”  
- Implementing or consuming `company_slug_redirects` as part of this probe (separate debt)  
- Unlinking SFF or modifying live role joins for the audit  

---

## 8. Genuine product decisions

1. **Amend ADR-004?** Is a single public URL for same-brand Event Companies an intentional V2, or still deferred?  
2. **What is the Company page for** after Participated Events exists — organization identity, sponsorship+exhibitor history, or disposable shell?  
3. **Redirect destination:** Series hub root vs `?tab=participated` vs interstitial?  
4. **Href policy:** rewrite roster/discovery links, or only intercept direct `/sponsors/[slug]`?  
5. **Scope:** allowlist one brand vs all linked Companies?  
6. **SEO:** 302+noindex vs 301 vs noindex-without-redirect?  
7. **Organizer-only linked brands** (0 sponsorships): redirect, keep noindex Company, or Series-only?  
8. **Exhibitor history** on Company page — acceptable loss or blocker?  
9. **Override mechanism:** code allowlist vs Admin flag (schema)?  
10. **Success criteria** for any probe (bounce, search consoles, support tickets) before expanding  

---

## 9. Document history

| Date | Change |
|------|--------|
| 2026-08-01 | Initial documentation-only audit (SFF conceptual test case; no implementation) |

---

**End of audit.**
