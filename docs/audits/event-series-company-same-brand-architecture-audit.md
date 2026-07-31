# Architecture Audit — Linked Event Series & Company Profiles

**Review type:** Documentation-first Architecture Audit (product / data-model / public surface exploration)  
**Date:** 2026-07-31  
**Phases:** Phase 1 — Database, domain model, admin, imports · Phase 2 — Public UI, search, SEO, permissions, V1 scope  
**Status:** Documentation only — no implementation, migrations, UI, or data changes  
**Baseline sources:** Live Supabase schema (read-only), public routes under `src/app/(marketing)`, SEO/indexability libs, ADRs, design docs, admin IA  

---

## 1. Executive Summary

The confirmed product direction — **Event Series = the event**, **participant roles always reference Company**, and a brand may eventually hold **both** an Event Series profile and a Company profile that can be **explicitly linked** — fits the existing architecture well.

Today the system already:

- Treats **Company** as the single organizational identity for Organizer, Sponsor, Exhibitor, and Partner Alumni membership.
- Keeps **Event Series / Event Edition** as a separate catalog for the event itself.
- Allows the same Company to hold multiple roles on one edition (orthogonal joins).
- Supports event brands appearing as Companies in the wild (often as sponsors of *other* series) via parallel records with **no explicit same-brand link**.

What is **missing** is any first-class same-brand relationship between `event_series` and `companies`. Live data already shows de facto dual profiles (exact name overlaps such as TOKEN2049, ETHGlobal, Korea Blockchain Week). A competing backlog idea ([Event sponsor entity expansion](../backlog.md)) proposes polymorphic sponsors pointing at `event_series`; that conflicts with the confirmed “roles always reference Company” decision and should not be treated as the target model.

**Phase 2 (public surfaces):** Dual profiles are already **separate public destinations** with incomplete reciprocity. Edition → Company links work for roles; Series hub → Company and Company → Series hub do **not**. Search scopes are siloed (Events vs Sponsors) with no same-name disambiguation. SEO treats Event Brand and Sponsor Organization as independent entities; series merge redirects exist, company merge redirects are DB-only and unused in app code. Restricted-company scrubbing is strong on sponsor/exhibitor paths and weaker on organizer mapping.

**Verdict:** The current architecture **broadly supports** the proposed direction. The smallest practical V1 is an optional, **admin-verified** Series↔Company link plus **minimal public reciprocal navigation** and lifecycle safety — not search unification, not polymorphic sponsors, not shared logo/metadata merging. The natural next step remains a focused **design doc** (cardinality + V1 public/SEO rules), then a thin phase scope — not schema work yet.

---

## 2. Current Architecture

### 2.1 Entity split

| Concept | Table | Role in product |
|--------|--------|-----------------|
| Event Series | `event_series` | Recurring event identity (Admin: Event Series; Public: Event Brand) |
| Event Edition | `event_editions` | Dated / located occurrence (`series_id` → series) |
| Company | `companies` | Global organizational identity (sponsors, organizers, exhibitors, Partner Alumni members) |
| Sponsor | `event_sponsors` | Edition ↔ Company join (+ tier metadata) |
| Organizer | `event_edition_organizers` | Edition ↔ Company join (+ `role_label`, order) |
| Exhibitor | `event_exhibitors` | Edition ↔ Company join (+ tier metadata) |
| Partner Alumni | `event_partner_alumni` (+ versions / `event_partner_alumni_version_companies`) | **Series-scoped** program; members are Companies |

Canonical summaries: [`docs/project-state.md`](../project-state.md), [`docs/terminology.md`](../terminology.md), [`docs/organizer-design.md`](../organizer-design.md), [`docs/exhibitor-design.md`](../exhibitor-design.md), [`docs/partner-alumni-design.md`](../partner-alumni-design.md).

### 2.2 Confirmed product decisions (this audit)

Treated as locked for evaluation:

1. Event Series represents the event itself.
2. Organizer always references a Company.
3. Sponsor continues to reference a Company.
4. Exhibitors and similar participant roles continue to reference Companies.
5. A Company may represent company, government agency, association, foundation, institution, community, media brand, or **event brand**.
6. When an event brand also participates as Organizer or Sponsor, it may have **both** an Event Series profile and a Company profile.
7. Those two profiles may eventually be **explicitly linked** as the same brand.

### 2.3 Four scenarios (product framing)

| # | Scenario | Today’s mechanical support |
|---|----------|----------------------------|
| 1 | Event and Organizer are different | Fully supported — organizer join → distinct Company |
| 2 | Event and Organizer share the same identity | Supported only via **parallel** Series + Company rows; no explicit link |
| 3 | Organizer is different; Event sponsors another Event | Supported — Event Brand exists as Company and sponsors other editions |
| 4 | Same identity as (2), and the Event also sponsors another Event | Supported as parallel rows + sponsor joins; no explicit link |

Live illustration (case-insensitive `lower(trim(name))` match between non-merged companies and non-merged series, read-only sample 2026-07-31): **10** name-matched pairs among ~37 non-merged series and ~4,560 active companies. Of those, **9** sponsor *other* series; **1** (TOKEN2049) organizes its own series. None currently both organize own series *and* sponsor other series under that name pair — scenario 4 is product-valid but underrepresented in current data. Full pair list: Appendix C.

---

## 3. Database Findings

### 3.1 Does the schema naturally support this model?

