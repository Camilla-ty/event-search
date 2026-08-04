# Security Audit — 2026-09

**Review type:** Security Audit
**Cadence:** Monthly
**Cycle:** 2026-09
**Date:** 2026-07-31
**Reviewer:** Security (Automated)
**Baseline:** false
**Status:** Cycle report — remediations update this file; one cycle = one report (do not create separate closeout reports).

> Recurring Security Health Check under Framework v1.1 (lifecycle clarified under Framework v1.2). File path retained as `2026-07-security.md`; cycle token for this write-up is **2026-09**. No new `SEC` IDs. `SEC-002` and `SEC-003` were later remediated in-repo and resolved in this same report (see **Resolution History**). Security topics already tracked under `ARC` IDs are referenced, not duplicated.

---

## Executive summary

Second full Security cycle for EventPixels (after the narrow `SEC-001` closeout). Methods: reconcile open/retired `SEC` Findings against current `src/` upload/ingest/auth/header surfaces; re-check ARC security cross-refs without cloning; scan for untracked trust-boundary defects (prefer under-tracking).

**At publication (2026-07-31):** **0 resolved**, **0 new**, **2 SEC open** (`SEC-002`, `SEC-003`). Manual logo MIME allowlist rejected SVG on admin upload, but client MIME was still trusted without magic-byte sniffing and ingest paths still accepted SVG — `SEC-002` not closed. `SEC-003` unchanged (parse-only URL checks; no private-host blocking). Highest residual application-security risk continues under Architecture IDs — especially `ARC-001`.

**After remediation (2026-08-02):** `SEC-002` **Resolved** (shared `validateLogoBinary` magic-byte gate on upload + ingest/storage write paths). `SEC-003` still Open at that step. Closing evidence in **Resolution History**. Cross-audit: `ARC-001` public fail-open service-role reads later **Resolved** the same day (Architecture Resolution History).

**After remediation (2026-08-04):** `SEC-003` **Resolved** (shared `assertSafeOutboundHttpUrl` + hop-checked `safeOutboundFetch` on all live logo-ingest paths). No open `SEC` Findings remain. Closing evidence in **Resolution History**.

---

## Since last cycle

| Change | Finding IDs | Notes / links |
|---|---|---|
| Resolved (removed from register) | `SEC-002`, `SEC-003` | `SEC-002` on 2026-08-02; `SEC-003` on 2026-08-04 — see Resolution History (`SEC-001` already retired) |
| Still open | — | no open SEC Findings |
| In progress | — | none |
| Deferred | — | none |
| New this cycle | — | none |
| Reopened (same ID) | — | none |

---

## Cross-audit references (existing Findings — not duplicated)

Per `audit-catalog.md`, Security remains the primary owner of these topics going forward. Root causes already tracked under Architecture IDs are retained and cited — not re-filed as `SEC`:

| ID | Topic | 2026-09 check |
|---|---|---|
| `ARC-001` | RLS / service-role bypass with fail-open reads | Resolved 2026-08-02 — [Architecture Resolution History](../architecture/2026-07-architecture.md); residual admin/import service-role use is out of that Finding’s public scope |
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

- **Status:** Resolved (2026-08-02) — see Resolution History
- **Delta (at 2026-07-31 publication):** Partially mitigated on **manual admin upload** paths; residual risk remained at audit time.
  - **Improved then:** Manual uploads went through `validateCompanyLogoUpload` — PNG/JPEG/WebP MIME allowlist (SVG MIME rejected).
  - **Still open then:** No magic-byte sniffing; company/event-series ingest still allowed `image/svg+xml`.
- **Acceptance criteria:** Sniff bytes server-side; disallow SVG (and spoofed SVG-as-PNG) on all write paths that land in public Storage.

### SEC-003 — SSRF in logo/website ingestion without host allow-listing

- **Status:** Resolved (2026-08-04) — see Resolution History
- **Delta (at publication):** Server-side `fetch()` followed operator/import-supplied URLs and constructed `https://${domain}/` targets without host allow-listing or private/link-local/metadata IP blocking (`companyLogoIngest`, `venueLogoIngest`, `eventSeriesLogoIngest`, `logoDevServer`; parse-only `isValidHttpUrl`).
- **Delta (post Phase 1–2 / verified 2026-08-04):** Live production logo-ingest fetches use shared `assertSafeOutboundHttpUrl` + `safeOutboundFetch` (manual redirects; every hop re-validated). Unsafe initial URLs and redirect targets are blocked.
- **Acceptance criteria:** Block private, link-local, and cloud-metadata ranges (and equivalent IPv6 private ranges); fail closed when DNS resolves to blocked addresses; do not follow redirects to forbidden targets; all live production logo-ingest outbound fetches use the shared safe fetch path.

---

## Observations (not tracked)

### Strengths

- Service-role key remains server-only (`src/lib/supabase/admin.ts`; not `NEXT_PUBLIC_`).
- Admin mutations continue to gate on `requireAdminApi`.
- Open-redirect guard still in use (`src/lib/auth/safeRedirect.ts`).
- JSON-LD now uses `dangerouslySetInnerHTML` via `JsonLd`, but `serializeJsonLd` escapes `<` (`src/components/seo/JsonLd.tsx`) — treated as a controlled sink, not a new Finding.
- Manual logo MIME allowlist (PNG/JPG/WebP) reduced SVG upload risk on the admin file path at publication; later closed fully via magic-byte validation (`SEC-002` Resolution History).

### Report-only notes

