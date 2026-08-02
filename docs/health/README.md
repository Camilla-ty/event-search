# Engineering Health Check

**Status:** Active — Framework v1.2
**Date:** 2026-08-02
**Scope:** Recurring engineering reviews of this repository and the long-term knowledge they produce.

The Engineering Health Check preserves long-term engineering knowledge with minimal maintenance. It is **not** an issue tracker.

> **Core principle**
> Reports preserve history. The live Findings Register is the current engineering work queue.
> A Finding exists only if it has long-term memory value.
> The Register answers exactly one question: **"What engineering problems still require attention?"**
>
> **One audit cycle = one report.** Never create companion closeout reports for the same cycle. Remediation updates the existing cycle report. A new report is created only when a new audit cycle is explicitly started with a new Cycle token.

---

## 1. What this system is made of

| Part | File(s) | Nature |
|---|---|---|
| **Reports** | `<review-type>/<cycle>-<review-type>.md` | One file per audit cycle. Updated in place for remediation within that cycle; never replaced by a sibling “closeout” report. |
| **Findings Register** | [`findings-register.md`](./findings-register.md) | Living work queue. Holds outstanding Findings only. |
| **Report template** | [`_templates/report-template.md`](./_templates/report-template.md) | One shared template for every review. |
| **Execution prompts** | [`_prompts/`](./_prompts/) | Canonical paste-ready prompts per review type. Created when a review is formalized. |

Review-type folders are created **lazily** — only when that review first runs.

**Core governance documents.** Two documents are authoritative, and every review — and every Health Check execution prompt — must follow them:

| Document | Authority |
|---|---|
| [`README.md`](./README.md) (this file) | Operating rules: lifecycle, cadence, naming, workflows, and Finding rules. |
| [`audit-catalog.md`](./audit-catalog.md) | **Ownership authority** — which audit primarily owns each engineering topic, and how overlapping discoveries are handled. |

---

## 2. Reviews and cadence

| Cadence | Review | Folder / slug | Finding prefix |
|---|---|---|---|
| Live | Dependency Vulnerability Monitoring | `dependency-vulns` | `DEP` |
| Monthly | Architecture Audit | `architecture` | `ARC` |
| Monthly | Product Audit | `product` | `PROD` |
| Monthly | Data Quality Audit | `data-quality` | `DQ` |
| Monthly | Database Audit | `database` | `DB` |
| Monthly | Security Audit | `security` | `SEC` |
| Monthly | Performance Audit | `performance` | `PERF` |
| Monthly | Code Hygiene Audit | `code-hygiene` | `HYG` |
| Monthly | Roadmap Review | `roadmap` | `ROAD` |
| Quarterly | Scalability Audit | `scalability` | `SCALE` |
| Quarterly | SEO Audit | `seo` | `SEO` |
| Quarterly | UX Audit | `ux` | `UX` |
| Quarterly | Documentation Audit | `documentation` | `DOC` |

Not every review must run every cycle. A review that is not run simply produces no report that cycle; its Findings persist in the register untouched.

**Boundary notes (summary):** Product owns product value and workflows; UX owns interaction quality, usability, and friction. Dependency Vulnerability Monitoring owns ongoing Dependabot / known-advisory triage; Security owns application security and trust boundaries. Architecture continues to own structural technical debt — there is no separate Tech Debt Audit. Full ownership rules live in [`audit-catalog.md`](./audit-catalog.md).

---

## 3. Naming conventions

| Thing | Convention | Example |
|---|---|---|
| Report file | `<slug>/<cycle>-<slug>.md` | `architecture/2026-08-architecture.md` |
| Live / Monthly cycle token | `YYYY-MM` | `2026-08` |
| Quarterly cycle token | `YYYY-Q#` | `2026-Q3` |
| Finding ID | `<PREFIX>-NNN` (zero-padded, permanent) | `ARC-001`, `SEC-014` |

The cycle token encodes cadence; each report also states `Cadence:` in its header. Live monitoring uses the same `YYYY-MM` token when a status or triage report is written.

---

## 4. What qualifies as a Finding — the memory-value test

Severity does **not** decide whether something is tracked. Promote an observation to a Finding only if it passes:

> **Will we likely need to remember this in a future review cycle?**

- **Yes** → it becomes a Finding (gets an ID, enters the register).
- **No** → it stays as narrative inside the report only, and is never tracked.

Signals of memory value: a standing architectural / security / data condition, a deliberate trade-off future reviewers should not rediscover, intended-but-unscheduled work, or a recurring risk. Report-only observations: transient notes, items already fixed during the review, strengths, and minor one-offs.

Severity and Effort are recorded on a Finding as **descriptive metadata** for prioritization — never as the inclusion criterion.

---

