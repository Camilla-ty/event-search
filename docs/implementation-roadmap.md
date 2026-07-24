# EventPixels — Implementation Roadmap

**Status:** Canonical
**Role:** Project-wide implementation roadmap **index** only
**Last updated:** 2026-07-24
**Purpose:** Point engineers to the authoritative phase, design, and plan documents for each major domain. This file does **not** define phase sequencing, timelines, or new priorities.

For current shipped product state, see [project-state.md](./project-state.md).
For unapproved future ideas, see [backlog.md](./backlog.md).
For engineering completion criteria, see [standards/definition-of-done.md](./standards/definition-of-done.md).

---

## Authority

| Document | Role |
|----------|------|
| **This file** | Canonical project-wide roadmap **index** |
| [implementation-roadmap-v1.md](./implementation-roadmap-v1.md) | **Historical** v1 Events Admin + Sponsor Import five-phase plan |
| Domain phase / design / plan docs linked below | Authoritative scope and status for each domain |
| [project-state.md](./project-state.md) | Current shipped snapshot (maintain when domains change) |

Do not treat the historical v1 document as the whole-product roadmap.

---

## Domain index

Statuses below summarize what existing documents and shipped code already establish. They do not invent work or reorder priorities.

| Domain | Authoritative documents | Notes |
|--------|-------------------------|-------|
| **Events Admin** (series, editions, companies) | [phase-1-events-admin-scope.md](./phase-1-events-admin-scope.md), [event-admin-workflow.md](./event-admin-workflow.md), [admin-information-architecture.md](./admin-information-architecture.md), [implementation-roadmap-v1.md](./implementation-roadmap-v1.md) (Phase 1) | v1 Events Admin track — see historical roadmap |
| **Location usability** | [phase-1.1-location-scope.md](./phase-1.1-location-scope.md) | Phase 1.1 |
| **Sponsor Import** | [sponsor-import-database-design.md](./sponsor-import-database-design.md), [sponsor-import-migration-design.md](./sponsor-import-migration-design.md), [phase-3-sponsor-import-api.md](./phase-3-sponsor-import-api.md), [implementation-roadmap-v1.md](./implementation-roadmap-v1.md) (Phases 2–4) | Migration / API / UI complete per historical v1; residual Phase 5 items remain there |
| **Venues** | [venue-design.md](./venue-design.md), [phase-venue-scope.md](./phase-venue-scope.md), [venue-migration-design.md](./venue-migration-design.md) | |
| **Organizers** | [organizer-design.md](./organizer-design.md), [phase-organizer-scope.md](./phase-organizer-scope.md), [phase-organizer-ux-amendment-scope.md](./phase-organizer-ux-amendment-scope.md), [organizer-migration-design.md](./organizer-migration-design.md) | |
| **Partner Alumni** | [partner-alumni-design.md](./partner-alumni-design.md), [phase-partner-alumni-scope.md](./phase-partner-alumni-scope.md), [partner-alumni-import-redesign.md](./partner-alumni-import-redesign.md), [partner-alumni-migration-design.md](./partner-alumni-migration-design.md) | |
| **Exhibitors** | [exhibitor-design.md](./exhibitor-design.md) | Design + phased plan E0–E6; consult shipped code for current implementation state |
| **Edition research metadata** | [phase-edition-last-reviewed-automation-scope.md](./phase-edition-last-reviewed-automation-scope.md) | |
| **Company identity & merge** | [adr/ADR-001-company-identity.md](./adr/ADR-001-company-identity.md), [adr/ADR-002-company-website-canonical-identity.md](./adr/ADR-002-company-website-canonical-identity.md), [phase-company-website-identity-scope.md](./phase-company-website-identity-scope.md), [implementation/company-domain-matching-v1.md](./implementation/company-domain-matching-v1.md) | |
| **Restricted companies** | [plans/protection-v1.md](./plans/protection-v1.md), [plans/indexability-policy.md](./plans/indexability-policy.md) | Public restriction / discovery exclusion |
| **Event Explorer / public discovery** | [phase-event-explorer-sort-scope.md](./phase-event-explorer-sort-scope.md) | |
| **Public sponsor roster** | [adr/ADR-003-tier-lazy-loaded-event-sponsors.md](./adr/ADR-003-tier-lazy-loaded-event-sponsors.md), [phase-public-sponsor-roster-lazy-load-scope.md](./phase-public-sponsor-roster-lazy-load-scope.md) | |
| **SEO / indexability** | [plans/seo-implementation-roadmap.md](./plans/seo-implementation-roadmap.md), [plans/seo-foundation.md](./plans/seo-foundation.md) | Parallel track — explicitly labeled roadmap-only where stated |
| **Terminology & IA** | [terminology.md](./terminology.md), [admin-information-architecture.md](./admin-information-architecture.md) | |

---

## Historical v1 track

The original five-phase plan (Events Admin → Sponsor Import migration → API → UI → QA) is preserved at:

**[implementation-roadmap-v1.md](./implementation-roadmap-v1.md)**

Use that document for v1 exit criteria and any remaining Phase 5 checklist items. Open product gaps that belong to Findings (for example admin global search) remain in the [Findings Register](./health/findings-register.md), not as invented roadmap priorities here.

---

## Document history

| Date | Change |
|------|--------|
| 2026-07-24 | Canonical project-wide index created; former five-phase document reclassified as [implementation-roadmap-v1.md](./implementation-roadmap-v1.md) (`ROAD-002`) |
