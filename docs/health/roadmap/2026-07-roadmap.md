# Roadmap Review — 2026-07

**Review type:** Roadmap Review
**Cadence:** Monthly
**Cycle:** 2026-07
**Date:** 2026-07-24
**Reviewer:** Roadmap (Automated)
**Baseline:** true
**Status:** Immutable historical record — do not edit after publication.

> Baseline Roadmap Health Check under Framework v1.1. No prior `roadmap/` report existed. New Findings are `ROAD-001`…`ROAD-002`. Cross-audit topics already tracked under `PROD` / `ARC` / `HYG` are referenced, not duplicated. This review evaluates roadmap quality only — not product completeness, feature planning, or reprioritization.

---

## Executive summary

First Roadmap cycle for EventPixels. Scope: whether documented delivery plans accurately represent current product and engineering direction. Compared the canonical `docs/implementation-roadmap.md` (v1, last updated 2026-06-03) to shipped admin/public surfaces, migrations, later phase/design docs, and competing plans under `docs/plans/`.

Net result: the canonical implementation roadmap is no longer a trustworthy source of truth for progress or direction. Sponsor-import phases 2–4 remain unmarked while the pipeline is shipped; the same document is silent on major post-v1 domains that now define engineering work (venues, organizers, partner alumni, exhibitors). Two ROAD Findings opened. Remaining Phase 5 gaps that are still truly incomplete (e.g. admin global search) are correctly unfinished in the roadmap and already owned by `PROD-001` — not duplicated here.

Strengths: several later phase/scope docs carry accurate **Implemented** / design status (e.g. venues, organizers, phase-3 sponsor import API); the SEO plan is explicitly labeled “roadmap only — no implementation,” which is honest planning hygiene for that track.

---

## Findings

### ROAD-001 — Canonical implementation roadmap still marks sponsor-import phases 2–4 incomplete

- **Why it matters:** Operators and engineers reading the titled “Implementation Roadmap (v1)” will treat unchecked Phase 2–4 exit criteria as unfinished work, even though sponsor import schema, API, and admin UI are already live. That misstates progress, duplicates planning effort, and conflicts with more accurate phase docs.
- **Severity:** High  ·  **Effort:** Small  (descriptive only)
- **Evidence:**
  - `docs/implementation-roadmap.md` — **Last updated:** 2026-06-03; Overview marks only Phase 1 ✅; Phase 2 exit criteria all unchecked (migration / tables / RLS); Phase 3 exit criteria unchecked (API happy path, publish, guards); Phase 4 exit criteria unchecked (E2E UI upload → publish).
  - Contrasting phase doc: `docs/phase-3-sponsor-import-api.md` — **Status: Implemented**.
  - Shipped evidence (source of truth for delivery): `src/features/sponsor-import/**`, `src/app/admin/sponsor-imports/**`, `src/app/api/admin/sponsor-imports/**`, admin nav “Sponsor imports” (`src/lib/constants/navigation.ts`), and applied migrations `20260610120000_sponsor_import_phase2.sql` through later sponsor-import follow-ups (publish RPC, tier label, materialize chunks, etc.).
  - `docs/project-state.md` describes admin sponsor imports as a full Excel pipeline through atomic publish and history.
  - **Source-of-truth judgment:** Implementation + `phase-3-sponsor-import-api.md` + migrations outweigh the June 3 checklist markers in `implementation-roadmap.md`. The conflict is unresolved roadmap drift, not evidence that import should be torn down.
- **Status:** Open
- **Recommended action:** Update `docs/implementation-roadmap.md` Phase 2–4 status/exit criteria to match shipped reality (or mark those phases complete and point to the Implemented phase docs / migrations). Do not invent new phases here — only correct progress accuracy.
- **Scope / affected docs:** `docs/implementation-roadmap.md` (Phases 2–4); cross-check `docs/phase-3-sponsor-import-api.md`
- **Validation / acceptance criteria:** A reader of the canonical roadmap can tell sponsor-import migration/API/UI are complete without contradicting shipped `/admin/sponsor-imports` or Implemented phase docs.
- **Uncertainty / false-positive risk:** Low for “shipped vs unchecked.” Some Phase 5 QA/sign-off items may still be open; this Finding is limited to Phases 2–4 progress markers.
- **Links:** Evidence docs above; related product gap for remaining Phase 5 search: `PROD-001`

### ROAD-002 — Canonical implementation roadmap no longer represents current engineering direction