**Yes, for roles and dual profiles; no, for explicit same-brand linking.**

- Participant roles are already Company-centric joins. Confirmed decisions 2–4 require **no change** to join targets.
- Dual profiles already exist as independent rows in `event_series` and `companies` (separate unique namespaces for `name` / `slug`).
- There is **no** `company_id` on `event_series`, no `event_series_id` on `companies`, and no junction / link table connecting them.
- No RPC encodes Series↔Company same-brand identity. Relevant RPCs today: `merge_companies`, `company_merge_preview`, `set_company_primary_domain`, sponsor/exhibitor import publish helpers, `event_edition_sponsor_search`, `sponsor_discovery_page`.

### 3.2 Same-brand relationship today

| Mechanism | Present? | Notes |
|-----------|----------|-------|
| Explicit FK or link table | **No** | |
| Implicit name co-occurrence | **Yes (data)** | Exact-name overlaps exist; not enforced or UI-managed |
| Shared domain / website | **Partial (data)** | Often similar websites (e.g. TOKEN2049); not a constraint or link |
| Polymorphic sponsor → series | **No (shipped)** | Proposed only in [`docs/backlog.md`](../backlog.md) “Event sponsor entity expansion” — conflicts with confirmed Company-only role targets |

### 3.3 Table-by-table notes

#### `event_series`

- Columns (relevant): `id`, `name`, `slug`, `website_url`, `logo_url`, `lifecycle_status`, `merged_into_series_id`, `created_at`.
- Uniques: `name`, `slug`.
- Lifecycle: `NULL` \| `active` \| `discontinued` \| `merged`; merge target via `merged_into_series_id` (checks enforce consistency; self-merge forbidden).
- RLS: public SELECT (`public read event_series`); writes via service role / admin APIs.
- **No company reference.**

#### `event_editions`

- Belongs to series (`series_id` → `event_series`, `ON DELETE SET NULL`).
- Globally unique `slug`; multiple editions per series+year allowed.
- Organizer / sponsor / exhibitor links hang off editions, not series (except Partner Alumni program at series level).

#### `companies`

- Identity: `name` (unique; constraint still named `sponsors_name_key` — legacy), `slug` (unique), `website`, `domain` (unique when set), `aliases[]`, logo metadata.
- Lifecycle column: `status` (`company_status` enum) `active` \| `merged`; `merged_into_company_id`, `merged_at`, `merged_by`.
- Public policy: optional `restricted_at` (CHECK: restricted only when `status = active`).
- **No** `type` / `org_type` / `entity_type` column — breadth of “what a Company is” is semantic, not typed.
- RLS: broad public SELECT (`public_read_companies` — `USING (true)`); application filters often add `restricted_at IS NULL` / `status = active` (see Health Finding `ARC-001`).
- Supporting index: `companies_publicly_displayable_idx` on active + non-restricted rows.

#### `company_domains`

- Verified identity keys for import matching (ADR-001); unique on `lower(domain)`; one primary per company.
- FK → `companies` `ON DELETE RESTRICT`.

#### `event_edition_organizers`

- `UNIQUE (event_editions_id, company_id)`; FKs `ON DELETE RESTRICT`.
- Public SELECT (anon + authenticated); no client writes.
- Indexes on `company_id` and `(event_editions_id, display_order)`.

#### `event_sponsors`

- `UNIQUE (event_editions_id, company_id)`.
- Edition FK `ON DELETE CASCADE`; company FK defaults to **NO ACTION** (no `ON DELETE` clause — tighter than cascade; organizers/exhibitors use explicit `RESTRICT`).
- Anon SELECT only `tier_rank = 1`; authenticated full SELECT; client INSERT/UPDATE/DELETE blocked via RLS.
- Indexes include `(event_editions_id, tier_rank, display_order)` and `company_id`.

#### `event_exhibitors`

- Same Company-on-edition pattern; uniqueness via unique index on `(event_editions_id, company_id)`.
- Both FKs `ON DELETE RESTRICT` (same family as organizers).
- Organizer-like public SELECT (no tier gate); no client-write policies observed beyond SELECT.
- Orthogonal to sponsors/organizers (same company may appear in all three).

#### Partner Alumni

- `event_partner_alumni`: one program per `event_series_id` (unique).
- Versions + `event_partner_alumni_version_companies`: members are Companies (`ON DELETE RESTRICT`).
- Series-scoped recognition roster — **not** a same-brand link; another consumer of Company identity.

### 3.4 Possible schema approaches (options only — no selection)

These are architectural options for a future design, **not** a migration plan:

| Approach | Sketch | Pros | Cons / risks |
|----------|--------|------|----------------|
| **A. FK on series** | `event_series.company_id` nullable → `companies` | Simple; series owns brand company pointer | Cardinality forced toward 1:1 from series side; company detail must discover reverse link |
| **B. FK on company** | `companies.event_series_id` nullable → `event_series` | Company “is event brand” flag-like | One company → at most one series; awkward if a parent org runs multiple brands |
| **C. Junction / link table** | e.g. `event_series_company_links (series_id, company_id, …)` | Explicit relationship entity; room for status, verified_at, notes | Extra table; must define uniqueness (1:1 vs 1:N) |
| **D. Verified link + status** | Junction with `proposed` / `verified` / `rejected` | Aligns with ADR-001 “never guess; verify once” | More admin UX; import may only *suggest* |
| **E. Shared “Brand” super-entity** | New identity above series + company | Clean long-term model | Large redesign; out of proportion to confirmed “eventual link” |

