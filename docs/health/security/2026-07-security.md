# Security Audit — 2026-09

**Review type:** Security Audit
**Cadence:** Monthly
**Cycle:** 2026-09
**Date:** 2026-07-31
**Reviewer:** Security (Automated)
**Baseline:** false
**Status:** Immutable historical record — do not edit after publication.

> Recurring Security Health Check under Framework v1.1. Prior reports: [`2026-07-security.md`](./2026-07-security.md) (baseline), [`2026-08-security.md`](./2026-08-security.md) (`SEC-001` closeout). This run was requested with review date **2026-07-31**; the cycle token is **2026-09** because `security/2026-07-security.md` and `security/2026-08-security.md` already exist and must not be overwritten. No new `SEC` IDs. `SEC-002` and `SEC-003` remain `Open` with evidence deltas. Security topics already tracked under `ARC` IDs are referenced, not duplicated.

---

## Executive summary

Second full Security cycle for EventPixels (after the narrow `SEC-001` closeout in 2026-08). Methods: reconcile open/retired `SEC` Findings against current `src/` upload/ingest/auth/header surfaces; re-check ARC security cross-refs without cloning; scan for untracked trust-boundary defects (prefer under-tracking).

Net change: **0 resolved**, **0 new**, **2 SEC still open** (`SEC-002`, `SEC-003`). `SEC-001` remains retired (Dependabot alerts control). Highest residual application-security risk continues to sit under Architecture IDs — especially `ARC-001` (service-role fail-open public reads). Material delta: manual logo upload MIME allowlist now rejects SVG (`validateCompanyLogoUpload`), but client MIME is still trusted without magic-byte sniffing, and company/event-series **ingest** paths still accept `image/svg+xml` onto the public Storage bucket — so `SEC-002` is **not** closed. `SEC-003` unchanged (parse-only URL checks; no private-host blocking).

---

## Since last cycle

| Change | Finding IDs | Notes / links |
|---|---|---|
| Resolved (removed from register) | — | none this cycle (`SEC-001` already retired in [2026-08](./2026-08-security.md)) |
| Still open | `SEC-002`, `SEC-003` | evidence deltas below |
| In progress | — | none |
| Deferred | — | none |
| New this cycle | — | none |
| Reopened (same ID) | — | none |

---

## Cross-audit references (existing Findings — not duplicated)

Per `audit-catalog.md`, Security remains the primary owner of these topics going forward. Root causes already tracked under Architecture IDs are retained and cited — not re-filed as `SEC`:

| ID | Topic | 2026-09 check |
|---|---|---|
| `ARC-001` | RLS / service-role bypass with fail-open reads | Still present — `getCompanyById` / `getCompanyBySlug` fail open to `createAdminClient` (`src/lib/queries/companies.ts`) |
| `ARC-007` | No rate limiting; no schema-validation library | Still present — no zod/valibot/yup or rate-limit usage; auth/public routes unthrottled |
| `ARC-009` | No RLS/grant regression-test harness | Still present — no harness in tree |
| `ARC-015` | Email enumeration via `/api/auth/check-email` | Still present — unauthenticated `exists` boolean (`src/app/api/auth/check-email/route.ts`) |
| `ARC-016` | Thin security headers | Still present — only `Referrer-Policy` in `next.config.ts` |
| `ARC-017` | Middleware `getUser()` on nearly every request | Observed (auth-adjacent / primarily performance) — unchanged ownership |

`DEP` / Dependabot: live dependency-advisory stream remains outside this report’s Finding set (`SEC-001` retired). No `.github/dependabot.yml` (version updates still intentionally out of scope per 2026-08 closeout).

---

## Findings

Existing Findings by ID + delta only (canonical bodies remain in [`2026-07-security.md`](./2026-07-security.md)).

### SEC-002 — Logo uploads trust client MIME and allow public SVG

