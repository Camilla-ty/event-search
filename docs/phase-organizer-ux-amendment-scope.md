# Phase — Organizer UX Amendment: Implementation Scope

**Status:** Implemented  
**Version:** v1 amendment (O5)  
**Last updated:** 2026-07-04  

Presentation-only amendment to **Organizer v1** (O1–O4 complete). Realigns admin and public surfaces per QA feedback. **No schema, migration, API, merge, or `last_reviewed_at` policy changes.**

**Source of truth:** [organizer-design.md](./organizer-design.md) — amended sections supersede O1–O4 UX locks where they conflict.

**Prerequisites:** Organizer v1 implemented ([phase-organizer-scope.md](./phase-organizer-scope.md)); migrations applied through `20260709120000_company_merge_organizers.sql`.

---

## 1. Summary

| Area | Before (O1–O4) | After (O5 amendment) |
|------|----------------|----------------------|
| **Admin write surface** | Dedicated **Organizers** tab on edition detail | **Profile** section — edition metadata alongside venue, website, city, dates |
| **Admin tabs** | Profile · Organizers · Live sponsors · Imports | Profile · Live sponsors · Imports |
| **Public read surface** | Organizers block on **Overview** (hidden when empty) | Dedicated **Organizers** tab (`?tab=organizers`) |
| **Public tab order** | Overview \| Sponsors \| Venue | Overview \| Sponsors \| Venue \| **Organizers** |
| **Public empty state** | Omit section on Overview | **Always show Organizers tab**; standard empty state inside tab |
| **Database / API** | Unchanged | Unchanged |

**Venue parallel (locked):** Admin assigns venue on **Profile**; public consumes venue on a **dedicated tab**. Organizers follow the same split after this amendment.

---

## 2. Locked decisions

### 2.1 Admin

| # | Decision |
|---|----------|
| A1 | **Remove** the dedicated Organizers tab from edition detail |
| A2 | **Embed** organizer management in the **Edition Profile** experience |
| A3 | Organizers are **edition metadata** — same class as venue, website, city, and dates — not a large operational dataset like sponsors or imports |
| A4 | Same capabilities: list, add (company search), edit `role_label`, Move Up/Down, remove |
| A5 | Company detail **Organizer roles** remains read-only; deep links target edition **Profile** (not `?tab=organizers`) |
| A6 | Legacy admin URL `?tab=organizers` may redirect to Profile or be ignored — implementation choice; document in PR |

### 2.2 Public

| # | Decision |
|---|----------|
| P1 | Add dedicated **Organizers** tab on Event Detail |
| P2 | Tab order: **Overview \| Sponsors \| Venue \| Organizers** |
| P3 | **Move** organizer list out of Overview into the Organizers tab — **do not duplicate** on Overview |
| P4 | Organizers remain **fully public** (anon/authenticated SELECT all rows; no tier gate) |
| P5 | **Always show** the Organizers tab — even when zero links |
| P6 | When zero organizers: **standard empty state inside the tab** (mirror Venue tab empty-state pattern) — **do not hide the tab** |

### 2.3 Unchanged

- `event_edition_organizers` schema, RLS, constraints  
- Admin API routes under `/api/admin/event-editions/[id]/organizers/...`  
- Company merge organizer conflict resolution  
- `last_reviewed_at`: add / remove / role edit ✅; reorder ❌  
- Non-goals: top-level admin Organizers nav, `/organizers/...` routes, public “Events organized”, Explorer cards, global admin search  

---

## 3. Explicit non-goals (amendment)

| Non-goal | Notes |
|----------|-------|
| Schema or migration changes | Presentation only |
| New API endpoints | Reuse existing organizer admin API |
| Organizers on Overview **and** Organizers tab | **Move only** — no duplicate public surfaces |
| Hide Organizers tab when empty | Tab always visible |
| Reintroduce admin Organizers tab | Profile embed is the write surface |

---

## 4. Admin UX deliverables

### 4.1 Edition detail tabs

| Order | Tab | Query param |
|-------|-----|-------------|
| 1 | Profile | `profile` (default) |
| 2 | Live sponsors | `sponsors` |
| 3 | Imports | `imports` |

Remove `organizers` from `EditionDetailTabs` (or equivalent).

### 4.2 Profile — Organizers section

Embed existing organizer panel (or equivalent) on **Profile**:

| Affordance | Behavior (unchanged from O2) |
|------------|------------------------------|
| Section heading | **Organizers** (or equivalent) |
| List | Companies with `role_label`, `display_order`, actions |
| Add organizer | Company search picker; default role **Organizer** |
| Edit role | Drawer; empty / >80 chars rejected |
| Move Up / Down | Server-managed dense order |
| Remove | Confirm modal — company not deleted |
| Empty state | Friendly copy + Add CTA when no links |
| Create company | Escape hatch to `/admin/companies/new` |

**Placement:** Below core profile fields and venue picker; above or below research metadata — implementation layout choice. Organizers are **not** mixed into Live sponsors or Imports tabs.

