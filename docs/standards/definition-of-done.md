# Definition of Done

**Status:** Canonical
**Applies to:** Feature work, bug fixes, refactors, migrations, and other repository changes
**Purpose:** Define the minimum evidence required before work may be described as complete or prepared for commit.

A change is not complete merely because the implementation works. It is complete
only when every applicable requirement below has been satisfied or explicitly
marked not applicable with a reason.

## 1. Scope and implementation

- [ ] The requested scope is implemented.
- [ ] No unrelated feature work or silent scope expansion was introduced.
- [ ] Existing behavior outside the approved scope is preserved.
- [ ] Temporary code, debug output, placeholders, and obsolete TODOs introduced
      by the change have been removed.

## 2. Verification

Use repository scripts where they apply:

- Tests: `npm test` (or focused `npx tsx --test <paths>`)
- ESLint: `npm run lint` (or `npx eslint` for affected paths)
- TypeScript: `npx tsc --noEmit`
- Whitespace/conflict markers: `git diff --check`

Checklist:

- [ ] Relevant automated tests pass.
- [ ] ESLint passes for the affected scope.
- [ ] TypeScript verification passes for the affected scope, or any unrelated
      pre-existing failures are identified explicitly.
- [ ] `git diff --check` is clean.
- [ ] Relevant manual behavior has been checked when automated coverage is
      insufficient.
- [ ] Verification results are reported accurately; no check is described as
      passing unless it was actually run.

## 3. Database and security

Complete this section when the change affects database schema, data access,
authentication, authorization, storage, imports, RPCs, or external input.

- [ ] Required migrations are created.
- [ ] Required migrations are applied in the intended environment, or clearly
      identified as pending user action.
- [ ] RLS, grants, RPC permissions, and role boundaries are reviewed where affected.
- [ ] Data integrity, rollback, duplicate handling, and failure behavior are reviewed
      where applicable.
- [ ] Sensitive data and untrusted input handling are reviewed where applicable.

## 4. Product completeness

Complete the applicable items only.

- [ ] Public UI is updated where required.
- [ ] Admin UI is updated where required.
- [ ] Loading, empty, error, permission-denied, and unavailable states are considered.
- [ ] Responsive behavior and accessibility are considered for affected UI.
- [ ] User-facing terminology remains consistent with canonical terminology
      ([docs/terminology.md](../terminology.md)).
- [ ] Routes, APIs, metadata, analytics, and SEO behavior are reviewed where affected.

## 5. Documentation Impact Review

Before preparing a commit, determine whether the completed change affects any
canonical or supporting documentation.

Review at least:

- implementation roadmaps ([docs/implementation-roadmap.md](../implementation-roadmap.md))
- project-state or product-state documents ([docs/project-state.md](../project-state.md))
- feature, phase, and design documents
- architecture and database documentation
- terminology and information architecture ([docs/terminology.md](../terminology.md), [docs/admin-information-architecture.md](../admin-information-architecture.md))
- operational or import instructions
- Health Check documentation and findings ([docs/health/](../health/))
- setup, deployment, and maintenance instructions

For each relevant document:

- [ ] Update it when its current claims, status, workflow, schema, or instructions
      would otherwise become inaccurate.
- [ ] Preserve historical context when changing status.
- [ ] Do not rewrite historical documents merely to make them appear current.
- [ ] Mark superseded or historical documents clearly when they are no longer
      authoritative.
- [ ] Do not invent planned work or reprioritize the roadmap.

If no documentation changes are required, report:

`Documentation impact: None`

and briefly state why.

## 6. Health and maintainability review

- [ ] Consider whether the change creates or resolves an Architecture, Product,
      Data Quality, Database, Security, Performance, Code Hygiene, Roadmap,
      Scalability, SEO, UX, or Documentation Health finding.
- [ ] Update Health Check reports or the Findings Register only when the governing
      Health Check workflow permits it ([docs/health/README.md](../health/README.md)).
- [ ] New debt, deferred work, and known limitations are reported explicitly rather
      than hidden.

## 7. Completion report

Before describing the work as complete or preparing a commit, report:

1. What changed.
2. Exact files changed.
3. Verification actually performed and its results.
4. Migration status, when applicable.
5. Documentation Impact Review and documents updated.
6. Remaining work, risks, limitations, or user actions.
7. Whether the work is ready to commit.
8. Whether anything was committed or pushed.

## 8. Commit gate

Do not prepare or recommend a commit as complete when an applicable Definition of
Done item remains unresolved.

Exceptions must be explicit. State:

- the incomplete item;
- why it remains incomplete;
- whether it is blocked, deferred, or requires user action;
- the risk of committing without it.

Never commit or push unless explicitly requested by the user.