- **Why it matters:** The document still presents itself as the approved delivery plan for “events setup → sponsor import → QA,” while substantial shipped and planned work lives only in separate phase/design/SEO docs. Without a current canonical direction artifact, planning hygiene fails: completed post-v1 work looks invisible, and “what is the roadmap?” becomes ambiguous.
- **Severity:** High  ·  **Effort:** Medium  (descriptive only)
- **Evidence:**
  - `docs/implementation-roadmap.md` scope/intro still centers admin events + sponsor import + QA; Document history has a single entry (2026-06-03); no mention of venues, organizers, partner alumni, exhibitors, or company-identity programs.
  - Shipped post-v1 domains (not in canonical roadmap): Venues (`docs/phase-venue-scope.md` Status: Implemented; `src/features/venues/**`; admin nav Venues); Organizers (`docs/phase-organizer-scope.md` Status: Implemented); Partner Alumni (`docs/phase-partner-alumni-scope.md` + `src/features/partner-alumni/**` / import); Exhibitors E1–E6 shipped (`supabase/migrations/20260725130000_event_exhibitors_v1.sql`, `20260726120000_exhibitor_import_v1.sql`, `src/features/exhibitors/**`, `src/features/exhibitor-import/**`, commits through `a33f304`).
  - Competing / parallel plans: `docs/plans/seo-implementation-roadmap.md` (explicitly “Roadmap only — no implementation,” dated 2026-07-16); multiple `docs/phase-*.md` and design docs carry the real delivery narrative.
  - Design drift example: `docs/exhibitor-design.md` §10 still labels **E6 — Bulk import (future)** while E6 is shipped (commit `a33f304`, migration applied) — planning artifact lag adjacent to the canonical roadmap gap.
  - **Source-of-truth judgment:** For *what the product currently is*, shipped code + Implemented phase docs win. For *active SEO sequencing*, the labeled SEO roadmap is intentionally separate and honest. For *canonical “Implementation Roadmap”*, the June 3 document is no longer authoritative direction — it is historical unless updated or formally superseded.
- **Status:** Open
- **Recommended action:** Either (a) revise `docs/implementation-roadmap.md` so its status/scope honestly reflects current multi-domain direction and points to active phase/design/SEO plans, or (b) formally retire/supersede it as historical v1 sponsor-import delivery and designate the current canonical direction index. Do **not** use this Finding to invent new feature priorities — only restore directional clarity.
- **Scope / affected docs:** `docs/implementation-roadmap.md`; related phase/design/plan corpus under `docs/` and `docs/plans/` (as references, not a DOC corpus rewrite)
- **Validation / acceptance criteria:** An engineer can answer “what is the current approved delivery direction?” from a clearly labeled canonical artifact without contradicting Implemented phase docs or major shipped admin domains.
- **Uncertainty / false-positive risk:** Medium on *how* to restructure docs (retire vs rewrite). Low on the claim that the June 3 roadmap is incomplete as a current-direction document.
- **Links:** Phase/venue/organizer/PA/exhibitor docs above; SEO plan: `docs/plans/seo-implementation-roadmap.md`

---

## Observations (not tracked)

- **Phase 5 admin global search** remains unchecked in `implementation-roadmap.md` and is still not shipped — that progress marker is *accurate*. Product ownership for the missing capability is already `PROD-001`; no ROAD duplicate.
- **SEO implementation roadmap** is clearly labeled non-implemented and decision-driven — good planning hygiene for a parallel track; not treated as a stale “secret second product roadmap.”
- **Import subsystem duplication** (`sponsor-import` / `partner-alumni-import` / now `exhibitor-import`) remains an Architecture concern (`ARC-011`); Roadmap notes only that post-v1 import tracks are invisible in the canonical roadmap (`ROAD-002`), without re-filing structural debt.
- **Public `/exhibitors` stub framing** remains `PROD-002`; not reframed as a roadmap Finding.
- Methods: read `docs/implementation-roadmap.md`, selected phase/design/plan docs, `navigation.ts`, feature module presence, migration filenames, recent `git log`; did not exercise browser workflows.
- Limitations: no external project tracker (Linear/GitHub Projects) consulted; some phase docs may themselves lag in subsections (e.g. exhibitor E6 “future” label) even when Status headers are current.

---

## Change log

| Date | Note |
|------|------|
| 2026-07-24 | Baseline Roadmap Review published (`ROAD-001`, `ROAD-002`). |
