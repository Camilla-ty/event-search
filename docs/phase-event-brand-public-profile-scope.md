# Phase — Event Brand Public Profile (ADR-005)

**Status:** **EB0** shipped (SFF manually approved) · **EB1** resolver · **EB2** soft SEO · **EB3** temporary `/sponsors` → Series redirect · **EB4** public role hrefs · EB5–EB6 **not** started  
**Version:** v1  
**Last updated:** 2026-08-01

Thin implementation scope for **[ADR-005 — Event Brand Public Profile Policy](./adr/ADR-005-event-brand-public-profile-policy.md)**. Defines phased work (EB0–EB6), acceptance criteria, verification, and stop gates — **not** SQL, migrations, or application code.

**Source of truth:** [ADR-005](./adr/ADR-005-event-brand-public-profile-policy.md) — if this scope conflicts with the ADR, the ADR wins.  
**Link prerequisite:** [ADR-004](./adr/ADR-004-event-series-company-same-brand-link.md) (`event_series.company_profile_id`) remains required; roles stay Company-only.  
**Inventory baseline:** [ADR-005 implementation audit](./audits/adr-005-event-brand-public-profile-implementation-audit.md)

**Permissions:** Admin-only for all mutations (`profiles.role = admin`). Public behavior is read-only routing / SEO / href resolution.

---

## 1. Summary

| Area | Deliverable |
|------|-------------|
| Approval | Explicit **per-Company** manual flag: use linked Event Series as public profile (separate from same-brand link) |
| Resolver | Central tested helper: normal → `/sponsors/...`; approved + safe Series → `/events/series/...`; else safe fallback |
| Soft SEO | Approved Companies: noindex + exclude from Company sitemap |
| Hard route | Temporary redirect `/sponsors/[slug]` → Series **root** (not `?tab=participated`) when safe |
| Outbound links | Public Sponsors / Organizers / Exhibitors / Partner Alumni / similar use resolver |
| Discovery | EB5 policy for Sponsor Discovery + suggest (product-locked before coding EB5) |
| Cleanup | JSON-LD, Admin View public, tests, docs |

**Phases:** EB0 approval → EB1 resolver → EB2 soft SEO → EB3 temporary redirect → EB4 outbound hrefs → EB5 discovery/suggest → EB6 JSON-LD / Admin / docs.

**Recommended first implementation batch:** **EB0–EB4** only, with **Singapore FinTech Festival** as the sole manually approved Company. Stop before EB5 until discovery/suggest product choice is locked. Stop before commit/push unless explicitly requested.

---

## 2. First test case (mandatory constraint)

| Entity | Identifier |
|--------|------------|
| Event Series | `singapore-fintech-festival` · id `78232c5b-7ef2-4cda-a23a-941387e1a9c1` |
| Company | Same-brand linked Company id `f85bff6d-f25a-40c5-839f-4a395fbb3d37` (Singapore FinTech Festival) |
| Public Series hub | `/events/series/singapore-fintech-festival` |
| Public Company (pre-retirement) | `/sponsors/singapore-fintech-festival` (or current public slug) |

**Rules:**

- After EB0 ships, Admin may approve **only this Company** for the first public rollout.
- **Do not** auto-approve, batch-approve, or migrate any other Company from name/domain overlap.
- Same-brand link must already exist (ADR-004); approval does not create the link.
- Catalog-wide rollout is out of the first batch.

---

## 3. Cross-cutting rules

| Rule | Decision |
|------|----------|
| Same-brand link vs approval | **Separate.** `company_profile_id` ≠ public-profile approval |
| Auto-detect | **Forbidden** (name, domain, website, import heuristics) |
| Role FKs | Stay on **Company**; URL resolution only |
| Redirect target | Series **root** via `buildSeriesHubPath` — **never** default to `?tab=participated` |
| Unsafe Series | Do **not** redirect or rewrite to dead/merged-unresolved Series; fall back to Company profile behavior |
| Normal Companies | Unchanged Sponsor Profiles |
| Admin Company pages | `/admin/companies/[id]` remain; not folded into Series |
| Polymorphic sponsors | Still forbidden (ADR-004) |

---

## 4. EB0 — Per-Company public-profile approval

### 4.1 In scope

