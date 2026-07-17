# Removal plan: `companies.short_description` and `companies.description`

Status: **Implemented (uncommitted).** Columns dropped on remote via
`20260722120000` + `20260722120100`. Curated CSV snapshot retained locally (gitignored).

Confirmed decision: neither `companies.short_description` nor `companies.description`
should be used in metadata, public pages, admin pages, imports, APIs, RPCs, tests, or
future SEO generation, and both columns are to be dropped from Supabase.

---

## 0. TL;DR

- Both columns are `text NULL`, no default, on `public.companies`.
- **No view or materialized view** depends on either column (verified via `pg_depend`).
- **5 database functions** reference them and would break on `DROP COLUMN` if not updated
  first: `sponsor_discovery_page`, `merge_companies`, `_company_merge_build_preview`,
  `_company_merge_company_snapshot`, `_company_merge_default_field_resolutions`.
- Public exposure is already narrow: the sponsor-discovery RPC intentionally strips
  `short_description` from its public JSON; the only place `description` /
  `short_description` are shown to end users is the **sponsor detail page**
  (`SponsorDetailView`) and the **admin company form**.
- Data: 3,453 companies. `short_description` non-empty on 3,452 (~78% are the
  `"{name} partner profile"` placeholder); `description` non-empty on 3,452 (~93% are the
  `"Auto-generated profile for …"` placeholder). Only **761** rows have a genuinely
  curated `short_description` and **238** a curated `description`.
- Safe order: (1) stop writing, (2) stop reading in app, (3) recreate DB functions without
  the columns, (4) `DROP COLUMN` in a final migration.

---

## 1. Every runtime usage (exact file paths)

### 1.1 Shared query / type layer

- `src/lib/queries/companies.ts`
  - `COMPANY_PUBLIC_COLUMNS` selects `short_description`, `description` (lines ~38–39).
  - `CompanyPublicRow` type declares both (lines ~65–66).
  - This is the **public sponsor detail loader** select (`COMPANY_PUBLIC_SELECT` →
    `getCompanyBySlug` / `getCompanyById`).

- `src/features/events/components/detail/types.ts`
  - Company embed type declares `short_description?`, `description?` (lines ~10–11).

### 1.2 Public sponsor detail page

- `src/features/sponsors/components/detail/SponsorDetailView.tsx`
  - Renders `company.short_description` as a paragraph (lines ~83–85).
  - Renders `company.description` in an "About" section (lines ~116–121).
  - These are the **only public UI surfaces** that display the fields.
- `src/features/sponsors/server/getSponsorDetailData.ts`
  - Passes `company` straight through (no direct field read), but returns the row that
    carries both fields. No change strictly required beyond the loader select.

### 1.3 Sponsor profile metadata (IR3A)

- `src/lib/seo/sponsorMetadata.ts` — **already revised** (see §8); no longer reads
  `short_description`.
- `src/app/(marketing)/sponsors/[slug]/page.tsx` — **already revised**; no longer passes
  `shortDescription`.

### 1.4 Admin company forms / create / edit

- `src/features/companies/components/admin/CompanyAdminForm.tsx`
  - `CompanyFormValues` fields `short_description`, `description` (lines ~31–32).
  - Edit-mode inputs for both (lines ~340–359).
  - PATCH payload sends both (lines ~220–221).
- `src/app/admin/companies/[id]/page.tsx`
  - Seeds the edit form `initial.short_description` / `initial.description` (lines ~120–121).
- `src/app/admin/companies/new/page.tsx`
  - Seeds create form with empty `short_description` / `description` (lines ~34–35).

### 1.5 Admin company API + server writes/reads

- `src/app/api/admin/companies/[id]/route.ts`
  - `PatchCompanyBody` and passthrough of both fields (lines ~43–44, 85–86).
- `src/features/companies/server/companyAdmin.ts`
  - `COMPANY_ADMIN_SELECT` includes both (line ~26).
  - `CompanyAdminRow` type + `mapCompanyAdminRow` map both (lines ~43–44, 67–68).
  - `UpdateCompanyAdminInput` declares both (lines ~90–91).
  - `updateCompanyAdmin` writes both into the update patch (lines ~343–348).
