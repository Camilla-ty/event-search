# Phase — Edition Last Reviewed Automation: Implementation Scope

**Status:** Implemented (Phases 1–3 complete)  
**Version:** v1  
**Last updated:** 2026-07-04  

Implementation scope for **automatically updating** `event_editions.last_reviewed_at` when meaningful Event Edition data is curated in admin. Defines product policy, write-path coverage, implementation boundaries, verification, and rollout — not application code.

**Related documentation:**

- [Event Series & Edition Admin Workflow](./event-admin-workflow.md) — edition create/edit and sponsor import handoff
- [Phase — Event Explorer Sort](./phase-event-explorer-sort-scope.md) — `last_reviewed_at` as research-freshness signal for public sort
- [ADR-002 — Company website canonical identity](./adr/ADR-002-company-website-canonical-identity.md) §8.2 — edition research metadata (`last_reviewed_at`, `primary_source_url`)
- Migration `supabase/migrations/20260705120000_event_detail_research_metadata.sql` — column definition

**Permissions:** Admin-only mutations (`profiles.role = admin`). Public site reads `last_reviewed_at` for Event Detail display and Event Explorer client-side sort.

---

## 1. Goal

Keep `event_editions.last_reviewed_at` accurate without requiring researchers to manually set **Last reviewed** on every profile save, sponsor edit, or import publish.

When an admin meaningfully curates an edition’s profile or live sponsor roster, the system should record **when that curation happened** so that:

- Public **Event Detail → Research Information** reflects recent work.
- Event Explorer **Recommended** and **Recently Reviewed** sorts surface editions with current, trustworthy data.

Researchers may still set **Last reviewed** and **Primary source** explicitly on the edition form for backfill and provenance.

---

## 2. Problem statement

### 2.1 Shipped behavior (2026-07-03)

| Area | Behavior |
|------|----------|
| `last_reviewed_at` | Auto-updates to `now()` on meaningful edition profile saves, live sponsor add/remove/tier edits, organizer add/remove/role-label edits, and qualifying sponsor import publish |
| Edition create | Always `NULL` — creation is cataloging, not review |
| Manual research save | PATCH with only `last_reviewed_at` / `primary_source_url` preserves submitted values |
| Live sponsor reorder/move | Does **not** auto-touch |
| Organizer reorder | Does **not** auto-touch |
| Sponsor import draft | Does **not** auto-touch until publish |
| Company merge — sponsorship side effects | **Not implemented** (optional Phase 4) |
| Company merge — organizer repoint/delete/update | **Implemented** — touch each affected edition |

### 2.2 Why this matters

EventPixels prioritizes **research freshness** over popularity in explorer ordering ([phase-event-explorer-sort-scope.md](./phase-event-explorer-sort-scope.md) §2.3). Before automation, `last_reviewed_at` was often NULL on fully curated editions, understating data readiness in **Recommended** browse mode. Manual-only updates were easy to forget during high-volume sponsor import and live roster correction workflows.

### 2.3 Problem boundary

This feature updates **one column on `event_editions`** in response to **meaningful curation events**. It does not redefine what “reviewed” means in UX copy, change explorer sort algorithms, or add audit tables.

---

## 3. Final product vision

### 3.1 Researcher experience

1. Admin creates an edition (minimum identity fields). **`last_reviewed_at` stays NULL** — the edition is cataloged, not yet “reviewed.”
2. Admin curates the edition: fills profile, assigns venue, adds/edits/removes sponsors, or publishes an import batch.
3. On each **meaningful** curation action, `last_reviewed_at` is set to **`now()`** (server timestamp, `timestamptz`).
4. Admin may still set **Last reviewed** to a **past date** or **Primary source URL** on the edition form for explicit provenance; a subsequent meaningful curation action advances the timestamp to `now()`.
5. Public Event Detail shows **Last Reviewed** when the field is non-NULL. Event Explorer sort modes react without further product changes.

### 3.2 Operational rule (for docs and training)

> **Last reviewed** advances automatically when you save meaningful edition profile changes or change the live sponsor roster. Creation alone does not count as review. Set the date manually only when backfilling historical research.

