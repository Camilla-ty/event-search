# Phase — Event Series ↔ Company Same-Brand Link (ADR-004)

**Status:** SB0–SB3 complete (schema · Admin · public reciprocal links · tests/docs/regressions) · **SB4 pending** (manual candidate review — ops only)
**Version:** v1
**Last updated:** 2026-07-31
**Implementation:** Shipped in code for SB0–SB3; SB4 is intentionally not automated.

Thin implementation scope for the optional 1:1 same-brand link per **[ADR-004](./adr/ADR-004-event-series-company-same-brand-link.md)**. Defines the smallest V1 deliverable, phased work, acceptance criteria, verification, and stop points — **not** SQL, migrations, or application code.

**Source of truth:** [ADR-004](./adr/ADR-004-event-series-company-same-brand-link.md) — if this scope conflicts with the ADR, the ADR wins.

**Exploration baseline:** [Architecture Audit — Linked Event Series & Company Profiles](./audits/event-series-company-same-brand-architecture-audit.md)

**Permissions:** Admin-only for all mutations (`profiles.role = admin`). Public reads use existing series/company SELECT policies plus application-side availability gates for reciprocal links.

---

## 1. Summary

| Area | V1 deliverable |
|------|----------------|
| Database | Nullable `event_series.company_profile_id` → `companies.id`; reverse 1:1 uniqueness |
| Admin — Series | Search Company, link, replace, unlink (Series-primary) |
| Admin — Company | Read reverse same-brand Series; unlink/replace affordance via Series or shared API |
| Validation | Refuse merged / inactive; 1:1 conflicts; restricted allowed with warning (public hidden) |
| Public | Reciprocal links on Event Brand (Series) hub and Company (`/sponsors/...`) when safe |
| Hidden targets | No public link when Company restricted, merged, or otherwise unavailable |
| Tests | Schema / validation, admin API, public suppression, regression (roles & imports unchanged) |
| Post-ship ops | Manual Admin review of known dual-profile candidates (no auto-backfill) |

**Phases:** SB0 schema → SB1 admin → SB2 public → SB3 tests & docs → SB4 manual candidate review.

---

## 2. V1 scope

### 2.1 In scope

| # | Deliverable |
|---|-------------|
| S1 | Column **`event_series.company_profile_id`** (nullable uuid FK → `companies.id`) |
| S2 | **Unique** enforcement so one Company is same-brand for at most one Series |
| S3 | FK **`ON DELETE RESTRICT`** (align with catalog company FKs; no cascade clear) |
| S4 | Admin **search → link / replace / unlink** on Event Series detail |
| S5 | Admin Company detail shows linked Series (reverse lookup) with navigation + clear/replace path |
| S6 | Server validation: linkable company, uniqueness, clear error messages |
| S7 | Public reciprocal nav on Series hub ↔ Company profile when both sides publicly safe |
| S8 | Suppress public reciprocal links when Company is restricted, merged, missing, or not publicly resolvable |
| S9 | Focused automated tests (schema intent via app validation tests, admin, public, regressions) |
| S10 | Operator checklist to **manually** review audit name-overlap candidates after ship |
| S11 | Update `project-state.md` / terminology notes when shipped; no table renames |

### 2.2 Explicitly deferred (do not implement in this phase)

| Deferred | Notes |
|----------|-------|
| Automatic matching or backfill | No name/domain auto-write of `company_profile_id` |
| Unified Events + Sponsors search | |
| SEO / canonical / JSON-LD unification | Separate index gates unchanged |
| Merge auto-repoint | After company/series merge, Admin reviews stale links |
| Polymorphic sponsors / role targets → `event_series` | Superseded by ADR-004 |
| Proposed / approved verification workflow | Save = verified |
| Brand super-entity | |
| Import suggestions UI | Future optional; must not write FK in V1 |
| Shared logo / forced single website | |
| Public “Events organized” on Company profile | Still deferred per organizer design |
| Company slug-redirect wiring | Independent SEO debt |
| Organizer `restricted_at` mapping hygiene | Adjacent; optional if cheap, not required |

---

## 3. Database outcomes (SB0)

