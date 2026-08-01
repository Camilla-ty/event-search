# ADR-004: Event Series ↔ Company Same-Brand Profile Link

**Status:** Accepted  
**Date:** 2026-07-31  
**Related:**
- [Architecture Audit — Linked Event Series & Company Profiles](../audits/event-series-company-same-brand-architecture-audit.md) (**source of truth for exploration**)
- [ADR-005 — Event Brand Public Profile Policy](./ADR-005-event-brand-public-profile-policy.md) (**amends** public dual-destination V1 for approved Event Brand Companies; link + Company-only roles unchanged)
- [ADR-001 — Company Identity & Multi-Domain Matching](./ADR-001-company-identity.md)
- [Terminology](../terminology.md)
- [Project state](../project-state.md)
- [Backlog — Event sponsor entity expansion](../backlog.md) (**superseded by this ADR**)

---

## 1. Context and problem

EventPixels models two catalog identities that often describe the same real-world brand:

| Profile | Table | Public term | Role |
|---------|-------|-------------|------|
| Event Series | `event_series` | **Event Brand** | The recurring event itself |
| Company | `companies` | Sponsor / organization profile (`/sponsors/...`) | Organizational identity for participation |

Participant roles — Organizer, Sponsor, Exhibitor, Partner Alumni membership — already reference **Company only**. That works when an event brand sponsors or organizes (including another event’s roster): the brand appears as a Company on edition joins.

Live catalog data already contains **dual profiles** (same or near-same name in both tables, e.g. TOKEN2049, ETHGlobal) with **no explicit relationship**. Public Series hubs and Company pages are separate destinations with no reciprocal navigation. A backlog idea proposed making `event_sponsors` polymorphic (`company` **or** `event_series`), which would fork the role model.

**Problem:** The product needs a way to state that an Event Series profile and a Company profile represent the **same brand**, without collapsing the two profile types, without changing role join targets, and without guessing identity from imports.

Exploration and options: [same-brand architecture audit](../audits/event-series-company-same-brand-architecture-audit.md) (Phase 1 + Phase 2).

---

## 2. Decision

EventPixels adopts an **optional, admin-managed, 1:1 same-brand link** from Event Series to Company.

| Rule | Decision |
|------|----------|
| Profile types | **Event Series** and **Company** remain separate profile types and separate public URLs |
| Role targets | Organizer, Sponsor, Exhibitor, and Partner Alumni roles continue to reference **Company only** |
| Relationship | Optional **1:1** same-brand link (at most one Company per Series; at most one Series per Company) |
| Storage | Nullable FK on series: **`event_series.company_profile_id` → `companies.id`** |
| Cardinality enforcement | Nullable FK ⇒ ≤1 Company per Series; **unique** constraint/index on `company_profile_id` where set ⇒ ≤1 Series per Company |
| Create / remove | **Manual Admin only** |
| Verification | Saving the link **is** verification — **no** separate proposed / approved workflow in V1 |
| Public V1 | Simple **reciprocal links** between the two profiles when the link exists and the Company is publicly safe |
| Restricted / unavailable Company | **Do not** show a public reciprocal link to a restricted or otherwise unavailable Company |
| Merges | **Do not** automatically repoint the link after company or series merges — require **Admin review** |
| Competing backlog | **Supersede** polymorphic Sponsor → `event_series` with this dual-profile + same-brand link approach |

Guiding identity principle (unchanged from ADR-001):

> Never guess.  
> A human verifies once.  
> EventPixels remembers forever.

Here, “remembers forever” means the stored FK until an Admin clears or revises it — not automatic inference from name or domain.

---

## 3. Relationship semantics

### 3.1 What the link means

`event_series.company_profile_id = C` means:

> This Event Series (public Event Brand) and Company `C` are the **same brand** for EventPixels catalog purposes.

It does **not** mean:

- The Company *is* the Event Series row
- Every organizer of the Series must be that Company
- Sponsor/exhibitor/Partner Alumni rows should point at the Series
- The two public pages share one URL, one logo, or one canonical website

### 3.2 Orthogonality to roles

Edition role joins remain independent:

```text
event_series ──(optional same-brand)──► companies
     │                                      ▲
     └── event_editions                     │
              ├── event_edition_organizers ─┘
              ├── event_sponsors ───────────┘
              └── event_exhibitors ─────────┘
```

A Series may link to Company C as same brand while editions of that Series are organized by a *different* Company (Scenario 1). Company C may also sponsor other Series’ editions (Scenarios 3–4).

### 3.3 Optional

Most Series need no Company profile link. A link is created only when an Admin asserts same-brand identity (typically when the brand also participates as Company, or dual profiles already exist).

### 3.4 1:1

| Side | Constraint |
|------|------------|
| Series → Company | At most one `company_profile_id` |
| Company → Series | At most one Series may reference a given Company as same-brand |

Parent organizations that run multiple event brands are **not** modeled as one Company linked to many Series via this FK. Those Series stay unlinked or each links only to its matching brand Company (if one exists).

### 3.5 Verification model (V1)

| Action | Meaning |
|--------|---------|
| Admin sets `company_profile_id` | Link is **verified** |
| Admin clears `company_profile_id` | Link removed |
| Import / domain / name match | May **suggest** candidates in a future UI — must **not** write the FK |

No `proposed` / `rejected` status column in V1.

### 3.6 Public visibility (V1)

When a verified link exists:

| Condition | Public reciprocal link |
|-----------|------------------------|
| Company active, not restricted, profile resolvable | **Show** Series hub ↔ Company profile links |
| Company restricted, merged, or otherwise unavailable | **Do not show** public link to that Company (Series hub remains independently public) |
| Series merged / unresolved tombstone | Follow existing series public access rules; do not invent a public same-brand destination |

Anonymous visitors may see reciprocal links (catalog navigation). Do not bury the Series↔Company cross-link only inside gated sponsorship history.

Copy must preserve terminology: Public **Event Brand** = Series hub; Company page remains the organization/sponsor profile — not a second “Event Brand” page label.

### 3.7 Merge behavior (V1)

| Event | Automatic behavior | Required Admin action |
|-------|--------------------|----------------------|
| Linked Company merged into survivor | **Do not** auto-repoint `company_profile_id` | Review: clear, or set to survivor if still same brand |
| Linked Series merged into successor | **Do not** auto-copy link onto successor | Review successor Series link independently |
| Company restricted after link | Keep or clear FK per admin ops; **public** link hidden while restricted | Confirm whether to keep admin-side link |

Implementation should refuse creating a new link to a **merged** Company (reuse `assertCompanyLinkable` / equivalent). Leaving a stale FK after a later merge is possible until Admin review — public rendering must still suppress unsafe targets.

---

## 4. Why the FK approach was chosen

Selected approach matches audit **Option A** (FK on series), with the column named **`company_profile_id`** for clarity (not overloaded with edition-role `company_id` joins).

| Reason | Detail |
|--------|--------|
| Matches 1:1 product rule | Nullable FK naturally expresses “at most one Company per Series” |
| Series owns event identity | Same-brand Company is an optional attribute of the Event Series |
| Smallest schema change | One column + FK + uniqueness — no junction table for V1 |
| Reverse discovery | Company admin/public can query `event_series` where `company_profile_id = :id` |
| Aligns with optional link | `NULL` = no same-brand Company asserted |
| Avoids role-model fork | Keeps all participation on Company; no polymorphic sponsor targets |

---

## 5. Alternatives considered