### 3.3 Locked v1 semantics

| Rule | Value |
|------|-------|
| Auto-touch value | Always `now()` at time of meaningful write (never copy form date picker on auto-touch) |
| Manual-only save | PATCH that changes **only** `last_reviewed_at` and/or `primary_source_url` does **not** trigger a second auto-touch |
| No-op saves | If a save produces no actual column change, do **not** touch |
| Creation | `last_reviewed_at = NULL` on insert; **ignore** any `last_reviewed_at` in create body for v1 (or treat as manual override only if product later allows — **out of scope for v1 auto policy**) |

---

## 4. Non-goals

| Item | Reason |
|------|--------|
| Changing Event Explorer sort logic | Sort already consumes `last_reviewed_at`; this feature feeds the signal |
| Changing public Event Detail layout | Research section already exists |
| Auto-updating `primary_source_url` | Remains manual; only `last_reviewed_at` is automated |
| Touching editions on **draft** sponsor import steps | Live data unchanged until publish |
| Touching editions on **series** edits (name, logo, keywords) | Series-level curation; would incorrectly fan out to all child editions |
| Touching editions on **venue entity** edits (name, address, logo) | Venue record change ≠ edition review; edition `venue_id` assignment **is** in scope |
| Touching editions on **company profile** edits from roster context | Company entity change; roster membership unchanged |
| Sponsor **display_order** reorder / move within tier | Presentation-only; not research semantics |
| Organizer **display_order** reorder (Move Up/Down) | Presentation-only; not research semantics |
| DB triggers as required deliverable | App-layer helper is sufficient for v1; trigger optional follow-up |
| `last_reviewed_by` / audit log table | Future enhancement |
| Backfill of historical editions | One-time script or manual form; not part of v1 automation |
| Editor/staff roles | Admin-only v1 |

---

## 5. Policy matrix

**Legend:** ✅ Auto-touch `last_reviewed_at = now()` · ❌ No auto-touch · ⚠️ Conditional

### 5.1 Edition profile (`event_editions`)

| Action | Auto-touch? | Notes |
|--------|-------------|-------|
| **Create edition** | ❌ | Insert with `last_reviewed_at = NULL`. Creation is cataloging, not review. |
| Save **name** | ✅ | Meaningful identity |
| Save **slug** | ✅ | Meaningful identity + URL impact |
| Save **start_date** / **end_date** | ✅ | Discovery metadata |
| Save **website_url** | ✅ | Research source for sponsors |
| Save **city_id** | ✅ | Discovery metadata |
| Save **venue_id** (assign, change, clear) | ✅ | Edition location curation |
| Save **only** `last_reviewed_at` | ❌ | Explicit researcher input |
| Save **only** `primary_source_url` | ❌ | Provenance only |
| Save `last_reviewed_at` **and** profile fields in one request | ✅ | Profile change triggers touch; manual date in same payload is superseded by `now()` on auto-touch (document in UI copy) |
| Save with **no effective change** | ❌ | Compare before/after patch |

**Excluded profile fields:** `series_id`, `year` (immutable after create), `logo_url` (rejected on edition — series logo only).

### 5.2 Live sponsor roster (`event_sponsors`)

| Action | Auto-touch? | Notes |
|--------|-------------|-------|
| **Add** sponsor link | ✅ | Roster membership |
| **Remove** sponsor link | ✅ | Roster membership |
| **Update** `tier_rank` | ✅ | Affects ordering and anon visibility (RLS rank-1) |
| **Update** `tier_label` | ✅ | Public roster display |
| **Reorder** within tier (`display_order` only) | ❌ | Presentation-only |
| **Move** up/down within tier | ❌ | Same as reorder |

### 5.3 Sponsor import

| Action | Auto-touch? | Notes |
|--------|-------------|-------|
| Upload, validate, match, import to draft | ❌ | Draft tables only |
| Draft link / row edits | ❌ | Draft tables only |
| Acknowledge review | ❌ | Batch metadata only |
| **Publish** batch | ⚠️ ✅ | Touch **if** publish modified live `event_sponsors` (insert, tier_rank change, or tier_label sync on live row). If publish result is all excluded / zero live writes, ❌ |

