# Protection v1

**Status:** In Progress (P1 implemented, P2 implemented, security hotfix prepared)

## Emergency security hotfix — admin RPC execute grants (2026-07-13)

### Confirmed vulnerability

Live PostgREST verification proved that **anon** and **authenticated** JWTs could invoke admin `SECURITY DEFINER` RPCs. `REVOKE FROM PUBLIC` in prior migrations was **insufficient**; Supabase retained explicit `EXECUTE` on `anon` and `authenticated`.

### Affected functions (remediated in migration `20260718120000_revoke_admin_rpc_execute_from_public_roles.sql`)

| Function | Signature |
|----------|-----------|
| `company_merge_preview` | `(uuid, uuid)` |
| `merge_companies` | `(uuid, uuid, uuid, jsonb, text)` |
| `sponsor_import_publish_batch` | `(uuid, uuid)` |
| `set_company_primary_domain` | `(uuid, uuid, text)` — current (Company Identity Phase 1: optional `p_website DEFAULT NULL`). Hotfix `20260718120000` remediated the prior `(uuid, uuid)` overload, which was dropped by `20260725120000_set_primary_preserve_website_url`. |
| `_company_merge_assert_preconditions` | `(uuid, uuid, boolean, uuid)` |
| `_company_merge_build_preview` | `(uuid, uuid)` |
| `_company_merge_company_row_json` | `(uuid)` |
| `_company_merge_company_snapshot` | `(uuid)` |
| `_company_merge_default_field_resolutions` | `()` |
| `_company_merge_draft_link_strategy` | `(jsonb, uuid)` |
| `_company_merge_duplicate_has_dependencies` | `(uuid)` |
| `_company_merge_logo_score` | `(text, text, text)` |
| `_company_merge_merge_aliases` | `(text, text[], text, text[])` |
| `_company_merge_name_key` | `(text)` |
| `_company_merge_organizer_strategy` | `(jsonb, uuid)` |
| `_company_merge_pick_text_field` | `(text, text, text)` |
| `_company_merge_process_organizers` | `(uuid, uuid, jsonb, jsonb)` |
| `_company_merge_process_partner_alumni` | `(uuid, uuid, jsonb)` |
| `_company_merge_sponsorship_strategy` | `(jsonb, uuid)` |
| `_company_merge_tombstone_slug` | `(uuid)` |
| `_company_merge_validate_resolutions` | `(jsonb, jsonb)` |

### Remediation

- Emergency migration revokes `EXECUTE` from `PUBLIC`, `anon`, and `authenticated` on every function above.
- Grants `EXECUTE` to `service_role` only.
- Adds helper `public.__restrict_rpc_execute_to_service_role(regprocedure)` for future migrations.
- Template: `supabase/sql/restrict_rpc_execute_to_service_role.sql`.

### Application call sites (unchanged — all use service role)

| RPC | Call site | Client |
|-----|-----------|--------|
| `company_merge_preview` | `src/features/companies/server/companyMerge.ts` | `createAdminClient()` |
| `merge_companies` | `src/features/companies/server/companyMerge.ts` | `createAdminClient()` |
| `sponsor_import_publish_batch` | `src/features/sponsor-import/server/sponsorImportAdmin.ts` | `createAdminClient()` |
| `set_company_primary_domain` | `src/features/companies/server/companyDomainsAdmin.ts` | `createAdminClient()` via `setCompanyPrimaryDomainForAdmin` |

No browser, anon, or authenticated-client dependency on these RPCs.

### Verification (after migration applied)

```bash
# SQL grant check
# Run supabase/verify/admin_rpc_execute_grants_post_migration.sql in SQL editor

# HTTP / client check
SUPABASE_SECURITY_TEST_EMAIL=member@example.com \
  npx tsx --env-file=.env.local scripts/verify-admin-rpc-permissions.ts

# Regression tests (opt-in)
RUN_ADMIN_RPC_SECURITY_TESTS=1 \
  SUPABASE_SECURITY_TEST_EMAIL=member@example.com \
  npx tsx --test --env-file=.env.local src/lib/supabase/adminRpcPermissions.integration.test.ts
```

**Expected after fix:** anon/authenticated receive permission denied (`42501` / `PGRST301`), **not** `P0001` business-rule errors. `service_role` retains execute access.

### Additional grant drift (not in this hotfix — report only)

| Function | Issue |
|----------|-------|
| `handle_new_user` | `SECURITY DEFINER` trigger function; `anon`/`authenticated` have `EXECUTE` (original migration revoked; later `CREATE OR REPLACE` drift) |
| `sponsor_discovery_page` | Intentionally public in P2; not part of this hotfix |

