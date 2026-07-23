# ADR-002: Company Website Canonical Identity Policy

**Status:** Proposed  
**Date:** 2026-06-25  
**Related:** [ADR-001 — Company Identity & Multi-Domain Matching](./ADR-001-company-identity.md)

---

## 1. Purpose

EventPixels stores one **canonical website** per company for public sponsor profiles, researcher workflows, and import matching. Sponsors arrive with many URL types: owned domains, regional sites, LinkedIn pages, token directories, and publishing platforms.

This ADR defines **which URL becomes the company’s canonical website** and how that URL maps to an **identity key** used for deduplication and import auto-matching.

It complements [ADR-001](./ADR-001-company-identity.md):

| ADR | Question |
|-----|----------|
| **ADR-001** | How does EventPixels remember **multiple verified domains** for one company after human review? |
| **ADR-002** (this document) | Which **single website** is canonical for display, and what **identity tier** does a URL belong to? |

**Guiding principle (unchanged from ADR-001):**

> Never guess identity from similarity.  
> A human verifies once.  
> EventPixels remembers forever.

ADR-002 adds a **selection priority** so researchers and the system agree on what “the company website” means before verification memory applies.

---

## 2. Definitions

| Term | Meaning |
|------|---------|
| **Canonical website** | The one URL stored in `companies.website` and shown on the public sponsor profile (href). There is exactly one canonical website per active company. |
| **Identity key** | The normalized value stored in `companies.domain` used for exact-match import resolution and duplicate clustering. May be a hostname (`sorare.com`) or a host+path key (`linkedin.com/company/sorare`). **Null** when the URL has no safe identity key. |
| **Verified domain** | A row in `company_domains` linking an identity key to a company after human verification (ADR-001). Additional verified domains are **internal only** — not shown on public profiles. |
| **Primary verified domain** | The `company_domains` row with `is_primary = true`. Mirrors the canonical identity key; promotion updates `companies.website`, `companies.domain`, and primary flag together. |
| **Website tier** | Classification of a URL by **selection priority** and **identity behavior** (§3). |
| **Identity resolution** | Outcome when parsing a URL: **`domain`** (usable key), **`no_identity`** (valid URL but no safe key), or **`unparseable`** (invalid / empty). |
| **Reference page** | A third-party listing or profile that describes the company but is not an owned official site (directory, aggregator, social company page). |
| **Hosted platform website** | A company page on a multi-tenant host where the entity is identified by **host + path** (or subdomain), not an owned registrable domain. |

**Field roles (locked):**

| Field | Role |
|-------|------|
| `companies.website` | Full canonical URL as entered or promoted (may include `https://`, path, query). |
| `companies.domain` | Identity key derived from canonical website, or `NULL` for `no_identity` URLs. |
| `company_domains` | Permanent memory of verified identity keys (ADR-001). |

Public display uses the canonical website for the link **href** and prefers the identity key (or derived host) for the visible **label** when both are set.

---

## 3. Website selection priority

When more than one URL is known for a company, select the canonical website using this priority order.

### Tier 1 — Official website

**What it is:** A website on a **domain the organization controls** — corporate marketing site, product site, or dedicated project domain.

**Examples:** `https://sorare.com`, `https://symbiogenesis.square-enix-games.com`

**Identity key:** Registrable hostname only (strip `www.`, ignore path for identity unless path is the sole differentiator on a shared corporate host — rare; treat as official only when clearly company-owned).

**Selection rule:** **Always prefer Tier 1** when a credible official site exists. Tier 2 and Tier 3 URLs may be added as **additional verified domains** (ADR-001) but must not replace Tier 1 as canonical without researcher action.

---

### Tier 2 — Social / directory / reference page

**What it is:** A **third-party page** that names or lists the company but is not an owned official domain.

**Includes:**

* Social company pages (when no Tier 1 exists): `linkedin.com/company/...`
* Startup / token **directories and aggregators**: CoinMarketCap, CoinGecko, Crunchbase, Wellfound, AngelList
* Community entry points without stable org identity: Discord invites, bare Instagram/TikTok profile URLs, Reddit communities
* Facebook bare hosts / incomplete profile URLs without an account discriminator (`facebook.com`, `facebook.com/profile.php` without numeric `id`)
* Link-in-bio aggregators: Linktree, Beacons