### 4.3 Company detail

| Change | Detail |
|--------|--------|
| Organizer roles links | `/admin/events/editions/[id]` (Profile default) — remove `?tab=organizers` |

---

## 5. Public UX deliverables

### 5.1 Tab bar

Update `PublicEventEditionTabs` (or equivalent):

```
Event Edition
├── Overview      — no organizers block
├── Sponsors      — unchanged
├── Venue         — unchanged
└── Organizers    — organizer list or empty state (?tab=organizers)
```

### 5.2 Organizers tab content

When ≥1 organizer link:

| Element | Source |
|---------|--------|
| Company name | `companies.name` |
| Role label | Join row `role_label` |
| Company link | `/sponsors/[slug]` (existing company profile route) |
| Logo | Company logo when available |
| Order | `display_order` ASC |

When zero links:

| Element | Behavior |
|---------|----------|
| Tab visibility | **Always shown** |
| Body | Standard empty state (heading + short explanatory copy) — same family as Venue tab when no venue linked |

### 5.3 Overview

**Remove** `EventOrganizersSection` (or equivalent) from the Overview panel. Overview content unchanged otherwise (history, research information, related editions, etc.).

---

## 6. Implementation boundaries

| Layer | Change |
|-------|--------|
| `EditionDetailTabs` | Remove organizers tab; drop `organizersPanel` prop |
| Edition detail page | Render organizer panel inside Profile panel |
| `PublicEventEditionTabs` | Add fourth tab + `organizersPanel` prop |
| Event detail page | Move organizers from `overviewPanel` to `organizersPanel` |
| `CompanyOrganizerRolesTable` | Update edition deep links |
| `EditionOrganizersPanel` | Update helper copy (remove Overview references) |
| Server / API / DB | **No change** |

---

## 7. QA checklist (amendment)

### Admin — Profile organizers section

- [ ] Edition detail tabs: **Profile · Live sponsors · Imports** only (no Organizers tab)
- [ ] Organizers section visible on **Profile** tab
- [ ] Add / edit role / reorder / remove behave as O2
- [ ] Empty state with Add CTA when no organizers
- [ ] Company Organizer roles links open edition **Profile**

### Public — Organizers tab

- [ ] Tab order: Overview \| Sponsors \| Venue \| Organizers
- [ ] Organizers tab **always visible** (including zero-link editions)
- [ ] ≥1 organizer: list with name, role, logo, company link; order matches admin
- [ ] Zero organizers: empty state **inside tab** — tab not hidden
- [ ] Overview has **no** Organizers section
- [ ] Sponsors and Venue tabs unchanged

### Regression

- [ ] Sponsor import flow unchanged
- [ ] Last-reviewed rules unchanged (add/remove/role ✅; reorder ❌)
- [ ] Company merge organizer conflicts unchanged
- [ ] `npm run build` + organizer-related tests pass

---

## 8. Documentation deliverables (this phase — docs first)

| Document | Action |
|----------|--------|
| [organizer-design.md](./organizer-design.md) | Amend §8, §9, §11, §12, §13 |
| [phase-organizer-scope.md](./phase-organizer-scope.md) | Add §16 amendment reference; update summary pointers |
| [project-state.md](./project-state.md) | Admin/public organizer bullets; in-progress O5 |
| [README.md](./README.md) | Organizer highlights + link to this doc |
| [admin-information-architecture.md](./admin-information-architecture.md) | Edition tabs, journey, §7.8 → Profile section |
| [event-admin-workflow.md](./event-admin-workflow.md) | Profile embed; public tab order |
| [phase-1-events-admin-scope.md](./phase-1-events-admin-scope.md) | Footnote: organizers on Profile (amendment) |
| This document | **Approved** |

**No update:** [organizer-migration-design.md](./organizer-migration-design.md), [operations/backup-policy.md](./operations/backup-policy.md), [phase-edition-last-reviewed-automation-scope.md](./phase-edition-last-reviewed-automation-scope.md) (policy unchanged).

---

## 9. Exit criteria

- [x] Amendment scope approved and documented
- [x] Living docs reconciled (§8)
- [x] Implementation complete (admin Profile embed + public tab)
- [ ] §7 QA checklist pass (manual)
- [x] [project-state.md](./project-state.md) updated when O5 ships

---

## 10. Related documents

| Document | Path |
|----------|------|
| Organizer design (amended) | [organizer-design.md](./organizer-design.md) |
| Organizer v1 scope (O1–O4) | [phase-organizer-scope.md](./phase-organizer-scope.md) |
| Venue design (IA parallel) | [venue-design.md](./venue-design.md) |
| Admin IA | [admin-information-architecture.md](./admin-information-architecture.md) |
| Event admin workflow | [event-admin-workflow.md](./event-admin-workflow.md) |

---

**Amendment approval (2026-07-04):** Locked admin Profile embed + public Organizers tab with always-visible tab and in-tab empty state. Implementation (O5) follows documentation sync.

---

**End of organizer UX amendment scope.**
