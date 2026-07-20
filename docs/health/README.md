# Engineering Health Check

**Status:** Active — Framework v1.0
**Date:** 2026-07-20
**Scope:** Recurring engineering reviews of this repository and the long-term knowledge they produce.

The Engineering Health Check preserves long-term engineering knowledge with minimal maintenance. It is **not** an issue tracker.

> **Core principle**
> Reports preserve history. The live Findings Register is the current engineering work queue.
> A Finding exists only if it has long-term memory value.
> The Register answers exactly one question: **"What engineering problems still require attention?"**

---

## 1. What this system is made of

| Part | File(s) | Nature |
|---|---|---|
| **Reports** | `<review-type>/<cycle>-<review-type>.md` | Immutable. Written once per review run, never edited afterward. |
| **Findings Register** | [`findings-register.md`](./findings-register.md) | Living. The only mutable document. Holds outstanding work only. |
| **Report template** | [`_templates/report-template.md`](./_templates/report-template.md) | One shared template for every review. |

Review-type folders are created **lazily** — only when that review first runs.

**Core governance documents.** Two documents are authoritative, and every review — and every generated Health Check prompt — must follow them:

| Document | Authority |
|---|---|
| [`README.md`](./README.md) (this file) | Operating rules: lifecycle, cadence, naming, workflows, and Finding rules. |
| [`audit-catalog.md`](./audit-catalog.md) | **Ownership authority** — which audit primarily owns each engineering topic, and how overlapping discoveries are handled. |

---

## 2. Reviews and cadence

| Cadence | Review | Folder / slug | Finding prefix |
|---|---|---|---|
| Monthly | Architecture Audit | `architecture` | `ARC` |
| Monthly | Product Audit | `product` | `PROD` |
| Monthly | Database Audit | `database` | `DB` |
| Monthly | Security Audit | `security` | `SEC` |
| Monthly | Performance Audit | `performance` | `PERF` |
| Monthly | Dead Code Audit | `dead-code` | `DEAD` |
| Monthly | Roadmap Review | `roadmap` | `ROAD` |
| Quarterly | SEO Audit | `seo` | `SEO` |
| Quarterly | Future Scalability Audit | `scalability` | `SCALE` |
| Quarterly | Data Quality Audit | `data-quality` | `DQ` |

Not every review must run every cycle. A review that is not run simply produces no report that cycle; its Findings persist in the register untouched.

---

## 3. Naming conventions

| Thing | Convention | Example |
|---|---|---|
| Report file | `<slug>/<cycle>-<slug>.md` | `architecture/2026-08-architecture.md` |
| Monthly cycle token | `YYYY-MM` | `2026-08` |
| Quarterly cycle token | `YYYY-Q#` | `2026-Q3` |
| Finding ID | `<PREFIX>-NNN` (zero-padded, permanent) | `ARC-001`, `SEC-014` |

The cycle token encodes cadence; each report also states `Cadence:` in its header.

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
- **Reopening:** a resolved Finding that reappears is re-added to the register under its **original ID** (look it up in the immutable report or Git history).

### 5a. Cross-audit ownership (applies across all prefixes)

Root-cause de-duplication applies across *every* audit type, not only within a single prefix. Every engineering problem has **one primary owner**.

- **Ownership is defined by [`audit-catalog.md`](./audit-catalog.md)**, which is authoritative for every ownership decision.
- **Before creating a new Finding, search all existing Finding prefixes** (`ARC`, `SEC`, `DB`, `PERF`, `PROD`, `DEAD`, `ROAD`, `SEO`, `SCALE`, `DQ`) for the same root cause.
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
2. Record the resolution in that cycle's report (`Since last cycle → Resolved`, with the closing PR / commit / migration link).
3. It remains permanently discoverable through the immutable reports and Git history, PRs, commits, ADRs, and implementation links.

The register therefore reflects only outstanding work. There is **no separate archive process** — resolved history already lives in the reports and Git. An archive would be introduced only if it ever becomes necessary years from now.

**Observation vs approved work:** if it is not a Finding, it is an observation (report-only). Among Findings, `In Progress` and `Deferred` represent decided/approved outcomes; `Open` is a remembered problem not yet actioned. The register `Links` column makes this concrete.

---

## 7. Reports are immutable

- A report is written once per review run and **never edited afterward**. Corrections go in the next cycle's report or in the register — never by rewriting a completed report.
- The **canonical full description of a Finding is born in the report where it was first discovered**; the register row points back to it.
- Later reports reference existing Findings **by ID** and record only the delta — they must not restate a Finding's full body.

Each report contains: a header block, a 5–10 line **Executive summary**, a **Since last cycle** delta by ID (omitted on baseline reports), **Findings** (full write-ups for new Findings; ID-reference + delta for existing ones), and untracked **Observations**.

**Baseline vs recurring detection (automatic, shared by every review).** Each review determines its own mode with no prompt-specific logic, by checking whether a prior report already exists in its review folder:

- **No prior report → Baseline Review:** `Baseline: true`, no *Since last cycle* section, allocate the first IDs for that prefix.
- **A prior report exists → Recurring Review:** `Baseline: false`, reconcile existing Findings first, and include the *Since last cycle* delta by ID.

This detection is part of the shared workflow (Step 0 below); reviews inherit it and never hard-code a baseline flag.

---

## 8. Monthly workflow

0. **Determine mode automatically** — check the review's folder for a prior report and resolve Baseline vs Recurring (see §7). A Baseline run skips step 1.
1. **Reconcile the register first** — for each open Finding of this review type, decide: still Open / In Progress / Deferred / **Resolved (remove row)** / Reopened.
2. **Run the review** and capture observations.
3. **Apply the memory-value test** to each observation → Finding (Open) or report-only narrative.
4. **Write the immutable report** from the template.
5. **Update the register** — add new Findings (new IDs), update statuses, remove any that became Resolved, refresh `Last updated`.

## 9. Quarterly workflow

Same mechanics, plus:

1. Reports use the `YYYY-Q#` token and `Cadence: Quarterly`.
2. **Deferred sweep** at quarter end: revisit every `Deferred` Finding and confirm it is still a conscious deferral or move it to `Open` / `In Progress`.
3. Quarterly Findings may feed the monthly Roadmap Review by ID.

---

## 10. Governance rules (keep the system healthy for years)

1. The live register is the source of truth for **what is still open**; reports are the source of truth for **what was found and what was resolved**.
2. Reports reference Finding IDs — they never restate a Finding's full body.
3. Never edit a completed report.
4. IDs are permanent and never reused; reuse the same ID for the same root cause across its entire life.
5. No Finding leaves as Resolved without a closing link recorded in the report.
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
