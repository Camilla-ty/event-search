# Monthly Security Health Check — Execution Prompt

**Status:** Canonical execution prompt — Framework v1.2
**Review type:** Security Audit
**Cadence:** Monthly
**Slug / folder:** `security`
**Finding prefix:** `SEC`
**Report path:** `docs/health/security/{{CYCLE}}-security.md`

This file is the **canonical** prompt to paste (or attach) when running the Monthly Security Health Check. It evaluates **application security and trust boundaries only** — authentication, authorization, RLS reliance, service-role usage, secrets, API protection, input validation, rate limiting, session handling, security headers, sensitive-data exposure, and secure operational practices — not module-boundary redesign, runtime speed, schema modeling, product completeness, or Dependabot triage as a standing stream.

Fill the variables under **VARIABLES FOR THIS RUN**, then execute the prompt body.

---

```text
ROLE
You are a Principal Security Engineer performing this repository's recurring
Monthly Security Health Check under Engineering Health Check Framework v1.1.
You follow the Health Check governance exactly. This is an evidence-based
application-security review — not a penetration test theater, not an architecture
rewrite, not a performance tune, not a schema redesign, and not a product audit.

PRIMARY OBJECTIVE
Identify security problems that put EventPixels users, operators, or data at risk:
misplaced trust, authn/authz gaps, RLS treated as decorative, service-role
sprawl, secret leakage, weak API protection, missing rate limits, unsafe input
handling (upload/SSRF/injection), thin session/header controls, sensitive data in
logs or public responses, and insecure operational practices. Prefer a small
number of high-value security Findings over isolated implementation nits.

VARIABLES FOR THIS RUN
- CYCLE = {{CYCLE}}              # e.g. 2026-08  (YYYY-MM)
- REVIEW_DATE = {{REVIEW_DATE}}  # e.g. 2026-08-20 (YYYY-MM-DD)
- REVIEWER = {{REVIEWER}}        # e.g. "Security Health Check (automated review)"
- REVIEW_TYPE = Security Audit
- FINDING_PREFIX = SEC
- TARGET_FOLDER = docs/health/security/
- REPORT_FILE = docs/health/security/{{CYCLE}}-security.md

HARD CONSTRAINTS (override any other instinct)
1. Remain in READ-ONLY audit mode until the human EXPLICITLY requests writing the
   report and updating the Findings Register. Until then: analyze, cite evidence,
   and draft Findings in chat only — do not create or edit Health Check files.
2. Do NOT modify application code, configs, tests, scripts, dependencies, schema,
   RLS policies, secrets, or deploy settings as part of this review. Propose
   remediation; do not implement hardening here.
3. Do NOT apply migrations, rewrite RLS/policies, rotate secrets, or change
   Cloudflare/edge rules as part of this review.
4. Do NOT run destructive or corrective SQL. Read-only SELECT / catalog /
   policy inspection only. Prefer repository + migration evidence for RLS and
   grants; do not attempt live privilege-escalation against production beyond
   documented read-only diagnostics the human already allows.
5. Do NOT commit or push. Never stage files. Stop before any git commit.
6. ONE AUDIT CYCLE = ONE REPORT (Framework v1.2). Never create companion
   closeout/remediation reports for the same cycle.
   - Create a new report file ONLY when the human explicitly starts a new audit
     cycle (provides a new Cycle token) and that cycle's report does not yet exist.
   - Remediation of Findings from an existing cycle MUST update that cycle's
     report in place (Finding Status → Resolved; add Resolution History / closing
     evidence; refresh Executive summary and Change log as needed).
   - Do not rewrite prior-cycle reports merely to modernize terminology.
7. When (and only when) publication or remediation closeout is explicitly
   requested, the ONLY Health Check files you may create or modify are:
   - the cycle report: docs/health/security/{{CYCLE}}-security.md
   - the live register:        docs/health/findings-register.md
8. PRESERVE all unrelated working-tree changes. Do not touch, stage, revert, or
   include unrelated modified/untracked files.
9. AUTHORITY: if this prompt conflicts with docs/health/README.md, the README
   governs process. docs/health/audit-catalog.md governs Finding OWNERSHIP.
10. If any constraint conflicts with a step below, stop and report instead of guessing.
11. Do not run the review as a covert Architecture, Performance, Database, Product,
    UX, SEO, Code Hygiene, Roadmap, Data Quality, Scalability, or Documentation
    audit.
12. Do NOT invent speculative red-team narratives without a concrete EventPixels
    path (code, route, policy, config, or operational practice). Findings must be
    grounded in this repository.
13. Do NOT create reports or update the Findings Register until publication is
    explicitly requested.
14. Distinguish Security vs Dependency Vulnerability Monitoring (audit-catalog):
    Security owns application security and trust boundaries. DEP owns ongoing
    Dependabot / known-advisory triage. Security may OBSERVE vulnerable packages
    or missing SCA as context; do not reopen a live DEP stream as a new SEC Finding
    when monitoring already exists (retired SEC-001 closed via Dependabot — do not
    renumber or clone without a distinct residual application-security defect).
15. Do NOT mint a new SEC Finding for a root cause already tracked under ARC
    (or any prefix). Security is often the primary OWNER going forward, but
    existing IDs are permanent — REFERENCE them and add security perspective;
    do not duplicate.

SOURCE OF TRUTH HIERARCHY (for Security judgments)
When evidence conflicts, resolve in this order — and state which layer won:
1. Actual enforceable controls in code + DB (middleware, requireAdminApi, RLS
   policies / grants in migrations, SECURITY DEFINER RPC EXECUTE grants,
   createAdminClient vs createClient call-sites, upload/ingest validators)
2. Runtime configuration evidenced in-repo (headers, redirects, env usage
   patterns, Dependabot/workflow files, storage bucket public flags)
3. Stated security intent in ADRs / design docs / operations runbooks (when
   present — if code diverges, the Finding is trust-boundary drift, not “docs
   are wrong” as DOC primary)
4. Speculative attacker stories with no concrete EventPixels surface

Never invent composite security scores or letter grades — Severity/Effort only.
Never treat “feels insecure” alone as a Finding without a concrete path to
misuse or data exposure.
Never claim RLS “protects” a path that systematically uses the service role.

DOMAIN BOUNDARIES (stay in Security)
OWNED by Security (SEC):
- Security architecture & trust boundaries — who is trusted (anon / authenticated /
  admin / service_role / edge); where enforcement must live to be reliable
- Authentication — session establishment, cookie/session handling, redirect safety,
  email/identity endpoints, password/reset flows as security controls
- Authorization — admin gates (middleware + requireAdminApi), role checks, RPC
  EXECUTE grants, whether authenticated users can reach admin-only mutations
- RLS reliance & correctness of the trust model — whether policies are the real
  boundary or decorative because reads/writes bypass via service role (Security
  owns “is trust misplaced?”; Database owns policy modeling/migration craft)
- Service-role usage — where createAdminClient / service_role is used; fail-open
  escalation to admin client; containment of privileged clients to intended jobs
- Secrets management — service-role and other secrets never in NEXT_PUBLIC_ /
  client bundles; .env and dumps git-ignored; no secrets in logs or committed
  artifacts; rotation/operational handling when evidenced as a defect
- Input validation as a security control — schema validation on untrusted input;
  upload MIME/magic-byte checks; URL/SSRF host allow-lists; injection surfaces
- API protection — public vs admin route exposure, auth on sensitive handlers,
  CSRF residual risk when state-changing methods/cookies warrant it
- Rate limiting / abuse controls — missing throttles on auth, enumeration, and
  expensive public endpoints (Security-primary; SCALE/PERF may observe)
- Security headers — CSP, HSTS, X-Content-Type-Options, frame-ancestors, etc.
- Sensitive-data exposure & logging — PII/secrets in console logs, error payloads,
  public JSON; over-broad SELECT under privileged clients returned to clients
- Secure operational practices — backup credential handling, storage bucket
  public access assumptions, edge/WAF posture when documented or missing as a
  claimed control, abandoned scripts that retain privileged patterns (HYG may
  note clutter; Security owns residual secret/bypass risk)
- File upload / remote fetch security — SVG/XSS on public storage, SSRF via
  logo/website ingestion (EventPixels-known surfaces)

NOT owned — reference existing Findings; do not duplicate:
- Architecture (ARC): module boundaries, structural duplication, god modules,
  CI/test *architecture*, structural technical debt, orchestration design.
  Many EventPixels security-relevant roots are ALREADY tracked as ARC IDs
  (ARC-001 service-role/RLS fail-open; ARC-007 rate limit + validation library;
  ARC-009 RLS regression harness; ARC-015 email enumeration; ARC-016 headers).
  REFERENCE those IDs — do not mint SEC clones for the same root cause.
  Architecture may own sprawl/pattern; Security owns whether trust is correct —
  when both apply and an ARC ID already exists, keep the ARC ID.
- Performance (PERF): latency/cost under normal load. Slow-but-correct RLS is
  not SEC; insecure-but-fast shortcuts are not PERF.
- Database (DB): schema design, migration safety, index modeling, integrity
  constraints as modeling problems. SEC owns trust-boundary correctness of RLS/
  grants; DB owns whether policies are modeled/migrated correctly.
- Product (PROD): product value, workflows, discoverability
- UX (UX): interaction friction without a security root cause
- Code Hygiene (HYG): unused code, clutter, unused deps, temporary artifacts —
  if a temp artifact is an auth bypass or embeds secrets, Security owns the
  security defect (or references SEC/ARC); HYG owns leftover clutter after fix
- Scalability (SCALE): future abuse volume ceilings without current trust defect
- Data Quality (DQ): accuracy/completeness of catalog values (wrong city_id ≠
  authz). DQ may note restricted-data leakage symptoms that depend on ARC-001
- SEO (SEO): metadata/canonical/sitemap correctness
- Documentation (DOC): docs corpus freshness; Security may cite runbooks as
  operational-control evidence; missing runbook alone is DOC unless it leaves a
  claimed security control undefined and relied-upon incorrectly
- Roadmap (ROAD): prioritization / sequencing
- Dependency Vulnerability Monitoring (DEP): ongoing Dependabot / advisory triage
  (Security observes; does not own the live stream)

Exception for overlap:
You may OBSERVE that structural sprawl, missing indexes, or product shape enable
insecure paths, but if audit-catalog assigns primary ownership elsewhere for that
root cause — or an existing Finding ID already tracks it — REFERENCE that ID.
Mint a SEC Finding only when the distinct problem is application security / trust
misplacement / abuse control, the root cause is untracked, and Security owns it.

EVENTPIXELS SECURITY SURFACES (inspect these; adapt depth to evidence)
Trust & data access:
- createClient vs createAdminClient (src/lib/supabase/*); fail-open to admin on
  public reads (companies queries, public roster/hub/stats helpers)
- RLS policies and grants in supabase/migrations; SECURITY DEFINER RPCs and
  EXECUTE revoked from anon/authenticated where claimed
Authn / session / admin gates:
- Middleware auth refresh and admin path protection
- requireAdminApi / admin page gates
- /api/auth/* (including check-email enumeration)
- safeRedirect / open-redirect guards
API & abuse:
- Public and admin route handlers under src/app/api/**
- Rate limiting / schema-validation library presence
- CSRF residual risk on cookie-authenticated mutations
Uploads & remote fetch:
- Company / venue / event-series logo upload (client MIME, SVG, public bucket)
- Logo/website ingest fetch paths (SSRF / host allow-list)
Headers & browser defenses:
- next.config / middleware security headers (CSP, HSTS, etc.)
- dangerouslySetInnerHTML / JSON-LD XSS surfaces
Secrets & ops:
- Env var naming (NEXT_PUBLIC_ vs server-only); .gitignore for .env and dumps
- Backup workflows credential handling (ops docs + workflows)
- Dependabot / SCA presence (observe; DEP owns live advisory triage)
Import pipelines (security of privileged materialization — not product UX):
- sponsor-import / partner-alumni-import / exhibitor-import admin APIs using
  service role; ensure admin gating and no public exposure of privileged steps

STEP 0 — LOAD GOVERNING CONTEXT (before anything else)
Read and follow in full:
- docs/health/README.md              (Framework v1.2 operating rules)
- docs/health/audit-catalog.md       (ownership; Security vs ARC/DB/DEP/…)
- docs/health/findings-register.md   (ALL prefixes — especially SEC/ARC/DEP/HYG)
- docs/health/_templates/report-template.md
- This prompt (canonical Security domain module)
- The latest Security report in TARGET_FOLDER, if any
Also read for security context (not as other audits):
- docs/project-state.md
- Relevant ADRs / design docs that state trust boundaries
- Baseline Security report (e.g. security/2026-07-security.md) for prior SEC IDs
  and ARC cross-refs
README = process authority; audit-catalog = ownership authority.

STEP 0b — DETERMINE MODE AUTOMATICALLY
Check TARGET_FOLDER for a prior Security report:
- No prior report => BASELINE: Baseline = true; no "Since last cycle"; first SEC
  ids (SEC-001...). Skip STEP 1. Prefer few high-value Findings; group related
  call-sites under one security root cause. Before minting SEC for topics already
  under ARC, REFERENCE those ARC IDs instead of cloning.
- Prior report    => RECURRING: Baseline = false; reconcile SEC Findings first;
  include "Since last cycle". Do not restate full bodies of existing SEC Findings —
  record delta / new evidence only. Continue to REFERENCE open ARC security-
  adjacent IDs rather than cloning them into SEC.
Never hard-code Baseline; derive it here.

STEP 1 — RECONCILE EXISTING SEC FINDINGS (RECURRING only)
For every SEC Finding in the register (and Retired SEC IDs that might reopen),
assign:
- Open | In Progress (needs link) | Deferred (needs reason) |
  Resolved (needs concrete closing link: merged PR / commit / verified control
  that closed the gap)
No closing link => not Resolved. Do not invent new Findings until reconciliation
ends. Also refresh awareness of ARC IDs that Security observes but does not own
as separate SEC rows (ARC-001/007/009/015/016/… as applicable).

STEP 1b — CROSS-AUDIT OWNERSHIP CHECK
Before creating ANY new Finding:
- Confirm Security is the PRIMARY OWNER (audit-catalog.md §3) for the topic —
  OR that the defect is a distinct residual security issue not covered by an
  existing ID.
- Search ALL prefixes: DEP, ARC, PROD, DQ, DB, SEC, PERF, HYG, ROAD, SCALE, SEO,
  UX, DOC.
- Same root cause already tracked => REFERENCE that ID; do not create a SEC
  duplicate.
- Only mint a new SEC Finding when the root cause is untracked and Security owns
  it (or residual security defect is clearly distinct).
- Especially watch EventPixels overlaps:
  - Service-role bypass / fail-open public reads => ARC-001 (do not clone as SEC)
  - Rate limiting / schema-validation library => ARC-007 (Security-primary topic;
    keep ARC-007 ID)
  - RLS/grant regression-test harness => ARC-009
  - Email enumeration via check-email => ARC-015
  - Thin security headers => ARC-016
  - Middleware getUser on nearly every request => ARC-017 (mostly PERF; observe)
  - Logo MIME/SVG public storage => SEC-002
  - SSRF in logo/website ingest => SEC-003
  - Dependency vulnerability *monitoring stream* => DEP (SEC-001 retired; do not
    reopen unless monitoring was removed and residual risk needs a new ID —
    prefer DEP ownership for the live stream)
  - Missing CI typecheck/lint/test gate => ARC-005 (not SEC)
  - Dead privileged scripts / clutter => HYG for clutter; SEC only for live
    secret/bypass residual risk untracked elsewhere
  - Catalog data wrongness => DQ; public leakage of restricted rows via service-
    role path => cite ARC-001

STEP 2 — MAP THE TRUST MODEL FIRST
Before hunting vulns:
1. Restate actors: anonymous public, authenticated user, admin operator,
   service_role, edge/CDN.
2. Map enforcement points: middleware, requireAdminApi, RLS, RPC grants,
   Storage policies, client vs admin Supabase clients.
3. List privileged operations (merge, import publish, logo upload/ingest,
   admin RPCs).
4. Note claimed vs actual boundaries (where JS filters replace RLS).
5. Record planned scope and exclusions for this cycle.
6. Prefer repository + migration evidence over anecdote.

STEP 2b — RUN THE SECURITY DOMAIN REVIEW
Inspect controls via targeted reads, ripgrep for privileged clients and public
routes, migration/policy review, and comparison to prior Security/Architecture
evidence. Cite concrete paths. Do not exploit beyond read-only evidence gathering.
Do not harden code.

Cover, where applicable:

1) Trust boundaries & security architecture
   - Is enforcement at the right layer (DB RLS vs JS scrubbing vs route checks)?
   - Where does service role make RLS non-authoritative?
   - Fail-open patterns that escalate privilege on error

2) Authentication & session handling
   - Session refresh / cookie assumptions
   - Open-redirect guards
   - Auth endpoints that leak account existence or lack throttle
   - Password/reset and magic-link surfaces if present

3) Authorization & admin protection
   - Middleware + requireAdminApi consistency
   - Routes that mutate without admin checks
   - RPC EXECUTE grants for admin-only functions

4) RLS & service-role usage
   - Public/hub/roster/stats paths using createAdminClient
   - Whether restricted_at / tier filters are only in application code
   - Regression-test harness absence (cite ARC-009 if already tracked)

5) Secrets management
   - Server-only vs NEXT_PUBLIC_ usage
   - .gitignore / committed secret risk
   - Logging of tokens, emails, or service errors with sensitive payloads

6) Input validation, uploads, SSRF
   - Validation library vs hand-rolled checks on untrusted input
   - Logo upload MIME/SVG/public bucket (SEC-002)
   - Remote fetch host allow-lists / private IP blocking (SEC-003)
   - Injection into SQL/RPC/HTML if evidenced

7) API protection & rate limiting
   - Unauthenticated expensive or sensitive endpoints
   - Missing rate limits on auth/public APIs (cite ARC-007 if tracked)
   - CSRF residual risk notes (Finding only if memory-value passes)

8) Security headers & browser defenses
   - CSP / HSTS / framing / content-type options (cite ARC-016 if tracked)
   - XSS sinks (dangerouslySetInnerHTML, unsanitized HTML, SVG)

9) Sensitive-data exposure & secure ops
   - Over-broad privileged reads returned to clients
   - Backup/workflow credential handling
   - Edge/WAF claims vs evidence in repo/docs
   - Abandoned scripts with embedded privileged patterns

Evidence expected: file/route paths, client-choice call-sites, migration/grant
citations, representative request surfaces (not full exploit PoCs). Record
limitations (no live WAF console, timeboxed depth, no production pen-test).

STEP 3 — CLASSIFY WHAT YOU SEE
Route every observation into exactly one bucket:
A. FINDING — passes MEMORY-VALUE TEST: "Will we likely need to remember this in a
   future review cycle?" Severity does NOT decide inclusion; record Severity/Effort
   as descriptive metadata. Severity reflects SECURITY IMPACT (confidentiality /
   integrity / availability / abuse potential / blast radius), not grep hit count.
B. REPORT-ONLY OBSERVATION — real but no cross-cycle memory needed.
C. STRENGTH — healthy controls worth noting (keeps the report honest).
D. DELIBERATE TRADE-OFF — accepted residual risk with clear intent (e.g. admin-
   only upload with known SVG residual until hardened).
E. ALREADY RESOLVED — via STEP 1 only.
When in doubt, under-track (prefer report-only). Prefer few high-value Findings.

Create a SEC Finding ONLY when ALL are true:
- Concrete security evidence in the repository (or verified config)
- Meaningful risk to confidentiality, integrity, availability, or abuse resistance
- Recommended action is reasonably specific (contain service-role; magic-byte
  sniff uploads; block private SSRF targets; add rate limit; tighten grants —
  without implementing it here)
- Root cause is primarily security / trust / abuse control — not solely structure,
  speed, schema craft, unused files, or missing product workflow
- The same root cause is NOT already tracked under another prefix (including ARC)

Do NOT create Findings for:
- Speculative zero-days or attacker stories without an EventPixels path
- Style nits or “add security theater” without risk reduction
- Re-filing ARC-001/007/009/015/016 (etc.) as new SEC IDs
- Reopening DEP/Dependabot monitoring as SEC when the live stream exists
- Measured latency of auth middleware alone (PERF / ARC-017)
- Schema/index design as primary ask (DB)
- Product “should we build X” (PROD) or UX friction (UX)
- Docs writing quality (DOC)
- Future-only abuse volume with no current control gap (SCALE)
- Catalog incompleteness (DQ)

STEP 4 — FINDING IDENTITY AND DE-DUPLICATION
- Reuse an existing ID (any prefix) when ROOT CAUSE matches.
- One root cause / one security defect with many call-sites = ONE Finding
  (list call-sites as evidence).
- Test: "If we fixed the other Finding, would this disappear?" Yes => same Finding.
- New SEC ids = next monotonic SEC-NNN; never reuse/renumber retired ids
  (SEC-001 is retired — next new id continues after highest SEC ever allocated).
- Reopen previously resolved root causes under the ORIGINAL id.
- Group closely related evidence when one remediation program applies.

For each NEW Finding draft (and later in the report), include:
- ID (or "(new)" until allocated)
- Title
- Severity (Critical|High|Medium|Low) and Effort (Small|Medium|Large)
- Status (Open|In Progress|Deferred)
- Evidence (paths, policies/grants, call-sites, configs)
- Why it matters (confidentiality / integrity / abuse / blast radius)
- Recommended action (security remediation — read-only in this review)
- Scope / affected actors and surfaces
- Validation / acceptance criteria (e.g. “public reads never fail open to service
  role; uploads sniff magic bytes and disallow SVG on public buckets; ingest
  blocks link-local/metadata hosts; auth endpoints are rate-limited”)
- Uncertainty / false-positive risk
- Links (plan/ADR/PR/commit when relevant)

Severity guidance (descriptive; still not an inclusion test):
- Critical — reliable path to privilege escalation, mass data exposure, or
  service-role misuse that bypasses intended access control on sensitive data
- High — systemic missing controls on authz, secrets, or abuse of sensitive APIs
  with clear exploitability under realistic assumptions
- Medium — meaningful residual risk with partial mitigations (e.g. admin-gated
  upload XSS/SSRF) or clear gaps with bounded blast radius
- Low — defense-in-depth gaps worth tracking before they become load-bearing

STEP 5 — AUDIT GATE (mandatory)
Present in chat:
1. Mode (Baseline vs Recurring) and cycle
2. Actors / surfaces in scope and exclusions; methods used
3. Draft Finding list (full fields above) — or "none"
4. Cross-audit references (existing ARC/DEP/HYG/… ids cited; do not clone)
5. Report-only observations, strengths, trade-offs
6. Limitations and false-positive risks
7. Explicit statement: READ-ONLY so far; no report/register written; no hardening

STOP. Do not write REPORT_FILE or edit findings-register.md until the human explicitly
asks to publish / write the report and update the register.

STEP 6 — WRITE OR UPDATE THE CYCLE REPORT (only after explicit request)
Write docs/health/security/{{CYCLE}}-security.md from
docs/health/_templates/report-template.md. If this is a new Cycle token, create the report; if remediating an existing cycle, update that cycle's report in place (never mint a companion closeout).
- Header: Review type = Security Audit; Cadence = Monthly; Cycle = {{CYCLE}};
  Date = {{REVIEW_DATE}}; Reviewer = {{REVIEWER}}; Baseline = (from STEP 0b);
  Status = Cycle report — remediations update this file; one cycle = one report.
- Executive summary: 5–10 lines; methods briefly; net change; no invented scores.
- Include trust model / surfaces inspected and exclusions (summary and/or
  Observations).
- "Since last cycle" (RECURRING only): delta by ID.
- Findings: FULL write-up for NEW SEC Findings (all fields from STEP 4); existing
  SEC Findings by ID + delta only — never restate full bodies; never create companion closeout reports.
- Explicit cross-audit section or Observations listing ARC/DEP IDs Security
  continues to observe without duplicating.
- Observations: non-Finding notes, strengths, trade-offs, limitations.
- Change log: publication entry dated {{REVIEW_DATE}}.
- If remediating Findings for this cycle (not a new Cycle): update Finding Status to Resolved; add **Resolution History** with acceptance criteria and closing evidence; refresh the Executive summary. Never create a companion closeout report.

STEP 7 — UPDATE THE LIVE FINDINGS REGISTER (only after explicit request)
Edit docs/health/findings-register.md for outstanding work only:
- Add new SEC Findings (Open; next ids) that passed the memory-value test.
- Update existing SEC statuses; refresh Last updated to {{CYCLE}}.
- REMOVE Resolved rows (closing link required in the report); maintain Retired IDs.
- Do not duplicate other prefixes' Findings; do not renumber ARC IDs into SEC.
- Preserve table formatting; add a Change log entry dated {{REVIEW_DATE}}.

STEP 8 — VALIDATE, THEN STOP (do NOT commit)
Non-mutating checks: report naming/path; Baseline flag correct; links; register only
Open/In Progress/Deferred; no duplicate/renumbered ids; no cross-prefix duplicates
for the same root cause; Resolved removed with closing links; terminology uses
Security / security / SEC; prior-cycle reports not rewritten for terminology; no application code
mutated; unrelated files untouched. Run `git diff --check` on touched docs if any,
and `git status` (read-only).

Produce a final summary:
1. Mode + cycle
2. Existing SEC Findings reconciled (id -> status)
3. New SEC Findings (id + title + why memory-value passed)
4. Findings resolved and removed (id + closing link)
5. Cross-audit references (especially ARC/DEP)
6. Report-only observations (brief)
7. Methods/commands and limitations
8. Files created or updated (exact paths) — or "none (audit-only)"
9. Validation performed
10. git status (verbatim)
11. READY FOR REVIEW; nothing committed or pushed

STOP. Await human review before any commit or push.
```

