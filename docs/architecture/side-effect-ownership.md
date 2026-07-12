# Side-effect ownership

Policy for **who may subscribe** to global browser and auth events in EventPX. Complements [Navigation & data fetching](./navigation-and-data-fetching.md), which governs *how* to navigate without redundant RSC work.

## One event / one owner

Each long-lived global subscription must have **exactly one owner per layout shell**:

| Event / API | Owner | Not allowed in |
|-------------|-------|----------------|
| `supabase.auth.onAuthStateChange` | `AuthSessionRefreshProvider` (one per shell) | `SessionControls`, search bars, list hooks |
| `router.refresh` after auth change | `AuthSessionRefreshProvider` (coalesced) | Presentational chrome, sign-out handlers |
| `popstate` for route collection state | One hook per page feature | Duplicate sync layers (review manually) |
| `popstate` for filter URL state | `useUrlSyncedState` consumer | — |

**Rule:** one physical event → at most one subscription owner → at most one side effect (e.g. one coalesced `router.refresh`).

## CSS-hidden components are still mounted

Browse layout mounts **two** `SessionControls` instances:

- Desktop sidebar (`NavigationShell`, `lg:flex`)
- Mobile header (`BrowseMobileHeader`, `lg:hidden`)

Both stay in the React tree on all viewport sizes. Subscriptions inside presentational chrome therefore run **twice**. Auth listeners belong in a shell provider above both instances.

## Provider placement rules

| Shell | Provider | File |
|-------|----------|------|
| Browse / marketing | `MarketingBrowseAuthBoundary` → `AuthSessionRefreshProvider` | `LayoutShell.tsx` |
| Admin | `AuthSessionRefreshProvider` | `AdminShell.tsx` |
| Auth (`/login`, `/signup`) | None | — |

Place providers at the **shell boundary**, not inside responsive variants or reusable presentational components.

## Presentational component restrictions

Components like `SessionControls` must **not**:

- call `supabase.auth.onAuthStateChange`
- call `router.refresh` after `signOut()`
- own layout/session refresh logic

They **may**:

- render from `session` props
- call `supabase.auth.signOut()` on user action
- use `router.replace` for explicit post-sign-out navigation (e.g. admin → `/login`)

## `router.refresh` ownership

| Trigger | Owner | Notes |
|---------|-------|-------|
| `SIGNED_IN` with session mismatch vs SSR | `AuthSessionRefreshProvider` | Skipped when hydration fingerprint matches |
| `SIGNED_OUT` | `AuthSessionRefreshProvider` | Always refresh |
| Post-login redirect | `applyPostAuthRedirect` | Auth pages only; `replace` + one refresh |
| Admin form mutation success | Feature form (Category C) | Separate backlog; not auth ownership |

Refreshes are **coalesced** via `scheduleCoalescedRouterRefresh` so duplicate callbacks in the same microtask burst produce at most one `router.refresh`.

## EventPX case study: `SessionControls`

**Before Phase H3:** each `SessionControls` instance subscribed to `onAuthStateChange` and called `router.refresh` on `SIGNED_IN` / `SIGNED_OUT`. Browse shell had **two listeners** → **two** `events?_rsc` requests on authenticated cold load.

**After Phase H3:** `AuthSessionRefreshProvider` owns one listener per shell. `SessionControls` is presentational. Hydration `SIGNED_IN` is skipped when client email matches the SSR session fingerprint.

## Checklist for new listeners

- [ ] Is this global or per-instance? (per-instance must be gated, e.g. `open`, `dirty`)
- [ ] Could a responsive desktop/mobile pair mount this twice?
- [ ] Is there already an owner at shell or page level?
- [ ] Does this call `router.refresh`? If yes, justify vs local state update.
- [ ] Is cleanup (`removeEventListener` / `unsubscribe`) in the effect return?
- [ ] Run `bash scripts/audit-side-effects.sh` and review new hits.

## Intentional per-instance exceptions

These are **allowed** to subscribe inside reusable components when gated:

| Component | Listener | Gate |
|-----------|----------|------|
| `InfoHelpPopover` | `document` mousedown/keydown | `open` |
| `MobileFilterDrawer` | `document` keydown | drawer open |
| `EditionSponsorsPanel` | `beforeunload` | unsaved dirty state |
| `PublicMobileDesktopNotice` | `matchMedia('change')` | single mount in `LayoutShell` |

## Audit tooling

```bash
bash scripts/audit-side-effects.sh
bash scripts/audit-soft-navigation.sh
```

## Tests

- `src/lib/auth/authSessionRefreshPolicy.test.ts` — shell ownership and refresh policy
- `src/lib/auth/marketingNavSessionFingerprint.test.ts` — hydration skip logic
- `src/lib/auth/scheduleCoalescedRouterRefresh.test.ts` — coalescing
