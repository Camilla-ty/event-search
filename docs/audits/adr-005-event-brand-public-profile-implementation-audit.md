# Audit — ADR-005 Event Brand Public Profile Implementation

**Status:** Documentation-only (no implementation authorized by this document)  
**Date:** 2026-08-01  
**Context:** [ADR-005](../adr/ADR-005-event-brand-public-profile-policy.md) accepted — Series hub is public Event Brand identity; approved Event Brand Company public profiles retire over time  

**Related:** [ADR-004](../adr/ADR-004-event-series-company-same-brand-link.md) · [ADR-005 migration §6](../adr/ADR-005-event-brand-public-profile-policy.md) · [Same-brand redirect audit](./same-brand-company-public-redirect-audit.md) (historical; default dual-destination superseded for **approved** Event Brand Companies) · [Participated Events placement](./participated-events-tab-placement-audit.md) · [Indexability policy](../plans/indexability-policy.md)

---

## 1. Verdict

**Central blast radius is `buildSponsorProfilePath`.** Nearly every public Company link flows through it (or a thin wrapper). Changing that helper without an approval gate would retarget **all** role and discovery surfaces overnight.

**Smallest safe order:** store per-Company public-profile approval first → soft SEO retirement → direct `/sponsors/[slug]` intercept for approved Companies only → then rewrite outbound public hrefs via a new/extended resolver → finally discovery/suggest + JSON-LD cleanup.

**Default link destination for approved Event Brand Companies should be the Series hub** (`/events/series/{slug}`), **not** `?tab=participated`. Participated Events remains a Series-hub *section*; using it as the universal Company-href target mislabels organizer/exhibitor/PA mentions.

**Admin Company pages stay on `/admin/companies/...`.** Do not fold Admin into Series. “View public page” needs an explicit product rule (preview retired public destination vs keep raw Company URL for ops).

**This audit does not authorize schema, code, data, redirects, or commits.**

---

## 2. Resolution policy (recommended)

| Situation | Public destination | Notes |
|-----------|-------------------|--------|
| Normal Company (not Event Brand–approved) | `/sponsors/{slug\|id}` | Unchanged |
| Same-brand linked but **not** public-profile approved | `/sponsors/...` | Link alone ≠ retirement (ADR-005) |
| **Approved** Event Brand Company | `/events/series/{slug}` (bare hub) | Prefer Events default; Participated tab optional deep-link only when product explicitly wants sponsorship history |
| Approved but Series missing / merged unresolved / not public | Keep Company page or 404 by existing company rules | Never invent a dead Series target |
| Restricted Company | `null` / no public link (today) | Unchanged |
| Admin UI | `/admin/companies/{id}` | Unchanged |
| Admin “View public” | **Decide in EB0** | See §6 |

**Do not** point role FKs at Series. Resolution is **URL/routing only**.

---

## 3. Company URL generation

### 3.1 Canonical helper

| Item | Detail | Impact |
|------|--------|--------|
| `buildSponsorProfilePath` | `src/lib/routes/explorerUrls.ts` — `/sponsors/{slug\|id}`; null if restricted | **Critical** — primary rewrite point |
| Options | `allowRestricted?: boolean` — tests only today | Low |

### 3.2 Related helpers

