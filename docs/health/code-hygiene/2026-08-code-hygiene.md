# Code Hygiene Audit — 2026-08

**Review type:** Code Hygiene Audit
**Cadence:** Monthly
**Cycle:** 2026-08
**Date:** 2026-07-23
**Reviewer:** Code Hygiene (Automated)
**Baseline:** false
**Status:** Immutable historical record — do not edit after publication.

> Recurring Code Hygiene Health Check under Framework v1.1. Prior report: [`2026-07-code-hygiene.md`](./2026-07-code-hygiene.md). This cycle records resolution of `HYG-001` only; no full Code Hygiene re-audit was run. `HYG-002` and `HYG-003` remain open.

---

## Executive summary

`HYG-001` is resolved. Tracked temporary/operational artifacts under `tmp/`, `reports/`, and `.tmp-before-phase1/` were removed from the tree. Two logo-migration rollback backups required by packaged scripts were moved to `scripts/archives/logo-migrations/` and script defaults were updated to those paths. Root `.gitignore` now excludes `/tmp/`, `/reports/`, `/.tmp-before-phase1/`, and `/tmp-domain-samples.test.ts` so fresh script output stays local.

`HYG-002` and `HYG-003` are unchanged.

---

## Since last cycle

| Change | Finding IDs | Notes / links |
|---|---|---|
| Resolved (removed from register) | `HYG-001` | Deleted tracked run artifacts; archived two rollback backups; updated `.gitignore` and rollback/cleanup default paths. Original write-up: [Code Hygiene 2026-07 §HYG-001](./2026-07-code-hygiene.md). |
| Still open | `HYG-002`, `HYG-003` | Unchanged this cycle. |
| In progress | — | |
| Deferred | — | |
| New this cycle | — | |
| Reopened (same ID) | — | |

---

## Findings

No new Code Hygiene Findings this cycle. Existing Findings are referenced by ID only (canonical bodies remain in [Code Hygiene 2026-07](./2026-07-code-hygiene.md)).

---

## Observations (not tracked)

- Application runtime paths were not changed; only operational artifact hygiene and script default backup paths for emergency rollbacks.
- New script runs may still write under `reports/` or `tmp/`; those directories are now gitignored by design.
- `scripts/archives/logo-migrations/` is intentionally version-controlled.

---

## Change log

| Date | Note |
|------|------|
| 2026-07-23 | Resolved `HYG-001`. Moved two logo rollback backups to `scripts/archives/logo-migrations/`; removed remaining `tmp/` / `reports/` / `.tmp-before-phase1/` / `tmp-domain-samples.test.ts` tracked artifacts; updated `.gitignore` and rollback/cleanup defaults. |
