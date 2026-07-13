# Protection v1

**Status:** In Progress

## Approved product decisions

- Event Explorer page size is fixed at **20**. The API does not accept a `page_size` query parameter.
- The browser must **never** receive the full event catalog.
- One **shared server pipeline** serves SSR (`/events`) and the public JSON endpoint (`GET /api/events/explorer`).
- Preserve current filters, Recommended ordering, search relevance, sorting, URL behavior, Back/Forward behavior, and loading UX.
- Add `sort` and `page` to the URL; omit their default values (`sort=recommended`, `page=1`).
- Reset `page` to **1** when filters or sort change.
- Prevent stale API responses from replacing newer client results.
- Keep current all-tier sponsor counts unchanged (`getSponsorCountsByEditionIds` / admin client pattern).
- Minimal browser row shape (`EventExplorerRow`) excludes `website_url`, series website URLs, `last_reviewed_at`, keyword IDs, raw location objects, and keyword names beyond the visible preview.

## P1 implementation scope (Event Explorer server pagination)

### Server

- `getEventExplorerPage` — load editions, resolve topics, filter, sort, slice, map to `EventExplorerRow`
- `GET /api/events/explorer` — public JSON endpoint with `Cache-Control: no-store`
- Shared params parsing (`eventExplorerParams.ts`) and row mapping (`mapEventExplorerRow.ts`)

### Client

- `useEventExplorerCollection` — fetch-driven results, URL sync via `replaceState`, popstate handling, stale-response guard
- `/events` SSR returns only the first page (20 rows)
- Event Explorer page no longer performs client-side catalog filtering, sorting, or slicing

### Tests

- Pagination, filtering, sorting, URL round-trips, stale-response guard, and no-full-catalog regression

### Explicitly out of scope for P1

- Sponsor Discovery limits
- Cloudflare rate limiting / Logpush
- Watermarking
- Pro plans / entitlements
- Database request logging

## P2 scope (not implemented)

- SQL/RPC-backed pagination for Event Explorer (replace in-memory slice)
- Sponsor Discovery rate limits and payload trimming
- Mitigate direct Supabase enumeration surfaces
- Bounded home-page discovery queries

## P3 scope (not implemented)

- Cloudflare WAF / rate rules and Logpush analytics
- Pro entitlements, exports, and watermarking
- Persistent abuse logging and alerting

## API contract

`GET /api/events/explorer`

Query parameters:

| Param | Description |
| --- | --- |
| `q` | Search query |
| `region` | Repeatable country filter |
| `topic` | Repeatable topic slug filter |
| `start` | Filter start date (ISO) |
| `end` | Filter end date (ISO) |
| `sort` | `recommended` (default), `reviewed`, `date_asc`, `date_desc`, `name` |
| `page` | 1-based page index (default `1`) |

Response:

```json
{
  "rows": "EventExplorerRow[]",
  "total": 0,
  "page": 1,
  "page_size": 20,
  "sort": "recommended",
  "filters": { "query": "", "regions": [], "startDate": "", "endDate": "", "topics": [] },
  "facets": { "countries": [], "topics": [] },
  "activeTopic": null,
  "topicUnknown": false,
  "params": { "filters": {}, "sort": "recommended", "page": 1 },
  "pageWasClamped": false
}
```

No authentication required. `page_size` is not accepted as input; it is always `20` in the response.