- **CSRF:** Cookie-authenticated admin mutations still lack an explicit CSRF/Origin check; residual risk remains low under default `SameSite=Lax` unless GET-based state changes or relaxed cookies appear.
- **Cloudflare / edge:** No WAF/bot/rate-limit configuration evidenced in-repo; edge posture remains an operational claim outside the tree.
- **Working-tree note:** At publication, companion Security cycle files were missing from the working tree; this path holds the 2026-09 recurring write-up and subsequent `SEC-002` resolution.

### Limitations

- No live production privilege-escalation testing; evidence is repository + config based.
- Dependabot alert enablement is a GitHub Advanced Security setting — not fully verifiable from the repo tree alone this cycle (`gh` unauthenticated).
- Timeboxed; did not exhaust every import admin route for auth omissions (spot-checked `requireAdminApi` pattern remains consistent on sampled admin APIs).

---

## Resolution History

### 2026-08-02 — SEC-002 resolved

- **Acceptance criteria:** Sniff bytes server-side; disallow SVG (and spoofed SVG-as-PNG) on all write paths that land in public Storage.
- **Closing evidence (verified 2026-08-02):**
  - Shared gate `src/lib/companies/logoBinaryValidation.ts` — `validateLogoBinary` accepts PNG/JPEG/WebP by magic bytes only; rejects SVG/HTML/XML markup, GIF, ICO; does not trust client MIME.
  - Manual upload: `validateCompanyLogoUpload` → `validateLogoBinary` (`companyLogoUploadValidation.ts` + tests).
  - Storage writers call `validateLogoBinary` before upload: `companyLogoStorage.ts`, `venueLogoStorage.ts`, `eventSeriesLogoStorage.ts`.
  - Ingest / remote fetch paths validate bytes: `companyLogoIngest.ts`, `venueLogoIngest.ts`, `eventSeriesLogoIngest.ts`, `logo.ts`, `logoDevServer.ts`.
  - Commit: `54f8bfb` (*fix: validate logo file bytes before storage*).
- **Why criteria pass:** New logo bytes cannot land in public Storage as SVG or as MIME-spoofed SVG; all primary write paths share the same byte gate.
- **Residual (not SEC-002):** `SEC-003` SSRF on URL fetch remained Open at this step (later resolved 2026-08-04). Legacy objects already in Storage are out of this Finding’s write-path scope.

### 2026-08-04 — SEC-003 resolved

- **Acceptance criteria:** Block private, link-local, and cloud-metadata ranges (and equivalent IPv6 private ranges); fail closed when DNS resolves to blocked addresses; do not follow redirects to forbidden targets; all live production logo-ingest outbound fetches use the shared safe fetch path.
- **Closing evidence (verified 2026-08-04):**
  - **Phase 1 — URL guard:** `src/lib/security/safeOutboundUrl.ts` (`assertSafeOutboundHttpUrl`) rejects non-http(s), credentials, localhost/`.localhost`/`.local`/metadata hostnames, loopback, RFC1918, link-local (incl. `169.254.169.254`), IPv6 loopback/ULA/link-local/mapped-private, and DNS results that resolve to blocked IPs (fail closed on DNS errors). Tests: `safeOutboundUrl.test.ts`.
  - **Phase 2 — Redirect safety:** `src/lib/security/safeOutboundFetch.ts` uses `redirect: "manual"` and re-runs `assertSafeOutboundHttpUrl` on every `Location` hop (max 5). Public→public allowed; public→localhost / `127.0.0.1` / `169.254.169.254` / RFC1918 blocked. Tests: `safeOutboundFetch.test.ts`.
  - **Live production wiring:** All outbound logo-ingest fetches go through `safeOutboundFetch`:
    - `companyLogoIngest.ts` (manual URL, favicon, homepage/og:image, Google favicon)
    - `venueLogoIngest.ts` / `eventSeriesLogoIngest.ts` (manual logo URL)
    - `logoDevServer.ts` (Logo.dev image URL)
  - **No live path uses `redirect: "follow"`** in those modules; only `safeOutboundFetch` issues outbound HTTP.
  - **Out of scope (confirmed non-live):** deprecated `companies/server/logo.ts` (`fetchAndUploadLogoByDomain` — no app imports); `scripts/backfill/resolvers/logoUpload.ts` still uses `redirect: "follow"` offline.
  - **Final verification:** Focused SEC-003 suites **28** pass; `tsc --noEmit` / eslint (touched paths) / `git diff --check` clean on SEC-003 files.
- **Why criteria pass:** Live production logo ingest cannot fetch unsafe initial destinations or follow redirects into blocked private/metadata targets; DNS-to-private fails closed.
- **Residual (not SEC-003):** Offline backfill resolver / deprecated `logo.ts` still lack the shared fetch helper until separately retired. `isValidHttpUrl` remains parse-only for stored website fields (no server page scrape). `ARC-007` rate limiting remains Open.

---

## Change log

| Date | Note |
|------|------|
| 2026-07-31 | Recurring Security Audit published. Reconciled `SEC-002`/`SEC-003` (both remain `Open` with deltas). Cross-referenced `ARC-001/007/009/015/016/017`. No new Findings; none resolved this cycle. |
| 2026-08-02 | Resolved `SEC-002` after magic-byte validation shipped. Closing evidence in Resolution History. `SEC-003` remains Open. |
| 2026-08-04 | Resolved `SEC-003` after shared outbound URL guard + hop-checked `safeOutboundFetch` on live logo-ingest paths. Closing evidence in Resolution History. No open SEC Findings remain. No companion closeout report (Framework v1.2). |