| Alternative | Sketch | Why not chosen for V1 |
|-------------|--------|------------------------|
| **B. FK on company** (`companies.event_series_id`) | Company “is an event brand” pointer | Series is the event identity; same-brand is more naturally owned by Series. Same 1:1 math, weaker narrative fit |
| **C. Junction table** | `event_series_company_links` | Extra table unnecessary while cardinality is strict 1:1 and V1 has no link metadata beyond existence |
| **D. Junction + proposed/verified status** | Review workflow states | Admin save-as-verified is enough for V1; status workflow deferred |
| **E. Brand super-entity** | New identity above Series + Company | Disproportionate to the need; collapses profile separation the product wants to keep |
| **Polymorphic `event_sponsors` → company \| series** | Backlog “Event sponsor entity expansion” | Conflicts with “roles always reference Company”; duplicates dual-profile problem inside every role table; **superseded** |
| **Name/domain auto-link** | Infer same brand from overlap | Violates ADR-001 never-guess; false positives (e.g. city brands under a parent) |

---

## 6. Consequences and trade-offs

### Positive

- Dual profiles become an intentional, navigable model instead of silent duplicates.
- Role architecture stays Company-centric and consistent with organizer/exhibitor/Partner Alumni design.
- Polymorphic sponsor complexity is avoided.
- Public V1 cost is low: reciprocal links only.
- Admin control matches verify-once culture.

### Trade-offs / risks

- **1:1 rigidity** — Multi-series parent orgs cannot hang many Series off one Company via this FK; that is intentional for “same brand,” not “same owner.”
- **Stale FKs after merge** — Manual review can lag; public suppression of restricted/unavailable targets is mandatory defense.
- **Column on series only** — Company UI must use reverse lookup; document both admin surfaces in implementation scope.
- **Two SEO documents remain** — Series and Company keep separate canonicals and indexability gates; linking does not merge schema.org entities in V1.
- **Organizer-only Companies** may remain `noindex` under current sponsorship-count rules even when linked to an indexable Series — unchanged unless product revisits indexability separately.
- **Terminology risk** — Public copy must not call the Company page an “Event Brand.”

### Non-consequences (explicit)

- No rename of `companies` or public `/sponsors` routes in this ADR.
- No change to edition roster UX as the place roles are curated.
- No requirement that every Series have a Company profile.

---

## 7. V1 scope

### In scope (when implemented)

1. Schema: nullable `event_series.company_profile_id` → `companies.id`, plus uniqueness for 1:1.
2. Admin: set and clear the link (Series-primary; Company detail may show reverse link and affordance).
3. Guards: refuse link to merged companies; public render rules for restricted/unavailable.
4. Public: simple reciprocal navigation on Series hub and Company profile when safe.
5. Documentation/terminology notes for dual destinations.
6. Backlog polymorphic sponsor item marked superseded (this ADR).

### Out of V1 implementation package (see §8)

Import auto-link, unified search, SEO graph merge, shared logo/website sync, brand super-entity, polymorphic roles, separate approval workflow, automatic merge repoint.

---

## 8. Explicitly deferred work

| Item | Notes |
|------|-------|
| Import candidate suggestions | Allowed later as **warnings/suggestions only** |
| Unified Events + Sponsors search / disambiguation UX | |
| Polymorphic role targets | Superseded as product direction |
| Brand super-entity | |
| Auto-link from name or domain | |
| Single shared public URL or merged indexability | |
| Forced shared logo / single canonical website across profiles | |
| `sameAs` / advanced JSON-LD stitching | |
| Separate proposed/verified/rejected workflow | |
| Automatic link repoint on merge | |
| Public “Events organized” on Company marketing profile | Still deferred per organizer design unless reopened |
| Organizer Excel import + same-brand hints | |
| City/regional brand taxonomy (e.g. Consensus vs Consensus Hong Kong) | Manual distinct links only |
| Company public slug-redirect consumption | Independent SEO debt |
| Organizer `restricted_at` mapping hygiene | Adjacent bugfix; not required to accept this ADR |
| Organizer-only Company indexability after link | Separate SEO product decision |

---

## 9. Implementation prerequisites

Before coding, produce a thin **implementation / phase scope** (not another open architecture exploration) that covers:

1. Migration sketch for `company_profile_id` (FK delete rule, unique index, RLS unchanged for public read of series).
2. Admin API validation (active/linkable company; unique conflict messages).
3. Public data loaders: resolve linked company for series hub; resolve linked series for company profile; apply restriction/availability gates.
4. Copy strings consistent with [terminology.md](../terminology.md).
5. Merge-admin UX or checklist: after company/series merge, surface Series with stale `company_profile_id` for review.
6. Update [project-state.md](../project-state.md) when shipped.
7. Tests for 1:1 uniqueness, public suppression of restricted targets, and no auto-write from import paths.

**Scope document:** [phase-event-series-company-same-brand-scope.md](../phase-event-series-company-same-brand-scope.md) (SB0–SB4).

**Implementation status (2026-07-31):** SB0–SB3 complete per the phase scope (schema, Admin link lifecycle, public reciprocal links, focused tests/docs/regressions). **SB4** (manual dual-profile candidate review) remains pending and must not be automated.

**This ADR does not authorize migrations or application code by itself.** Implementation starts only when coding is explicitly requested against that phase scope.

---

## 10. Supersession of polymorphic Sponsor backlog

The backlog item **Event sponsor entity expansion** proposed allowing `event_sponsors` to point at `company` **or** `event_series`.

**Status under this ADR:** **Superseded.**

| Problem the backlog named | Solution under this ADR |
|---------------------------|-------------------------|
| Event brands appear on sponsor rosters | Event brand has a **Company** profile used in `event_sponsors` |
| Series already exists for that brand | Optional **same-brand link** connects Series ↔ Company |
| Public should reach the event brand | Reciprocal link to Series hub from Company (and reverse) — roster rows still link to Company |

Do not implement polymorphic sponsor (or organizer/exhibitor) FKs toward `event_series` unless a future ADR explicitly revokes this decision.

---

## 11. References

| Document | Role |
|----------|------|
| [event-series-company-same-brand-architecture-audit.md](../audits/event-series-company-same-brand-architecture-audit.md) | Exploration source of truth (Phase 1 + 2) |
| [ADR-001](./ADR-001-company-identity.md) | Never-guess / verify-once identity culture |
| [ADR-002](./ADR-002-company-website-canonical-identity.md) | Company website identity (orthogonal) |
| [terminology.md](../terminology.md) | Event Brand vs Event Series wording |
| [organizer-design.md](../organizer-design.md) | Company-only organizer joins |
| [exhibitor-design.md](../exhibitor-design.md) | Company-only exhibitor joins |
| [partner-alumni-design.md](../partner-alumni-design.md) | Company members on series-scoped program |
| [plans/indexability-policy.md](../plans/indexability-policy.md) | Separate Series/Company index gates |
| [backlog.md](../backlog.md) | Polymorphic sponsor item — superseded |
| [docs/README.md](../README.md) | Documentation index |
| [phase-event-series-company-same-brand-scope.md](../phase-event-series-company-same-brand-scope.md) | Thin V1 implementation scope (SB0–SB4) |

---

## 12. Document history

| Date | Change |
|------|--------|
| 2026-07-31 | Accepted — locks optional 1:1 `event_series.company_profile_id`, admin verify-on-save, public reciprocal links, no merge auto-repoint, supersedes polymorphic sponsors |
| 2026-07-31 | Linked thin implementation scope [phase-event-series-company-same-brand-scope.md](../phase-event-series-company-same-brand-scope.md) |
| 2026-07-31 | Implementation status note: SB0–SB3 complete; SB4 manual candidate review pending |
| 2026-08-01 | Related: [ADR-005](./ADR-005-event-brand-public-profile-policy.md) amends public dual-destination / reciprocal-link V1 for **approved Event Brand Companies** (Series-first public identity; Company public profile retirement over time). Same-brand FK, Company-only roles, and never-guess linking unchanged. |

---

**End of ADR-004.**