### 5.4 Company merge

| Action | Auto-touch? | Notes |
|--------|-------------|-------|
| `merge_companies` repoints/deletes/updates **sponsorships** | ✅ **per affected edition** (spec) | **Not implemented** in app — optional Phase 4 |
| `merge_companies` repoints/deletes/updates **organizer links** | ✅ **per affected edition** | Implemented in Organizer O2 (`collectOrganizerMergeEditionIds` + touch loop) |

### 5.5 Event edition organizers (`event_edition_organizers`)

| Action | Auto-touch? | Notes |
|--------|-------------|-------|
| **Add** organizer link | ✅ | Roster membership |
| **Remove** organizer link | ✅ | Roster membership |
| **Update** `role_label` | ✅ | Public Overview display |
| **Reorder** within edition (`display_order` only) | ❌ | Presentation-only |

### 5.6 Indirect / out of scope

| Action | Auto-touch? |
|--------|-------------|
| Series keyword assignment | ❌ |
| Series profile update | ❌ |
| Venue record update (without edition `venue_id` change) | ❌ |
| Company create/edit/merge (except sponsorship / organizer side effects above) | ❌ |
| Scripts, migrations, one-off SQL | ❌ |

---

## 6. Edition create behavior

### 6.1 Locked rule

**New editions start with `last_reviewed_at = NULL`.**

Creation — even with website, dates, city, or venue filled in — is **not** considered a review event for v1.

### 6.2 Rationale

- Researchers often create a shell edition and immediately enter sponsor import; “reviewed” should mean post-curation confidence, not “exists in catalog.”
- **Recommended** sort already treats NULL as “unreviewed”; auto-setting on create would blur reviewed vs. newly cataloged editions.
- First meaningful save (profile update after create, first sponsor add, or import publish) establishes the first review timestamp.

### 6.3 Create API contract (v1)

| Field | On create |
|-------|-----------|
| `last_reviewed_at` in request body | **Ignored** for automation policy; persisted as `NULL` unless product explicitly documents manual create-time backfill in a later version |
| After insert | `last_reviewed_at IS NULL` |

### 6.4 First touch triggers

The first auto-touch typically occurs when the admin:

1. Saves the edition profile after create (any meaningful field change), **or**
2. Adds a live sponsor, **or**
3. Publishes a sponsor import with live writes.

---

## 7. Write-path coverage

All paths below are the v1 hook surface. Implementation must cover each **✅** row in §5.

### 7.1 Edition profile

| Layer | File | Entry point |
|-------|------|-------------|
| Server | `src/features/events/server/createEventEdition.ts` | `createEventEdition()` — force `last_reviewed_at: null` on insert |
| Server | `src/features/events/server/createEventEdition.ts` | `updateEventEdition()` — after meaningful patch, call touch helper |
| API | `src/app/api/admin/event-editions/route.ts` | `POST` |
| API | `src/app/api/admin/event-editions/[id]/route.ts` | `PATCH` |
| API | `src/app/api/events/route.ts` | `POST` (legacy admin-gated create — same create rules) |
| UI | `src/features/events/components/admin/EventEditionForm.tsx` | Submits to APIs above; no separate client logic required beyond optional copy |

**Meaningful-field detection:** `name`, `slug`, `start_date`, `end_date`, `website_url`, `city_id`, `venue_id`.

### 7.2 Live sponsors

| Layer | File | Entry point |
|-------|------|-------------|
| Server | `src/features/events/server/eventSponsorAdmin.ts` | `createEventSponsorLinkAdmin()` |
| Server | Same | `updateEventSponsorLinkAdmin()` — touch if `tier_rank` or `tier_label` in patch (not display_order-only side effect) |
| Server | Same | `deleteEventSponsorLinkAdmin()` |
| Server | Same | `reorderEventSponsorLinksInTierAdmin()` — **no touch** |
| Server | Same | `moveEventSponsorLinkAdmin()` — **no touch** |
| API | `src/app/api/admin/event-editions/[id]/sponsors/route.ts` | `POST` |
| API | `src/app/api/admin/event-sponsors/[linkId]/route.ts` | `PATCH`, `DELETE` |
| API | `src/app/api/admin/event-editions/[id]/sponsors/reorder/route.ts` | `POST` — **no touch** |
| API | `src/app/api/admin/event-sponsors/[linkId]/move/route.ts` | `POST` — **no touch** |

