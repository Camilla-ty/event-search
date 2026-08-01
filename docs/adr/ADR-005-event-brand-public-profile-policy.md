# ADR-005: Event Brand Public Profile Policy

**Status:** Accepted  
**Date:** 2026-08-01  
**Related:**
- [ADR-004 — Event Series ↔ Company Same-Brand Profile Link](./ADR-004-event-series-company-same-brand-link.md) (**prerequisite link model**; public dual-destination V1 policy **amended** here for Event Brand Companies)
- [ADR-001 — Company Identity & Multi-Domain Matching](./ADR-001-company-identity.md)
- [Participated Events Tab Placement Audit](../audits/participated-events-tab-placement-audit.md)
- [Same-Brand Company Public Redirect Audit](../audits/same-brand-company-public-redirect-audit.md) (**historical exploration**; default dual-destination / no-redirect stance superseded for approved Event Brand Companies by this ADR)
- [Series Hub vs Edition Tabs Reuse Audit](../audits/series-hub-vs-edition-tabs-reuse-audit.md)
- [Terminology](../terminology.md)
- [Indexability policy](../plans/indexability-policy.md)
- [Phase — Event Brand Public Profile (ADR-005)](../phase-event-brand-public-profile-scope.md) (**thin implementation scope** — EB0–EB6; not authorized by ADR alone)

---

## 1. Motivation

EventPixels already separates **Event Series** (public **Event Brand**) from **Company** (organizational identity). Participant roles — Sponsor, Organizer, Exhibitor, Partner Alumni — always reference **Company**. ADR-004 added an optional, admin-verified **1:1 same-brand link** so a Series and a Company can represent the same real-world brand without collapsing tables or making roles polymorphic.

That model correctly kept **two catalog entities**. Early public V1 under ADR-004 treated them as **two public destinations** with reciprocal navigation. After the **Participated Events** Series-hub prototype, product direction changed:

| Observation | Implication |
|-------------|-------------|
| Visitors looking for an Event Brand already land on the Series hub | Series is the natural **public identity** for Event Brands |
| Sponsorship of *other* events is brand-level activity, not a second “org homepage” | **Participated Events** on the Series hub is the right public surface |
| A parallel `/sponsors/...` page for the same brand competes with the Event Brand hub | Event Brand **Company** profiles should leave the **public** experience over time |
| Roles still need a Company row | Event Brand Companies **remain internal** for joins, imports, and Admin |

This ADR locks the **public-profile policy** for Event Brands. It does **not** by itself authorize schema, data, route, or SEO implementation.

---

## 2. Product goals

1. **One public Event Brand destination** — the Event Series hub (`/events/series/...`) is the public identity for an Event Brand.
2. **Participated Events as brand activity** — when an Event Brand sponsors (or otherwise appears via its linked Company on) other events, that history is shown on the Series hub (Participated Events), not as a substitute Company marketing page.
3. **Preserve the Company role model** — all edition and program roles continue to point at Company; Event Brand Companies stay in the database for those relationships.
4. **Manual, conservative rollout** — only **Admin-approved** Companies are treated as Event Brand Companies for this public policy; never infer from name or domain.
5. **Leave normal Companies alone** — ordinary Sponsor / organization profiles keep today’s Sponsor Profile behavior and URLs.
6. **No polymorphic roles** — do not point Sponsor (or other role) FKs at Event Series.

---

## 3. Architecture principles

| Principle | Meaning |
|-----------|---------|
| **Two entities, one public face (for Event Brands)** | Series and Company remain separate rows; for approved Event Brand pairs, **public** experience converges on Series |
| **Company is the organizational join target** | Sponsor, Organizer, Exhibitor, Partner Alumni always reference `companies` |
| **Series owns Event Brand public identity** | Public copy, hub UX, and (over time) discovery for the brand center on Series |
| **Same-brand link is the gate** | ADR-004 `event_series.company_profile_id` remains the structural assertion that Series ↔ Company are the same brand |
| **Public hide/redirect is a separate, manual approval** | Existence of the same-brand link alone does **not** automatically remove the Company from public; an **additional** per-Company approval drives public-profile retirement |
| **Never guess** | Aligns with ADR-001 — no automatic Event Brand detection from name, domain, website, or import heuristics |
| **Verify once, remember** | Admin approval of Event Brand public policy is stored and reused until Admin revises it |

```text
Public (Event Brand, approved):
  Visitor ──► Event Series hub
                 ├── Events (own editions)
                 └── Participated Events  (via linked Company → role joins)

Internal (unchanged):
  event_sponsors / organizers / exhibitors / PA ──► companies
  event_series.company_profile_id ──► companies   (ADR-004 same-brand)
```

---

## 4. Approved rules

### 4.1 Entity roles

| Entity | Internal role | Public role (Event Brand path) |
|--------|---------------|--------------------------------|
| **Event Series** | Recurring event identity | **Public Event Brand** profile |
| **Company** (Event Brand) | Organizational row for roles + same-brand link | **Not** the long-term public Event Brand face; intended to leave public UX over time once approved |
| **Company** (normal) | Organizational row for roles | **Sponsor Profile** unchanged (`/sponsors/...`) |

