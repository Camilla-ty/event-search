# ADR-001: Company Identity & Multi-Domain Matching

**Status:** Accepted

**Date:** 2026-06-26

---

# 1. Context

EventPX stores companies that sponsor events.

Initially each company has a single website and a single domain.

As the database grows, the same company may appear under different official domains.

Examples:

* Global website
* Country-specific websites
* Localized websites

Without an explicit identity model, these imports create duplicate companies or repeatedly require manual review.

The system needs a scalable way to recognize previously verified domains while remaining conservative about identity.

---

# 2. Problem

The same company may own multiple official websites.

Example:

Company

Bitlifi

Official websites

* bitlifi.com
* bitlifi.jp
* bitlifi.de
* bitlifi.sg

All represent the same company.

However, EventPX must never assume that two similar domains belong to the same company.

False matches are significantly more expensive than manual review.

---

# 3. Decision

EventPX adopts the following identity principle.

> Never guess.
>
> A human verifies once.
>
> EventPX remembers forever.

This principle applies to every newly discovered domain.

---

# 4. Canonical Company Model

A company represents one real-world organization.

The company record remains the canonical entity.

Example:

Company

Bitlifi

Website

bitlifi.com

The company profile always exposes only the primary website.

Additional verified domains are internal identity data.

They are not shown on the public company profile.

---

# 5. Domain Model

Each company may own multiple official domains.

These domains exist only to improve identity matching.

Proposed table:

company_domains

* id
* company_id
* domain
* is_primary
* created_at

The table intentionally remains small.

No additional metadata is stored unless future requirements justify it.

---

# 6. Import Flow

When an imported website exactly matches an existing verified domain:

Import

↓

Verified domain found

↓

Automatically resolve to existing company

↓

No review required

---

When the imported domain has never been seen before:

Import

↓

No verified domain exists

↓

Needs Review

↓

Reviewer decides:

* Link to existing company
* Create new company

No automatic identity inference is performed.

---

# 7. Permanent Memory

Once a reviewer links a domain to a company:

Example

bitlifi.jp

↓

Linked to Bitlifi

↓

Stored in company_domains

From this point forward:

Every future occurrence of bitlifi.jp automatically resolves to Bitlifi.

The reviewer never needs to make the same decision again.

---

# 8. Automatic Matching Rules

Automatic matching is allowed only when:

* The imported domain exactly matches an existing verified domain.
* The imported domain exactly matches the company's primary domain.

Automatic matching is never performed because:

* Domains look similar.
* Company names look similar.
* TLDs are related.
* The system "thinks" they are probably the same company.

Exact verified identity is required.

---

# 9. Public Behaviour

Company profile

Displays:

* Company information
* Primary website

Does not display:

* Regional domains
* Additional verified domains

Those domains exist only for internal matching.

---

# 10. Benefits

This design provides:

* Conservative identity management
* High data quality
* Permanent learning after human verification
* Fewer duplicate companies
* Reduced review workload over time
* Simple matching logic
* Good scalability

As the database grows, manual work decreases because every verified domain becomes permanent knowledge.

---

# 11. Trade-offs

Advantages

* Prevents incorrect automatic merges.
* Keeps company identity stable.
* Makes future imports increasingly automatic.
* Simple and easy to understand.

Disadvantages

* First encounter of a new domain always requires review.
* Small additional table is introduced.

These costs are acceptable because they occur only once per newly discovered domain.

---

# 12. Non-Goals

This design does not attempt to solve:

* LinkedIn identities
* GitHub organizations
* Social media accounts
* Marketplace URLs
* Community websites
* Automatic similarity matching
* AI-based company identity inference

This ADR is only concerned with official company website domains.

---

# 13. Future Evolution

The initial design intentionally remains minimal.

Future requirements may extend company_domains if needed.

Until a clear requirement exists, no additional metadata or identity systems will be added.

The guiding philosophy remains:

> Never guess.
>
> Verify once.
>
> Remember forever.