### 7.3 Sponsor import publish

| Layer | File | Entry point |
|-------|------|-------------|
| RPC | `supabase/migrations/20260618120000_sponsor_import_tier_label.sql` | `sponsor_import_publish_batch` — live writes |
| Server | `src/features/sponsor-import/server/sponsorImportAdmin.ts` | `publishBatch()` — touch after RPC when live data changed |
| API | `src/app/api/admin/sponsor-imports/batches/[batchId]/publish/route.ts` | `POST` |

**Publish touch condition:** `new_count + tier_updated_count > 0` **OR** any live `tier_label` update occurred (unchanged-tier branch in RPC). Implementation may use RPC return counts plus tier_label sync detection, or extend RPC to return `edition_id` + `live_rows_changed` flag.

### 7.4 Company merge

| Layer | File | Entry point |
|-------|------|-------------|
| Server | `src/features/companies/server/companyMerge.ts` | `mergeCompaniesExecute()` |
| RPC | `supabase/migrations/20260625120000_company_merge_phase2.sql` | `merge_companies` |
| API | `src/app/api/admin/companies/merge/route.ts` | `POST` |

Touch each distinct `event_editions_id` affected by organizer repoint/delete/update in merge result payload. Sponsorship-side touch remains optional Phase 4.

### 7.5 Event edition organizers

| Layer | File | Entry point |
|-------|------|-------------|
| Server | `src/features/organizers/server/eventOrganizerAdmin.ts` | `createEventOrganizerLinkAdmin()` |
| Server | Same | `updateEventOrganizerLinkAdmin()` — touch if `role_label` changed |
| Server | Same | `deleteEventOrganizerLinkAdmin()` |
| Server | Same | `reorderEventOrganizerLinksAdmin()` — **no touch** |
| API | `src/app/api/admin/event-editions/[id]/organizers/route.ts` | `POST` |
| API | `src/app/api/admin/event-editions/[id]/organizers/[organizerId]/route.ts` | `PATCH`, `DELETE` |
| API | `src/app/api/admin/event-editions/[id]/organizers/reorder/route.ts` | `POST` — **no touch** |
| Merge | `src/features/companies/server/companyMergeAdmin.ts` | `mergeCompaniesExecute()` — touch editions from `collectOrganizerMergeEditionIds()` |

### 7.6 Explicitly not hooked

- `sponsorImportAdmin.ts` — draft pipeline (upload through `import_to_draft`)
- `seriesKeywordsAdmin.ts` — `setSeriesKeywords()`
- `eventSeriesAdmin.ts` — series CRUD
- `venueAdmin.ts` — venue CRUD (edition `venue_id` changes go through `updateEventEdition`)
- `companyAdmin.ts` — company CRUD without edition sponsorship side effects

---

## 8. Recommended implementation approach

### 8.1 No migration required (v1)

Column and type already exist. v1 is **application logic only**.

Optional later: DB trigger on `event_sponsors` for defense-in-depth — **not** v1.

### 8.2 Shared server helper

Add a single server module (name TBD, e.g. `touchEditionLastReviewed.ts`):

```text
touchEditionLastReviewed(editionId: string): Promise<void>
  → UPDATE event_editions
     SET last_reviewed_at = now()
     WHERE id = editionId
```

Properties:

- Idempotent: repeated calls same day are fine (latest curation wins).
- No-op if `editionId` invalid — log/throw per existing server conventions.
- Does **not** modify `primary_source_url` or `updated_at` unless a separate column exists (none today).

Optional internal helper:

```text
hasMeaningfulEditionPatch(before, patch): boolean
```

### 8.3 Call-site strategy