**Cardinality considerations (open):**

- Product language (“linked as the same brand”) suggests **at most one** Company per Series for brand identity, and possibly **at most one** Series per Company — but a holding company might organize many series without being “the same brand” as each.
- Role joins remain **N:M** via editions (one company organizes/sponsors many editions; one edition has many companies). Same-brand link is orthogonal to those joins.

### 3.5 Archived / merged / restricted behavior

Any future link must define behavior for:

| Side | Mechanism | Implication for a link |
|------|-----------|------------------------|
| Company merged | `status = merged`, tombstone + slug redirects; `merge_companies` repoints sponsor/organizer/exhibitor/PA joins | Link must move to survivor or dissolve; do not leave pointers at tombstones |
| Company restricted | `restricted_at` set | Series remains public; Company public profile hidden — link should not accidentally expose restricted company via series hub |
| Series merged | `lifecycle_status = merged`, `merged_into_series_id` | Public resolution already follows merge chain (`resolveSeriesPublicAccess`); brand link should follow successor or clear |
| Series discontinued | `lifecycle_status = discontinued` | Company may still sponsor others; link may remain historically valid |

`assertCompanyLinkable` (`src/lib/companies/assertCompanyLinkable.ts`) already blocks linking **merged** companies into edition roles — a same-brand link should reuse the same gate.

### 3.6 Indexes / RLS / integrity (reuse)

- Uniqueness of `(edition, company)` on role tables already prevents duplicate role rows; same-brand link does not replace those.
- Company domain uniqueness prevents two companies claiming the same identity key — helpful when an event brand company is created from import.
- Series and company **name** uniqueness are **separate**; the same string may exist in both catalogs (observed). That is the dual-profile pattern, not a bug — but without a link, admins cannot see the pairing.

---

## 4. Domain Model Findings

### 4.1 How Company is defined

From ADR-001, organizer/exhibitor design, and project-state:

> A company represents one real-world organization.  
> Sponsor / Organizer / Exhibitor = that organization linked to an edition.

Public marketing routes use `/sponsors/[slug]` (historical “sponsor profile” naming) for Company pages. Admin uses **Companies**.

### 4.2 Broader organizational identity — already true in practice

Company already behaves as a **broad organizational identity**, not a legal-corporation type:

- No schema field restricts legal form.
- Docs explicitly allow non-corporate participants via roles (organizers, exhibitors, Partner Alumni members).
- Confirmed decision that Company may be government, association, foundation, institution, community, media brand, or event brand is **consistent** with current usage and with backlog examples (event brands appearing on sponsor rosters).

### 4.3 Assumptions that every Company is a legal corporation

**Not enforced in schema.** Residual **terminology** risk only:

- Table and UI label **Company** / public **Sponsor** profile can imply corporation.
- ADR-001 language (“official company website”) is corporation-flavored but operationally means “organization website.”
- No rename is in scope for this audit (per instructions).

### 4.4 Terminology conflicts to watch

| Surface | Term | Conflict risk |
|---------|------|----------------|
| Public | **Event Brand** = Event Series | Event brand **Company** profile is a different entity — copy must not equate them without a link |
| Admin | **Event Series** vs **Company** | Clear if dual profiles stay separate |
| Public company page | Still framed as sponsor/org profile | Event-brand companies look like “sponsors” even when they are peer events |
| Backlog polymorphic sponsor | Sponsor → `event_series` | Conflicts with “roles always reference Company” |

[`docs/terminology.md`](../terminology.md) does not yet define same-brand linking or “event brand company.”

---

## 5. Admin Workflow Findings

### 5.1 Surfaces today

| Workflow | Where | Company involvement |
|----------|-------|---------------------|
| Event Series management | `/admin/events/series` | Name, website, logo, keywords, lifecycle; Partner Alumni versions |
| Event Edition management | `/admin/events/editions/[id]` Profile / Live sponsors / Exhibitors / Imports | Organizers on Profile; sponsors/exhibitors on tabs |
| Company management | `/admin/companies` | Identity, domains, aliases, merge, restrict; read-only Sponsorships / Organizer roles / Exhibitor history |
| Organizer | Edition Profile → company picker | Manual only (no Excel pipeline) |
| Sponsor | Live sponsors + sponsor import | Excel + manual add |
| Exhibitor | Exhibitors tab + exhibitor import | Excel + manual add |
| Maria’s Excel → Bulk Upload → Cross-check | Operational sequence in [`docs/event-admin-workflow.md`](../event-admin-workflow.md) / admin IA | Discover → Series → Edition → Create & import sponsors → Review → Draft → Publish; parallel exhibitor / PA imports |

References: [`docs/admin-information-architecture.md`](../admin-information-architecture.md), [`docs/event-admin-workflow.md`](../event-admin-workflow.md).

### 5.2 Where a future same-brand relationship would naturally be managed

Natural admin homes (options for design — not chosen):

1. **Event Series detail** — “Linked Company (same brand)” section next to website/logo (series is the event identity).
2. **Company detail** — “Linked Event Series (same brand)” next to Sponsorships / Organizer roles (company is the participant identity).
3. **Both, kept in sync** — recommended UX pattern if a single underlying link exists; avoids one-sided discovery.
4. **Not** inside edition sponsor/organizer pickers as the *definition* of same-brand (those pickers already select Companies for roles). Optional **hint**: “This company matches series X — link as same brand?”