Migration design lives in the migration PR for this phase. Required outcomes:

### 3.1 Column

| Column | Nullable | Type | Notes |
|--------|----------|------|-------|
| `event_series.company_profile_id` | YES | uuid | Same-brand Company profile; `NULL` = no link |

No other same-brand columns in V1 (no status, verified_at, notes).

### 3.2 Foreign key and deletion

| Rule | Enforcement |
|------|-------------|
| `company_profile_id` → `companies.id` | FK, **`ON DELETE RESTRICT`** |
| Hard-delete Company while linked | Blocked by FK (companies are not hard-deleted in product practice) |
| Unlink | Application sets column to `NULL` (Admin unlink) |
| Series delete | Out of product practice; if ever allowed, FK behavior follows series row lifecycle — do not invent cascade to companies |

**Rationale:** RESTRICT matches organizer/exhibitor/company_domains catalog FKs. Do **not** `ON DELETE SET NULL` in V1 — clearing identity must be an explicit Admin unlink (and merge review), not a silent side effect of a destructive company operation.

### 3.3 Reverse 1:1 uniqueness

| Rule | Enforcement |
|------|-------------|
| At most one Company per Series | Nullable scalar FK |
| At most one Series per Company | **`UNIQUE (company_profile_id)`** — in PostgreSQL unique indexes allow multiple NULLs, so unlinked series remain unrestricted |

### 3.4 RLS / grants

- No new public write policies.
- Series public SELECT unchanged; column readable where series is readable.
- Writes via existing admin / service-role paths only.

### 3.5 Types

Regenerate or extend Typed Supabase / app types so `event_series.company_profile_id` is available to server modules.

### 3.6 Likely areas affected (SB0)

| Area | Examples |
|------|----------|
| Migrations | New `supabase/migrations/*_event_series_company_profile_id.sql` |
| Types | Generated DB types / local series row types |
| Series loaders | Any `select` lists on `event_series` that need the new column for admin/public |

---

## 4. Admin workflows (SB1)

### 4.1 Series-primary (required)

On **Admin → Event Series → [id]** add a **Same-brand Company profile** section:

| Action | Behavior |
|--------|----------|
| **Search** | Reuse existing admin company search family (same patterns as sponsor/organizer pickers) |
| **Link** | Set `company_profile_id` when currently `NULL` |
| **Replace** | Set a different company when already linked (single write; enforces uniqueness) |
| **Unlink** | Set `company_profile_id` to `NULL` (confirm) |

Saving **is** verification — no separate approve step.

### 4.2 Company detail (required, thin)

On **Admin → Companies → [id]**:

| Element | Behavior |
|---------|----------|
| Reverse link display | If a Series has `company_profile_id = this company`, show Series name + admin link |
| Empty | “No same-brand Event Series linked.” |
| Mutate | Prefer navigate to Series section **or** call the same link/unlink API with series id — do not invent a second source of truth |

### 4.3 Validation rules (server)

| Condition | Create / replace | Notes |
|-----------|------------------|-------|
| Company missing | **Reject** | |
| `status !== active` or merged / has `merged_into_company_id` | **Reject** | Reuse `assertCompanyLinkable` (or shared same-brand helper wrapping it) |
| Company already linked to **another** Series | **Reject** | Clear conflict message naming the other Series |
| Target Series is merged lifecycle (optional harden) | **Reject or warn** | Prefer reject linking from/to unresolved merged series rows used as admin destinations |
| Company **restricted** (`restricted_at` set) | **Allow** with explicit Admin **warning** | Public reciprocal link stays hidden until unrestricted |
| Self-consistency | N/A | |

Unlink always allowed for Admins (clears FK).

### 4.4 Merge review (no auto-repoint)

| Event | Automatic | Admin |
|-------|-----------|--------|
| Company merge | Role joins repoint per existing merge RPC; **`company_profile_id` unchanged** | If FK points at loser tombstone or wrong survivor → Admin unlink/replace |
| Series merge | Successor does **not** inherit predecessor’s `company_profile_id` | Admin sets link on successor if still same brand |