| Path | Strategy |
|------|----------|
| `updateEventEdition` | After successful update, if meaningful fields changed and not manual-only research patch → `touchEditionLastReviewed(id)` **or** include `last_reviewed_at: now()` in same UPDATE |
| `createEventEdition` | Set `last_reviewed_at: null` explicitly on insert; strip/ignore client-supplied value |
| Sponsor admin functions | Call touch with `event_editions_id` after successful write |
| `publishBatch` | After RPC, if live changes → touch `batch.event_edition_id` |
| Merge execute | Loop affected edition IDs from result → touch each (organizer path implemented; sponsorship path optional) |

**Prefer** consolidating in server functions over duplicating in every API route so all entry points stay covered.

### 8.4 Publish RPC options

| Option | Pros | Cons |
|--------|------|------|
| **A. Touch in `publishBatch()` only** | No SQL migration | Must detect tier_label-only updates from RPC counts (may under-count today) |
| **B. Extend RPC to UPDATE edition at end** | Atomic with publish | Requires migration + RPC replace |
| **C. Extend RPC return payload with `live_rows_changed`** | App touch with certainty | Small RPC migration |

**Recommended for v1:** **Option A** with enhanced detection: touch if `new_count + tier_updated_count > 0` **or** `unchanged_count > 0` (RPC updates tier_label on unchanged tier). Document that `unchanged_count` implies live label sync.

### 8.5 Manual form coexistence

| Scenario | Behavior |
|----------|----------|
| Admin sets Last reviewed to 2024-06-01 only | Stored as submitted; no auto-touch |
| Admin later adds a sponsor | Auto-touch → `now()` |
| Admin saves name + Last reviewed date together | Meaningful profile change → auto-touch `now()` overrides manual date in same transaction |

**UI follow-up (optional, same phase):** Helper text under **Last reviewed**: *“Updates automatically when you save profile or sponsor changes.”*

### 8.6 Testing

| Level | Scope |
|-------|-------|
| Unit | `hasMeaningfulEditionPatch`, manual-only detection, create forces NULL |
| Integration | Sponsor add/delete, profile PATCH, publish with/without live writes |
| Manual QA | See §9 |

`npm run build` remains merge gate; add tests where helpers are pure.

---

## 9. QA scenarios

### 9.1 Edition create and profile

| # | Steps | Expected |
|---|-------|----------|
| Q1 | Create edition with website, dates, city | `last_reviewed_at` IS NULL |
| Q2 | Edit edition — change name only | `last_reviewed_at` set to ~now |
| Q3 | Edit edition — set Last reviewed only | Date saved; no double-bump beyond submitted value |
| Q4 | Edit edition — change name + set Last reviewed past date | `last_reviewed_at` = now (auto-touch wins) |
| Q5 | Save profile with no field changes | `last_reviewed_at` unchanged |
| Q6 | Assign venue on edition | `last_reviewed_at` set |
| Q7 | Clear venue on edition | `last_reviewed_at` set |

### 9.2 Live sponsors

| # | Steps | Expected |
|---|-------|----------|
| Q8 | Add sponsor | Touch |
| Q9 | Remove sponsor | Touch |
| Q10 | Change tier rank | Touch |
| Q11 | Change tier label only | Touch |
| Q12 | Move up / move down within tier | **No** touch |
| Q13 | Reorder via API (bulk order) | **No** touch |

### 9.3 Sponsor import

| # | Steps | Expected |
|---|-------|----------|
| Q14 | Full draft pipeline without publish | `last_reviewed_at` unchanged |
| Q15 | Publish with new sponsors | Touch |
| Q16 | Publish with tier rank changes only | Touch |
| Q17 | Publish with tier label sync only (unchanged tier) | Touch |
| Q18 | Publish with all rows excluded | **No** touch |

### 9.4 Merge and public surfaces

| # | Steps | Expected |
|---|-------|----------|
| Q19 | Merge companies affecting edition A and B sponsorships | Both editions touched |
| Q20 | Event Detail — Research Information | Shows formatted date after touch |
| Q21 | Event Explorer — Recently Reviewed | Edition rises after touch |
| Q22 | Event Explorer — Recommended browse | Reviewed edition ranks above unreviewed peers in same bucket |

