# Phase 1.1 — Location Usability: Implementation Scope

**Status:** Implemented  
**Version:** v1  
**Last updated:** 2026-06-09  

Location display formatter + inline Add City on edition and company forms. No full location admin.

**Permissions:** Admin-only (unchanged).

---

## 1. Verified schema (live)

```
regions
  └── countries (region_id)
        └── states (country_id)
              └── cities (country_id, state_id nullable)
                    └── event_editions.city_id, companies.city_id
```

| Table | Columns (verified) |
|-------|---------------------|
| `regions` | `id`, `name`, `slug` |
| `countries` | `id`, `name`, `slug`, `region_id` |
| `states` | `id`, `name`, `slug`, `country_id` |
| `cities` | `id`, `name`, `slug`, `country_id`, `state_id` |

**No new columns added.** Formatter uses `cities.name`, `states.name`, `countries.name` via FK embeds.

**Examples in production data:**

| City | state_id | Display |
|------|----------|---------|
| Singapore | null | `Singapore` |
| Dubai | null | `Dubai, United Arab Emirates` |
| San Francisco | California | `San Francisco, California` |

Singapore has 0 states; United States has 50 states in `states` table.

---

## 2. Deliverable A — Location display formatter ✅

### Rule (locked)

```
if state exists AND state ≠ city → "city, state"
else if country exists AND country ≠ city → "city, country"
else → city only
```

### Implementation

| Module | Path |
|--------|------|
| Formatter | `src/lib/location/formatLocationLabel.ts` |
| Embed parser | `src/lib/location/parseLocationEmbed.ts` |
| Query embeds | `src/lib/location/cityEmbedSelect.ts` |

### Surfaces updated

- Event edition detail + SEO metadata
- Event cards (explorer)
- Sponsor detail + sponsor search cards + home previews
- Admin editions list, series editions table, edition detail header
- City dropdown labels (`getCityOptions`)
- Edition sibling warnings

---

## 3. Deliverable B — Inline Add City ✅

### Workflow (approved)

```
Edition/company form → Add city → Select country → Select state (if country has states)
→ Enter city name → Create → Auto-select new city → Continue form
```

### Implementation

| Item | Path |
|------|------|
| Modal | `src/features/locations/components/AddCityModal.tsx` |
| Form control | `src/features/locations/components/AdminCitySelect.tsx` |
| Server | `src/features/locations/server/locationAdmin.ts` |
| GET countries | `/api/admin/countries` |
| GET states | `/api/admin/states?countryId=` |
| POST city | `/api/admin/cities` |

### Forms wired

- `EventEditionForm` (create + edit)
- `CompanyAdminForm` (create + edit)

### Validation

| Rule | Behavior |
|------|----------|
| Country required | Error |
| State required when country has ≥1 state in DB | Error |
| State optional when country has 0 states | Allowed |
| Duplicate name + country + state | 409 with existing city hint |
| Unique city slug | Server-generated with suffix fallback |

### Out of scope (deferred)

- Countries / States / Cities admin nav
- Create country or state in UI
- Large city seeding project (existing partial seed sufficient)

---

## 4. Exit criteria ✅

- [x] Formatter uses existing `states` table (no `administrative_area` column)
- [x] Singapore → `Singapore`; Dubai → `Dubai, United Arab Emirates`
- [x] US cities with state → `city, state`
- [x] Inline Add City on edition + company forms
- [x] New city auto-selected after create
- [x] `npm run build` passes
- [x] Sponsor Import Phase 2 not started

---

## 5. Manual QA checklist

- [ ] Singapore edition shows `Singapore` (not `Singapore, Singapore`)
- [ ] Dubai edition shows `Dubai, United Arab Emirates`
- [ ] US city shows `City, State` (e.g. San Francisco, California)
- [ ] City dropdown labels use formatter
- [ ] Add city: Singapore (no state) → creates and selects
- [ ] Add city: US + state + city → creates and selects
- [ ] Duplicate city returns friendly error
- [ ] Continue edition create after add city without leaving form

---

## 6. Related documents

| Document | Path |
|----------|------|
| Phase 1 scope | [phase-1-events-admin-scope.md](./phase-1-events-admin-scope.md) |
| Implementation roadmap (historical v1) | [implementation-roadmap-v1.md](./implementation-roadmap-v1.md) |