**V1 surfacing (minimum):** On Series same-brand section, if linked company is not linkable/active, show a **stale link** warning with unlink/replace. Optionally list on company merge success UI: “Review same-brand Event Series links.” No background job required.

### 4.5 Likely areas affected (SB1)

| Area | Examples |
|------|----------|
| Admin Series UI | `src/app/admin/events/series/[id]/page.tsx`, series admin components under `src/features/events/` |
| Admin Company UI | `src/app/admin/companies/[id]/page.tsx`, company detail sections |
| Admin API | e.g. `PATCH` series route and/or dedicated `/api/admin/event-series/[id]/company-profile` |
| Validation | `src/lib/companies/assertCompanyLinkable.ts` (+ thin same-brand helper if needed) |
| Company search | Existing admin company search endpoints / pickers |

**Permissions:** Admin only. No Editor role.

---

## 5. Public UI (SB2)

### 5.1 Reciprocal links

| Surface | When shown | Behavior |
|---------|------------|----------|
| Event Brand hub `/events/series/[slug]` | Link exists **and** Company is publicly safe | Simple text/link to Company profile (`buildSponsorProfilePath`) |
| Company `/sponsors/[slug]` | Reverse Series exists **and** Series is publicly resolvable (not unresolved merged tombstone) | Simple text/link to Series hub (`buildSeriesHubPath`) |

Anonymous-visible (not buried only inside gated sponsorship history).

### 5.2 Hidden when unavailable

Do **not** render the public reciprocal link when any of:

- Company `restricted_at` is set
- Company `status` is merged / not active
- `buildSponsorProfilePath` would return null
- Series fails public access / is unresolved merged tombstone
- Linked company row missing

Series hub and Company profile otherwise render as today.

### 5.3 Copy / terminology

- Public Series side: may say the brand also has an organization/sponsor profile — **do not** label the Company page as a second “Event Brand.”
- Follow [terminology.md](./terminology.md): Admin = Event Series; Public = Event Brand for the series hub only.

### 5.4 Non-goals on public surfaces

- No shared hero/logo sync
- No metadata/canonical/JSON-LD merge
- No changes to edition organizer/sponsor roster link targets

### 5.5 Likely areas affected (SB2)

| Area | Examples |
|------|----------|
| Series hub | `src/app/(marketing)/events/series/[slug]/page.tsx`, `SeriesHubHeader`, `getSeriesHubData` |
| Company profile | `src/app/(marketing)/sponsors/[slug]/page.tsx`, `SponsorDetailView`, `getSponsorDetailData` |
| Path helpers | `src/lib/routes/explorerUrls.ts` |
| Restriction helpers | `src/lib/companies/companyPublicRestriction.ts` |
| Series access | `src/lib/seo/resolveSeriesPublicAccess.ts` (consume; do not redesign) |

---

## 6. Tests (SB3)

### 6.1 Focused coverage

| Layer | Acceptance |
|-------|------------|
| Schema / integrity (via migration review + app) | Unique conflict when second Series links same Company; NULL allowed on many series |
| Validation unit tests | Reject merged; allow restricted with expected warning path; replace/unlink |
| Admin API | Link / replace / unlink happy paths; 1:1 conflict; unauthorized non-admin |
| Public | Link visible when safe; **hidden** when restricted/merged; Series hub still loads |
| Regression | Sponsor/exhibitor/organizer/Partner Alumni imports and role joins **do not** write `company_profile_id`; polymorphic sponsor paths absent |

### 6.2 Likely areas affected (SB3)

| Area | Examples |
|------|----------|
| Unit / wiring tests | Adjacent to new helpers and API routes |
| Public component tests | Series header / sponsor detail link rendering |
| Migration tests | Pattern used elsewhere for constraint presence if the repo uses SQL string assertions |

---

## 7. Manual candidate review (SB4)

**After** SB0–SB3 are shipped to the target environment — **not** an automatic backfill.

### 7.1 Purpose

Admins manually decide which dual profiles deserve a same-brand link, using the audit sample as a starting checklist.

### 7.2 Candidate seed (from audit 2026-07-31)

Exact/near name overlaps (non-exhaustive; re-query at review time):

