# Engineering Audit Catalog

**Status:** Active — core governance document for the Engineering Health Check.
**Date:** 2026-07-23
**Applies to:** every Health Check review type and every Health Check execution prompt.

This document defines the **responsibility boundaries** of each Engineering Audit. It is not a checklist. It exists so that every engineering problem has exactly **one primary owner**, and so that reviews reinforce rather than duplicate each other. Read it alongside [`README.md`](./README.md) (operating rules) and [`findings-register.md`](./findings-register.md) (the live work queue).

---

## 1. Purpose

The repository is reviewed from several angles because a single lens cannot capture engineering health. Structure, safety, correctness, speed, discoverability, usefulness, experience, cleanliness, direction, growth, trustworthiness, and documentation quality are different questions about the same codebase, and each demands a different reviewer mindset.

To keep that multiplicity from producing chaos, the system enforces one rule above all:

> **One engineering problem should have one primary owner.**

Each audit owns a distinct domain of responsibility. When two audits notice the same underlying issue, only the **primary owner** records the Finding. Other audits **reference** that Finding (by ID) and add their perspective — they never create a second Finding for the same root cause. This keeps the Findings Register free of duplicates and keeps accountability unambiguous.

---

## 2. Engineering Audit Catalog

| Audit | Why it exists (purpose) | Primary responsibility | Typical questions answered | Cadence |
|---|---|---|---|---|
| **Dependency Vulnerability Monitoring** | Keep known third-party advisories visible and actionable | Ongoing Dependabot alerts / security-update triage for npm dependencies | Are there open advisories we must act on? Which upgrades or exceptions are deliberate? | Live |
| **Architecture** | Keep the system's structure sound as it grows | Module boundaries, layering, structural technical debt | Is the structure coherent? Are boundaries respected? Will this scale structurally? | Monthly |
| **Security** | Protect the system and its data from misuse | Application security: authn/authz, RLS, APIs, secrets, and trust boundaries | Can someone reach data or actions they shouldn't? Where is trust misplaced? | Monthly |
| **Database** | Keep data storage correct and well-modeled | Schema, migrations, indexes, integrity constraints | Is the schema correct? Are migrations safe? Are constraints/indexes right? | Monthly |
| **Performance** | Keep the system fast under normal load | Query/render speed, caching, bundle cost | Where is it slow today? What wastes work per request? | Monthly |
| **Product** | Keep the product useful and coherent | Product value and user-facing workflows | Does this serve users well? Are workflows coherent? | Monthly |
| **Code Hygiene** | Keep the codebase clean and intentional | Unused/unreachable code; obsolete and temporary artifacts; actionable TODO debt; meaningful duplication; repo/asset/package/test/script clutter | What increases maintenance cost or obscure intent that we can safely remove or simplify? | Monthly |
| **Roadmap** | Keep engineering effort aligned with direction | Prioritization and sequencing of work | Are we working on the right things next? Is anything stale? | Monthly |
| **Data Quality** | Keep stored data trustworthy | Accuracy, completeness, and de-duplication of data | Is the data correct and non-duplicated? Can we trust it? | Monthly |
| **SEO** | Keep public content discoverable | Metadata, structured data, canonicals, sitemaps | Can search/AI engines find and understand our pages? | Quarterly |
| **Scalability** | Ensure the system survives future growth | Behavior at large data/traffic volumes | What breaks at 10–100×? Where are the future ceilings? | Quarterly |
| **UX** | Keep interaction quality high | User experience, interaction quality, usability, and friction | Where do users struggle? What interactions are unclear or high-friction? | Quarterly |
| **Documentation** | Keep engineering knowledge accurate and findable | Docs freshness, ADRs, runbooks, and Health Check governance docs | Are docs accurate? What is missing or misleading for the next engineer? | Quarterly |

There is **no separate Tech Debt Audit**. Structural technical debt remains owned by **Architecture**; other audits raise domain debt under the topic's primary owner.