### 5.3 Manual vs automatic linking

Aligned with ADR-001:

> Never guess. A human verifies once. EventPixels remembers forever.

- **Automatic same-brand linking is a poor fit** for v1 of a link feature.
- Safe automation ceiling: **suggest** candidates (exact name, shared normalized domain / website host) into a review queue.
- Auto-accept only after an explicit verified link exists (mirrors `company_domains` permanent memory).

### 5.4 Duplicate prevention & validation

| Concern | Current behavior | Link-feature implication |
|---------|------------------|---------------------------|
| Duplicate companies | Unique `name`, `slug`, `domain`; merge RPC | Linking does not replace merge |
| Duplicate series | Unique `name`, `slug`; series merge fields | Linking does not replace series merge |
| Parallel Series+Company same name | **Allowed** | Should become the **normal** dual-profile case once linkable |
| Creating Company for event brand that already has Series | Import/create flows do not warn about series name/domain collision | Candidate validation: warn / offer link |
| Linking merged/restricted entities | Role creates blocked for merged | Same-brand create should refuse merged; decide restricted policy |

---

## 6. Import & Data Quality Findings

### 6.1 Current assumptions

Sponsor / exhibitor / Partner Alumni imports assume:

1. Every roster row resolves to a **Company** (create or match).
2. Auto-ready matching is **exact** on verified domain / primary domain / alias domain memory (ADR-001); name/`exact_name` may propose but bulk-accept policies favor domain/alias (`AUTO_READY_MATCH_METHODS`).
3. Event Series is a **prerequisite context** (edition or PA series), not a match target for roster identity.
4. Organizers are **out of import** (manual curation).

Docs: [`docs/adr/ADR-001-company-identity.md`](../adr/ADR-001-company-identity.md), [`docs/adr/ADR-002-company-website-canonical-identity.md`](../adr/ADR-002-company-website-canonical-identity.md), [`docs/sponsor-import-database-design.md`](../sponsor-import-database-design.md), [`docs/implementation/company-domain-matching-v1.md`](../implementation/company-domain-matching-v1.md), [`docs/health/data-quality/2026-07-data-quality.md`](../health/data-quality/2026-07-data-quality.md) (`DQ-001`–`DQ-003`).

### 6.2 Event-branded companies

When Excel lists another event as a partner/sponsor (backlog example: Singapore FinTech Festival on Nordic Blockchain Conference):

- Import creates or matches a **Company** with that event’s name/website.
- A separate **Event Series** may already exist with the same name/website.
- Result: dual profiles without linkage — already observed in production-like data.

### 6.3 Duplicate & false-match risks

| Risk | Severity | Notes |
|------|----------|-------|
| Parallel Series + Company without link | Medium (ops clarity) | Expected under confirmed model until link exists |
| Domain auto-match to event-brand Company | Low–Medium | Correct for Company identity; does not discover Series |
| Name similarity across unrelated orgs | High if automated | ADR-001 forbids fuzzy merge — same rule for same-brand |
| Shared parent domain (e.g. `consensus.coindesk.com` vs series website) | Medium | Path/host identity rules may or may not align Series website with Company domain |
| Weak / social-only websites (`DQ-001`) | High for matching quality | Undermines domain-based suggestions for same-brand |
| Orphan / bogus company shells (`DQ-003`) | Medium | Pollutes candidate lists for linking |
| Polymorphic “sponsor the series” without Company | Product conflict | Would break Company-only role model |

### 6.4 Situations requiring manual review

- First time an event brand appears as a participant while a Series already exists (or vice versa).
- Same brand, different websites (marketing site vs edition microsite).
- Parent brand vs city-specific series (e.g. Consensus vs Consensus Hong Kong — both appear as name-matched pairs in current data).
- Series merge / company merge after a link exists.
- Restricted companies that are also event brands.
- Import rows that look like program labels rather than organizations (see `DQ-003` Partner Alumni shell example).

---

## 7. Analysis of the Four Scenarios

### Scenario 1 — Event and Organizer are different

**Support:** Native.

- Series/Edition describe the event; `event_edition_organizers` points at a distinct Company (e.g. a production company or agency).
- No same-brand link required.
- Admin: Profile organizer picker; no import path.

### Scenario 2 — Event and Organizer share the same identity

**Support:** Dual profiles only; link absent.

- Requires an `event_series` row **and** a `companies` row used as organizer on editions.
- TOKEN2049-class data: same name Series + Company; Company organizes own series edition(s).
- Without a link, public/admin cannot navigate Series ↔ Company as one brand; logos/websites may drift independently.

### Scenario 3 — Organizer different; Event sponsors another Event

**Support:** Native via Company-as-sponsor.

- Event Brand A has Series A; Event Brand B appears as Company B on Series A’s edition sponsor roster.
- Organizer of A is some other Company.
- Matches the bulk of current name-overlap companies (sponsor other series, do not organize own).

### Scenario 4 — Same identity as Scenario 2; Event also sponsors another Event

**Support:** Composition of 2 + 3.

- Same Company is organizer on own editions **and** sponsor on other editions.
- Explicit same-brand link would clarify that the sponsoring Company *is* the Event Brand behind Series X — without changing join targets.
- Current exact-name sample did not show this combo; still a first-class product case.