### 9.5 Regression

| # | Steps | Expected |
|---|-------|----------|
| Q23 | Series keyword change | Child editions **not** touched |
| Q24 | Venue entity edit (name/address) | Linked editions **not** touched |
| Q25 | Company name edit from roster drawer | Edition **not** touched |

---

## 10. Rollout plan

### Phase 0 — Documentation (this document)

| Step | Deliverable |
|------|-------------|
| 0.1 | Approve this scope |
| 0.2 | Add cross-links to `event-admin-workflow.md` and `docs/README.md` |
| 0.3 | Note decision in `project-state.md` §5 when implementation starts |

### Phase 1 — Server helper + edition profile

| Step | Deliverable | Status |
|------|-------------|--------|
| 1.1 | `touchEditionLastReviewed` helper | ✅ |
| 1.2 | `createEventEdition` — always NULL on create | ✅ |
| 1.3 | `updateEventEdition` — meaningful patch detection + touch | ✅ |
| 1.4 | Unit tests for patch classification | ✅ |

### Phase 2 — Live sponsors + import publish

| Step | Deliverable | Status |
|------|-------------|--------|
| 2.1 | Hook create / update (tier) / delete | ✅ |
| 2.2 | Confirm reorder/move **unchanged** | ✅ |
| 2.3 | `publishBatch` touch with live-change detection | ✅ |

### Phase 3 — QA and documentation

| Step | Deliverable | Status |
|------|-------------|--------|
| 3.1 | Policy + wiring tests (`editionLastReviewedPolicy.test.ts`, `editionLastReviewedWiring.test.ts`) | ✅ |
| 3.2 | Update `event-admin-workflow.md` and `project-state.md` | ✅ |
| 3.3 | `npm run build` pass | ✅ |

### Phase 4 — Optional follow-ups (not implemented)

| Step | Deliverable | Status |
|------|-------------|--------|
| 4.1 | Company merge — touch per affected edition (**sponsorship** side effects) | ⏳ Optional |
| 4.1b | Company merge — touch per affected edition (**organizer** side effects) | ✅ (Organizer O2) |
| 4.2 | Form helper text under **Last reviewed** on edition form | ⏳ Optional |
| 4.3 | Cross-link in `docs/README.md` | ✅ |

### Rollout characteristics

| Concern | Approach |
|---------|----------|
| Feature flag | **Not required** — low-risk server-side timestamp |
| Backfill | **None** — existing NULLs remain until next curation |
| Deploy order | App deploy only; no migration dependency |
| Rollback | Revert app commit; column data harmless |

---

## 11. Document history

| Date | Change |
|------|--------|
| 2026-07-03 | Initial proposed scope from codebase audit |
| 2026-07-03 | Phases 1–3 implemented; Phase 4 (merge touch, form copy) optional |
| 2026-07-04 | Organizer write paths (§5.5, §7.5); organizer merge touch implemented |

---

## 12. Decision reference

| Topic | v1 value |
|-------|----------|
| Auto-touch timestamp | `now()` |
| Edition create | `last_reviewed_at = NULL`; creation ≠ review |
| Profile fields that touch | name, slug, dates, website, city, venue |
| Sponsor add/remove/tier | Touch |
| Sponsor reorder/move | No touch |
| Organizer add/remove/role | Touch |
| Organizer reorder | No touch |
| Import draft | No touch |
| Import publish | Touch when live `event_sponsors` changes |
| Company merge sponsorship changes | Touch per affected edition (spec; **not implemented**) |
| Company merge organizer changes | Touch per affected edition (**implemented**) |
| Series/venue entity/company profile | No touch |
| Migration | None for v1 |
| Manual Last reviewed field | Retained; manual-only save respected |

**Implementation (Phases 1–3):** `src/features/events/server/touchEditionLastReviewed.ts`, `editionLastReviewedPolicy.ts`, hooks in `createEventEdition.ts`, `eventSponsorAdmin.ts`, `sponsorImportAdmin.publishBatch()`.