**Identity key:**

| Subcase | Identity key |
|---------|----------------|
| Path-stable social **company** page (e.g. LinkedIn `/company/`) | Host + path key allowed (see Tier 3 overlap — classified by **host rules**, not researcher tier) |
| **Facebook** account URL (`facebook.com`, `www.facebook.com`, `m.facebook.com`, `fb.com`) with path and/or identity-bearing query | Host + path (+ `profile.php?id=` when present). Tracking params stripped. Example: `facebook.com/profile.php?id=123`. Bare host / `profile.php` without numeric `id` → **`NULL`** (`no_identity`) |
| **Directory / aggregator / community** listings | **`NULL`** (`no_identity`) — full URL stored as website only |

**Selection rule:** Use Tier 2 **only when no Tier 1 official website is known**. Flag for future upgrade when an official site is discovered. Directory-only records (e.g. CoinMarketCap-only) are **valid sponsor references** but **weak identity** — require manual review on import.

---

### Tier 3 — Hosted platform website

**What it is:** The company’s **primary public presence** lives on a **multi-tenant publishing or platform host** identified by path or subdomain, not a owned registrable domain.

**Examples:**

* `https://x.com/sorare`
* `https://www.youtube.com/@sorare`
* `https://opensea.io/collection/...`
* `https://mirror.xyz/eth/0x...` (project publication home on Mirror)
* `https://medium.com/@project` or `project.substack.com`

**Identity key:** **Host + normalized path** when the platform rules define a stable per-entity path; otherwise `NULL` if the host is globally shared without path discrimination (e.g. bare `medium.com`).

**Selection rule:** Use Tier 3 when **no Tier 1 exists** and the project’s **effective home** is on that platform. Prefer the **most specific stable URL** (project collection page, not marketplace root). Logo curation is **manual** for hosted-platform companies until a researcher sets a manual logo.

---

### Priority summary

```
Tier 1 Official website
    ↓ (if none known)
Tier 3 Hosted platform website   ← prefer over bare directory when project “lives” here
    ↓ (if none known)
Tier 2 Social / directory / reference page
    ↓ (if none known)
Website empty — name-only company (allowed; weak identity)
```

When both Tier 2 directory and Tier 3 hosted URLs exist, prefer **Tier 3** if it is the project’s operational home; use **Tier 2** only as supplementary reference (additional verified domain or notes), not canonical website.

---

## 4. Selection rules

### 4.1 Canonical website (locked)

| Rule | Policy |
|------|--------|
| One canonical URL | Exactly one `companies.website` per active company. |
| Tier precedence | Tier 1 > Tier 3 > Tier 2 > empty. |
| Upgrade path | When a Tier 1 site is discovered for a company on Tier 2/3, researchers **promote** it to canonical (admin save or **Set as Primary** on a verified domain). |
| Public display | Sponsor profile shows **canonical website only** — not regional domains, not import alternates (ADR-001 §9). |
| URL fidelity | Store the researcher-approved full URL in `companies.website`; do not strip paths or queries that matter for Tier 3 pages. |

### 4.2 Identity key (locked)

| Rule | Policy |
|------|--------|
| Derived from canonical URL | `companies.domain` is computed from `companies.website` via identity resolution — not independently invented. |
| No bare shared hosts | Never use a bare multi-tenant hostname (e.g. `crunchbase.com`, `coinmarketcap.com`, `discord.com`) as an identity key. |
| Path-aware platforms | For allowed platforms (LinkedIn company, X handle, OpenSea collection, etc.), identity key = normalized `host/path`. |
| `no_identity` | Directory, community, and ambiguous URLs: `companies.domain = NULL`. Matching falls back to **name / alias** (ADR-001 conservative rules). |
| Never fuzzy | Similar domains, TLD variants, or name similarity **do not** auto-merge (ADR-001 §8). |

### 4.3 Verified domains (ADR-001)