### 4.2 Participated Events

- **Participated Events** is the approved **public** way to surface an Event Brand’s activity at **other** events.
- Primary placement remains the **Event Series hub** (see placement audit).
- Data continues to resolve through the linked Company and existing Company-targeted role tables (e.g. `event_sponsors`) — **not** by pointing role FKs at Series.

### 4.3 Event Brand Company public profiles

- Event Brand Companies **continue to exist** internally.
- Their **public** Sponsor Profile experience is intended to **disappear over time** (hide, noindex, redirect, or equivalent — exact mechanism deferred to implementation design).
- That public retirement is **manually approved per Company**, not applied catalog-wide when a same-brand link exists.
- Until a given Company is approved for public retirement, existing public Company behavior may remain (safe default).

### 4.4 Normal Companies

- Companies that are **not** approved Event Brand public-profile cases continue to use **Sponsor Profiles** unchanged.
- Same-brand link without Event Brand public-profile approval does **not** force Sponsor Profile removal.

### 4.5 Detection and roles

| Rule | Decision |
|------|----------|
| Auto-detect Event Brand from name | **Forbidden** |
| Auto-detect Event Brand from domain / website | **Forbidden** |
| Polymorphic Sponsor → Series | **Forbidden** (ADR-004 supersession stands) |
| Role targets | **Company only** |

### 4.6 Approval model (policy level)

| Layer | What Admin asserts |
|-------|-------------------|
| **Same-brand link (ADR-004)** | Series and Company are the same brand |
| **Event Brand public-profile approval (this ADR)** | This Company’s public Sponsor Profile should follow Event Brand policy (Series-first; public Company profile retired over time) |

Both are **manual**. Linking alone ≠ public-profile retirement. Exact Admin UX and storage for the second approval are **implementation-scoped** (see §7 / §8).

---

## 5. Non-goals

This ADR does **not**:

1. Authorize schema migrations, data backfills, redirects, or route changes by itself.
2. Merge Series and Company into one database entity or brand super-table.
3. Make roles polymorphic (`event_sponsors` → company **or** series).
4. Auto-classify Companies as Event Brands from name, domain, website, or imports.
5. Change public behavior for **normal** (non–Event Brand) Companies.
6. Require every Series to have a Company, or every Company to be an Event Brand.
7. Force immediate catalog-wide hide/redirect of all linked Companies.
8. Replace Admin Company management — Admin Company surfaces remain required for roles, domains, merges, and same-brand link maintenance.
9. Decide final SEO mechanics (301 vs soft noindex-first, sitemap rules, JSON-LD) — those belong in an implementation / phase scope.
10. Relitigate Partner Alumni or edition roster placement beyond Participated Events on the Series hub.

---

## 6. Migration strategy

Phased, **manual**, reversible preference:

| Phase | Intent |
|-------|--------|
| **M0 — Policy lock** | This ADR accepted; no automatic public behavior change |
| **M1 — Product surfaces** | Series hub Participated Events treated as the public Event Brand activity surface (prototype → product as separately authorized) |
| **M2 — Approval affordance** | Admin can mark a linked Company for Event Brand **public-profile** policy (storage TBD in implementation scope) |
| **M3 — Soft public retirement** | For approved Companies only: prefer Series in navigation/copy; optional noindex / sitemap exclude while `/sponsors/...` still resolves |
| **M4 — Hard public retirement** | For approved Companies only: redirect or otherwise remove public Sponsor Profile destination; update outbound public links that previously pointed at that Company profile where product requires Series instead |
| **M5 — Cleanup** | Monitor broken external links, Admin “view public” targets, and indexability; keep internal Company row and role FKs |

**Guardrails:**

- One Company at a time (or small allowlists) — no batch auto-migration from name/domain overlap.
- Same-brand link must exist (or be created under ADR-004 rules) before Event Brand public-profile approval.
- Restricted / merged / unavailable Companies follow existing safety gates; do not invent public destinations.
- Normal Companies never enter M3–M4.

**Explicit:** Choosing M3 vs M4 mechanics, link-rewriting scope (rosters vs direct URL only), and SEO details requires a thin **implementation / phase scope** after this ADR — not implied by acceptance alone.

---

## 7. Open questions