- Blockchain Futurist Conference
- Consensus by CoinDesk
- Consensus Hong Kong
- ETHGlobal
- European Blockchain Convention
- Istanbul Blockchain Week
- Korea Blockchain Week
- London Blockchain Conference
- Singapore FinTech Festival
- TOKEN2049

### 7.3 Review procedure

1. Open Series admin → Same-brand section.
2. Search candidate Company by name/domain.
3. Confirm same brand (not merely similar name / parent org).
4. Link or skip; record skips if useful for ops notes.
5. Spot-check public reciprocal links (and restricted hiding if applicable).

**Stop:** Do not script bulk `UPDATE event_series SET company_profile_id = …` from name matches.

---

## 8. Implementation phases

### SB0 — Schema

| | |
|--|--|
| **Deliver** | `company_profile_id` column, FK RESTRICT, unique 1:1, types |
| **Acceptance** | Migration applies cleanly; multiple NULL ok; second Series cannot claim same Company; linked company cannot be hard-deleted while referenced |
| **Verify** | Apply migration on intended env; `\d event_series` / constraint list; typecheck against new field |
| **Stop before commit** | Migration reviewed; no app feature UI required yet (types-only follow-ups ok in same PR if small) |
| **Stop before push** | User explicitly requests push |

### SB1 — Admin link / unlink

| | |
|--|--|
| **Deliver** | Series search/link/replace/unlink; Company reverse display; validation; stale-link warning |
| **Acceptance** | Admin can complete link lifecycle; merged rejected; restricted warned but savable; 1:1 conflict message; non-admin denied |
| **Verify** | Manual Admin QA on staging/local; unit/API tests for validation matrix |
| **Stop before commit** | Definition of Done for SB1 (lint/tsc/tests for touched paths); no public UI required yet |
| **Stop before push** | User explicitly requests push |

### SB2 — Public reciprocal links

| | |
|--|--|
| **Deliver** | Series hub ↔ Company profile links with availability gating |
| **Acceptance** | Safe pair shows both directions; restricted/merged company suppresses Company-side destination from Series (and reverse rules); terminology-safe copy |
| **Verify** | Manual public QA for linked/unlinked/restricted fixtures; component or loader tests for hide rules |
| **Stop before commit** | DoD for SB2; confirm SEO metadata unchanged aside from on-page links |
| **Stop before push** | User explicitly requests push |

### SB3 — Tests, docs, regressions

| | |
|--|--|
| **Deliver** | Focused automated tests; `project-state.md` (+ index notes if needed); confirm imports untouched |
| **Acceptance** | Test list in §6 green for affected scope; project-state describes same-brand field; no polymorphic sponsor code |
| **Verify** | `npm test` (focused), lint/tsc for touched paths, `git diff --check` |
| **Stop before commit** | Full DoD for the shipped slice; Documentation Impact Review completed |
| **Stop before push** | User explicitly requests push |

### SB4 — Manual candidate review (ops)

| | |
|--|--|
| **Deliver** | Human-reviewed links for agreed candidates (or documented skips) |
| **Acceptance** | No bulk auto-link; each saved link is intentional |
| **Verify** | Spot-check public pages for linked brands |
| **Stop** | Ops activity — may not require a code commit; if checklist doc updates only, still no push unless requested |

**Recommended PR slicing:** SB0 alone or SB0+SB1; SB2 separate; SB3 can merge with SB2; SB4 after deploy.

---

## 9. Acceptance criteria (roll-up)

V1 is done when:

1. `event_series.company_profile_id` exists with FK RESTRICT + reverse uniqueness.
2. Admins can search, link, replace, and unlink from Series (Company shows reverse).
3. Merged/unavailable companies cannot be newly linked; restricted can be linked with warning; public never exposes unsafe Company targets.
4. Public reciprocal links work for safe pairs and hide otherwise.
5. Focused tests pass; role/import regressions checked.
6. Manual candidate review has been run or explicitly scheduled with owners — **not** automated. (**SB4 — still pending.**)
7. `project-state.md` updated for the shipped behavior.

---

## 10. Verification checklist (engineering)