| Rule | Policy |
|------|--------|
| Permanent memory | After human verification, additional URLs/domains are stored in `company_domains`. |
| Exact match only | Future imports auto-resolve only on **exact** identity key match to `companies.domain` or `company_domains.domain`. |
| Primary flag | Exactly one primary verified domain per company; mirrors canonical identity. |
| Additional domains | Regional TLDs (`bitlifi.jp`), legacy URLs, and pre-upgrade Tier 2/3 URLs may be stored as **non-primary** verified domains. |

### 4.4 Researcher judgment

| Situation | Action |
|-----------|--------|
| Official site found later | Update canonical website to Tier 1; add old URL as non-primary verified domain if still useful for matching. |
| Token with only CMC listing | Accept as canonical **temporarily** with `no_identity`; prioritize finding Tier 1 or Tier 3 project home. |
| LinkedIn-only startup | Accept LinkedIn company URL as canonical until Tier 1 exists. |
| Wrong canonical tier | Admin corrects `companies.website`; system re-derives identity key on save. |

---

## 5. Examples

### 5.1 Sorare (Tier 1 — official website)

| Field | Value |
|-------|-------|
| Context | Established company with owned domain. Sponsor spreadsheets may also list social URLs. |
| **Canonical website** | `https://sorare.com` |
| **Identity key** | `sorare.com` |
| **Tier** | 1 — Official |
| Import | `sorare.com` rows → **auto_ready** if domain verified. `linkedin.com/company/sorare` → exact path match only after reviewer links domain. |
| Public profile | Label: `sorare.com` · Href: `https://sorare.com` |

---

### 5.2 Symbiogenesis (Tier 1 — official project site)

| Field | Value |
|-------|-------|
| Context | Game/IP with dedicated official site; may also appear under publisher domain paths. |
| **Canonical website** | `https://symbiogenesis.square-enix-games.com` (or current official project URL) |
| **Identity key** | `symbiogenesis.square-enix-games.com` |
| **Tier** | 1 — Official |
| Selection | Prefer project-owned hostname over Square Enix corporate root or social pages. |
| Import | Exact match on project hostname; publisher path URLs need review before linking as additional verified domains. |
| Public profile | Label: project hostname · Href: full official URL |

---

### 5.3 LinkedIn-only startup (Tier 2 — social reference; path-aware identity)

| Field | Value |
|-------|-------|
| Context | Early-stage company with **no** owned domain yet; only LinkedIn company page. |
| **Canonical website** | `https://www.linkedin.com/company/acme-startup/` |
| **Identity key** | `linkedin.com/company/acme-startup` |
| **Tier** | 2 — Social reference (canonical until Tier 1 exists) |
| Import | Path key match → auto_ready **after** first verification links domain; first encounter → **needs_review**. |
| Upgrade | When `acme-startup.com` launches, researcher sets Tier 1 as canonical; LinkedIn row remains as non-primary verified domain. |
| Public profile | Label: `linkedin.com/company/acme-startup` · Href: full LinkedIn URL |
| Logo | Manual logo review recommended (hosted-platform rules). |

---

### 5.3b Facebook-only page (Tier 2 — social reference; path/query identity)

| Field | Value |
|-------|-------|
| Context | Sponsor with **only** a Facebook page or profile URL — no owned domain. |
| **Canonical website** | Full verified Primary URL as entered (e.g. `https://www.facebook.com/profile.php?id=…&utm_source=…` or vanity `/BrandName`) |
| **Identity key / match key** | `facebook.com/profile.php?id={digits}` or `facebook.com/{path}` — never bare `facebook.com` or `facebook.com/profile.php` without `id` |
| **Tier** | 2 — Social / community reference |
| Rationale | Facebook is multi-tenant; the account discriminator (path and/or `id` query) is the Identity. Tracking query params are dropped from the match key. `companies.website` keeps the full verified URL; `companies.domain` / primary `company_domains.domain` store the normalized Identity. |
| Import | `normalized_domain` = Identity key; full URL preserved as website. Bare Facebook host → `community_website` warning + null domain. |
| Public profile | Href: full Facebook website URL · Label from identity display rules |
| Verified domains | Primary + alias `company_domains` rows use the normalized Identity (not the raw website string). |