- Store explicit Admin approval that this Company uses its linked Event Series as its **public** profile.
- Admin UI to set / clear approval (Company detail primary; Series same-brand section may show read-only status + deep link).
- Server validation:
  - Approval **requires** an existing reverse same-brand Series (`event_series.company_profile_id = company.id`).
  - Clearing approval always allowed.
  - Refuse approval if Company not linkable / Series not publicly usable as a future target (define shared “Series public-safe” helper used later by EB1–EB3).
- No public URL, SEO, or redirect behavior changes in EB0.
- No name/domain suggestions that write approval.

### 4.2 Out of scope

- Public href rewrite, redirect, sitemap, noindex
- Approving any Company other than the SFF test case in the first ops pass
- Changing ADR-004 link/unlink semantics
- Editor role

### 4.3 Recommended storage (and alternatives)

| Option | Sketch | Recommendation |
|--------|--------|----------------|
| **A. Boolean (or timestamptz) on `companies`** | e.g. `use_linked_series_as_public_profile boolean NOT NULL DEFAULT false`, or `event_brand_public_profile_approved_at timestamptz NULL` | **Recommended.** Approval is a Company public-policy attribute; reverse Series already comes from ADR-004 FK; simple Admin on Company detail; default false = safe |
| **B. Flag on `event_series`** | e.g. `company_is_public_profile boolean` | Weaker: approval is about retiring the **Company** public face; Series-owned flag conflates with link |
| **C. Allowlist / junction table** | `event_brand_public_profile_approvals(company_id)` | Useful if metadata (approved_by, notes) needed later; heavier for V1 |
| **D. Code/env allowlist only** | Hard-code SFF id | Acceptable **only** as an emergency probe — **not** the ADR-005 end state; prefer A even for first test (approve one row) |

**Lock for this scope:** **Option A** — nullable `timestamptz` **or** boolean on `companies`, name finalized in migration PR. Application must still require same-brand Series before setting true/non-null. Do **not** overload `company_profile_id`.

### 4.4 Likely affected areas

| Area | Examples |
|------|----------|
| Migration | New `supabase/migrations/*_company_event_brand_public_profile*.sql` |
| Types | Generated / local Company types |
| Admin Company UI | `src/app/admin/companies/[id]/page.tsx`, company admin sections |
| Admin Series UI | Optional status near `SameBrandCompanyProfileSection` |
| Admin API | Company PATCH or dedicated approve/clear route |
| Validation | Shared helper beside `sameBrandCompanyProfile` / series public-access checks |

### 4.5 Acceptance criteria

- [ ] Approved storage exists and defaults to “not approved.”
- [ ] Admin can approve only when same-brand Series exists; clear error otherwise.
- [ ] Admin can clear approval without unlinking same-brand.
- [ ] Unapproved linked Companies behave exactly as today publicly.
- [ ] No import/matching path writes the approval field.
- [ ] SFF is the only Company approved in the first ops checklist (manual).

### 4.6 Verification

- Focused tests: approve/reject validation; unlink Series clears or blocks approval per chosen rule (prefer: **clear approval or reject leaving orphan approval** — lock in PR: **refuse to keep approval if link removed**; clearing link auto-clears approval is acceptable).
- ESLint / tsc on touched paths; `git diff --check`.
- Manual: Admin approve/clear on SFF staging/local.

### 4.7 Stop gate

Stop after EB0 merge readiness review. **Do not** start public SEO/redirect until EB0 is verified. No commit/push unless explicitly requested.

---

## 5. EB1 — Public destination resolver

### 5.1 In scope

- New **central** helper (prefer **new** function, e.g. `resolvePublicCompanyDestination` / `buildPublicCompanyHref` — do not silently change Admin-only callers of `buildSponsorProfilePath`).
- Behavior:

| Input | Output |
|-------|--------|
| Restricted / no public company path today | `null` (unchanged semantics) |
| Not approved | `/sponsors/{slug\|id}` via existing sponsor path rules |
| Approved + reverse Series **public-safe** | `/events/series/{slug\|id}` (**root only**) |
| Approved + Series missing / merged unresolved / not public-safe | **Fallback:** `/sponsors/...` (or `null` if company also unusable) — never invent Series URL |

- Unit tests covering SFF-shaped fixtures + negative cases.
- **No** consumer wiring required in EB1 (helper + tests only), unless a dead feature flag is used.

### 5.2 Out of scope

- Changing `buildSponsorProfilePath` default behavior for all callers
- Redirects, sitemap, discovery filters
- `?tab=participated` destinations

### 5.3 Likely affected areas