| # | Question | Notes |
|---|----------|-------|
| 1 | Where is Event Brand **public-profile approval** stored? | New column vs flag vs allowlist table; must not overload `company_profile_id` alone |
| 2 | Soft (noindex) first vs hard redirect first for approved Companies? | Redirect audit favored caution; this ADR allows retirement but does not pick the first ship |
| 3 | Do roster / discovery cards for an Event Brand Company link to **Series** or keep Company until M4? | Affects `buildSponsorProfilePath` blast radius |
| 4 | How are **exhibitor-only** (or organizer-heavy) histories on today’s Sponsor page represented after public Company retirement? | May need Series-side surfaces or accepted loss for Event Brand cases |
| 5 | Terminology / copy updates for dual-link chrome once Series is sole public face | [terminology.md](../terminology.md) ADR-004 reciprocal notes may need revision when shipping |
| 6 | Search / suggest: should approved Event Brand Companies stop appearing as Sponsor hits? | Product + SEO |
| 7 | Interaction with company slug redirects and merged-company flows | Keep Admin review culture; no silent auto-repoint beyond ADR-004 |
| 8 | Is reciprocal Series↔Company **header chrome** permanently off for Event Brands, or only until retirement ships? | Prototype currently hides it |

---

## 8. Relationship to ADR-004

| Topic | ADR-004 | ADR-005 |
|-------|---------|---------|
| Same-brand link | **Accepted** — optional 1:1 `event_series.company_profile_id` | **Reuses** as prerequisite |
| Role targets | Company only | **Unchanged** |
| Polymorphic sponsors | Superseded / forbidden | **Reaffirmed** |
| Never-guess linking | Manual Admin verify-on-save | **Extended** to public-profile approval — still manual, still no name/domain auto |
| Public V1 dual destinations + reciprocal links | Stated for V1 | **Amended** for **approved Event Brand Companies**: public experience converges on Series; Company public profile retires over time |
| Normal Companies | N/A beyond link optionality | Sponsor Profiles **unchanged** |
| Schema / implementation | Phase scope SB0–SB4 | **Not authorized** by this document alone |

**Summary:** ADR-004 answers *“Are these the same brand, and how do we store that without forking roles?”*  
ADR-005 answers *“Given same brand, what should the public see?”* — Series hub (+ Participated Events) as Event Brand public identity; Event Brand Company profiles leave public UX under per-Company approval.

Documents that assumed permanent dual public destinations for all linked pairs (including the 2026-08-01 redirect audit’s default “keep both pages”) are **historical for exploration**; their **default product rule** for approved Event Brand Companies is superseded by this ADR. Unapproved / normal Companies remain dual-or-sponsor-profile as today.

---

## 9. Consequences

### Positive

- Clear public story: Event Brand = Series hub.
- Participated Events has an explicit product home.
- Role and import architecture stay Company-centric.
- Rollout stays manual and reversible per Company.

### Trade-offs / risks

- Two approval layers (same-brand vs public-profile) must stay distinct in Admin UX to avoid accidental catalog-wide hides.
- External links to `/sponsors/{event-brand-slug}` will need redirect or soft handling when M4 ships.
- Sponsor-page-only surfaces (e.g. some exhibitor history) need an explicit product answer before hard retirement.
- Until implementation scope ships, catalog may still show dual public pages for linked pairs — policy ahead of mechanics.

### Non-consequences

- No automatic deletion of Company rows.
- No requirement to rename `companies` or immediately remove `/sponsors` routes for all tenants.
- No change to ADR-001 domain identity rules.

---

## 10. Authorization boundary

**This ADR does not authorize** migrations, application code, data writes, redirects, sitemap/robots changes, or Admin UI by itself.

Implementation starts only when explicitly requested against the thin phase scope: [phase-event-brand-public-profile-scope.md](../phase-event-brand-public-profile-scope.md) (recommended first batch **EB0–EB4**, Singapore FinTech Festival only).

---

## 11. References

| Document | Role |
|----------|------|
| [ADR-004](./ADR-004-event-series-company-same-brand-link.md) | Same-brand link; roles Company-only; amended public dual-destination V1 for Event Brands |
| [ADR-001](./ADR-001-company-identity.md) | Never-guess / verify-once |
| [participated-events-tab-placement-audit.md](../audits/participated-events-tab-placement-audit.md) | Series hub as Participated Events placement |
| [same-brand-company-public-redirect-audit.md](../audits/same-brand-company-public-redirect-audit.md) | Historical redirect options / risks |
| [event-series-company-same-brand-architecture-audit.md](../audits/event-series-company-same-brand-architecture-audit.md) | Dual-profile exploration |
| [terminology.md](../terminology.md) | Event Brand vs Event Series wording |
| [plans/indexability-policy.md](../plans/indexability-policy.md) | Separate Series/Company index gates (to be revisited at M3–M4) |
| [phase-event-brand-public-profile-scope.md](../phase-event-brand-public-profile-scope.md) | Thin implementation scope (EB0–EB6) |
| [docs/README.md](../README.md) | Documentation index |

---

## 12. Document history

| Date | Change |
|------|--------|
| 2026-08-01 | Accepted — Event Series as public Event Brand identity; Participated Events as public brand activity; Event Brand Company public profiles retire over time under per-Company approval; normal Companies unchanged; no auto-detect; no polymorphic sponsors; amends ADR-004 public dual-destination stance for approved Event Brand Companies |
| 2026-08-01 | Linked thin implementation scope [phase-event-brand-public-profile-scope.md](../phase-event-brand-public-profile-scope.md) |

---

**End of ADR-005.**