## 5. Finding identifiers — one problem, one ID for life

- Assigned by the register the moment a Finding is created. No candidate stage.
- `<PREFIX>-NNN`, monotonic per prefix, **never reused, never renumbered**. Gaps are allowed and expected.
- **Reuse the same ID whenever the underlying root cause is the same.** Never mint a new ID just because a new cycle started.
- One root cause with many call-sites is **one** Finding (list call-sites as evidence).
- Decision test: *"If we fixed the other Finding, would this one disappear?"* If yes, it is the same Finding.
- **Reopening:** a resolved Finding that reappears is re-added to the register under its **original ID** (look it up in the cycle report or Git history).

### 5a. Cross-audit ownership (applies across all prefixes)

Root-cause de-duplication applies across *every* audit type, not only within a single prefix. Every engineering problem has **one primary owner**.

- **Ownership is defined by [`audit-catalog.md`](./audit-catalog.md)**, which is authoritative for every ownership decision.
- **Before creating a new Finding, search all existing Finding prefixes** (`DEP`, `ARC`, `PROD`, `DQ`, `DB`, `SEC`, `PERF`, `HYG`, `ROAD`, `SCALE`, `SEO`, `UX`, `DOC`) for the same root cause.
- If the same root cause already exists under another audit, **reference that existing Finding — never create a duplicate**. A non-owning audit may discuss the issue from its own perspective in its report's Observations, citing the existing ID.
- The **primary owner** records and maintains the Finding. Existing IDs are **never renumbered** when ownership is clarified — ownership is expressed by cross-reference, not by re-issuing IDs.

---

## 6. Finding lifecycle — three live statuses, and a Resolved exit

The live register contains only these three statuses:

| Status | Meaning |
|---|---|
| **Open** | A known problem still needing attention; not yet being worked. |
| **In Progress** | Actively being implemented (linked to a PR / branch / plan). |
| **Deferred** | Consciously postponed; carries a short reason. |

**Resolved is not a live status — it is an exit.** When a Finding is resolved:

1. **Remove its row** from `findings-register.md`.
2. **Update that Finding’s cycle report in place** — set Finding Status to Resolved; add closing evidence under **Resolution History** (or equivalent), with the closing PR / commit / migration / verified-docs link. Do **not** create a new report file for remediation alone.
3. It remains permanently discoverable through the cycle report and Git history, PRs, commits, ADRs, and implementation links.

The register therefore reflects only outstanding work. There is **no separate archive process** — resolved history already lives in the reports and Git. An archive would be introduced only if it ever becomes necessary years from now.

**Observation vs approved work:** if it is not a Finding, it is an observation (report-only). Among Findings, `In Progress` and `Deferred` represent decided/approved outcomes; `Open` is a remembered problem not yet actioned. The register `Links` column makes this concrete.

---

## 7. One audit cycle = one report

**Applies to every Health Check type** (Product, Roadmap, Architecture, Performance, Security, Data Quality, Code Hygiene, Scalability, SEO, UX, Documentation, Dependency Vulnerability Monitoring, and any future review).

| Rule | Meaning |
|---|---|
| **One cycle, one file** | Exactly one report path per `(review-type, cycle)`: `<slug>/<cycle>-<slug>.md`. |
| **No companion closeouts** | Never create an extra report (e.g. `2026-08-…`) solely to close Findings from an earlier cycle. |
| **Remediation in place** | When Findings from a cycle are remediated, update **that cycle’s existing report** (Status fields + **Resolution History** / closing evidence + change log). |
| **New report only for a new cycle** | Create a new report file only when a new audit cycle is **explicitly started** with a new Cycle token (e.g. human provides `2026-10` or `2027-Q1`). |
| **Prior cycles** | Do not rewrite prior-cycle reports merely to modernize terminology. A new cycle’s report references existing Findings **by ID** and records only the delta. |

- The **canonical full description of a Finding is born in the report where it was first discovered**; the register row points back to it. Resolution evidence for that Finding is appended to the **same** cycle report.
- Later **new-cycle** reports reference existing Findings **by ID** and record only the delta — they must not restate a Finding's full body.

Each report contains: a header block, a 5–10 line **Executive summary**, a **Since last cycle** delta by ID (omitted on baseline reports), **Findings** (full write-ups for new Findings; ID-reference + delta for existing ones), untracked **Observations**, and (when remediations land) **Resolution History**.

**Baseline vs recurring detection (automatic, shared by every review).** When starting a **new** cycle (new Cycle token), each review determines its mode by checking whether a prior report already exists in its review folder:

- **No prior report → Baseline Review:** `Baseline: true`, no *Since last cycle* section, allocate the first IDs for that prefix.
- **A prior report exists → Recurring Review:** `Baseline: false`, reconcile existing Findings first, and include the *Since last cycle* delta by ID.