---

### 5.4 CoinMarketCap-only token project (Tier 2 — directory reference; no identity)

| Field | Value |
|-------|-------|
| Context | Token sponsor with **only** a CoinMarketCap (or similar) listing — no official site in spreadsheet. |
| **Canonical website** | `https://coinmarketcap.com/currencies/example-token/` |
| **Identity key** | `NULL` (`no_identity`) |
| **Tier** | 2 — Directory / reference |
| Rationale | Aggregator URLs must not collapse unrelated tokens onto `coinmarketcap.com`. |
| Import | `community_website` **warning**; `normalized_domain = null`; **needs_review**; no domain auto-accept. |
| Researcher goal | Find Tier 1 (`example.com`) or Tier 3 (project Mirror / GitHub org home) and upgrade canonical website. |
| Public profile | Href: full CMC URL · Label: derived from URL host/path display rules until upgraded |
| Verified domains | Do **not** add bare `coinmarketcap.com` to `company_domains`. |

---

### 5.5 Mirror.xyz project (Tier 3 — hosted platform website)

| Field | Value |
|-------|-------|
| Context | Web3 project whose public home is a Mirror publication, not a owned domain. |
| **Canonical website** | `https://mirror.xyz/eth/0xabc.../` or project-specific Mirror URL |
| **Identity key** | Policy: path-stable Mirror publication URL → `mirror.xyz/eth/0x...` normalized path key **when implementation supports Mirror path rules**; otherwise `NULL` until rules are added |
| **Tier** | 3 — Hosted platform |
| Import | Treat like other publishing hosts: full URL preserved; identity per host rules; manual review if `no_identity`. |
| Upgrade | If project later launches `example.io`, promote Tier 1; keep Mirror URL as non-primary verified domain for historical imports. |
| Public profile | Href: full Mirror URL |
| Logo | **Manual** logo required (`logo_source = manual`) — no Logo.dev auto-fetch on hosted platforms. |

---

## 6. Import behavior

Sponsor import uses the canonical identity policy at **validation**, **matching**, and **review** time.

### 6.1 Validation

| Input | Behavior |
|-------|----------|
| Missing website | **Warning** — row may proceed; company created by name only. |
| Unparseable URL | **Blocking** error. |
| Tier 2 directory / community (`no_identity`) | **Warning** (`community_website`) — `normalized_domain = null`. |
| Tier 1 / Tier 3 with identity key | `normalized_domain` set to identity key. |

### 6.2 Matching (exact only — ADR-001)

Auto-accept (`auto_ready`) when `normalized_domain` exactly matches:

1. `companies.domain` (primary identity key), or  
2. `company_domains.domain` (verified additional domain), or  
3. Exact company **name** or **alias** match (separate match method; no domain guess).

No auto-accept for:

* `no_identity` rows  
* Similar domains or names  
* Bare directory hosts  

### 6.3 Review queue

| Reviewer action | Effect |
|-----------------|--------|
| **Use matched** / **Choose different** company | Resolve row; if `normalized_domain` is non-null, **link domain** to company in `company_domains` (ADR-001 permanent memory). |
| **Create new** | New company; canonical website from row; identity key derived per this ADR. |
| Directory-only row | Reviewer confirms weak identity; may create name-only or CMC-canonical record pending upgrade. |

### 6.4 Duplicate clustering

Within a batch, rows cluster on `normalized_domain` when present; otherwise on normalized company name. `no_identity` rows with different full URLs must **not** cluster as duplicates.

---

## 7. Admin behavior

### 7.1 Company create / edit

| Action | Policy |
|--------|--------|
| Website required on create | **Yes** (Phase 1 rule) — researchers enter best-known URL per tier priority. |
| Save | Re-resolve identity key from website; set `companies.domain` to key or `NULL`. |
| Tier 1 corporate site | `domain` = hostname; Logo.dev may run per existing company logo policy. |
| Tier 2 / 3 / `no_identity` | `domain` may be null; logo often manual. |

### 7.2 Company domains (internal)