- `src/features/companies/server/companyAdminSearch.ts`
  - `COMPANY_ADMIN_SEARCH_SELECT` includes both (line ~14).
  - `mapCompanyAdminRow` maps both (lines ~28–29).

### 1.6 Company creation (bulk + manual)

- `src/features/companies/server/createCompanyWithLogo.ts`
  - `CompanyRow` type declares both (lines ~32–33).
  - `buildShortDescription()` / `buildDescription()` generate the placeholder text
    (lines ~36–45).
  - `createCompany` inserts both into `insertPayload` and selects them back
    (lines ~85–86, 94).
  - `applyManualCompanyLogoStorage` selects them back (line ~117).
  - This is the source of the placeholder data seen in production.
- Bulk import: no dedicated importer writes these columns directly; imported companies are
  created via `createCompany`, so they inherit the placeholder generation above. (Confirmed
  no other `insert(...short_description...)` call sites exist.)

### 1.7 Company merge (server mapping + admin validation + UI)

- `src/features/companies/server/companyMerge.ts`
  - `CompanyMergeSnapshot` type declares both (lines ~12–13).
  - `mapCompanyMergeSnapshot` maps both (lines ~197–198).
  - `CompanyMergeFieldResolutions` type declares both (lines ~78–79).
  - `defaultCompanyMergeFieldResolutions()` sets `short_description: "longer"`,
    `description: "longer"` (lines ~408–409).
- `src/features/companies/server/companyMergeAdmin.ts`
  - `parseFieldResolutions` validates/normalizes both strategies (lines ~139–140, 166–177,
    199–214, 221–222).
- `src/features/companies/components/admin/merge/MergeFieldResolutionForm.tsx`
  - Field config entries for `short_description` and `description` (lines ~65–84).
- `src/features/companies/components/admin/merge/MergeCompaniesWizard.tsx`
  - Uses `description` only as a `MergeCompanyPicker` UI prop — **unrelated** to the column.
- `src/features/companies/components/admin/merge/MergeCompanyPicker.tsx`
  - `description?: string` is a UI prop — **unrelated** to the column.

### 1.8 Tests / fixtures

- `src/features/companies/server/companyAdminSearch.test.ts` — fixture sets
  `short_description: null`, `description: null`.
- `src/features/sponsors/server/sponsorDiscoveryRpcPublicPayload.test.ts` — asserts
  `short_description` is a forbidden RPC key.
- `src/features/sponsors/server/sponsorDiscoveryPublicPayload.test.ts` — lists
  `short_description` in `FORBIDDEN_PUBLIC_ROW_KEYS`; fixture includes it.
- `src/features/sponsors/server/mapSponsorDiscoveryPublicRow.test.ts` — fixture includes
  `short_description: null`.
- `src/features/sponsors/server/sponsorDiscoverySuggest.test.ts` — fixtures include
  `short_description`.
- `src/features/sponsors/server/sponsorDiscoveryCompanyDomainsSearch.migration.test.ts` —
  asserts the migration SQL does **not** emit `'short_description', pg.short_description`.
- `src/lib/seo/sponsorMetadata.test.ts` — **already revised** (see §8).

### 1.9 Discovery internal type (carries but never exposes the field)

- `src/features/sponsors/server/sponsorDiscoveryTypes.ts` —
  `SponsorDiscoveryInternalRow.short_description` (line ~51). The public row type omits it.
- `src/features/sponsors/server/mapSponsorDiscoveryRpcResponse.ts` — reads
  `row.short_description` into the internal row (line ~89). Never forwarded to the browser.

### 1.10 Documentation (non-runtime; update for accuracy)

- `docs/plans/seo-gap-audit.md`, `docs/plans/seo-copy-examples.md`,
  `docs/audits/seo-documents-inventory.md`, `docs/phase-1-events-admin-scope.md` mention
  the fields. Informational only.

---

## 2. Every database dependency

### 2.1 Column definitions

| column | type | nullable | default |
| --- | --- | --- | --- |
| `companies.short_description` | `text` | YES | none |
| `companies.description` | `text` | YES | none |

