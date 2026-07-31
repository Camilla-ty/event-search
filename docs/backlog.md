# EventPixels — Product Backlog

**Status:** Living document  
**Last updated:** 2026-07-31  

Future ideas and deferred enhancements for EventPixels. Items here are **not approved for implementation** unless promoted to a dedicated scope or design document.

For the project-wide roadmap index, see [Implementation Roadmap](./implementation-roadmap.md). For the historical v1 Events Admin + Sponsor Import plan, see [Implementation Roadmap v1](./implementation-roadmap-v1.md). For current shipped state, see [Project State](./project-state.md).

**This document is planning only.** No SQL, migrations, API routes, or application code.

---

## How to use this backlog

| Field | Meaning |
|-------|---------|
| **Status** | `Backlog` = captured idea; not scheduled. `Superseded` = replaced by an ADR or design decision — do not implement the historical direction |
| **Priority** | Relative urgency when the item is eventually picked up |
| **Problem** | User or data-model pain today |
| **Future direction** | Intended end state (may span multiple releases) |
| **Recommended v1** | Smallest useful slice if/when work starts |
| **Reason for deferral** | Why this is not active now |

To promote an item: create a `phase-*-scope.md` or design doc, link it here, and update status.

---

## Backlog items

### Event sponsor entity expansion

| Field | Value |
|-------|-------|
| **Title** | Event sponsor entity expansion |
| **Status** | **Superseded** |
| **Priority** | — |
| **Superseded by** | [ADR-004 — Event Series ↔ Company same-brand link](./adr/ADR-004-event-series-company-same-brand-link.md) (2026-07-31) |

**Problem**

Some sponsor or partner entries are actually event brands rather than companies. Example: Nordic Blockchain Conference 2023 lists Singapore FinTech Festival as a Community & Media Partner. Singapore FinTech Festival already exists as an `event_series`, but current sponsor workflows treat all sponsor entries as companies.

**Future direction (historical — do not implement)**

Allow `event_sponsors` to point to either:

- `company`
- `event_series`

**Replacement direction (ADR-004)**

Keep roles Company-only. When an event brand participates, it may have both an Event Series profile and a Company profile, optionally linked 1:1 via `event_series.company_profile_id`. Public reciprocal links connect the two profiles; roster rows continue to reference Company.

**Recommended v1 (historical)**

- Keep bulk upload company-only.
- Allow admin users to manually convert or relink a sponsor entry from company to `event_series`.
- Public sponsor roster should link `event_series` sponsor entries to the series page.
- Do not support `event_edition`, organizer, venue, or media entity targets in v1.

**Reason for supersession**

Polymorphic sponsor targets conflict with the locked “roles always reference Company” model and fork every participation join. The same user problem is solved by dual profiles + an optional verified same-brand link (ADR-004).

---

## Related documents

| Document | Path |
|----------|------|
| ADR-004 — Event Series ↔ Company same-brand link | [adr/ADR-004-event-series-company-same-brand-link.md](./adr/ADR-004-event-series-company-same-brand-link.md) |
| Same-brand architecture audit | [audits/event-series-company-same-brand-architecture-audit.md](./audits/event-series-company-same-brand-architecture-audit.md) |
| Implementation roadmap (canonical index) | [implementation-roadmap.md](./implementation-roadmap.md) |
| Implementation roadmap v1 (historical) | [implementation-roadmap-v1.md](./implementation-roadmap-v1.md) |
| Project state | [project-state.md](./project-state.md) |
| Sponsor import database design | [sponsor-import-database-design.md](./sponsor-import-database-design.md) |
| Partner Alumni design | [partner-alumni-design.md](./partner-alumni-design.md) |