| Area | Examples |
|------|----------|
| Routes helpers | `src/lib/routes/explorerUrls.ts` (sibling helper) and/or `src/lib/companies/*` |
| Series public access | Reuse existing series public/resolvable checks |
| Same-brand reverse lookup | Patterns from `sameBrandPublicLinks.ts` |
| Tests | New focused unit tests |

### 5.4 Acceptance criteria

- [ ] Resolver matches the table in §5.1.
- [ ] Series destination never includes `?tab=participated`.
- [ ] Fallback proven when Series unsafe.
- [ ] `buildSponsorProfilePath` still returns sponsor paths for legacy/Admin use.

### 5.5 Verification

- Unit tests only (no full public matrix yet).
- ESLint / tsc / `git diff --check` on touched paths.

### 5.6 Stop gate

Helper merged/ready before EB2. No public behavior change yet. No commit/push unless requested.

---

## 6. EB2 — Soft SEO retirement

### 6.1 In scope

- For **approved** Companies only:
  - Force **noindex** (extend `getCompanyIndexability` or equivalent gate).
  - **Exclude** from `fetchPublicCompanySitemapEntries` / company sitemap entries.
- Company page may still **200** and render (until EB3).
- Canonical may remain self during soft phase (document as temporary).

### 6.2 Out of scope

- HTTP redirect
- Outbound href rewrite
- Changing Series sitemap rules
- robots.txt Disallow paths (page-level robots sufficient)

### 6.3 Likely affected areas

| Area | Examples |
|------|----------|
| Indexability | `src/lib/seo/indexability.ts` |
| Sitemap | `src/lib/seo/sitemapEntries.ts`, `src/app/sitemap.ts` |
| Sponsor page metadata | `src/app/(marketing)/sponsors/[slug]/page.tsx` |
| Tests | `indexability.test.ts`, sitemap entry tests |

### 6.4 Acceptance criteria

- [ ] Approved SFF Company is noindex and absent from Company sitemap.
- [ ] Unapproved Companies unchanged.
- [ ] Page still loads for direct URL (soft phase).

### 6.5 Verification

- Unit tests for indexability + sitemap exclusion with approval fixture.
- Manual: fetch SFF `/sponsors/...` robots/meta; confirm sitemap omission.
- ESLint / tsc / `git diff --check`.

### 6.6 Stop gate

Soft SEO verified for SFF before EB3. No commit/push unless requested.

---

## 7. EB3 — Temporary redirect of Company profile route

### 7.1 In scope

- On `GET /sponsors/[slug]` (and UUID resolution path if used): if Company is **approved** and Series is **public-safe** → **temporary redirect (302)** to Series **root**.
- If Series unsafe → **do not redirect**; keep existing Company page behavior (still noindex from EB2 if approved).
- Preserve login/not-found/restricted behavior for non-approved Companies.
- Do **not** rewrite roster hrefs in EB3 (one-hop via old `/sponsors/...` is OK).

### 7.2 Out of scope

- Permanent 301 (may follow in a later ops decision after SFF validation)
- Default `?tab=participated`
- Discovery/suggest changes
- Deleting Company rows or Admin routes
- `company_slug_redirects` wiring (independent debt)

### 7.3 Likely affected areas

| Area | Examples |
|------|----------|
| Page | `src/app/(marketing)/sponsors/[slug]/page.tsx` |
| Loader | `getSponsorDetailData.ts` (resolve approval + reverse Series before render) |
| Redirect pattern | Prefer existing Next redirect helpers used by merged Series |
| Tests | Route/wiring tests for redirect + fallback |

### 7.4 Acceptance criteria

- [ ] Approved SFF `/sponsors/...` → **302** → `/events/series/singapore-fintech-festival` (no query).
- [ ] Unapproved Companies never redirect via this rule.
- [ ] Unsafe Series → no redirect; page remains.
- [ ] Admin Company detail still reachable.

### 7.5 Verification

- Automated redirect + fallback tests.
- Manual: SFF Company URL, a normal Sponsor URL, and a simulated unsafe-Series case.
- ESLint / tsc / `git diff --check`.

### 7.6 Stop gate

SFF redirect confirmed before EB4. Accept that Sponsor-page-only surfaces (e.g. exhibitor history on Company page) are unreachable via public Company URL while redirected — **explicit first-batch trade-off**. No commit/push unless requested.

---

## 8. EB4 — Public role / surface href rewrite

### 8.1 In scope

Wire **public** consumers to the EB1 resolver (not raw sponsor path) for approved Companies:

| Surface | Primary files (from audit) |
|---------|----------------------------|
| Edition Sponsors roster | `PublicSponsorRosterRow`, tier panels |
| Edition sponsor search mapping | `publicSponsorSearch` (+ ensure UI uses resolved href) |
| Organizers | `EventOrganizerListItem` (+ fix `restricted_at` omission in mapper if touching) |
| Exhibitors | `PublicExhibitorRosterRow` |
| Partner Alumni | `EventPartnerAlumniSection` |
| Topic×Region hubs | `TopicRegionHubView` |
| Discovery row `href` | `mapSponsorDiscoveryPublicRow` (remove id-fallback bypass of resolver) |
| Global combobox navigate | `SponsorSearchCombobox` (navigation target; listing policy is EB5) |

Copy/accessibility: links may still show company **name**; destination is Series hub for approved brands.

### 8.2 Out of scope

- Admin “View public” final UX (EB6)
- Excluding approved brands from Discovery/suggest result sets (EB5)
- JSON-LD graph rewrite beyond what falls out of href helper if organizers already use it (full JSON-LD in EB6)
- Related Sponsors (not implemented)
- Re-enabling Series↔Company reciprocal Company link chrome

### 8.3 Likely affected areas

Listed in §8.1 plus shared tests for roster/organizer/exhibitor/PA/topic-region/discovery hrefs.

### 8.4 Acceptance criteria

- [ ] On a page where SFF Company appears as sponsor/organizer/exhibitor/PA (as applicable), public href is Series root.
- [ ] Normal Companies still link to `/sponsors/...`.
- [ ] Discovery `href` for approved SFF uses resolver (even if row still appears until EB5).
- [ ] No polymorphic role schema changes.

### 8.5 Verification

- Focused component/mapper tests with approved vs unapproved fixtures.
- Manual spot-check: edition roster + one organizer/exhibitor/PA surface + topic hub if SFF appears.
- ESLint / tsc / `git diff --check`.

### 8.6 Stop gate — **end of recommended first batch**

After EB4:

- Stop coding EB5/EB6 until product locks §11 decisions.
- Run Definition of Done for the EB0–EB4 batch when commit is requested.
- **Do not** approve additional Companies without a new ops checklist.
- No commit/push unless explicitly requested.

---

## 9. EB5 — Sponsor Discovery & suggest (second batch)

### 9.1 In scope (after product lock)

Define and implement **one** of:

| Option | Behavior |
|--------|----------|
| **E5-A Exclude** | Approved Event Brand Companies omitted from Sponsor Discovery + suggest |
| **E5-B Relabel** | Remain visible but labeled/navigated as Event Brand → Series hub |
| **E5-C Dual** | Appear in Events/Series discovery instead of Sponsors (larger) |

**This scope does not pick A/B/C** — see §11. EB5 coding blocked until chosen.

### 9.2 Out of scope until locked

- Implementing any of E5-A/B/C
- Changing `/sponsors` hub IA beyond filter behavior

### 9.3 Likely affected areas (when unlocked)

Discovery RPC/mappers, `mapSponsorDiscoverySuggestItems`, `SponsorSearchCombobox`, discovery API routes, protection/indexability docs.

### 9.4 Acceptance criteria (template)

- [ ] Chosen option documented in this file’s history when locked.
- [ ] SFF behaves per option; normal sponsors unchanged.
- [ ] Tests for suggest + discovery filters.

### 9.5 Verification / stop gate

Standard focused tests + manual suggest/discovery. Stop before EB6. No commit/push unless requested.

---

## 10. EB6 — JSON-LD, Admin View public, docs, cleanup

### 10.1 In scope

- Organization JSON-LD: do not advertise retired Company URL as live identity after redirect (no Organization graph on redirected responses; Event organizer URLs follow resolver).
- Admin **View public**: ship **dual links** (recommended default) — “View Company URL” (ops) + “View public destination” (resolved). Admin pages themselves unchanged.
- Remove or quarantine dead `sponsorDetailHref` if touched.
- Update `project-state.md`, terminology notes for Series-first Event Brands, indexability plan cross-links, ADR-005 implementation status note.
- Regression: roles/imports still Company-only; no auto-approval.

### 10.2 Out of scope

- Permanent 301 cutover policy (ops decision after SFF soak)
- `company_slug_redirects` public consumption
- Batch approval tooling

### 10.3 Likely affected areas

`organizationJsonLd.ts`, `eventJsonLd.ts`, `admin/companies/[id]/page.tsx`, docs listed above, SEO tests.