### 2.2 Functions referencing the columns (would break on `DROP COLUMN`)

- `public.sponsor_discovery_page(...)` — selects `c.short_description` inside its internal
  CTE (latest def: `supabase/migrations/20260721120000_sponsor_discovery_company_domains_search.sql`).
  It does **not** expose the value publicly, but the column read itself would fail once the
  column is dropped.
- `public.merge_companies(...)` — writes `short_description` / `description` on the
  canonical row via `_company_merge_pick_text_field(...)`.
- `public._company_merge_build_preview(...)` — emits both under `field_differences`.
- `public._company_merge_company_snapshot(...)` — includes both in the JSON snapshot.
- `public._company_merge_default_field_resolutions()` — returns default strategies for both.

(Enumerated via `pg_get_functiondef` scan; `prokind='f'` only.)

### 2.3 Views / materialized views

- **None.** `pg_depend` rewrite-dependency scan for both columns returned zero rows, and no
  `information_schema.views` definition references them. In particular
  `company_sponsor_stats` does **not** use these columns.

### 2.4 Triggers / RLS / indexes

- No trigger function references the columns (covered by the function scan above).
- No index is defined on either column.

### 2.5 Migration history touching the columns

Merge-function migrations (each redefines the merge functions, so the final `DROP` must
come after a fresh function redefinition):
`20260624120000_company_merge_phase1.sql`, `20260625120000_company_merge_phase2.sql`,
`20260626120000_company_merge_slug_order_fix.sql`,
`20260627120000_company_merge_domain_order_fix.sql`,
`20260709120000_company_merge_organizers.sql`,
`20260712120000_company_merge_partner_alumni.sql`.

Sponsor-discovery RPC migrations (each redefines `sponsor_discovery_page`):
`20260622120000_sponsor_discovery_page_rpc.sql`,
`20260623120000_sponsor_discovery_visibility_pr1_1.sql`,
`20260716120000_company_public_restriction.sql`,
`20260717120000_sponsor_discovery_page_size_max_50.sql`,
`20260719120000_sponsor_discovery_page_p4a_public_payload.sql`,
`20260720120000_sponsor_discovery_page_public_domain_website.sql`,
`20260721120000_sponsor_discovery_company_domains_search.sql`.

Verify scripts referencing the merge field resolutions (expectation fixtures, update after
the merge functions drop the fields):
`supabase/verify/company_merge_slug_order_post_migration.sql`,
`supabase/verify/company_merge_domain_order_post_migration.sql`.

---

## 3. Could removing either column break existing functions or views?

- **Views:** No — nothing depends on them.
- **Functions:** **Yes** — dropping either column while the 5 functions in §2.2 still
  reference it will cause those functions to fail (Postgres does not fail the `DROP` because
  function bodies are not schema-bound, but the functions error at call time). Therefore the
  functions **must be redefined without the columns before** the `DROP COLUMN` migration.
- **Postgres-level `DROP` blocker:** No hard dependency (no view/rule/constraint), so
  `ALTER TABLE ... DROP COLUMN` will succeed; the risk is purely stale function bodies.

---

## 4. UI that displays or edits these fields

- **Displays (public):** `SponsorDetailView` shows `short_description` (paragraph) and
  `description` ("About" section). These disappear once the loader stops selecting them and
  the JSX is removed.
- **Edits (admin):** `CompanyAdminForm` (edit mode) exposes a "Short description" input and
  a "Description" textarea; the merge wizard's `MergeFieldResolutionForm` lets an admin pick
  which side's text wins.
- **No other UI** reads them (sponsor discovery list/search strip them; event pages only
  type them).

---

## 5. Existing non-null data (counts + representative values)

Counts over 3,453 companies:

| metric | count |
| --- | --- |
| `short_description` non-empty | 3,452 |
| `description` non-empty | 3,452 |
| `short_description` = `"{name} partner profile"` placeholder | 2,691 |
| `description` starting `"Auto-generated profile for …"` | 3,214 |
| curated `short_description` (non-placeholder) | 761 |
| curated `description` (non-placeholder) | 238 |
| curated in either column | 761 |

