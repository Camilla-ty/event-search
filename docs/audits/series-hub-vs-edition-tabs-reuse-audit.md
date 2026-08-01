# Audit — Series Hub Tabs vs Event Edition Tabs (Reuse)

**Status:** Documentation-only (no implementation authorized by this document)  
**Date:** 2026-08-01  
**Context:** Series hub **Events** / **Participated Events** chrome vs public Event Edition section tabs; whether the Series hub should reuse the Edition tab implementation  

**Related:** [Participated Events tab placement audit](./participated-events-tab-placement-audit.md) · [ADR-004](../adr/ADR-004-event-series-company-same-brand-link.md) · design tokens in `src/lib/design/classes.ts`

---

## 1. Verdict

**Do not reuse `PublicEventEditionTabs` as the Series hub tab shell.** Keep Series-specific tab orchestration (parse/build URLs, conditional visibility, panel wiring).

**Do treat the visual system as misaligned today:** Series hub tabs match **admin** pill/nav-item chrome (`navItemActiveClass` / `navItemInactiveClass`), not the **public** Edition file-tab chrome (`fileTab*` / `fileTabLinkClass`). If product wants Series to look like public Editions, align Series to the shared **`fileTab*` tokens** (and optionally the shared `useInstantTabNavigation` hook)—not by importing the Edition tabs component.

There is **no** generic reusable public tab component today. Shared pieces are design tokens and a generic instant-navigation hook. Edition and Series (and admin Edition) are **independent implementations** that happen to share some of those primitives inconsistently.

**Behavioral differences** (server `Link` vs client instant tabs; two optional tabs vs a fixed multi-tab shell with providers) justify **separate shells**. They do **not** justify two different *public* visual languages.

---

## 2. Event Edition tab implementation (public)

| Concern | Finding |
|---------|---------|
| Component | `PublicEventEditionTabs` (`src/features/events/components/detail/PublicEventEditionTabs.tsx`) — `"use client"` |
| Styling | **File-tab** system: `fileTabShellClass`, `fileTabBarClass`, `fileTabScrollRowClass`, `fileTabLinkClass(active)`, `fileTabPanelClass` |
| Active / inactive | Active: white raised tab, semibold, border with white bottom; inactive: slate bar tab, medium weight, hover. Applied via `fileTabLinkClass(active)` |
| A11y | `role="tablist"` / `role="tab"`, `aria-selected`, `aria-current="page"` when active |
| Routing | Path `/events/{slug}`; overview = bare path; other tabs = `?tab={id}` via `buildPublicEditionTabHref` / `parsePublicEditionTab` (`publicEditionTabUrls.ts`) |
| Behavior | Instant client switch: `useInstantTabNavigation` intercepts same-origin clicks, `preventDefault`, updates local state + `pushHistoryUrl`; `popstate` restores tab. Visibility-aware parse (hidden exhibitors / partner-alumni → overview) |
| Coupling | Hard-wired `PublicEditionTabId`s, panel ReactNodes, `PublicEditionTabNavigationProvider` for in-page `selectTab` from Overview links |

**Admin counterpart (not the public Edition UI):** `EditionDetailTabs` uses the **same** `useInstantTabNavigation` pattern but **admin** chrome: `navItemActiveClass` / `navItemInactiveClass` + `rounded-md px-3 py-1.5 text-sm` under a `border-b` row—not `fileTab*`.

---

## 3. Series hub tab implementation

| Concern | Finding |
|---------|---------|
| Component | Inline nav in `SeriesHubBody` (`src/features/events/components/series/SeriesHubBody.tsx`) — **server component** (no `"use client"`) |
| Tabs | **Events** (default) · **Participated Events** (`?tab=participated`) |
| Visibility | Entire tab bar omitted when `participatedEvents.length === 0`; parse falls back to `events` if participated unavailable |
| Styling | Same pattern as **admin** `EditionDetailTabs`: flex wrap, `border-b border-slate-200 pb-3`, `rounded-md px-3 py-1.5 text-sm`, `navItemActiveClass` / `navItemInactiveClass` |
| Active / inactive | Brand left border + muted bg when active; transparent left border + slate text when inactive |
| Routing | `buildSeriesHubTabHref` / `parseSeriesHubTab` colocated in `SeriesHubBody`; page reads `searchParams.tab` and passes `activeTab` (`events/series/[slug]/page.tsx`) |
| Behavior | Next.js `<Link>` — full navigation / RSC refresh; **no** instant client tab state, **no** `role="tab*"` |
| Comment drift | File comment claims chrome “matches public edition/admin tab styling”; it matches **admin**, not public Edition file tabs |

Panels stay Series-specific: `SeriesEditionsList` vs `SeriesParticipatedEventsList`.

---

## 4. Comparison

| Dimension | Public Edition | Series hub | Same? |
|-----------|----------------|------------|-------|
| Shell component | `PublicEventEditionTabs` | Inline in `SeriesHubBody` | No |
| Design tokens | `fileTab*` | `navItem*` (+ pill padding) | **No** (Series ≈ admin) |
| Client instant nav | Yes (`useInstantTabNavigation`) | No (`Link`) | No |
| URL shape | `?tab=` except default | `?tab=` except default | Yes (pattern) |
| Conditional tabs | Per-tab omit + fallback | Hide whole bar when no participated | Similar idea, different shape |
| Tab count / IDs | 4–6 edition-specific | 0 or 2 series-specific | No |
| Provider / in-page tab links | Yes | No | No |
| Panel content | Edition sections | Series lists | No |

---

## 5. Determination answers

### Is there already a reusable tab component?

**No single public `<Tabs>` component.** Reusable pieces:

1. **Design tokens** — `fileTab*` (public) and `navItem*` (admin / current Series)
2. **`useInstantTabNavigation<T>`** — generic string-tab client hook
3. **History helpers** — `instantTabNavigation` / `pushHistoryUrl` / click intercept

`PublicEventEditionTabs` and `EditionDetailTabs` are **page-bound shells**, not drop-in tab kits.

### Are these two independent implementations?

**Yes.** Series hub does not import Edition tab modules. Shared only: `navItem*` tokens (with admin, not public Edition) and the conceptual `?tab=` query pattern.

### Can the Series hub safely reuse the Event Edition tab implementation?

| Reuse target | Safe? | Notes |
|--------------|-------|-------|
| `PublicEventEditionTabs` wholesale | **No** | Bound to edition tab IDs, `/events/{slug}`, panel props, navigation provider |
| `fileTab*` visual tokens | **Yes** | Pure class swap / thin presentational wrapper |
| `useInstantTabNavigation` | **Yes** | Requires a small client wrapper; Series tab IDs stay local |
| `EditionDetailTabs` | **No** | Admin IDs/panels; Series already copied its **look**, not the component |

### Would this reduce duplication?

**Modestly**, if limited to shared chrome:

- Series tab markup is ~25 lines; extracting a tiny presentational bar removes copy/paste with admin or with Edition file tabs—not a large duplication debt.
- Forcing Series through `PublicEventEditionTabs` would **increase** coupling and conditional complexity for little shared logic.

### Would it improve design consistency?

**Aligning Series to `fileTab*` would improve public consistency** with Event Editions.  
**Reusing the Edition component is unnecessary** for that outcome.  
Leaving Series on `navItem*` keeps a public page looking like admin sub-nav—the main consistency gap.

### Behavioral differences that justify keeping them separate?

**Yes, for shells / orchestration:**

- Series may render **no** tab bar; Editions always show a multi-tab shell
- Series is 2 tabs with list panels; Editions need providers and many panels
- Server `Link` is acceptable for Series (low tab count, full list payloads); Editions invested in instant switch for denser in-page UX

**No strong product reason** to keep a **different public visual language** once Series has more than one tab.

---

## 6. Recommended implementation (when authorized)

**Preferred (S):** Keep `SeriesHubBody` ownership of Series tab IDs/URLs/panels. Restyle the nav to **public `fileTab*`** tokens (shell optional; bar + links required for parity). Optionally extract a dumb presentational helper, e.g. `PublicFileTabBar`, used only for markup/classes—not Edition business logic.

**Optional (S+):** Thin client wrapper around Series tabs using `useInstantTabNavigation` + same `?tab=` helpers, for Edition-parity click feel and back/forward without full RSC round-trip. Not required for correctness.

**Avoid:** Importing or generalizing `PublicEventEditionTabs` to accept Series tab configs; sharing admin `EditionDetailTabs`.

**If extracting a shared component:** Prefer presentational (`items: { id, label, href }[]`, `activeId`, optional `onTabClick`) over a mega-tabs that owns panels and route parsing.

---

## 7. Estimated implementation size

| Option | Size | Rough scope |
|--------|------|-------------|
| A. Series → `fileTab*` style only (still server `Link`) | **S** | `SeriesHubBody` class/markup change; snapshot/UI tests; ~½ day |
| B. A + client instant navigation | **S** | Small client child + hook wiring + popstate tests; ~½–1 day |
| C. Extract shared `PublicFileTabBar` + Series + (later) Edition adopt | **S–M** | Extract + migrate Series first; Edition migration optional second PR; 1–2 days if both |

No schema, RLS, or route-shape change required for A/B if `?tab=` stays as today.

---

## 8. Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Styling Series like Editions without a shell/panel box can look half-migrated | Low | Apply bar + link tokens together; decide whether Series needs `fileTabShellClass` / padded panel |
| Client instant nav changes loading semantics (panels already on page vs RSC fetch) | Low–Med | Series already receives both lists as props today—instant switch is a natural fit if both panels stay mounted or swapped client-side |
| Over-generalizing `PublicEventEditionTabs` | Med | Keep Edition component edition-specific |
| A11y gap today (Series lacks `role="tab"`) | Low | Address when restyling or adding instant nav |
| Comment / docs claiming Series matches “public edition” tabs | Low | Fix comment when implementing |

---

## 9. Components involved (inventory)

| Role | Path |
|------|------|
| Public Edition tabs | `src/features/events/components/detail/PublicEventEditionTabs.tsx` |
| Edition tab URLs | `…/detail/publicEditionTabUrls.ts` |
| Instant nav hook | `…/detail/useInstantTabNavigation.ts` |
| Instant nav helpers | `…/detail/instantTabNavigation.ts` |
| Edition in-page nav context | `…/detail/PublicEditionTabNavigation.tsx` |
| Admin Edition tabs (visual twin of current Series) | `…/admin/EditionDetailTabs.tsx` |
| Series hub tabs + URL helpers | `…/series/SeriesHubBody.tsx` |
| Series page wiring | `src/app/(marketing)/events/series/[slug]/page.tsx` |
| Design tokens | `src/lib/design/classes.ts` (`fileTab*`, `navItem*`) |

---

## 10. Explicit non-goals of this audit

- No code or styling changes authorized
- No commit / push
- Does not decide Participated Events product permanence (see placement audit)
- Does not authorize Company redirect/hide work

---

## 11. Suggested follow-up (product / eng)

1. Confirm desired public look: **file tabs** (match Editions) vs keep admin pill style on Series.
2. If file tabs: authorize option **A** (style) or **B** (style + instant nav).
3. Defer shared extraction (**C**) until a third surface needs the same chrome.