| Helper | File | Produces | Impact if Event Brand–aware |
|--------|------|----------|------------------------------|
| `buildPublicSameBrandCompanyLink` | `src/lib/companies/sameBrandPublicLink.ts` | `{ href, name }` via helper | Medium (UI currently hidden) |
| `loadPublicSameBrandCompanyLinkForSeries` | `src/features/events/server/sameBrandPublicLinks.ts` | Same | Low (Series hub not wiring it) |
| `buildSponsorSearchUrl` | `explorerUrls.ts` | `/sponsors` hub | None (hub stays) |
| `buildSponsorDiscoveryPath` | `sponsorDiscoveryParams.ts` | `/sponsors?...` | None (hub stays) |
| `sponsorDetailHref` | `eventSponsorUtils.ts` | `/sponsors/...` | **None** — dead code |
| Discovery fallback | `mapSponsorDiscoveryPublicRow.ts` | `` `/sponsors/${id}` `` if helper null | **High** — bypasses helper |
| Page metadata strings | `sponsors/[slug]/page.tsx` | canonical `/sponsors/...` | **High** with route retirement |
| Admin View public | `admin/companies/[id]/page.tsx` | raw `/sponsors/${slug}` | **Medium** — must stay intentional |
| `CompanyAdminForm` | display `Public path: /sponsors/...` | Display only | Low (copy may need “retired” note) |
| `next.config.ts` | `/companies` → `/sponsors` | Legacy alias | Low (still lands on Company route) |

### 3.3 Recommended resolver shape (implementation sketch only)

Introduce something like `buildPublicOrganizationHref(company, ctx)` **or** extend `buildSponsorProfilePath` with an optional resolved Series + approval flag — **after** EB0 storage exists. Prefer a **new** function used by public marketing, leaving Admin and tests explicit, to avoid accidental Admin retargeting.

Prerequisite data for each public emit:

1. Company id/slug + `restricted_at`
2. Reverse same-brand Series (from `event_series.company_profile_id = company.id`)
3. Event Brand **public-profile approval** (storage TBD — ADR-005 open question #1)

---

## 4. Public surfaces — inventory and recommendation

Legend: **Retarget?** = for **approved** Event Brand Companies, should public href resolve to Series hub?

| Surface | Files / symbols | Produces / consumes | Retarget? | Impact |
|---------|-----------------|---------------------|-----------|--------|
| Edition Sponsors roster | `PublicSponsorRosterRow`, `PublicSponsorTier*`, `EventSponsorsSection` | Consumes helper | **Yes** (EB4) | High |
| Edition sponsor search | `publicSponsorSearch` maps `href`; UI rebuilds path in roster | Both | **Yes** (EB4) | High |
| Sponsor Discovery table | `mapSponsorDiscoveryPublicRow` → `SponsorDiscoveryTable` | Both | **Yes** href; consider **exclude or dual-label** in suggest/list (EB5) | High |
| Global suggest / combobox | `SponsorSearchCombobox.navigateToProfile` | Both | **Yes** navigate; product may **omit** from sponsor suggest (EB5) | High |
| Organizers | `EventOrganizerListItem`; `mapPublicOrganizers` | Consumes | **Yes** (EB4) | High |
| Exhibitors | `PublicExhibitorRosterRow` | Consumes | **Yes** (EB4) | High |
| Partner Alumni | `EventPartnerAlumniSection` / list item | Consumes | **Yes** (EB4) | High |
| Topic×Region hubs | `TopicRegionHubView` | Consumes | **Yes** (EB4) | Medium |
| Company / Sponsor “cards” | Discovery table rows only (no separate card component) | Consumes `row.href` | Same as Discovery | High |
| Related Sponsors | **Not implemented** | — | N/A | None |
| Series ↔ Company reciprocal chrome | Loaders exist; UI **hidden** | Would produce Company URL | Keep hidden or remove once Series-only; do **not** reintroduce Company link for approved brands | Low |
| Participated Events rows | `SeriesParticipatedEventsList` | Edition URLs only | No change | None |
| Event overview chips | Explicitly no company profile links | — | N/A | None |
| Home / research marketing | No `/sponsors/{slug}` profile links found | — | N/A | None |
| Nav | `/sponsors` hub only | Hub | Keep hub | None |
| Login return path on sponsor page | `SponsorDetailView` + `buildSponsorProfilePath` | Consumes | Follows route policy | Low |

**Organizer caveat:** `mapPublicOrganizers` omits `restricted_at` today — pre-existing gap; fix when wiring EB4 so restricted Event Brands don’t get accidental links.

**Context caveat:** Retargeting organizer/exhibitor/PA links to Series is correct under ADR-005 (public face = Event Brand), but copy (“View profile”) may need Event Brand wording so visitors aren’t told they’re opening a Sponsor Profile.

---

## 5. Direct routes, redirects, canonical, sitemap

| Item | File | Today | ADR-005 action (approved only) | Impact |
|------|------|-------|--------------------------------|--------|
| Profile route | `src/app/(marketing)/sponsors/[slug]/page.tsx` | Renders SponsorDetailView | Soft: 200 + noindex (EB2); Hard: redirect to Series (EB3) | **Critical** |
| Loader | `getSponsorDetailData.ts` | By slug then UUID; no slug-redirect table | Resolve approval + reverse Series before render/redirect | Critical |
| not-found | `sponsors/[slug]/not-found.tsx` | Link to hub | Unchanged | Low |
| Canonical | `createPageMetadata({ path: /sponsors/... })` | Self | Soft: self + noindex; Hard: redirect (canonical becomes Series) | High |
| Indexability | `getCompanyIndexability` | Not restricted ∧ sponsored ≥ 1 | Approved Event Brands: force non-indexable (EB2) | High |
| Sitemap | `fetchPublicCompanySitemapEntries` / `sitemap.ts` | Emits `/sponsors/{slug}` | **Exclude** approved Event Brand Companies (EB2) | High |
| robots.txt | `src/app/robots.ts` | Allow all | Prefer page-level robots; optional later Disallow unnecessary | Low |
| Legacy redirect | `next.config.ts` `/companies/:slug` → `/sponsors/:slug` | Permanent | After EB3, chain still hits Company route then Series redirect — acceptable | Low |
| `company_slug_redirects` | DB table; merge RPC writes; **public route unused** | Loser slugs 404 | Independent debt; do not rely on it for Event Brand retirement | Medium (blocker if ops expect old slugs) |

**Redirect target:** Series hub via `buildSeriesHubPath`. Prefer **bare hub**. Use `?tab=participated` only as an optional deep link when product wants sponsorship-history entry (and tab is guaranteed visible).

**Closest existing pattern:** merged Series `permanentRedirect` + noindex source — better template than restricted-company 404.

---

## 6. Admin (must remain)

| Surface | Path | ADR-005 requirement |
|---------|------|---------------------|
| Company detail | `src/app/admin/companies/[id]/page.tsx` | **Unchanged** as Admin home for the Company row |
| Company form | `CompanyAdminForm.tsx` | Keep edit/domains/merge; optional status copy for public retirement |
| Same-brand Admin | Series `SameBrandCompanyProfileSection`; Company reverse view | Keep ADR-004 link/unlink; add **separate** public-profile approval control (EB0) |
| “View public page ↗” | Raw `/sponsors/${slug}` | **Do not silently delete.** Options: (A) always open Company URL for ops preview even if public redirects; (B) open resolved public destination; (C) dual links. Prefer **A** or **C** so Admin can still inspect SponsorDetailView during soft retirement |
| Role joins / imports | Admin edition + import UIs | Unchanged — still Company FKs |

---

## 7. JSON-LD / metadata

| Producer | File | Behavior today | Approved Event Brand | Impact |
|----------|------|----------------|----------------------|--------|
| Organization JSON-LD | `organizationJsonLd.ts` + sponsor page | `@id`/`url` = absolute `/sponsors/...` | Disappears with hard redirect; soft phase should avoid advertising retired URL as canonical identity | High |
| Event organizers JSON-LD | `eventJsonLd.ts` `buildOrganizers` | Organizer `url` via helper | Should follow public href resolver (Series) once EB4 ships | High |
| Page metadata | sponsor `[slug]/page.tsx` | Title/canonical/robots | EB2/EB3 | High |

---

## 8. Recommended implementation phases (EB0…)

Aligns with ADR-005 M0–M5; sized for smallest reversible ships.

| Phase | Goal | Scope | Est. |
|-------|------|-------|------|
| **EB0 — Approval foundation** | Store + Admin-set Event Brand **public-profile approval**; require same-brand link; no public URL change | Schema/flag or table (TBD); Admin UI on Company and/or Series; guards; tests; docs. **Blocker for all later phases** | **M** (0.5–1.5 d) |
| **EB1 — Public destination resolver** | Pure helper: company + approval + series → `/sponsors/...` \| Series hub \| null | Unit tests; **no** consumer wiring yet (or wire behind dead feature flag) | **S** (0.5 d) |
| **EB2 — Soft retirement (SEO)** | Approved Companies: `getCompanyIndexability` → noindex; exclude from company sitemap; page still **200** | Indexability + sitemap + page metadata; allowlist/approval gated | **S–M** (0.5–1 d) |
| **EB3 — Hard route retirement** | `/sponsors/[slug]` for approved → `permanentRedirect` (or 302 probe) to Series hub; fallbacks if Series unsafe | Page + loader only; leave roster hrefs as one-hop until EB4 | **M** (1–2 d) |
| **EB4 — Outbound href rewrite** | Public consumers use resolver (roster, organizers, exhibitors, PA, topic×region, discovery `href`, combobox) | Prefer new helper; fix discovery id fallback; fix organizer `restricted_at` gap; a11y/copy tweaks | **M–L** (2–3 d) |
| **EB5 — Discovery / suggest policy** | Approved Event Brands: exclude from Sponsor Discovery/suggest **or** show as Event Brand → Series | Product choice; API + combobox + discovery RPC filters | **M** (1–2 d) |
| **EB6 — Structured data + cleanup** | Event JSON-LD organizers; remove dead `sponsorDetailHref` if touching; terminology notes; Admin View-public dual link; monitor | Docs + SEO tests | **S–M** (0.5–1 d) |

**Participated Events productization** (prototype → stable) is **parallel / prerequisite for brand story**, not a substitute for EB0–EB3. Track as Series-hub work (ADR-005 M1), not as a Company URL phase.

**Do not start with rewriting `buildSponsorProfilePath` in place** before EB0–EB3 — highest regression risk.

---

## 9. Phase dependency diagram

```text
EB0 approval storage + Admin
        │
        ▼
EB1 resolver (tested)
        │
        ├──────────► EB2 soft SEO (safe, reversible)
        │
        ▼
EB3 direct /sponsors/[slug] redirect
        │
        ▼
EB4 outbound public href rewrite
        │
        ├──────────► EB5 discovery/suggest policy
        └──────────► EB6 JSON-LD + cleanup
```

---

## 10. Blockers

| # | Blocker | Why it blocks |
|---|---------|---------------|
| B1 | **Approval storage design** (ADR-005 §7 #1) | Cannot gate EB2–EB6 without a manual per-Company signal distinct from `company_profile_id` |
| B2 | **Href rewrite vs redirect-only** product choice (ADR-005 §7 #3) | Determines whether EB4 is required for “done” or EB3 is enough for v1 |
| B3 | **Redirect target** bare hub vs `?tab=participated` | Wrong default breaks organizer/exhibitor semantics and empty-tab UX |
| B4 | **Sponsor Discovery inclusion** (ADR-005 §7 #6) | Else Event Brands remain discoverable as Sponsors after profile retirement |
| B5 | **Sponsor-page-only surfaces** (exhibitor history on Company page) | Hard retirement drops them unless Series gains equivalents or product accepts loss |
| B6 | **Admin “View public” policy** | Ops still need a way to inspect Company public rendering during soft phase |
| B7 | **Series public safety** | Merged/unresolved Series must not become redirect targets |
| B8 | Unused **`company_slug_redirects`** | Old Company slugs may 404 independently of Event Brand policy |

---

## 11. Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Rewriting helper retargets every roster overnight | High | EB0 gate + EB3 before EB4; feature flag / allowlist |
| Duplicate SEO (Company + Series) during soft phase | Medium | EB2 noindex + sitemap exclude ASAP after approval |
| Redirect to Participated tab when empty | Medium | Prefer bare Series hub |
| Organizer/exhibitor users land on Event Brand hub expecting Sponsor Profile | Medium | Copy + EB5 discovery separation |
| Loss of exhibitor history on Company page | Medium | Explicit product accept or Series-side surface before EB3 catalog-wide |
| Confusing same-brand link with public-profile approval | High | Separate Admin controls and labels |
| Admin accidentally follows public redirect and can’t QA Company page | Medium | Dual View links (EB6) |
| JSON-LD still emits `/sponsors/...` after redirect | Medium | EB6 + ensure Organization graph not served on redirected responses |
| Auto-detection pressure from dual-name catalog | High | Reaffirm never-guess; approval only |

---

## 12. Affected files (checklist)

### Critical / high

- `src/lib/routes/explorerUrls.ts` (`buildSponsorProfilePath`)
- `src/app/(marketing)/sponsors/[slug]/page.tsx`
- `src/features/sponsors/server/getSponsorDetailData.ts`
- `src/lib/seo/indexability.ts` (`getCompanyIndexability`)
- `src/lib/seo/sitemapEntries.ts` (`fetchPublicCompanySitemapEntries`)
- `src/features/sponsors/server/mapSponsorDiscoveryPublicRow.ts`
- `src/features/sponsors/components/search/SponsorSearchCombobox.tsx`
- `src/features/sponsors/components/search/SponsorDiscoveryTable.tsx` (consumes `href`)
- `src/features/events/components/detail/PublicSponsorRosterRow.tsx`
- `src/features/events/server/publicSponsorSearch.ts`
- `src/features/events/components/detail/EventOrganizerListItem.tsx`
- `src/features/exhibitors/components/detail/PublicExhibitorRosterRow.tsx`
- `src/features/partner-alumni/components/detail/EventPartnerAlumniSection.tsx`
- `src/lib/seo/organizationJsonLd.ts`
- `src/lib/seo/eventJsonLd.ts`
- Admin approval UI (new) + `src/app/admin/companies/[id]/page.tsx` View public

### Medium

- `src/features/events/components/topic-region/TopicRegionHubView.tsx`
- `src/lib/companies/sameBrandPublicLink.ts` + `sameBrandPublicLinks.ts`
- `src/features/sponsors/components/detail/SponsorDetailView.tsx`
- `src/features/events/server/mapPublicOrganizers.ts` (restricted_at)
- Discovery/suggest API routes + mappers
- Indexability / sitemap / organizationJsonLd tests

### Low / none (note only)

- Dead `eventSponsorUtils.sponsorDetailHref`
- `company_slug_redirects` (unused by public app)
- Series Participated Events list (edition links)
- `/sponsors` hub path builders
- Research / home (no profile links found)

---

## 13. Implementation estimate (roll-up)

| Package | Estimate |
|---------|----------|
| EB0 + EB1 | ~1–2 days |
| EB2 + EB3 (first approved Company soft→hard) | ~1.5–3 days |
| EB4 href rewrite across surfaces | ~2–3 days |
| EB5 + EB6 | ~1.5–3 days |
| **End-to-end first approved brand (careful)** | **~6–11 days** eng, excluding open product decisions |
| Catalog-wide approvals | Ops time; eng mostly gating/tests |

Schema for approval is the main unknown in EB0 (±0.5–1 day).

---

## 14. Explicit non-goals of this audit

- No code, schema, data, redirect, or SEO changes
- No commit / push
- No choice of final approval column name
- No batch linking or name/domain auto-detect
- Does not reopen polymorphic sponsors

---

## 15. Suggested next step

When coding is authorized, follow [phase-event-brand-public-profile-scope.md](../phase-event-brand-public-profile-scope.md) — recommended first batch **EB0–EB4**, Singapore FinTech Festival only.

---

**End of audit.**