```text
Scenario 4 (conceptual)
  event_series [Brand X]
       ↑ (optional future same-brand link)
  companies [Brand X]
       ├─ event_edition_organizers → editions of Brand X
       └─ event_sponsors           → editions of Brand Y
```

---

## 8. Existing Architecture We Can Reuse

| Building block | Reuse for same-brand linking |
|----------------|------------------------------|
| Company as sole role target | Keep; do not polymorphic-ize sponsors |
| Orthogonal role joins | Same company can organize + sponsor + exhibit |
| ADR-001 verify-once memory | Pattern for verified Series↔Company link |
| `company_domains` + import match | Suggest candidates; not auto-link Series |
| `merge_companies` + conflict strategies | Lifecycle when linked company is merged |
| Series lifecycle / merge fields | Lifecycle when linked series is merged |
| `assertCompanyLinkable` | Gate link creation |
| Company admin relationship sections | Pattern for “Linked Event Series” read/write |
| Series admin detail | Pattern for “Linked Company” |
| Organizer design principle “warnings, not walls” | Missing link should not block edition save/import |
| Terminology Event Brand / Event Series | Keep; document dual-profile carefully |
| Backlog “event brand as sponsor” problem statement | Valid *problem*; preferred *solution* is dual profile + link, not polymorphic FK |

---

## 9. Risks

1. **Competing product story** — Backlog polymorphic `event_sponsors` → `event_series` vs confirmed Company-only roles. Leaving both live creates design thrash.
2. **Silent dual profiles** — Parallel Series/Company rows already exist; without a link, logos, websites, and SEO entities diverge.
3. **Over-automation** — Auto-linking on name/domain would violate ADR-001 and create false same-brand ties (especially city-branded series under a parent).
4. **Cardinality mistakes** — Forcing 1:1 Company↔Series may break parent-org / multi-brand operators; allowing unconstrained N:N may confuse “same brand.”
5. **Public UX ambiguity** — Event Brand page vs Company (sponsor) page for the same brand without clear cross-links.
6. **Merge/restrict edge cases** — Linked pairs need explicit policies or links will point at tombstones / leak restricted companies.
7. **Import create path** — Continues to mint event-brand Companies without Series awareness → more unlinked pairs (`DQ` pressure).
8. **Terminology debt** — “Company” label vs event brand / government / association; no schema type field (acceptable if documented).
9. **Health Finding `ARC-001`** — Public company visibility relies on app filters; any public cross-link UI must respect `restricted_at` / merged status.
10. **Scope creep** — Redesigning sponsors to target Series, or introducing a Brand super-entity, exceeds the confirmed “eventual explicit link” need.

---

# Phase 2 — Public surfaces, search, SEO, permissions, V1 scope

Phase 1 established that dual profiles already exist and that roles remain Company-centric. Phase 2 asks what that means for visitors, search, crawlers, and a smallest practical V1. Database/domain conclusions from Phase 1 are reused, not re-litigated.

---

## 10. Public UI Findings

### 10.1 Current public destinations

| Entity | Public route | Primary components |
|--------|--------------|--------------------|
| Event Brand (Series) | `/events/series/[slug]` | `series/[slug]/page.tsx`, `SeriesHubHeader`, `SeriesEditionsList` |
| Event (Edition) | `/events/[id]` | `events/[id]/page.tsx`, `PublicEventEditionTabs` |
| Company (public “Sponsor”) | `/sponsors/[slug]` | `sponsors/[slug]/page.tsx`, `SponsorDetailView` |
| Explorers | `/events`, `/sponsors` | Event explorer; sponsor discovery |

Path helpers: `buildSeriesHubPath`, `buildSponsorProfilePath` (`src/lib/routes/explorerUrls.ts`).

### 10.2 Reciprocal links today

| Direction | Present? | Notes |
|-----------|----------|-------|
| Edition → Series hub | **Yes** | Series badge, “Event brand” cell, “More from …” / View all |
| Edition sponsor / exhibitor / PA → Company | **Yes** | Roster rows → `/sponsors/...` |
| Edition organizer → Company | **Yes** | `EventOrganizerListItem` → `/sponsors/...` |
| Series hub → Company (same brand) | **No** | `SeriesHubHeader` shows external website only |
| Company → Series hub (same brand) | **No** | Auth sponsorship history groups by series **name** (plain text); links go to **editions** only |
| Company → “Events organized” | **No** | Deferred in organizer design; admin-only today |

Dual same-name profiles (e.g. TOKEN2049 Series + TOKEN2049 Company) are **unrelated public destinations**. A visitor on the Series hub has no in-product path to the Company profile, and vice versa, except by guessing the other explorer scope.

### 10.3 Navigation patterns

- Global chrome: Events \| Sponsors scope tabs on search (`GlobalSearchBar` / `ExplorerScopeTabs`).
- Series hub: “← Back to Events”; Company: “← Back to Sponsors”.
- Edition breadcrumbs: Events → edition name (**no series crumb**).
- No “related Event Brand” / “related Sponsor profile” chrome for linked dual identities.

### 10.4 Implications for a future same-brand link

Natural public surfaces (options for design — not chosen):

1. **Series hub** — “Also on EventPixels as a Sponsor profile” (or “Organization profile”) when a verified link exists and the Company is publicly safe.
2. **Company profile** — “Event Brand” / series hub link when verified link exists and Series is publicly resolvable.
3. **Edition roles unchanged** — Organizer/Sponsor rows keep pointing at Company; same-brand link is orthogonal metadata, not a replacement for role FKs.
4. **Avoid** implying the Company page *is* the Event Brand page (terminology collision: Public “Event Brand” = Series).

