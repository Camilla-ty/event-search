# Company Domain Matching v1 Implementation Plan

**Status:** Draft
**Related ADR:** `docs/adr/ADR-001-company-identity.md`

---

## 1. Overview

This document describes how EventPX will implement the company-domain identity model defined in ADR-001.

The goal is to introduce a minimal `company_domains` table and use it to remember verified company-domain relationships permanently.

The guiding rule is:

> Never guess.
> A human verifies once.
> EventPX remembers forever.

This implementation must be phased carefully so existing import, review, publish, and public company behavior remain stable.

---

## 2. Scope

This plan covers official company website domains only.

Examples:

* `bitlifi.com`
* `bitlifi.jp`
* `bitlifi.de`
* `bitlifi.sg`

These domains may all resolve to the same canonical company after human verification.

The public company profile continues to show only `companies.website`.

Additional domains are internal matching data only.

---

## 3. Non-Goals

This implementation does not cover:

* LinkedIn
* GitHub
* X / Twitter
* Discord
* YouTube
* Marketplace URLs
* Social/community websites
* AI-based identity inference
* Fuzzy matching
* Similar-domain auto-merge
* Domain kind/category expansion
* Public display of additional domains

---

## 4. Proposed Schema

Add a minimal table:

```sql
company_domains (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  domain text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
)
```

Rules:

* `domain` should use the same normalized format as `companies.domain`.
* `is_primary = true` means the domain mirrors the canonical `companies.domain`.
* Additional verified domains use `is_primary = false`.
* No extra metadata is added in v1.

---

## 5. Cross-Phase Invariants

These rules must remain true throughout every phase:

1. Public company pages continue to display only `companies.website`.
2. Existing import behavior must not change until the matching phase.
3. New domains must not auto-match unless they already exist in `company_domains`.
4. No fuzzy matching.
5. No similarity-based merge.
6. No public display of additional domains.
7. `companies.domain` remains the primary company identity field during rollout.
8. `company_domains` extends matching; it does not replace `companies.domain` immediately.

---

# 6. Implementation Phases

---

## Phase 0 — ADR finalized

### Goal

Record the architectural decision.

### Deliverable

* `docs/adr/ADR-001-company-identity.md`

### Status

Completed.

---

## Phase 1 — Implementation design spec

### Goal

Create this implementation plan.

### Deliverable

* `docs/implementation/company-domain-matching-v1.md`

### Status

Completed.

---

## Phase 2 — Add `company_domains` table and backfill primary domains

### Goal

Create the database table and backfill existing primary domains from `companies.domain`.

### Files likely affected

* `supabase/migrations/*`
* possible generated Supabase types if the project tracks them

### What changes

* Add `company_domains`.
* Backfill one row for each active company where `companies.domain IS NOT NULL`.
* Backfilled rows should have:

  * `company_id = companies.id`
  * `domain = companies.domain`
  * `is_primary = true`

### What must not change

* Import matching
* Review UI
* Public company pages
* Admin UI
* Company creation behavior
* Publish behavior

### Verification notes

After migration, verify:

* Count of active companies with non-null `companies.domain`
* Count of `company_domains` rows where `is_primary = true`
* Any duplicate domains
* Any companies with `domain IS NOT NULL` but missing `company_domains`

### Risks

* Existing duplicate domains may block a unique constraint.
* Merged or inactive company rows may require special handling.
* Null domains must not be backfilled.

### TODO

Decide exact uniqueness scope:

* unique globally by `domain`, or
* unique only for active companies.

Initial preference: prevent duplicate active domain ownership.

---

## Phase 3 — Add admin read-only visibility

### Goal

Allow admins to see a company’s stored domains.

### Files likely affected

* Admin company detail page
* Company query helpers
* Company types

### What changes

Admin company detail may show an internal-only section:

```text
Company Domains

- bitlifi.com primary
- bitlifi.jp additional
```

### What must not change

* Public company pages must not display additional domains.
* Admins should not yet edit domains unless explicitly implemented later.
* Import matching should not change in this phase.

### Verification notes

Confirm:

* Domains show for a company in admin.
* Public pages do not show additional domains.
* No write actions are introduced accidentally.

### Risks

* Confusing public website with internal domains.
* Accidentally exposing additional domains publicly.

---

## Phase 4 — Extend import matching to read from `company_domains`

### Goal

Allow exact matches against verified stored domains.

### Files likely affected

* sponsor import matching logic
* import match context builder
* import row matching tests

### What changes

Import matching should check:

1. Existing `companies.domain`
2. Existing `company_domains.domain`

If an imported domain exactly matches a stored company domain, resolve to that company.

### What must not change

* No fuzzy matching.
* No similar-domain matching.
* No automatic same-name + new-domain matching.
* No review UI link action yet.

### Verification notes

Test cases:

* `bitlifi.com` matches Bitlifi via primary company domain.
* `bitlifi.jp` matches Bitlifi only if already stored in `company_domains`.
* `bitlifi.jp` does not match if it is not stored.
* Similar domain strings do not auto-match.

### Risks

* Duplicate domain mappings could create ambiguous matches.
* Import behavior may change unexpectedly if `company_domains` is not unique.
* Matching logic must remain deterministic.

---

## Phase 5 — Add review action to link new domain to existing company

### Goal

Allow a reviewer to confirm that a newly seen domain belongs to an existing company.

### Files likely affected

* Review queue UI
* Row decision drawer
* Sponsor import server actions
* Import row decision logic
* Tests

### What changes

When a new domain appears and a reviewer chooses “Link to existing company”:

* Insert a row into `company_domains`
* Set `company_id` to the selected existing company
* Set `domain` to the normalized imported domain
* Set `is_primary = false`
* Resolve the import row to that company

Future imports of that domain should auto-match after Phase 4 matching is active.

### What must not change

* New domains must not be linked automatically.
* Public website must not change.
* `companies.website` must not be overwritten.
* Existing create-new-company behavior must remain available.

### Verification notes

Test cases:

* Reviewer links `bitlifi.jp` to Bitlifi.
* A `company_domains` row is created.
* The current import row resolves to Bitlifi.
* A future import containing `bitlifi.jp` auto-matches Bitlifi.
* Public Bitlifi profile still shows `bitlifi.com`.

### Risks

* UI may make it unclear whether the public website changes.
* Duplicate domain insert may fail.
* Existing row decision states may need a new action type.

### TODO

Decide whether this requires a new `conflict_type` or can reuse current review metadata.

---

## Phase 6 — Stabilization, tests, and cleanup

### Goal

Confirm the new identity layer is safe and stable.

### Files likely affected

* Tests
* Admin docs
* Import docs
* Audit scripts if needed

### What changes

Add or update tests around:

* Backfill
* Exact domain matching
* No fuzzy matching
* Review link action
* Public page non-exposure
* Merge behavior if relevant

### What must not change

* No schema expansion unless explicitly approved.
* No social/community identity features.
* No automatic merge heuristics.

### Verification notes

Run:

* Build
* Relevant unit tests
* Import matching tests
* Manual import smoke test

### Risks

* Existing merge behavior may not yet account for `company_domains`.
* Existing company creation flows may not automatically create primary domain rows.

### TODO

Decide how `merge_companies()` should move or reconcile `company_domains`.

---

## 7. Suggested PR Order

Recommended order:

1. Docs only
2. Phase 2 migration + backfill
3. Phase 3 admin read-only display
4. Phase 4 import matching
5. Phase 5 review link action
6. Phase 6 stabilization and cleanup

Do not combine Phase 4 and Phase 5 unless the implementation is clearly small and low risk.

---

## 8. Locked Rules

These rules come directly from ADR-001 and should not be changed casually:

* Never guess.
* A human verifies once.
* EventPX remembers forever.
* Public website remains one canonical website.
* Additional company domains are internal-only.
* Exact verified domain match only.
* No fuzzy matching.
* No similarity-based automatic merge.
* Keep v1 minimal.

## Status

Completed.

Implemented in Phases 2–9.

The company identity model is now considered the canonical architecture for EventPX.

Future work should build on this model rather than replacing it.
