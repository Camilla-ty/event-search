# Code Hygiene Audit — 2026-07

**Review type:** Code Hygiene Audit
**Cadence:** Monthly
**Cycle:** 2026-07
**Date:** 2026-07-23
**Reviewer:** Code Hygiene (Automated)
**Baseline:** true
**Status:** Immutable historical record — do not edit after publication.

> Baseline Code Hygiene Health Check under Framework v1.1. No prior `code-hygiene/` report existed. New Findings are `HYG-001`…`HYG-003`. Cross-audit topics already tracked under `ARC` / `SEC` IDs are referenced, not duplicated (`audit-catalog.md`; `README.md` §5a). Prefer few high-value Findings over micro-findings.

---

## Executive summary

First Code Hygiene cycle for EventPixels. Scope: repository cleanliness — unused/obsolete code, temporary artifacts, one-off operational scripts, and related clutter. Excluded: Architecture structure/debt (`ARC`), application security (`SEC`), Dependabot advisories (`DEP`), performance, product, and documentation corpus quality.

Methods: layout inspection; `git ls-files` for tracked temp/generated paths; ripgrep for `console`/`debugger`, TODO-style markers, and skipped/focused tests; package.json vs `scripts/` cross-check; import/route verification for suspected unused modules.

Three Findings recorded: tracked temporary/operational artifacts (~9.8 MB), an unused superseded edition-imports stub, and unretired incident-specific partner-alumni repair scripts. No HYG Findings resolved (baseline). Strengths: almost no TODO/FIXME debt in `src/`; production `console.log` noise is minimal; CLI logging in `scripts/` is intentional.

---

## Findings

### HYG-001 — Tracked temporary run artifacts and scratch files in git

- **Why it matters:** Generated migration/audit JSONL, screenshots, a partial `.next` tree, and root scratch tests are versioned (~9.8 MB across 38 paths). They inflate the repo, obscure real source changes, and leave one-off QA/repair scripts discoverable as if they were supported tooling.
- **Severity:** Medium  ·  **Effort:** Small  (descriptive only)
- **Evidence:**
  - `git ls-files` includes `reports/*.jsonl` (15 files), `tmp/*.jsonl`, `tmp/*.ts`, `tmp/**/*.png`, `.tmp-before-phase1/.next/dev/**` (5 files), and root `tmp-domain-samples.test.ts`.
  - Combined size of those tracked paths ≈ 9.8 MB (`du` on `git ls-files` set).
  - `.gitignore` already ignores `.next/`, `test-results/`, and `scripts/artifacts/`, but **does not** ignore `tmp/`, `reports/`, or `.tmp-before-phase1/`.
  - `tmp-domain-samples.test.ts` is a sample harness that `console.log`s and asserts `assert.ok(true)` (always passes).
  - `tmp/qa-company-logo-upload.ts`, `tmp/retry-failed-logo-migration.ts`, `tmp/verify-logo-migration.ts` are explicit one-off QA/repair scripts living under `tmp/`.
- **Status:** Open
- **Recommended action:** Remove tracked artifacts from git history going forward (delete from tree + add `tmp/`, `reports/`, `.tmp-before-phase1/` to `.gitignore`). Retain any required audit evidence outside the repo or under an explicitly documented archive policy. Relocate any still-useful scripts into `scripts/` with clear naming/docs or delete them.
- **Scope / affected files:** `tmp/**`, `reports/**`, `.tmp-before-phase1/**`, `tmp-domain-samples.test.ts`, `.gitignore`
- **Validation / acceptance criteria:** Those paths are untracked (or gone); `.gitignore` prevents re-commit; `git status` stays clean of new JSONL/screenshot dumps after routine script runs.
- **Uncertainty / false-positive risk:** Low for generated JSONL/screenshots/`.next` fragments. Some `tmp/*.ts` scripts might still be useful — relocate rather than blindly delete if owners want retention.
- **Links:** —

### HYG-002 — Unused superseded `EditionImportsStub` after live imports panel shipped

- **Why it matters:** The edition admin page uses `EditionImportsPanel`, but `EditionImportsStub.tsx` remains and still claims “Phase 4” / disabled import UX. Dead UI surface misleads readers and was already noted for cleanup in project state.
- **Severity:** Low  ·  **Effort:** Small  (descriptive only)
- **Evidence:**
  - Live consumer: `src/app/admin/events/editions/[id]/page.tsx` imports and renders `EditionImportsPanel` only.
  - `rg EditionImportsStub` finds **no** runtime imports — only the stub file itself and a cleanup note in `docs/project-state.md`.
  - Stub copy still says “Sponsor import for this event will be available in Phase 4” while `/admin/sponsor-imports` and edition import history are live.
