# Engineering Audit Catalog

**Status:** Active — core governance document for the Engineering Health Check.
**Date:** 2026-07-20
**Applies to:** every Health Check review type and every Health Check execution prompt.

This document defines the **responsibility boundaries** of each Engineering Audit. It is not a checklist. It exists so that every engineering problem has exactly **one primary owner**, and so that reviews reinforce rather than duplicate each other. Read it alongside [`README.md`](./README.md) (operating rules) and [`findings-register.md`](./findings-register.md) (the live work queue).

---

## 1. Purpose

The repository is reviewed from several angles because a single lens cannot capture engineering health. Structure, safety, correctness, speed, discoverability, usefulness, cleanliness, direction, growth, and trustworthiness are different questions about the same codebase, and each demands a different reviewer mindset.

To keep that multiplicity from producing chaos, the system enforces one rule above all:

> **One engineering problem should have one primary owner.**

Each audit owns a distinct domain of responsibility. When two audits notice the same underlying issue, only the **primary owner** records the Finding. Other audits **reference** that Finding (by ID) and add their perspective — they never create a second Finding for the same root cause. This keeps the Findings Register free of duplicates and keeps accountability unambiguous.

---

## 2. Engineering Audit Catalog

| Audit | Why it exists (purpose) | Primary responsibility | Typical questions answered | Cadence |
|---|---|---|---|---|
| **Architecture** | Keep the system's structure sound as it grows | Module boundaries, layering, structural technical debt | Is the structure coherent? Are boundaries respected? Will this scale structurally? | Monthly |
| **Security** | Protect the system and its data from misuse | Safety of access, data, and trust boundaries | Can someone reach data or actions they shouldn't? Where is trust misplaced? | Monthly |
| **Database** | Keep data storage correct and well-modeled | Schema, migrations, indexes, integrity constraints | Is the schema correct? Are migrations safe? Are constraints/indexes right? | Monthly |
| **Performance** | Keep the system fast under normal load | Query/render speed, caching, bundle cost | Where is it slow today? What wastes work per request? | Monthly |
| **SEO** | Keep public content discoverable | Metadata, structured data, canonicals, sitemaps | Can search/AI engines find and understand our pages? | Quarterly |
| **Product** | Keep the product useful and coherent | User-facing workflows and experience | Does this serve users well? Are workflows coherent? | Monthly |
| **Dead Code** | Keep the codebase clean of the unused | Unused code, APIs, and dependencies | What can we safely delete? What is no longer referenced? | Monthly |
| **Roadmap** | Keep engineering effort aligned with direction | Prioritization and sequencing of work | Are we working on the right things next? Is anything stale? | Monthly |
| **Scalability** | Ensure the system survives future growth | Behavior at large data/traffic volumes | What breaks at 10–100×? Where are the future ceilings? | Quarterly |
| **Data Quality** | Keep stored data trustworthy | Accuracy, completeness, and de-duplication of data | Is the data correct and non-duplicated? Can we trust it? | Quarterly |

---

## 3. Audit Ownership Matrix

Every topic has exactly **one primary owner**. Secondary observers may add perspective but must reference the owner's Finding rather than create their own.

| Topic | Primary owner | Secondary observers |
|---|---|---|
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
| Dependency structure & boundaries | Architecture | Security (vulns), Dead Code (unused) |
| Module boundaries | Architecture | — |
| Technical debt | Architecture | all audits contribute perspective |
| Client/server orchestration | Architecture | Performance, Security |
| Observability & logging infrastructure | Architecture | Security, Performance |
| Testing & CI architecture | Architecture | all audits contribute perspective |
| Metadata | SEO | Product |
| JSON-LD / structured data | SEO | — |
| Canonical URLs | SEO | Architecture |
| Sitemaps | SEO | Performance |
| User experience | Product | SEO, Performance |
| Workflow | Product | Architecture |
| Unused code | Dead Code | Architecture |
| Unused APIs | Dead Code | Architecture, Security |
| Unused dependencies | Dead Code | Security, Performance |
| Scalability (general) | Scalability | Performance, Architecture, Database |
| Large-dataset handling | Scalability | Performance, Database |
| Data accuracy | Data Quality | Database |
| Duplicate data | Data Quality | Database |

**Boundary clarifications**

- **Performance vs Scalability:** Performance owns *"slow today under normal load."* Scalability owns *"breaks in the future at large volume."* Same symptom, different time horizon.
- **Security vs Database on RLS:** Security owns whether the trust boundary is *correct and relied upon*; Database owns whether the policy is *modeled and migrated correctly*.
- **Architecture vs Dead Code on dependencies:** Architecture owns dependency *structure and boundaries*; Dead Code owns *unused* dependencies; Security owns *vulnerable* dependencies.
- **Technical debt** is nominally owned by Architecture, but every audit may raise debt in its own domain and file it under the topic's primary owner.

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

- **Architecture** reviews structure.
- **Security** reviews safety.
- **Database** reviews correctness.
- **Performance** reviews speed.
- **SEO** reviews discoverability.
- **Product** reviews usefulness.
- **Dead Code** reviews cleanliness.
- **Roadmap** reviews direction.
- **Scalability** reviews future growth.
- **Data Quality** reviews trustworthiness.

No single audit sees the whole picture. Together they provide a complete, non-overlapping view of engineering health — each responsible for its own question, each trusting the others to own theirs.

---

## 6. Future Audits

New audit types (e.g. Accessibility, Compliance, AI Quality) may be added when a genuinely distinct question emerges. Adding one requires, at minimum:

- **Clear responsibility** — a distinct engineering question no existing audit already owns.
- **No overlap** — its scope must not duplicate an existing audit's primary responsibility.
- **Ownership assignment** — update the Ownership Matrix (§3): claim new topics and/or become a secondary observer, never a second owner of an existing topic.
- **Cadence** — Monthly or Quarterly.
- **Finding prefix** — a new, globally unique, permanent prefix registered in [`README.md`](./README.md).

A new audit inherits all shared engines (Core, Finding, Report, Register, Validation) automatically; only its domain responsibility and ownership entries are new.

---

## Change log

| Date | Note |
|------|------|
| 2026-07-20 | Catalog created: audit purposes, ownership matrix, overlap rules, and future-audit requirements established. |