Auth gating note: sponsorship history detail is signed-in-only today (`getSponsorDetailData`). A same-brand Series hub link should be treated as **anonymous-safe catalog navigation** if shown — not buried behind login.

---

## 11. Search Findings

### 11.1 Current search surfaces

| Surface | Scope | Result shape |
|---------|-------|--------------|
| Global search bar | Events **or** Sponsors (tabbed) | Routes into explorer with `q` |
| Event explorer `/events` | Editions (query also matches series name / website host) | `EventCard` editions — not series hubs |
| Sponsor discovery `/sponsors` | Companies | Name + domain + sponsored count |
| Suggest API | Companies | `{ id, slug, name, domain, logo_url }` — no entity-type badge |
| In-edition sponsor search | One edition’s roster | Role-scoped |

### 11.2 Duplicate names & disambiguation

- Series and Company namespaces are **independent**; identical display names are allowed and already observed.
- Searching “TOKEN2049” in **Events** finds editions/series-name matches; in **Sponsors** finds the company. The user must switch scope — **no mixed result list**.
- **No** entity-type badge (“Event Brand” vs “Sponsor”) on suggest rows or event cards beyond series name as card context.
- **No** same-brand disambiguation UX (e.g. “Did you mean the Event Brand or the Sponsor profile?”).

### 11.3 Implications

| Concern | Phase 2 stance |
|---------|----------------|
| False “duplicate” in one list | Low today — scopes are separate |
| User confusion across scopes | Medium — especially for event-brand companies |
| Unified global search | **Out of V1** unless product prioritizes it |
| Labels when a verified link exists | Optional V1: secondary line “Same brand as Event Brand X” on company suggest / profile only |
| Auto-merging search hits | **Forbidden** — same ADR-001 never-guess rule |

---

## 12. SEO Findings

### 12.1 Metadata & indexability (current)

| Entity | Indexability gate | Key helpers |
|--------|-------------------|-------------|
| Company `/sponsors/{slug}` | Not restricted **and** sponsored editions ≥ 1 | `getCompanyIndexability` |
| Edition `/events/{slug}` | Sponsor links ≥ 1 | `getEventEditionIndexability` |
| Series `/events/series/{slug}` | Not merged (active + discontinued indexable) | `getSeriesIndexability`, `resolveSeriesPublicAccess` |

Policy: [`docs/plans/indexability-policy.md`](../plans/indexability-policy.md). Shared site canonical host via `createPageMetadata` / `getSiteUrl`.

**Important for dual profiles:** An event-brand Company that only organizes (TOKEN2049-class) and has **zero** sponsor links may be **noindex** under current company rules, while its Series hub remains indexable. Same-brand linking must not assume both sides are equally indexable.

### 12.2 Structured data

| Surface | JSON-LD today |
|---------|---------------|
| Edition | `Event` (`buildEventJsonLd`) — organizer Organizations; skips restricted when `restricted_at` present; `isPartOf` series |
| Company | `Organization` (`buildOrganizationJsonLd`) — null if restricted |
| Series hub | **Metadata only — no JSON-LD** |

A verified same-brand link does **not** automatically require merging into one schema.org entity. Safer V1 SEO stance: keep two pages / two graphs; optionally add a soft cross-reference in copy or a future `sameAs` / `url` relation once product locks cardinality — **do not** invent a single URL that replaces both destinations in V1.

### 12.3 Canonical & redirects

| Case | Today | Same-brand implication |
|------|-------|------------------------|
| Merged series | `resolveSeriesPublicAccess` → `permanentRedirect` or tombstone + noindex | Link must follow successor or clear |
| Merged company | `company_slug_redirects` exists in DB; **not used in `src/`** public routes | Loser slugs typically **404**; indexability policy already marks successor redirects as future |
| Restricted company | Profile 404 / path builder returns null | Must not surface from Series hub |
| Discontinued series | Still public + indexable | Link may remain valid |

Canonical collision risk if product later tries to make Company and Series “the same page”: high — URLs, index gates, and content models differ. Prefer **two canonicals + reciprocal links**.

### 12.4 Sitemap

Companies: active, non-restricted, ≥1 sponsorship. Series: exclude merged. Editions: ≥1 sponsor. A linked pair can appear as **0, 1, or 2** sitemap entries depending on each side’s gates — expected and fine for V1.

---

## 13. Permissions & Lifecycle Findings

### 13.1 Restricted companies

| Layer | Behavior |
|-------|----------|
| Profile load | Filtered `restricted_at IS NULL` → 404 |
| `buildSponsorProfilePath` | Returns `null` when restricted |
| Sponsor / exhibitor roster UI | Scrubs domain/logo; `RESTRICTED_COMPANY_ROSTER_LABEL` |
| Discovery / suggest / sitemap / Organization JSON-LD | Excluded or null |
| Edition Event JSON-LD organizers | Skips when `restricted_at` present on organizer payload |
| **Organizer list mapping gap** | `mapOrganizerCompany` (`mapPublicOrganizers.ts`) **drops `restricted_at`**, so organizer rows may still emit profile hrefs that 404 — pre-existing hygiene issue amplified if same-brand UI trusts organizer mapping |

**Same-brand V1 rule (recommended):** Never publish a Series→Company reciprocal link if the Company is restricted, merged, or fails public profile eligibility. Series hub remains independently public.