---

## 3. Audit Ownership Matrix

Every topic has exactly **one primary owner**. Secondary observers may add perspective but must reference the owner's Finding rather than create their own.

| Topic | Primary owner | Secondary observers |
|---|---|---|
| Known dependency vulnerabilities (Dependabot / advisories) | Dependency Vulnerability Monitoring | Security |
| Authentication | Security | Architecture |
| Authorization | Security | Architecture |
| Row Level Security (RLS) | Security | Database, Architecture |
| API security / exposure | Security | Architecture |
| Rate limiting | Security | Scalability, Performance |
| Input validation | Security | Architecture, Data Quality |
| Security headers | Security | — |
| Secrets & environment variables | Security | — |
| Cloudflare / edge protection | Security | Scalability, Performance |
| Service-role usage | Security | Architecture, Database |
| Sensitive-data exposure & logging | Security | Data Quality |
| Schema design | Database | Architecture |
| Migrations | Database | — |
| Indexes | Database | Performance |
| Data integrity constraints | Database | Data Quality |
| Query performance | Performance | Database |
| Caching | Performance | Architecture, Scalability |
| Rendering (dynamic/static/ISR) | Performance | Architecture, SEO |
| Bundle size | Performance | — |
| Dependency structure & boundaries | Architecture | Dependency Vulnerability Monitoring (vulns), Code Hygiene (unused) |
| Module boundaries | Architecture | — |
| Structural technical debt | Architecture | all audits contribute perspective |
| Client/server orchestration | Architecture | Performance, Security |
| Observability & logging infrastructure | Architecture | Security, Performance |
| Testing & CI architecture | Architecture | all audits contribute perspective |
| Metadata | SEO | Product |
| JSON-LD / structured data | SEO | — |
| Canonical URLs | SEO | Architecture |
| Sitemaps | SEO | Performance |
| Product value & workflows | Product | UX, Architecture |
| User experience / usability / friction | UX | Product, SEO, Performance |
| Unused code | Code Hygiene | Architecture |
| Unused APIs | Code Hygiene | Architecture, Security |
| Unused dependencies | Code Hygiene | Dependency Vulnerability Monitoring, Performance |
| Temporary / debug artifacts in source | Code Hygiene | Security (if bypass/secret-related) |
| Actionable TODO / FIXME hygiene debt | Code Hygiene | Roadmap (if scheduled work) |
| Meaningful implementation duplication | Code Hygiene | Architecture |
| Repo / asset / fixture clutter | Code Hygiene | Documentation (if docs corpus) |
| Stale or skipped tests (hygiene) | Code Hygiene | Architecture (CI/test architecture) |
| Abandoned one-off scripts | Code Hygiene | Security, Database |
| Scalability (general) | Scalability | Performance, Architecture, Database |
| Large-dataset handling | Scalability | Performance, Database |
| Data accuracy | Data Quality | Database |
| Duplicate data | Data Quality | Database |
| Engineering documentation freshness | Documentation | Architecture, Roadmap |
| ADRs & design docs | Documentation | Architecture |
| Runbooks & operational how-tos | Documentation | Security, Database |

**Boundary clarifications**

- **Performance vs Scalability:** Performance owns *"slow today under normal load."* Scalability owns *"breaks in the future at large volume."* Same symptom, different time horizon.
- **Security vs Database on RLS:** Security owns whether the trust boundary is *correct and relied upon*; Database owns whether the policy is *modeled and migrated correctly*.
- **Security vs Dependency Vulnerability Monitoring:** Security owns application security and trust boundaries. Dependency Vulnerability Monitoring owns ongoing Dependabot / known npm-advisory triage. Security may observe vulnerable dependencies but does not own the live monitoring stream.
- **Architecture vs Code Hygiene on dependencies:** Architecture owns dependency *structure and boundaries*; Code Hygiene owns *unused* dependencies; Dependency Vulnerability Monitoring owns *vulnerable* dependencies under active advisory triage.
- **Product vs UX:** Product owns *product value and workflows* (does the right work exist and cohere?). UX owns *interaction quality, usability, and friction* (is the experience clear and low-friction?). Same surface, different question.
- **Structural technical debt** is owned by Architecture. Every audit may raise debt in its own domain and file it under that topic's primary owner — there is no separate Tech Debt Audit.