This detection is part of the shared workflow (Step 0 below); reviews inherit it and never hard-code a baseline flag. Remediating Findings without a new Cycle token is **not** a new review run — update the existing cycle report instead.

---

## 8. Live workflow

Dependency Vulnerability Monitoring runs continuously (Dependabot alerts and security updates). A written report is optional and produced only when there is something to remember across cycles — for example: new actionable advisories promoted to Findings, triage decisions with memory value, or a periodic status snapshot.

When a Live report is written:

0. **Determine mode automatically** — check `dependency-vulns/` for a prior report (Baseline vs Recurring; see §7).
1. **Reconcile open `DEP` Findings** in the register (same status options as monthly).
2. **Triage current Dependabot / advisory state** and capture observations.
3. **Apply the memory-value test** → Finding (`DEP`) or report-only narrative.
4. **Write or update the cycle report** from the template (`Cadence: Live`, cycle token `YYYY-MM`) — one file per cycle; remediations update in place.
5. **Update the register** as needed.

Transient alert noise that does not pass the memory-value test stays out of the register.

---

## 9. Monthly workflow

0. **Determine mode automatically** — check the review's folder for a prior report and resolve Baseline vs Recurring (see §7). A Baseline run skips step 1.
1. **Reconcile the register first** — for each open Finding of this review type, decide: still Open / In Progress / Deferred / **Resolved (remove row)** / Reopened.
2. **Run the review** and capture observations.
3. **Apply the memory-value test** to each observation → Finding (Open) or report-only narrative.
4. **Write the cycle report** from the template when this is a newly started Cycle; otherwise update the existing cycle report for remediations.
5. **Update the register** — add new Findings (new IDs), update statuses, remove any that became Resolved, refresh `Last updated`.

## 10. Quarterly workflow

Same mechanics as monthly, plus:

1. Reports use the `YYYY-Q#` token and `Cadence: Quarterly`.
2. **Deferred sweep** at quarter end: revisit every `Deferred` Finding and confirm it is still a conscious deferral or move it to `Open` / `In Progress`.
3. Quarterly Findings may feed the monthly Roadmap Review by ID.

---

## 11. Governance rules (keep the system healthy for years)

1. The live register is the source of truth for **what is still open**; reports are the source of truth for **what was found and what was resolved**.
2. Reports reference Finding IDs — they never restate a Finding's full body (except the originating cycle report, which holds the canonical write-up and Resolution History).
3. **One audit cycle = one report.** Never create companion closeout reports. Remediation updates the existing cycle report. Create a new report only when a new Cycle is explicitly started.
4. IDs are permanent and never reused; reuse the same ID for the same root cause across its entire life.
5. No Finding leaves as Resolved without closing evidence recorded in that Finding’s cycle report.
6. No invented scores or grades — only Severity (Critical / High / Medium / Low) and Effort (Small / Medium / Large).
7. Deferred is time-boxed, not a parking lot — every Deferred carries a reason and is revisited each quarter.
8. Under-track by default: when in doubt, it is an observation, not a Finding.
9. Create review-type folders lazily — do not scaffold empty ones.
10. **One problem, one owner across all audits.** [`audit-catalog.md`](./audit-catalog.md) is authoritative for ownership; before filing a Finding, search all prefixes and reference an existing Finding for the same root cause instead of duplicating it.

---

## Change log

| Date | Note |
|------|------|
| 2026-07-20 | System established. Baseline Architecture Audit preserved as `architecture/2026-07-architecture.md`; register seeded with outstanding architecture Findings. |
| 2026-07-20 | **Framework v1.0.** Added cross-audit Finding ownership (§5a, governance rule 10) with `audit-catalog.md` as ownership authority; moved automatic Baseline-vs-Recurring detection into the shared workflow (§7, §8 step 0); referenced `audit-catalog.md` as a core governance document (§1). |
| 2026-07-23 | **Framework v1.1.** Cadence restructured: Live Dependency Vulnerability Monitoring; Data Quality moved to Monthly; Dead Code renamed Code Hygiene (`code-hygiene` / `HYG`); Future Scalability renamed Scalability; added quarterly UX and Documentation; no separate Tech Debt Audit. Live workflow §8 added; monthly/quarterly sections renumbered. |
| 2026-07-23 | Added `_prompts/` for canonical execution prompts; published Monthly Code Hygiene prompt (`_prompts/code-hygiene.md`). |
| 2026-08-02 | **Framework v1.2.** One audit cycle = one report. Remediation updates the existing cycle report (Resolution History); never create companion closeout reports. New report only when a new Cycle is explicitly started. Documentation 2026-07 consolidated; redundant `2026-08`/`2026-09` DOC closeouts removed. |