Admin company detail shows **Company Domains** (internal only):

* List verified domains with primary badge  
* **Add domain** — researcher verifies an additional identity key  
* **Set as Primary** — promotes domain to canonical: updates `companies.website`, `companies.domain`, and primary flag (with confirmation modal)

Public sponsor pages **never** list additional verified domains.

### 7.3 Aliases

Company **aliases** (alternate names) support import name matching only. Aliases do **not** replace website tier selection or identity keys.

### 7.4 Merge

Company merge tooling must reconcile `company_domains` and preserve a single canonical website on the surviving company (see ADR-001 implementation notes). Merge is out of band for this ADR but must not violate tier precedence without explicit researcher choice.

---

## 8. Future review workflow

This section defines **operational** expectations not yet fully automated.

### 8.1 Upgrade reviews (recommended)

| Trigger | Action |
|---------|--------|
| Canonical is Tier 2 directory or `no_identity` | Queue for researcher: find Tier 1 or Tier 3 home. |
| Canonical is Tier 2 social / Tier 3 hosted | Periodic check for launched official domain. |
| Hosted-platform company, non-manual logo | Logo review per `companyNeedsLogoReview` rules. |

### 8.2 Edition / series research metadata (related)

Edition `last_reviewed_at` and `primary_source_url` track **event** research provenance. They do not replace company canonical website policy but may cite the URL used to discover sponsors.

### 8.3 Planned automation (non-binding)

Future phases may add:

* Admin dashboard widgets: “Companies on directory-only websites”  
* Bulk suggest upgrades when official site appears in a later import  
* Stricter publish guard: warn when edition roster > N% `no_identity` companies  

No automation may bypass ADR-001 **never guess** rule.

### 8.4 Documentation and QA

Implementation changes must update:

* [ADR-001](./ADR-001-company-identity.md) cross-references  
* `docs/implementation/company-domain-matching-v1.md`  
* `docs/sponsor-import-database-design.md` (auto-accept and `community_website`)  
* `docs/project-state.md`  

QA matrix must cover all tier examples in §5 on import, admin save, and public sponsor profile.

---

## 9. Non-goals

This policy does **not**:

| Non-goal | Notes |
|----------|-------|
| Fuzzy or AI-based identity matching | Exact verified keys only (ADR-001). |
| Public display of regional / additional domains | Internal `company_domains` only. |
| Treating directories as stable identity | CoinMarketCap, Crunchbase, etc. → `no_identity`. |
| LinkedIn / GitHub as separate entity types | URLs are websites with tier rules — not standalone entities. |
| Auto-selecting “best” URL from multiple in one import row | Researcher or review decision required. |
| Scraping official sites from directory pages | Manual research. |
| Replacing ADR-001 multi-domain memory | This ADR selects canonical website; ADR-001 remembers verified alternates. |
| Social media identity graph | No follower counts, handle verification, or platform APIs. |

---

## 10. Relationship to ADR-001

| Topic | ADR-001 | ADR-002 |
|-------|---------|---------|
| Multiple domains per company | Yes — `company_domains` | Canonical **website** is still one; extras are verified domains |
| Auto-match | Exact verified domain | Defines which URLs produce a matchable key |
| Public profile | Primary website only | Defines which URL is primary |
| Social / directory URLs | Listed as non-goals for **entity model** | Admitted as **canonical website tiers** with strict `no_identity` or path rules — not as new entity types |
| Never guess | Core principle | Tier selection is researcher-driven; system does not infer Tier 1 from Tier 2 |

---

## 11. Document history

| Date | Change |
|------|--------|
| 2026-06-25 | Initial proposed policy — website tiers, selection rules, import/admin behavior, five reference examples |
| 2026-07-23 | Facebook hosts (`facebook.com`, `fb.com`, `m.facebook.com`) always `no_identity`; LinkedIn `/company/` path keys unchanged |
| 2026-07-23 | Company Identity Phase 1: Facebook path + `profile.php?id=` match keys; Set Primary preserves full `companies.website`; bare Facebook remains `no_identity` |

---

**End of ADR-002 (proposed).**