---

## 4. Overlap Rules

1. **Findings belong to the primary owner.** Only the owning audit creates the Finding for a given root cause.
2. **Other audits reference, never clone.** A secondary observer cites the existing Finding ID and adds its perspective in its own report's observations — it does not open a new Finding.
3. **Do not duplicate Findings across prefixes.** Root-cause reuse applies across *all* audits, not just within one prefix. If a root cause is already tracked under any ID, reuse it.
4. **Reuse Finding IDs whenever possible.** IDs are permanent and follow the root cause for its entire life, regardless of which audit re-encounters it.
5. **Cross-reference instead of re-filing.** Before creating a new Finding, scan the register (all prefixes) for the same root cause; if present, reference it.
6. **Ownership follows the topic, not the discoverer.** If an audit finds an issue that another audit owns, it records it under the owner's domain (or references the owner's existing Finding) rather than under its own prefix.
7. **Existing IDs are never renumbered.** A Finding already recorded under one prefix keeps that ID for life even if this catalog assigns the topic to a different primary owner; ownership is expressed by cross-reference, not by re-issuing IDs.

---

## 5. Design Philosophy

Each audit asks a different question about the same repository:

- **Dependency Vulnerability Monitoring** reviews known third-party advisories.
- **Architecture** reviews structure (including structural technical debt).
- **Security** reviews application safety and trust boundaries.
- **Database** reviews storage correctness.
- **Performance** reviews speed under normal load.
- **Product** reviews product value and workflows.
- **Code Hygiene** reviews cleanliness (unused/obsolete/temporary artifacts, duplication, and repo clutter — broader than the former Dead Code idea).
- **Roadmap** reviews direction.
- **Data Quality** reviews data trustworthiness.
- **SEO** reviews discoverability.
- **Scalability** reviews future growth.
- **UX** reviews interaction quality and friction.
- **Documentation** reviews whether engineering knowledge stays accurate and findable.

No single audit sees the whole picture. Together they provide a complete, non-overlapping view of engineering health — each responsible for its own question, each trusting the others to own theirs.

---

## 6. Future Audits

New audit types (e.g. Accessibility, Compliance, AI Quality) may be added when a genuinely distinct question emerges. Adding one requires, at minimum:

- **Clear responsibility** — a distinct engineering question no existing audit already owns.
- **No overlap** — its scope must not duplicate an existing audit's primary responsibility.
- **Ownership assignment** — update the Ownership Matrix (§3): claim new topics and/or become a secondary observer, never a second owner of an existing topic.
- **Cadence** — Live, Monthly, or Quarterly.
- **Finding prefix** — a new, globally unique, permanent prefix registered in [`README.md`](./README.md).

A new audit inherits all shared engines (Core, Finding, Report, Register, Validation) automatically; only its domain responsibility and ownership entries are new.

---

## Change log

| Date | Note |
|------|------|
| 2026-07-20 | Catalog created: audit purposes, ownership matrix, overlap rules, and future-audit requirements established. |
| 2026-07-23 | **Framework v1.1.** Added Live Dependency Vulnerability Monitoring; Data Quality → Monthly; Dead Code → Code Hygiene; Future Scalability → Scalability; added UX and Documentation; clarified Product vs UX and Security vs dependency-vuln ownership; confirmed no separate Tech Debt Audit. |
| 2026-07-23 | Expanded Code Hygiene catalog purpose and ownership matrix to match the canonical Code Hygiene execution prompt (`_prompts/code-hygiene.md`). |