### 13.2 Merged / discontinued

| Entity | Public behavior | Link policy recommendation |
|--------|-----------------|----------------------------|
| Company merged | Tombstone + slug often rewritten; public redirect **not** implemented | Do not create/keep public link to tombstone; repoint to survivor only after re-verification or automated successor policy (open decision) |
| Series merged | Redirect to successor when available | Follow successor for public link target |
| Series discontinued | Hub still shown | Link may remain if Company still public |

`assertCompanyLinkable` already blocks attaching merged companies to roles — reuse for same-brand **create**.

### 13.3 Verification requirements

Aligned with ADR-001:

- Same-brand link creation requires **human verification** (admin).
- Import may **suggest** candidates (name / shared domain) — never auto-create the link.
- No public self-serve verification in V1.
- Domain verification (`company_domains`) remains **Company identity** memory, not proof of Series same-brand identity by itself (shared domain is a **hint** only).

---

## 14. Recommended V1 Scope

### 14.1 Smallest practical V1

**Goal:** Make dual profiles *intentionally* connectable and *safely* discoverable without rebuilding search, SEO graphs, or role models.

| Layer | V1 intent |
|-------|-----------|
| Data | Optional verified Series↔Company link (schema shape deferred to design; options A–D in §3.4) |
| Admin | Create / clear link on Series and/or Company detail; refuse merged; decide restricted policy |
| Public | Bidirectional reciprocal nav when link exists **and** both sides are publicly safe |
| Import | Suggestion / warning only |
| Search / SEO | No unified search; no merged schema.org entity; no shared canonical |

### 14.2 Required / optional / future

#### Required for V1

1. Product lock on **cardinality** (at least: one Series ↔ at most one “same-brand” Company for V1, or explicit multi-link rules).
2. Explicit decision to **defer/supersede** polymorphic `event_sponsors` → `event_series` ([`docs/backlog.md`](../backlog.md)).
3. Admin ability to **verify and store** a same-brand link (and remove it).
4. Lifecycle guards: no link to **merged** Company; Series merge follow/clear policy documented and enforced.
5. Public reciprocal links **only when** Company is not restricted and resolves publicly; Series is not an unresolved merged tombstone.
6. Terminology-safe copy that does not equate Public “Event Brand” (Series) with the Company/Sponsor profile.
7. Import: **no auto-link**.

#### Optional for V1 (nice if cheap)

1. Admin candidate suggestions (exact name and/or shared normalized domain) into a review UI.
2. Secondary label on Company profile: “Also an Event Brand on EventPixels” (and reverse).
3. Company profile link to Series hub in the anonymous header area (not only inside gated sponsorship history).
4. Fix organizer `restricted_at` mapping gap as adjacent hygiene (helps role UI even without same-brand).
5. Wire `company_slug_redirects` in public routes (independent SEO debt; helps linked survivors).

#### Future (explicitly out of V1)

1. Unified global search mixing Event Brands and Companies.
2. Polymorphic sponsor/organizer targets pointing at `event_series`.
3. Brand super-entity above Series + Company.
4. Automatic same-brand linking from import or domain match.
5. Merging Series and Company into one public URL / one indexable document.
6. Shared logo sync / forced single canonical website across both profiles.
7. Public “Events organized” marketing section (still deferred per organizer design) unless product reopens it.
8. `sameAs` / advanced schema.org graph stitching.
9. City/regional brand graphs (Consensus vs Consensus Hong Kong) beyond manual distinct links.
10. Organizer Excel import + auto-suggest same-brand for edition’s Series.

### 14.3 What V1 deliberately does *not* change

- Role join targets (stay Company).
- Edition roster UX as the definition of identity.
- Indexability formulas (Company still needs sponsorship count ≥ 1 to index; Series rules unchanged) — unless product separately revisits “organizer-only event-brand companies.”

---

## 15. Remaining Product Decisions

Carry-forward from Phase 1, narrowed by Phase 2:

### Must decide before design lock

1. **Cardinality** — V1 default recommendation to evaluate: **at most one** verified same-brand Company per Series and **at most one** Series per Company; multi-brand parent orgs stay unlinked or link only the matching brand.
2. **Public reciprocal copy & placement** — Series hub and/or Company header; anonymous-visible or not.
3. **Restricted companies** — Link may exist in admin but **never** publicize; or refuse link entirely while restricted.
4. **Merged entities** — Auto-repoint vs require re-verification after company merge / series merge.
5. **Backlog polymorphic sponsors** — Formally supersede, defer, or rewrite problem statement to “dual profile + link.”
6. **Organizer-only Companies** — Should a Company that only organizes (0 sponsorships) remain noindex after linking? Separate SEO product call.

### Can defer past V1 design

7. Creation policy (auto-create Company when creating Series).
8. Suggestion rule richness beyond exact name / shared domain.
9. Admin ownership preference if bidirectional UI is accepted.
10. Shared logo / single canonical website.
11. City / regional brand taxonomy.
12. Partner Alumni / Exhibitor special cases (likely none — pure Company membership).
13. Organizer import same-brand hints.
14. Unified search disambiguation UX.
15. Company public merge redirects (can ship independently).

---

## 16. Recommended Next Steps