- **Status:** Open
- **Delta:** Partially mitigated on **manual admin upload** paths; residual risk remains — **not resolved**.
  - **Improved:** Manual uploads go through `validateCompanyLogoUpload` (`src/lib/companies/companyLogoUploadValidation.ts`) — allowlist is PNG/JPEG/WebP only (SVG MIME rejected). Wired from `uploadCompanyLogoFileAdmin` and admin logo routes (`src/app/api/admin/companies|venues|event-series/[id]/logo/route.ts`). Venue URL ingest now reuses the same MIME allowlist (`isAllowedVenueLogoIngestContentType`).
  - **Still open:** Routes still pass **client** `file.type` with **no magic-byte sniffing**. Company auto-ingest still allows `image/svg+xml` (and gif/ico) in `ALLOWED_IMAGE_TYPES` (`src/features/companies/server/companyLogoIngest.ts`). Event-series ingest likewise still allows SVG (`src/features/events/server/eventSeriesLogoIngest.ts`). `extensionForContentType` still maps SVG / unknown → `svg` / `bin` (`companyLogoStorage.ts`). Objects remain on the public `company-logos` bucket.
- **Acceptance still unmet:** Sniff bytes server-side; disallow SVG (and spoofed SVG-as-PNG) on all write paths that land in public Storage.

### SEC-003 — SSRF in logo/website ingestion without host allow-listing

- **Status:** Open
- **Delta:** Still present. Server-side `fetch()` follows operator/import-supplied URLs and constructed `https://${domain}/` targets without host allow-listing or private/link-local/metadata IP blocking.
  - `src/features/companies/server/companyLogoIngest.ts` (`fetchWithTimeout` / homepage & favicon strategies)
  - `src/features/venues/server/venueLogoIngest.ts`
  - `src/features/events/server/eventSeriesLogoIngest.ts`
  - `src/features/companies/server/logo.ts` / `src/lib/companies/logoDevServer.ts` (related remote image fetch)
  - `src/lib/validation/url.ts` (`isValidHttpUrl` — parseability / hostname non-empty only)
- **Acceptance still unmet:** Block private, link-local, and cloud-metadata ranges; prefer allow-listed public hosts; do not follow redirects to forbidden targets.

---

## Observations (not tracked)

### Strengths

- Service-role key remains server-only (`src/lib/supabase/admin.ts`; not `NEXT_PUBLIC_`).
- Admin mutations continue to gate on `requireAdminApi`.
- Open-redirect guard still in use (`src/lib/auth/safeRedirect.ts`).
- JSON-LD now uses `dangerouslySetInnerHTML` via `JsonLd`, but `serializeJsonLd` escapes `<` (`src/components/seo/JsonLd.tsx`) — treated as a controlled sink, not a new Finding.
- Manual logo MIME allowlist (PNG/JPG/WebP) is a real reduction of SVG upload risk on the admin file path (insufficient alone to close `SEC-002`).

### Report-only notes

- **CSRF:** Cookie-authenticated admin mutations still lack an explicit CSRF/Origin check; residual risk remains low under default `SameSite=Lax` unless GET-based state changes or relaxed cookies appear.
- **Cloudflare / edge:** No WAF/bot/rate-limit configuration evidenced in-repo; edge posture remains an operational claim outside the tree.
- **Magic-byte gap:** Spoofing `image/png` while uploading SVG bytes is still plausible on manual upload — keep under `SEC-002` rather than a new ID.
- **Working-tree note:** Immutable `2026-07` / `2026-08` Security reports were missing from the working tree at review start and were restored from `HEAD` so register links resolve; content was not rewritten.

### Limitations

- No live production privilege-escalation testing; evidence is repository + config based.
- Dependabot alert enablement is a GitHub Advanced Security setting — not fully verifiable from the repo tree alone this cycle (`gh` unauthenticated).
- Timeboxed; did not exhaust every import admin route for auth omissions (spot-checked `requireAdminApi` pattern remains consistent on sampled admin APIs).

---

## Change log

| Date | Note |
|------|------|
| 2026-07-31 | Recurring Security Audit published. Reconciled `SEC-002`/`SEC-003` (both remain `Open` with deltas). Cross-referenced `ARC-001/007/009/015/016/017`. No new Findings; none resolved this cycle. |
