# Security Audit — 2026-08

**Review type:** Security Audit
**Cadence:** Monthly
**Cycle:** 2026-08
**Date:** 2026-07-23
**Reviewer:** Security Health Check (Automated)
**Baseline:** false
**Status:** Immutable historical record — do not edit after publication.

> Recurring Security Health Check under Framework v1.0. Prior report: [`2026-07-security.md`](./2026-07-security.md). This cycle records resolution of `SEC-001` only; no full Security re-audit was run. `SEC-002` and `SEC-003` remain open. Security topics already tracked under `ARC` IDs are unchanged.

---

## Executive summary

Dependabot-based dependency vulnerability alerting is now in place for this repository. `SEC-001` is resolved and removed from the live Findings Register.

The fix is GitHub-native: Dependency graph, Dependabot alerts, and Dependabot security updates are enabled in repository Advanced Security settings. Routine Dependabot version-update PRs were not enabled (no `.github/dependabot.yml`), and no `npm audit` script or CI SCA job was added. Application runtime, dependencies, Vercel, Supabase, and Cloudflare were not changed.

`SEC-002` and `SEC-003` remain open. Architecture-owned security cross-refs (`ARC-001`, `ARC-007`, `ARC-009`, `ARC-015`, `ARC-016`, `ARC-017`) are unchanged.

---

## Since last cycle

| Change | Finding IDs | Notes / links |
|---|---|---|
| Resolved (removed from register) | `SEC-001` | Closed by enabling GitHub Dependabot alerts + security updates for npm (`package-lock.json`); version updates and auto-merge left off. Original write-up: [Security 2026-07 §SEC-001](./2026-07-security.md). Repo: [Dependabot alerts](https://github.com/Camilla-ty/event-search/security/dependabot); settings: [Advanced Security](https://github.com/Camilla-ty/event-search/settings/security_analysis). |
| Still open | `SEC-002`, `SEC-003` | Unchanged this cycle. |
| In progress | — | |
| Deferred | — | |
| New this cycle | — | |
| Reopened (same ID) | — | |

---

## Findings

No new Security Findings this cycle. Existing Security Findings are referenced by ID only (canonical bodies remain in [Security 2026-07](./2026-07-security.md)).

### SEC-001 — No dependency vulnerability scanning

- **Delta:** Resolved. Known npm dependency vulnerabilities are now surfaced via Dependabot alerts; Dependabot may open security-update pull requests when a patched version exists. Owner email notification depends on GitHub notification / watch settings (configured outside the repository tree).
- **Out of scope for this close (intentional):** Dependabot version updates, auto-merge, `npm audit` scripts, and scheduled GitHub Actions SCA jobs.
- **Related:** Still distinct from `ARC-005` (no CI gate for typecheck/lint/test/build).

### SEC-002 — Logo uploads trust client MIME and allow public SVG

- **Delta:** None this cycle. Still open.

### SEC-003 — SSRF in logo/website ingestion without host allow-listing

- **Delta:** None this cycle. Still open.

---

## Observations (not tracked)

- Closing `SEC-001` via repository Advanced Security settings alone is sufficient per GitHub docs; a `dependabot.yml` is required only for Dependabot **version** updates, which this project deliberately does not enable.
- Email delivery for Dependabot alerts is an account/repository notification preference, not a repository file. Re-confirm under GitHub notification settings and repository watch (Security alerts) if mail stops arriving.
- No Dependabot operations document was added; resolution is recorded only in this Health Check report and the Findings Register.

---

## Change log

| Date | Note |
|------|------|
| 2026-07-23 | Recurring Security report published. Resolved `SEC-001`. No new Findings. |
