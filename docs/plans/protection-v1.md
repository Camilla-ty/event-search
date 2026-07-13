# Protection v1

**Status:** In Progress (P1 implemented, P2 implemented)

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