- [x] Migration applied in intended environment (or clearly pending user action) — `20260731120000_event_series_company_profile_id.sql`
- [x] Unique + FK behavior verified (migration + validation uniqueness conflict coverage)
- [x] Admin link / replace / unlink QA (validation + Admin UI + PATCH wiring tests)
- [x] Restricted company: Admin warning + public link hidden
- [x] Merged company: Admin reject on link/replace
- [x] 1:1 conflict when Company already linked
- [x] Public Series → Company and Company → Series for a safe fixture (component + builder tests)
- [x] Focused tests + lint/tsc for touched paths
- [x] Confirm sponsor/exhibitor/organizer/PA import paths do not set `company_profile_id`
- [x] Documentation Impact Review (`project-state`, this scope status → SB0–SB3 complete; SB4 pending)
- [ ] **SB4:** Manual candidate review (ops) — not part of SB3 code complete

---

## 11. Issues that block or gate implementation

| Item | Severity | Notes |
|------|----------|-------|
| ADR-004 acceptance | **Cleared** | Accepted 2026-07-31 |
| This scope approval | **Gate** | Treat as approved for planning when product accepts this doc; implementation still waits for an explicit build request |
| Separate migration design doc | **Not blocking** | Outcomes in §3 are sufficient for a thin V1; optional `*-migration-design.md` only if the team wants SQL reviewed in isolation |
| Organizer-only Company indexability | **Non-blocking** | Deferred SEO product call; do not change indexability in this phase |
| Whether Admin may link restricted companies | **Locked here** | Allow + warn; public hide — matches ADR public rule without blocking admin curation |
| Live candidate list drift | **Non-blocking** | Re-query overlaps at SB4; audit list is a seed |
| `company_slug_redirects` unused in app | **Non-blocking** | Independent; merged company public 404s remain pre-existing |

No schema contradiction with ADR-004. No requirement to reopen audit options A–E.

---

## 12. Commit and push policy

Per repository rules and Definition of Done:

1. **Stop before commit** at each phase boundary until DoD for that slice is met and the user asks to commit.
2. **Never push** unless the user explicitly requests push.
3. Do not combine unrelated refactors with SB0–SB3.
4. Do not commit `.env` or secrets.

This scope document itself is documentation-only until implementation is requested.

---

## 13. Documentation impact (when shipping code)

| Document | Update when implementing |
|----------|--------------------------|
| [project-state.md](./project-state.md) | Describe `company_profile_id` and admin/public behavior |
| [terminology.md](./terminology.md) | Short note only if public copy introduces dual-destination phrasing |
| This scope | Status → **Implemented** (+ date) |
| [implementation-roadmap.md](./implementation-roadmap.md) | Notes column → implemented |
| [ADR-004](./adr/ADR-004-event-series-company-same-brand-link.md) | Optional “Implemented” pointer to this scope |

Do **not** rewrite the historical audit; add ship notes only if needed.

---

## 14. References

| Document | Role |
|----------|------|
| [ADR-004](./adr/ADR-004-event-series-company-same-brand-link.md) | Binding decisions |
| [Same-brand architecture audit](./audits/event-series-company-same-brand-architecture-audit.md) | Exploration + candidate seed |
| [ADR-001](./adr/ADR-001-company-identity.md) | Never-guess identity culture |
| [terminology.md](./terminology.md) | Event Brand vs Event Series |
| [assertCompanyLinkable.ts](../src/lib/companies/assertCompanyLinkable.ts) | Merged-company gate to reuse |
| [Definition of Done](./standards/definition-of-done.md) | Completion / commit gate |

---

## 15. Document history

| Date | Change |
|------|--------|
| 2026-07-31 | Initial thin implementation scope (SB0–SB4) for ADR-004 |
| 2026-07-31 | SB0: migration `20260731120000_event_series_company_profile_id.sql` + migration test; admin/public still deferred |
| 2026-07-31 | SB1: Admin Series link/replace/unlink + Company reverse view; public still deferred |
| 2026-07-31 | SB2: Public reciprocal Series hub ↔ Company profile links with availability gating |
| 2026-07-31 | SB3: Focused tests + regression wiring + documentation accuracy pass; **SB4 remains pending** |

---

**End of phase scope.**