- **Status:** Open
- **Recommended action:** Delete `src/features/events/components/admin/EditionImportsStub.tsx` (and drop the project-state cleanup bullet when done).
- **Scope / affected files:** `src/features/events/components/admin/EditionImportsStub.tsx`
- **Validation / acceptance criteria:** File removed; `rg EditionImportsStub` returns no matches under `src/`; edition imports tab still renders `EditionImportsPanel`.
- **Uncertainty / false-positive risk:** Low — no dynamic import string references found. Confirm no external docs/screenshots that still instruct use of the stub component name (docs cleanup is secondary).
- **Links:** Related note (not a Finding): `docs/project-state.md` cleanup item 10.

### HYG-003 — Unretired NFT.NYC partner-alumni corruption repair scripts

- **Why it matters:** Two scripts hard-code program/version/catalog IDs and perform destructive cleanup for a single incident. They are not wired through `package.json`, have no in-repo consumers, and look runnable — accidental re-execution could delete data again.
- **Severity:** Medium  ·  **Effort:** Small  (descriptive only)
- **Evidence:**
  - `scripts/cleanup-nft-nyc-pa-corrupt.ts` — hardcoded `PROGRAM_ID`, `VERSION_ID`, `CATALOG_IDS`; deletes version members / version / bogus companies.
  - `scripts/cleanup-nft-nyc-pa-corrupt-resume.ts` — same catalog IDs; scans companies by `created_at` window and numeric names.
  - Neither appears in `package.json` `scripts`, GitHub workflows, or other source references (`rg cleanup-nft-nyc` → only these files).
- **Status:** Open
- **Recommended action:** Confirm the incident is fully closed; then either delete the scripts or move them to a clearly marked archive (e.g. `scripts/archive/incidents/`) with a README stating “do not run.” Prefer delete if backups/docs already record the repair.
- **Scope / affected files:** `scripts/cleanup-nft-nyc-pa-corrupt.ts`, `scripts/cleanup-nft-nyc-pa-corrupt-resume.ts`
- **Validation / acceptance criteria:** Scripts removed or quarantined with explicit non-run marking; no `package.json` entry invites execution; owners acknowledge incident is closed.
- **Uncertainty / false-positive risk:** Medium — incident might still need a documented resume path. Do not delete without owner confirmation if production residue remains.
- **Links:** —

---

## Cross-audit references (existing Findings — not duplicated)

| Topic observed | Existing ID | Why not a new HYG Finding |
|---|---|---|
| Near-duplicate sponsor / partner-alumni import subsystems (incl. parallel drawers) | `ARC-011` | Architecture owns structural duplication of subsystems |
| Very large modules / components | `ARC-012` | Architecture owns structural “god module” debt |
| Thin Playwright coverage | `ARC-020` | Architecture/testing coverage posture, not test-file hygiene |
| No CI gate | `ARC-005` | CI architecture |
| Missing dependency vulnerability scanning (historical) | `SEC-001` (retired) | Live monitoring is `DEP` / Security history — not unused-package hygiene |

---

## Observations (not tracked)

**Methods / scope**
- Inspected `src/`, `scripts/`, `e2e/`, root, `tmp/`, `reports/`, `.tmp-before-phase1/`, `package.json`, `.gitignore`, `.github/workflows/`.
- Excluded from unused-code deep dive: full graph analysis of every export (no knip/ts-prune configured); dynamic string references may hide rare consumers.
- Limitations: without a dedicated unused-export tool, “unused file” claims beyond verified zero-reference cases (e.g. `EditionImportsStub`) stay observations.

**Strengths**
- No `TODO` / `FIXME` / `HACK` / `XXX` hits under `src/`, `scripts/`, or `e2e/` in this scan.
- Application `src/` has essentially no ad-hoc `console.log`; `importToDraftPipelineLog.ts` uses structured `console.info`/`console.error` as intentional pipeline logging (observability gap remains `ARC-008`).
- `describe.skip` in `adminRpcPermissions.integration.test.ts` is env-gated integration opt-in — not abandoned test hygiene debt.
- `scripts/backup/*` is referenced by GitHub Actions — not orphaned.

**Deliberate / acceptable**
- CLI `console.log` in `scripts/*` operational tools.
- Measure helpers (`scripts/measure-event-explorer-*.ts`) and verify helpers (`scripts/verify-*.ts`) without npm script aliases — runnable via `npx tsx`; low urgency.
- `scripts/convert-remaining-company-logo-urls-to-relative.ts` appears a specialized companion to the packaged migrate/rollback scripts — retain until logo URL migration is confirmed complete.
- Dual `RowDecisionDrawer` implementations — covered by `ARC-011`, not filed again under HYG.

**Follow-ups (not Findings)**
- Local untracked CSVs under `docs/audits/` are already gitignored by pattern — good; keep them uncommitted.
- Consider adding an unused-export check (knip/ts-prune) in a later cycle once CI (`ARC-005`) exists — tooling gap observation only.

---

## Change log

| Date | Note |
|------|------|
| 2026-07-23 | Baseline Code Hygiene Audit published. Added `HYG-001`–`HYG-003`. Cross-referenced `ARC-005/011/012/020` and retired `SEC-001`. No issues fixed during the review. |