### Defense-in-depth (recommended follow-up)

- Add `auth.uid()` + admin-role checks inside admin `SECURITY DEFINER` entry points (`merge_companies`, `sponsor_import_publish_batch`, `set_company_primary_domain`).
- Keep `_company_merge_*` helpers service-role-only; consider moving to non-exposed schema long term.
- After every `CREATE OR REPLACE FUNCTION` on admin RPCs, call `__restrict_rpc_execute_to_service_role` — never rely on `REVOKE FROM PUBLIC` alone.

## Approved product decisions

### Event Explorer (P1 — implemented)

- Event Explorer page size is fixed at **20**. The API does not accept a `page_size` query parameter.
- The browser must **never** receive the full event catalog.
- One **shared server pipeline** serves SSR (`/events`) and the public JSON endpoint (`GET /api/events/explorer`).
- Add `sort` and `page` to the URL; omit their default values (`sort=recommended`, `page=1`).
- Reset `page` to **1** when filters or sort change.
- Prevent stale API responses from replacing newer client results.
- Minimal browser row shape (`EventExplorerRow`) excludes sensitive catalog fields.

### Sponsor Discovery (P2 — implemented)

- Sponsor Discovery default page size is **20**.
- Sponsor Discovery maximum page size is **50**.
- Invalid `page_size` values are **clamped**, not rejected.
- Sponsor Discovery remains **public** (no login required).
- Anonymous users can see **`sponsored_edition_count`**.
- Anonymous users **cannot** see sponsored event lists on company profiles.
- Logged-in users retain sponsored event lists on company profiles.
- **All-tier aggregate** `sponsored_edition_count` remains public via `company_sponsor_stats`.
- Anon RPC execute on `sponsor_discovery_page` is **retained** in P2; direct bypass mitigation is deferred.
- Protection v1 uses **no application database request logging**.

### Deferred to P3

- Cloudflare rate limiting and Logpush
- Pro plans, exports, watermarking, and API keys
- Revoking anon RPC execute
- `event_sponsors` RLS redesign for company-scoped anon reads

## P1 implementation scope (Event Explorer server pagination) — implemented

- `getEventExplorerPage` shared server pipeline
- `GET /api/events/explorer`
- Fetch-driven `EventExplorerPage` with minimal `EventExplorerRow` payload

## P2 implementation scope (Sponsor Discovery controls) — implemented

### Pagination

- Application max page size reduced from 100 → **50** (default remains **20**).
- `sponsor_discovery_page` RPC clamp aligned to **50**.
- Invalid `page_size` values clamp to default (below min) or max (above 50).

### Public payload

- `mapSponsorDiscoveryPublicRow` trims discovery API/SSR rows to UI-needed fields only.
- Removed public `location_label` enrichment (`getCompaniesByIds` no longer called for discovery).
- Public `eventContext` omits edition `id`; rows omit internal sort/filter fields.

### Preserved behavior

- Sponsor Discovery UI and URL behavior unchanged.
- Suggest endpoint remains minimal (`id`, `slug`, `name`, `domain`, `logo_url`).
- Anonymous event-filter discovery still follows current RLS tier visibility.
- Restricted companies remain excluded from discovery RPC results.

## P3 scope (not implemented)

- Cloudflare WAF / rate rules and Logpush analytics
- Pro entitlements, exports, and watermarking
- Persistent abuse logging and alerting
- Direct Supabase enumeration mitigation (anon RPC revoke, company-scoped `event_sponsors` reads)

## API contracts

### Event Explorer

`GET /api/events/explorer` — page size fixed at 20; no `page_size` input.

### Sponsor Discovery

`GET /api/sponsors/discovery`

Query parameters: `q`, `event`, `sort`, `page`, `page_size` (optional; default 20, max 50).

Public row shape:

```json
{
  "id": "uuid",
  "slug": "acme-corp",
  "name": "Acme Corp",
  "href": "/sponsors/acme-corp",
  "website_label": "acme.com",
  "logo_url": null,
  "logo_source": null,
  "logo_status": null,
  "sponsored_edition_count": 12,
  "event_tier_label": null
}
```

Response metadata: `{ rows, total, params, eventContext: { slug, name } | null, eventUnknown, pageWasClamped? }`

### Sponsor suggest

`GET /api/sponsors/suggest` — `{ query, items: [{ id, slug, name, domain, logo_url }], total }`