Representative **curated** values (real, not placeholders):

- Cryptopolitan — short: "Crypto news that doesn't waste your time. Breaking updates,
  market analysis, on-chain insights…"; description: "Premium cryptocurrency news
  platform delivering institutional-grade market analysis…".
- eToro — short: "Know better. The value of your investments may go up or down…";
  description: "Hi, we're eToro, The World's Leading Social Investment Platform…".
- Finjuris Counsel — short: "International Legal Experts for Fintech, Crypto Exchange,
  Tokenization, Forex, AML, DIFC & ADGM…".

Representative **placeholder** values (safe to discard):
`"{name} partner profile"` and `"Auto-generated profile for {name} ({website})."`.

> Note on data loss: dropping the columns discards the 761 curated short descriptions.
> If any of that copy is worth keeping, snapshot it first (see §6, step 0). Otherwise the
> curated content is unverified third-party marketing text and is intentionally being
> retired in favor of the factual summary engine (IR2).

---

## 6. Safe removal sequence

**Step 0 (optional, recommended) — snapshot curated data.** Before any DDL, export the
761 curated rows for archival:

```sql
COPY (
  SELECT id, slug, name, short_description, description
  FROM public.companies
  WHERE (short_description IS NOT NULL AND short_description !~* 'partner profile$')
     OR (description IS NOT NULL AND description !~* '^Auto-generated profile for')
) TO STDOUT WITH CSV HEADER;
```

**Step 1 — stop writing (app).** Remove the fields from create/update/merge paths so no
new data is produced:
- `createCompanyWithLogo.ts`: delete `buildShortDescription` / `buildDescription`, drop both
  keys from `insertPayload` and the select-back lists, drop them from `CompanyRow`.
- `companyAdmin.ts`: drop from `COMPANY_ADMIN_SELECT`, `UpdateCompanyAdminInput`, the write
  patch, `CompanyAdminRow`, `mapCompanyAdminRow`.
- `companyAdminSearch.ts`: drop from `COMPANY_ADMIN_SEARCH_SELECT` and `mapCompanyAdminRow`.
- `api/admin/companies/[id]/route.ts`: drop from `PatchCompanyBody` and passthrough.
- `CompanyAdminForm.tsx`, `admin/companies/[id]/page.tsx`, `admin/companies/new/page.tsx`:
  remove the inputs and the `initial` seeds.
- Merge: remove `short_description` / `description` from `CompanyMergeFieldResolutions`,
  `defaultCompanyMergeFieldResolutions`, `parseFieldResolutions`, and the
  `MergeFieldResolutionForm` field config.

**Step 2 — stop reading (app / public).** Remove display + select:
- `SponsorDetailView.tsx`: delete the `short_description` paragraph and the "About"
  `description` section.
- `queries/companies.ts`: drop both from `COMPANY_PUBLIC_COLUMNS` and `CompanyPublicRow`.
- `events/components/detail/types.ts`: drop both optional fields.
- Discovery: drop `short_description` from `SponsorDiscoveryInternalRow` and stop reading
  it in `mapSponsorDiscoveryRpcResponse.ts`.
- Update fixtures/tests in §1.8 accordingly. Keep the public-payload "forbidden key" guards
  (they remain valid defensive assertions even after the column is gone).

**Step 3 — recreate DB functions without the columns (migration).** Ship one migration that
redefines all 5 functions so none reference `short_description` / `description`:
- `sponsor_discovery_page`: remove `c.short_description` from the internal CTE.
- `merge_companies`: stop setting `short_description` / `description` on the canonical row.
- `_company_merge_company_snapshot`, `_company_merge_build_preview`,
  `_company_merge_default_field_resolutions`: remove both keys from snapshot / diff /
  defaults.
- Update `supabase/verify/company_merge_*_post_migration.sql` expectation fixtures.

**Step 4 — drop the columns (final migration).** Only after Step 3 is deployed:

```sql
ALTER TABLE public.companies
  DROP COLUMN IF EXISTS short_description,
  DROP COLUMN IF EXISTS description;
```