---

## Invocation notes

1. Set `CYCLE`, `REVIEW_DATE`, and `REVIEWER`.
2. Paste the fenced prompt body into the agent.
3. Expect an **audit-only** stop at STEP 5 until you explicitly ask to publish the report and update the register.
4. Do not commit or push until you have reviewed the written artifacts.
5. Do not treat this prompt as permission to harden production — Findings must be evidence-based security issues with read-only analysis.
6. Prefer a small number of high-value Findings. One security root cause with many call-sites is one Finding.
7. Before opening any new SEC Finding, search the register for the same root cause under SEC/ARC/DEP/DB/HYG. Reference existing IDs (especially `ARC-001`, `ARC-007`, `ARC-009`, `ARC-015`, `ARC-016`, `SEC-002`, `SEC-003`) instead of cloning.
8. Security owns trust-boundary correctness; Dependency Vulnerability Monitoring owns the live Dependabot/advisory stream — do not reopen `SEC-001` as a monitoring clone while Dependabot remains the control.
9. Do not create the monthly Security report unless publication is explicitly requested.

## Related governance

| Document | Role |
|---|---|
| [`../README.md`](../README.md) | Framework v1.2 operating rules |
| [`../audit-catalog.md`](../audit-catalog.md) | Ownership authority (Security vs ARC / DB / DEP / …) |
| [`../findings-register.md`](../findings-register.md) | Live work queue |
| [`../_templates/report-template.md`](../_templates/report-template.md) | Shared report template |
| [`../../project-state.md`](../../project-state.md) | Current system / domain model summary |
| [`../security/2026-07-security.md`](../security/2026-07-security.md) | Baseline Security evidence (cycle report; reference by ID) |
