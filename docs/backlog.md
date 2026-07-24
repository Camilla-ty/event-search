# EventPixels — Product Backlog

**Status:** Living document  
**Last updated:** 2026-07-07  

Future ideas and deferred enhancements for EventPixels. Items here are **not approved for implementation** unless promoted to a dedicated scope or design document.

For the project-wide roadmap index, see [Implementation Roadmap](./implementation-roadmap.md). For the historical v1 Events Admin + Sponsor Import plan, see [Implementation Roadmap v1](./implementation-roadmap-v1.md). For current shipped state, see [Project State](./project-state.md).

**This document is planning only.** No SQL, migrations, API routes, or application code.

---

## How to use this backlog

| Field | Meaning |
|-------|---------|
| **Status** | `Backlog` = captured idea; not scheduled |
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
| **Status** | Backlog |
| **Priority** | Low |

**Problem**

Some sponsor or partner entries are actually event brands rather than companies. Example: Nordic Blockchain Conference 2023 lists Singapore FinTech Festival as a Community & Media Partner. Singapore FinTech Festival already exists as an `event_series`, but current sponsor workflows treat all sponsor entries as companies.

**Future direction**

Allow `event_sponsors` to point to either:

- `company`
- `event_series`

**Recommended v1**

- Keep bulk upload company-only.
- Allow admin users to manually convert or relink a sponsor entry from company to `event_series`.
- Public sponsor roster should link `event_series` sponsor entries to the series page.
- Do not support `event_edition`, organizer, venue, or media entity targets in v1.

**Reason for deferral**

Technically feasible but not urgent. Defer until the sponsor, organizer, venue, and partner-alumni systems are stable.

---

## Related documents

| Document | Path |
|----------|------|
| Implementation roadmap (canonical index) | [implementation-roadmap.md](./implementation-roadmap.md) |
| Implementation roadmap v1 (historical) | [implementation-roadmap-v1.md](./implementation-roadmap-v1.md) |
| Project state | [project-state.md](./project-state.md) |
| Sponsor import database design | [sponsor-import-database-design.md](./sponsor-import-database-design.md) |
| Partner Alumni design | [partner-alumni-design.md](./partner-alumni-design.md) |
