# Security Audit — 2026-07

**Review type:** Security Audit
**Cadence:** Monthly
**Cycle:** 2026-07
**Date:** 2026-07-20
**Reviewer:** Security Health Check (Automated)
**Baseline:** true
**Status:** Immutable historical record — do not edit after publication.

> Baseline Security Health Check under Framework v1.0. No prior Security report existed, so this run is Baseline. New Findings are `SEC-001`…`SEC-003`. Security topics already tracked under `ARC` IDs are referenced, not duplicated (`audit-catalog.md`; `README.md` §5a).

---

## Executive summary

First security baseline of the repository. Strengths: the service-role key is server-only, secrets and DB dumps are git-ignored, redirects are guarded against open-redirect, there is no `dangerouslySetInnerHTML` surface, admin routes are gated by middleware plus `requireAdminApi`, and admin RPCs are locked to `service_role`.

Three new Findings were recorded: missing dependency vulnerability scanning (`SEC-001`), weak logo upload validation including public SVG (`SEC-002`), and SSRF risk in logo/website ingestion (`SEC-003`).

The largest security issues already exist under Architecture IDs (`ARC-001`, `ARC-007`, `ARC-009`, `ARC-015`, `ARC-016`). They are cross-referenced below and were not re-filed. No scores or grades are assigned.

---

## Cross-audit references (existing Findings — not duplicated)

Per `audit-catalog.md`, Security is the primary owner of these topics going forward. The root causes are already tracked under Architecture IDs from the 2026-07 Architecture baseline, so those IDs are retained and cited here:

| ID | Topic | Note |
|---|---|---|
| `ARC-001` | RLS / service-role bypass with fail-open reads | Most material security issue in the register |
| `ARC-007` | No rate limiting on public/auth endpoints; no schema-validation library | Rate limiting is Security-primary; schema-validation library is shared API concern within the same Finding |
| `ARC-009` | No RLS/grant regression-test harness | |
| `ARC-015` | Email enumeration via `/api/auth/check-email` | |
| `ARC-016` | Thin security headers | |
| `ARC-017` | Middleware runs `getUser()` on nearly every request | Auth-adjacent; primarily a performance concern — listed for awareness, not as a Security-primary Finding |

---

## Findings

### SEC-001 — No dependency vulnerability scanning

- **Why it matters:** There is no automated scanning of third-party dependencies for known vulnerabilities — no Dependabot, no `npm audit`/SCA step, and no CI job to host one. Vulnerable packages can enter and persist undetected.
- **Severity:** Medium · **Effort:** Small
- **Evidence:** `.github/workflows/` contains only `backup-database.yml` and `backup-storage.yml`; no `.github/dependabot.yml`; `package.json` has no audit/scan script.
- **Status:** Open
- **Related:** Distinct from `ARC-005` (no CI gate for typecheck/lint/test/build). Adding a test/build gate does not by itself add dependency vulnerability scanning.

### SEC-002 — Logo uploads trust client MIME and allow public SVG

- **Why it matters:** Logo upload paths derive the stored extension from the client-supplied MIME type and enforce size/emptiness only — no magic-byte sniffing and no strict server allow-list on the upload path. SVG is accepted and objects are served from a public Storage bucket, creating a stored-XSS surface on the Storage origin and enabling content-type spoofing (unknown types become `.bin`). Uploads are admin-gated, which lowers but does not remove the risk.
- **Severity:** Medium · **Effort:** Small
- **Evidence:**
  - Routes pass `file.type` through: `src/app/api/admin/companies/[id]/logo/route.ts`, `src/app/api/admin/venues/[id]/logo/route.ts`, `src/app/api/admin/event-series/[id]/logo/route.ts`
  - Shared MIME→extension mapping and SVG acceptance: `src/features/companies/server/companyLogoStorage.ts` (`extensionForContentType`, `COMPANY_LOGO_STALE_EXTENSIONS` includes `svg`, 2 MB size cap)
  - Same upload helper pattern: `src/features/venues/server/venueLogoStorage.ts` (`uploadVenueLogoBytes`), `src/features/events/server/eventSeriesLogoStorage.ts` (`uploadEventSeriesLogoBytes`)
- **Status:** Open

### SEC-003 — SSRF in logo/website ingestion without host allow-listing

- **Why it matters:** Server-side `fetch()` follows URLs and domains from imports and admin input (homepage, favicon, provided logo URLs). `isValidHttpUrl` checks parseability only — no host allow-list and no blocking of private/link-local ranges (including cloud metadata). A crafted domain/URL can coerce the server into requesting internal resources.
- **Severity:** Medium · **Effort:** Medium
- **Evidence:**
  - `src/features/companies/server/companyLogoIngest.ts` (`fetch`, `https://${domain}/`, favicon/homepage fetches)
  - `src/features/events/server/eventSeriesLogoIngest.ts` (manual URL ingest + upload)
  - `src/features/venues/server/venueLogoIngest.ts` (manual URL ingest + upload)
  - `src/lib/validation/url.ts` (`isValidHttpUrl` — parseability only)
- **Status:** Open

---

## Observations (not tracked)

### Strengths

- Service-role key used only server-side (`src/lib/supabase/admin.ts`); never via `NEXT_PUBLIC_`.
- `.env*`, schema dumps, and local audit snapshots are git-ignored.
- Open-redirect guard in `src/lib/auth/safeRedirect.ts` (rejects non-relative and `//` targets).
- No `dangerouslySetInnerHTML` in `src` today (revisit when JSON-LD lands).
- Admin gating at middleware and `requireAdminApi`; admin RPCs revoked from `anon`/`authenticated` (`20260718120000_revoke_admin_rpc_execute_from_public_roles.sql`).

### Report-only notes

- **CSRF:** Admin mutations use cookie sessions without an explicit CSRF token or Origin check. Residual risk is low under default `SameSite=Lax` cookie behavior. Promote to a Finding if authenticated GET-based state changes or a relaxed cookie policy appear.
- **Cloudflare / edge:** No WAF/bot/rate-limit configuration is evidenced in the repo. Document intended edge controls under `docs/operations/` if they are part of the security posture.

---

## Change log

| Date | Note |
|------|------|
| 2026-07-20 | Baseline Security Audit published. Added `SEC-001`–`SEC-003`. Cross-referenced `ARC-001/007/009/015/016/017` (no duplicates). No issues fixed during the review. |
| 2026-07-21 | Report-quality polish only: severity/effort enums normalized; titles shortened; parallel-path evidence added; cross-audit refs moved above Findings; redundant wording removed. Finding IDs and set unchanged. |