**Step 5 — verify.** Run the full test suite, `tsc`, and re-run
`scripts/verify-sitemap.ts`; smoke-test sponsor detail, admin company edit, company create,
and a company merge preview/execute.

Ordering rationale: app must stop reading before functions change output shape; functions
must stop referencing the columns before the `DROP`, or they error at call time.

---

## 7. Exact files and migrations that would change

### App code (Steps 1–2)

- `src/lib/queries/companies.ts`
- `src/features/events/components/detail/types.ts`
- `src/features/sponsors/components/detail/SponsorDetailView.tsx`
- `src/features/sponsors/server/sponsorDiscoveryTypes.ts`
- `src/features/sponsors/server/mapSponsorDiscoveryRpcResponse.ts`
- `src/features/companies/server/createCompanyWithLogo.ts`
- `src/features/companies/server/companyAdmin.ts`
- `src/features/companies/server/companyAdminSearch.ts`
- `src/features/companies/server/companyMerge.ts`
- `src/features/companies/server/companyMergeAdmin.ts`
- `src/features/companies/components/admin/CompanyAdminForm.tsx`
- `src/features/companies/components/admin/merge/MergeFieldResolutionForm.tsx`
- `src/app/admin/companies/[id]/page.tsx`
- `src/app/admin/companies/new/page.tsx`
- `src/app/api/admin/companies/[id]/route.ts`

### Tests / fixtures

- `src/features/companies/server/companyAdminSearch.test.ts`
- `src/features/sponsors/server/sponsorDiscoveryPublicPayload.test.ts`
- `src/features/sponsors/server/mapSponsorDiscoveryPublicRow.test.ts`
- `src/features/sponsors/server/sponsorDiscoverySuggest.test.ts`
- `src/features/sponsors/server/sponsorDiscoveryRpcPublicPayload.test.ts` (keep guard;
  remove/adjust the fixture object that supplies `short_description`)
- `src/features/sponsors/server/sponsorDiscoveryCompanyDomainsSearch.migration.test.ts`
  (the new RPC migration must still satisfy the "no `short_description`" assertion)

### New migrations (Steps 3–4)

- `supabase/migrations/<ts>_company_merge_drop_descriptions.sql` (redefine merge functions)
- `supabase/migrations/<ts>_sponsor_discovery_drop_short_description.sql` (redefine
  `sponsor_discovery_page`) — may be combined with the above into one migration.
- `supabase/migrations/<ts>_drop_company_description_columns.sql` (`DROP COLUMN`).

### Verify scripts

- `supabase/verify/company_merge_slug_order_post_migration.sql`
- `supabase/verify/company_merge_domain_order_post_migration.sql`

### Docs (accuracy)

- `docs/plans/seo-gap-audit.md`, `docs/plans/seo-copy-examples.md`,
  `docs/audits/seo-documents-inventory.md`, `docs/phase-1-events-admin-scope.md`.

---

## 8. IR3A revision (already applied, uncommitted)

To satisfy "future SEO generation must not use these fields," the uncommitted IR3A sponsor
metadata builder was revised to no longer read `short_description`:

- `src/lib/seo/sponsorMetadata.ts`
  - Removed `shortDescription` from `SponsorMetadataDescriptionInput`.
  - Removed `isQualitySponsorShortDescription`, the placeholder patterns, and the
    min-length constant.
  - New preference order: **domain/website → sponsored edition count → generic**.
- `src/lib/seo/sponsorMetadata.test.ts`
  - Dropped the `isQualitySponsorShortDescription` suite and all `shortDescription` cases;
    remaining tests assert the domain → count → generic order.
- `src/app/(marketing)/sponsors/[slug]/page.tsx`
  - Removed the `shortDescription: data.company.short_description` argument.

Verified: `npx tsx --test src/lib/seo/sponsorMetadata.test.ts` passes (8/8) and
`npx tsc --noEmit` is clean.

> The sponsor-detail loader (`COMPANY_PUBLIC_COLUMNS`) still selects the columns for now,
> so `SponsorDetailView` continues to render them until Step 2. Removing the columns from
> the loader is deferred to the removal migration sequence above to keep this change scoped
> to metadata generation only.