### 10.4 Acceptance criteria

- [ ] Redirected responses do not emit conflicting Organization canonical identity.
- [ ] Event JSON-LD organizer URLs for approved SFF use Series hub when organizers JSON includes URL.
- [ ] Admin dual View links work.
- [ ] Docs reflect shipped EB0–EB4 (+ EB5 if done).

### 10.5 Verification / stop gate

SEO + Admin tests; DoD documentation impact; no commit/push unless requested.

---

## 11. Unresolved product decisions (phase blockers)

| # | Decision | Blocks | Notes |
|---|----------|--------|-------|
| P1 | Discovery/suggest option **E5-A / E5-B / E5-C** | **EB5** | First batch (EB0–EB4) can ship without this |
| P2 | Auto-clear approval when same-brand link removed vs reject unlink while approved | **EB0** (minor) | Scope preference: clearing link clears approval **or** unlink blocked until approval cleared — pick in EB0 PR |
| P3 | Soft-phase canonical self vs early canonical-to-Series | EB2 only | Default: keep self canonical until EB3 redirect |
| P4 | Promote 302 → 301 after soak | Post-EB3 ops | Not required for first batch |
| P5 | Accept loss of Company-page exhibitor history for SFF while redirected | **EB3** (accepted for first test case in this scope) | Revisit before catalog-wide approvals |
| P6 | Admin View public dual vs single | EB6 | Default dual recommended; not blocking EB0–EB4 |

**Not blockers for EB0–EB4:** Participated Events tab product permanence; reciprocal header chrome (stays hidden); polymorphic sponsors (already forbidden).

---

## 12. Recommended first implementation batch

| Include | Exclude |
|---------|---------|
| **EB0, EB1, EB2, EB3, EB4** | **EB5, EB6** (follow-up batch) |
| Manual approval: **SFF Company only** | Any other Company approval / auto-migration |
| 302 to Series **root** | `?tab=participated` as default target |
| Resolver + public role hrefs | Discovery exclusion/relabel until P1 |

**Rationale:** EB4 completes the public link graph so visitors don’t bounce `/sponsors → Series` on every roster click. EB5 needs an explicit discovery product choice. EB6 is cleanup that can trail once SFF behavior is validated.

Optional: ship EB0–EB3 first for a smaller redirect-only probe, then EB4 in a fast follow — still **stop before EB5**.

---

## 13. Global out of scope (entire ADR-005 phase)

- Polymorphic role targets → Series  
- Name/domain auto-detect or batch backfill of approval  
- Deleting Company rows used by Event Brands  
- Renaming `/sponsors` hub or `companies` table  
- Merging Series + Company into one entity  
- Wiring unused `company_slug_redirects` (unless separately scoped)  
- Changing normal Sponsor Profile behavior  
- Implementing code from this document without an explicit implementation request  

---

## 14. Authorization boundary

**This phase document does not authorize** migrations, application code, data writes, redirects, sitemap changes, or commits by itself.

Implementation starts only when explicitly requested, phase by phase (or as the EB0–EB4 batch), against this scope. After each phase (and before any commit/push), run the phase stop gate and [Definition of Done](./standards/definition-of-done.md).

---

## 15. Document history

| Date | Change |
|------|--------|
| 2026-08-01 | Initial thin scope EB0–EB6; recommend Option A storage; first batch EB0–EB4; SFF-only first approval; Series root redirect |
| 2026-08-01 | EB0 coded: `companies.event_brand_public_profile_approved_at`; Admin approve/revoke; unlink blocked while approved. **No Companies auto-approved.** Migration apply may still be pending in the target DB. |
| 2026-08-01 | EB1 coded: `resolvePublicCompanyDestination` / `buildPublicCompanyHref` (unwired to public UI). |
| 2026-08-01 | EB2 coded: soft-retire approved+resolvable Event Brand Companies (noindex + company sitemap exclude); `/sponsors/...` still renders. |
| 2026-08-01 | EB3 coded: temporary `redirect()` from approved Event Brand `/sponsors/[slug]` → Series hub root (SFF → `/events/series/singapore-fintech-festival`). |
| 2026-08-01 | EB4 coded: public role hrefs use `buildPublicCompanyRoleHref` + destination index (Sponsors, Organizers, Exhibitors, Partner Alumni, Topic×Region; edition sponsor search). Discovery / global combobox / JSON-LD unchanged. |

---

**End of phase scope.**