1. **Design document** — *Event Series ↔ Company same-brand link (design)* that:
   - Locks Phase 1 confirmed decisions + Phase 2 V1 required list (§14.2).
   - Chooses cardinality and schema option family (A–D) without writing migrations yet.
   - Specifies admin verify UX, public reciprocal link rules, and merge/restrict matrices.
   - Explicitly rejects polymorphic sponsor targets for the confirmed model.
   - Adds terminology notes for dual public destinations (no table renames).
2. **Optional parallel hygiene** (can be separate small scopes): organizer `restricted_at` mapping; company slug redirect consumption.
3. **Only after design approval** — open a thin implementation phase (migration + admin + minimal public links).

Do **not** start with search unification or SEO graph merging.

---

## Appendix A — Key references

| Kind | Path |
|------|------|
| Project state | `docs/project-state.md` |
| Terminology | `docs/terminology.md` |
| Company identity | `docs/adr/ADR-001-company-identity.md` |
| Website identity | `docs/adr/ADR-002-company-website-canonical-identity.md` |
| Organizer design | `docs/organizer-design.md` |
| Exhibitor design | `docs/exhibitor-design.md` |
| Partner Alumni | `docs/partner-alumni-design.md` |
| Admin IA | `docs/admin-information-architecture.md` |
| Event admin workflow | `docs/event-admin-workflow.md` |
| Sponsor import DB | `docs/sponsor-import-database-design.md` |
| Domain matching plan | `docs/implementation/company-domain-matching-v1.md` |
| Indexability policy | `docs/plans/indexability-policy.md` |
| SEO foundation | `docs/plans/seo-foundation.md` |
| Backlog (competing idea) | `docs/backlog.md` § Event sponsor entity expansion |
| Data quality baseline | `docs/health/data-quality/2026-07-data-quality.md` |
| Linkability gate | `src/lib/companies/assertCompanyLinkable.ts` |
| Restriction helpers | `src/lib/companies/companyPublicRestriction.ts` |
| Series public merge resolution | `src/lib/seo/resolveSeriesPublicAccess.ts` |
| Indexability helpers | `src/lib/seo/indexability.ts` |
| Event / Organization JSON-LD | `src/lib/seo/eventJsonLd.ts`, `src/lib/seo/organizationJsonLd.ts` |
| Series hub UI | `src/features/events/components/series/SeriesHubHeader.tsx` |
| Company public UI | `src/features/sponsors/components/detail/SponsorDetailView.tsx` |
| Organizer public mapping | `src/features/events/server/mapPublicOrganizers.ts` |
| Path builders | `src/lib/routes/explorerUrls.ts` |
| Migrations (illustrative) | `supabase/migrations/20260708120000_organizers_v1.sql`, `20260725130000_event_exhibitors_v1.sql`, `20260624120000_company_merge_phase1.sql`, `20260706120000_event_edition_lifecycle_merged.sql` |

## Appendix B — Audit method

### Phase 1
- Read-only inspection of live `public` schema (columns, constraints, indexes, RLS policies, relevant RPCs).
- Read-only aggregate/sample queries for name-overlap Series↔Company pairs and role patterns.
- Documentation review of design ADRs, admin workflows, import policy, backlog, and prior Health Check notes.

### Phase 2
- Read-only review of public marketing routes, search/explorer surfaces, SEO/indexability modules, JSON-LD builders, and restriction/merge handling in application code.
- Cross-check against [`docs/plans/indexability-policy.md`](../plans/indexability-policy.md) and SEO plan docs.
- **No** migrations, code changes, data writes, commits, or pushes.

## Appendix C — Live name-overlap sample (2026-07-31)

Case-insensitive name match between non-merged `event_series` and non-merged `companies`. Role flags derived from edition joins.

| Series / Company name | Organizes own series | Sponsors other series | Notes |
|-----------------------|----------------------|-----------------------|-------|
| Blockchain Futurist Conference | No | Yes | Near-identical websites (`futuristconference.com`) |
| Consensus by CoinDesk | No | Yes | Shared CoinDesk host pattern |
| Consensus Hong Kong | No | Yes | Distinct company domain vs parent Consensus site |
| ETHGlobal | No | Yes | Series website path `/events` vs company root |
| European Blockchain Convention | No | Yes | Matching domains |
| Istanbul Blockchain Week | No | Yes | Matching domains |
| Korea Blockchain Week | No | Yes | Matching domains |
| London Blockchain Conference | No | Yes | Matching domains |
| Singapore Fintech Festival / Singapore FinTech Festival | No | Yes | Same brand; name casing differs; matching domain |
| TOKEN2049 | **Yes** | No | Scenario 2 exemplar; near-identical websites |

**Catalog scale at sample time:** ~37 non-merged series; ~4,560 active companies; ~75 organizer links; ~7,287 sponsor links; ~56 exhibitor links.

## Appendix D — Phase 2 scenario lens (public)

| Scenario | Public UX today | V1 with verified link |
|----------|-----------------|------------------------|
| 1. Event ≠ Organizer | Edition → organizer Company; Series hub independent | Unchanged; no same-brand link required |
| 2. Same identity | Two destinations, no cross-nav (TOKEN2049) | Reciprocal Series ↔ Company links when safe |
| 3. Event sponsors Event | Company profile of brand B on edition of A; Series B hub separate | Link clarifies B’s Company *is* Event Brand B |
| 4. Same identity + sponsors others | Composition of 2+3; rare in sample | Same as 2, plus existing sponsor joins |

---

**End of audit (Phase 1 + Phase 2).**
