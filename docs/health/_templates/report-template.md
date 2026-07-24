<!--
Shared report template for the Engineering Health Check.

How to use:
- Copy this file to <review-type>/<cycle>-<review-type>.md
  e.g. architecture/2026-08-architecture.md  or  seo/2026-Q3-seo.md
       or dependency-vulns/2026-08-dependency-vulns.md (Live)
- Fill in the header block and each section.
- Reports are IMMUTABLE once written. Do not edit a completed report.
- Reference existing Findings by ID; never restate a Finding's full body.
- Delete this comment block and any unused optional lines before saving.
-->

# <Review Name> — <Cycle>

**Review type:** <Dependency Vulnerability Monitoring | Architecture Audit | Product Audit | Data Quality Audit | Database Audit | Security Audit | Performance Audit | Code Hygiene Audit | Roadmap Review | Scalability Audit | SEO Audit | UX Audit | Documentation Audit>
**Cadence:** <Live | Monthly | Quarterly>
**Cycle:** <YYYY-MM | YYYY-Q#>
**Date:** <YYYY-MM-DD>
**Reviewer:** <name / role>
**Baseline:** <true | false>
**Status:** Immutable historical record — do not edit after publication.

---

## Executive summary

<5–10 lines. What is the net change this cycle? Highlight resolved / new / still-open counts and anything that needs a decision. No invented scores or grades.>

---

## Since last cycle

<!-- Omit this entire section when Baseline: true. Reference Findings by ID only. -->

| Change | Finding IDs | Notes / links |
|---|---|---|
| Resolved (removed from register) | | closing PR / commit / migration link required |
| Still open | | |
| In progress | | |
| Deferred | | reason / revisit |
| New this cycle | | |
| Reopened (same ID) | | where it reappeared |

---

## Findings

<!--
- NEW Findings: full write-up here (this is the canonical description). Then add a row to findings-register.md with a new ID.
- EXISTING Findings: reference by ID with only the delta / new evidence — do not restate.
- Before creating a NEW Finding, search ALL prefixes. If the same root cause is owned by
  another audit (see audit-catalog.md), reference that existing Finding instead of duplicating it.
- Only promote an observation to a Finding if it passes the memory-value test:
  "Will we likely need to remember this in a future review cycle?"
-->

### <FINDING-ID or (new)> — <short title>

- **Why it matters:** <impact>
- **Severity:** <Critical | High | Medium | Low>  ·  **Effort:** <Small | Medium | Large>  (descriptive only)
- **Evidence:** <files / paths / line ranges / query names>
- **Status:** <Open | In Progress | Deferred>
- **Links:** <plan / ADR / migration / PR / commit, where relevant>

---

## Observations (not tracked)

<Narrative notes, context, and strengths that do NOT need cross-cycle memory. These deliberately do not become Findings and are not added to the register.>

---

## Change log

| Date | Note |
|------|------|
| <YYYY-MM-DD> | Report published. |
