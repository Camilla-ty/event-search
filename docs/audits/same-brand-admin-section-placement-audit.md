# Audit — Same-brand Company Profile Section Placement (Event Series Admin)

**Status:** Recommendation **implemented** (collapse-by-default on Series Admin; 2026-08-01)  
**Date:** 2026-08-01  
**Context:** ADR-004 same-brand link + ADR-005 Event Brand public-profile approval are implemented; link management remains Series-primary Admin UI  

**Related:** [ADR-004](../adr/ADR-004-event-series-company-same-brand-link.md) · [ADR-005](../adr/ADR-005-event-brand-public-profile-policy.md) · [Phase same-brand scope §4](../phase-event-series-company-same-brand-scope.md) · [Same-brand architecture audit §5.2](./event-series-company-same-brand-architecture-audit.md) · [Event admin workflow](../event-admin-workflow.md) · [Admin IA](../admin-information-architecture.md)

---

## 1. Verdict

**Prefer Option B:** keep the control on the Event Series Admin page, but **collapse it by default** into an expandable section. Do **not** keep it as a permanently expanded full card (Option A). Do **not** move mutation ownership off the Series page (Option C as “Company-only home”).

**One-line rationale:** Same-brand linking is a rare, optional Series attribute — not part of the day-to-day Series edit / Editions / Partner Alumni workflow — yet it currently sits as a full always-open card between the primary form and Partner Alumni, overstating its frequency and interrupting scroll for ~all Series that will never use it.

**Do not** treat this audit as approval to change public routing, approval UX, Partner Alumni, Editions, or Company Event Brand approval placement.

---

## 2. Current placement (as shipped)

**Route:** `/admin/events/series/[id]` (`src/app/admin/events/series/[id]/page.tsx`)

**Vertical order today:**

1. Breadcrumbs / header / Events sub-nav  
2. Keyword chips (if any)  
3. **`EventSeriesForm`** — primary Series profile edit (name, slug, website, logo, lifecycle, merge)  
4. **`SameBrandCompanyProfileSection`** — full white card, always expanded  
5. **`SeriesPartnerAlumniPanel`** — large Series-scoped program UI  
6. **Event Editions** table + “Create event edition” CTA in header  

**Section chrome today:**

- Heading: **“Same-brand company profile”**
- Always-visible helper copy (optional same-brand; not organizer/owner/operator)
- Always-visible **“Currently linked”** status block (linked name/domain + warnings, or “No same-brand company profile linked.”)
- When not merged: company search, create-company link, Link / Replace / Unlink controls
- ADR-005: blocks unlink/replace while Event Brand public-profile approval is active; points Admin to Company page to revoke

**Company Admin counterpart** (`/admin/companies/[id]`):

- Read-only **“Same-brand Event Series”** after Sponsorships / Organizer roles  
- Mutate via “Manage link” → Series page (Series remains source of truth)  
- Separate **Event Brand public-profile approval** section (ADR-005) lives on Company, not Series  

That split remains correct: Series owns the FK; Company owns approval + reverse display.

---

## 3. Frequency of expected use

| Signal | Evidence |
|--------|----------|
| Product intent | ADR-004: “Most Series need no Company profile link.” Link only when Admin asserts same-brand identity. |
| Live catalog (read-only, 2026-08-01) | **1 / 38** Series have `company_profile_id` set; **1** Company has Event Brand public-profile approval (Singapore FinTech Festival). |
| Historical audit sample | Architecture audit found ~10 name-overlap dual-profile *candidates* among non-merged Series — still a minority; linking remains manual and non-automatic. |
| Ops cadence | Link/replace/unlink is occasional identity hygiene (and ADR-005 gate), not a weekly Series edit step. |

**Conclusion:** For the vast majority of Series Admin visits, the full search/link UI is noise. Status awareness matters more than edit affordances on every load.

---

## 4. Relationship to primary editing workflow

Primary Series Admin jobs (per [event-admin-workflow.md](../event-admin-workflow.md) / Admin IA):

1. Edit Series profile fields  
2. Create / open Event Editions (import and roster work live on Editions)  
3. Manage Partner Alumni when the Series uses that program  

Same-brand linking is **orthogonal** to those jobs:

- Not required to save Series profile  
- Not required to create Editions or import sponsors  
- Not a participant-role picker (Organizer / Sponsor / Exhibitor / PA members stay Company joins)  
- Rarely changes after initial verification  

**Current UX friction:** After saving the form, Admins immediately encounter a full optional identity card before Partner Alumni and Editions — elevating a rare control above core catalog work.

---

## 5. Relationship to Partner Alumni and Event Editions

| Surface | Scope | Typical use | Collision with same-brand |
|---------|-------|-------------|---------------------------|
| Partner Alumni | Series-scoped Company roster / versions | Recurring for brands that run a PA program | Different concept (recognition members ≠ same-brand identity). Same-brand sitting *above* PA visually risks “another company linker” confusion. |
| Event Editions | Series → dated occurrences | Primary operational path | Same-brand is Series metadata, not edition work. Editions currently appear *below* both same-brand and PA. |
| Same-brand link | Optional 1:1 Series → Company | Rare identity assertion | Must stay discoverable from Series; must not look like a PA/sponsor roster tool. |

Keeping same-brand on the Series page is right. Giving it **equal visual weight** to Partner Alumni (large interactive panel) and sitting it **above** Editions is the mismatch — not the page choice.

---

## 6. Should it remain permanently visible?

**Fully expanded UI: No.**  
**Discoverable on the Series page: Yes.**  
**Collapsed summary of link state: Yes (recommended).**

Reasons:

- Permanent full card contradicts “optional / rare” product framing.  
- Completely hiding it (separate page only) hurts discoverability for the few cases that need it and for ADR-005 unlink prerequisites.  
- Stale / restricted / approval-blocked states are important when a link *exists*; those should remain glanceable without opening the editor.

---

## 7. Existing disclosure / collapsible patterns

| Area | Pattern | Notes |
|------|---------|-------|
| **Admin UI** | **No shared Advanced / `<details>` / accordion pattern** found under `src/app/admin` or admin feature panels for secondary sections | Modals/drawers exist (`open={…}`); not section disclosure |
| **Public / marketing** | Native `<details>` / `<summary>` (e.g. Sponsor history groups, Exhibitor history) | Closest visual precedent in the product |
| **Series page itself** | Flat stacked sections (form → card → PA → table) | No collapse today |

**Implication:** Option B introduces a **new but small** Admin disclosure pattern. Prefer a simple, accessible control (`<details>` or button + `aria-expanded`) rather than inventing a heavy accordion system. Match existing rounded border / slate card language.

---

## 8. Options evaluation

### A. Keep permanently visible

| | |
|--|--|
| Pros | Maximum discoverability; matches phase-scope “add a section” literally; no new UI pattern |
| Cons | Overstates rarity; interrupts form → PA / Editions flow on 37/38 Series; full search UI always mounted; looks peer to Partner Alumni |
| Fit | Poor for steady-state Admin after ADR-004/005 ship |

### B. Collapse into expandable section (default collapsed)

| | |
|--|--|
| Pros | Matches frequency; keeps Series-primary home; preserves access for link/unlink; can show status in summary when collapsed; small change |
| Cons | Slightly more clicks when linking; needs careful summary copy so Admins still find it; new Admin disclosure pattern |
| Fit | **Best** |

### C. Move to another location

| Variant | Assessment |
|---------|------------|
| C1. Company Admin as sole mutate UI | **Reject** — contradicts ADR-004 / phase scope Series-primary ownership; Company already correctly read-only + deep-link |
| C2. Below Event Editions (still Series page) | Acceptable de-emphasis; Editions then closer to form (good), but same-brand becomes easy to miss without a collapsed summary higher up |
| C3. Separate “Advanced” Series subpage | Overkill for one optional FK; worse discoverability |
| C4. Inside `EventSeriesForm` as optional fields | Mixes identity link with profile fields; search/link UX is already a separate client section — awkward fit |

**C2 can combine with B** (collapsed block after PA or after Editions) if product wants Editions immediately under the form — that is a slightly larger IA reorder, not required for the first fix.

---

## 9. Recommendation

### Preferred placement

- **Stay** on **Admin → Event Series → [id]** (Series remains mutate home).  
- **Default:** keep current slot *or* move the collapsed block to **after Partner Alumni / before Event Editions** so PA sits closer to Series identity work and Editions stay near the bottom operational list.  
- **Do not** remove Company reverse section or move approval off Company.

**Preferred first ship:** collapse **in current position** (minimal IA churn). Optionally reorder later if Editions-up is desired as a separate IA tweak.

### Preferred label

- **Keep:** **“Same-brand company profile”** (aligned with ADR-004, phase scope, and Company reverse section language).  
- Optional summary suffix when empty: “Optional” — avoid vague sole title **“Advanced”** (hides meaning).  
- If a grouping shell is used: **“Advanced”** may wrap the disclosure, with the inner title remaining **Same-brand company profile**.

### Default expanded / collapsed state

| State | Rule |
|-------|------|
| **Default** | **Collapsed** for all Series |
| Optional enhancement | Auto-expand when linked **and** (stale **or** restricted **or** Event Brand approval active) — so ops issues surface without hunting |
| Manual expand | Always available to link/replace/unlink |

### Linked status when collapsed

**Yes — keep status visible in the summary row**, e.g.:

- Unlinked: `Same-brand company profile · None linked`  
- Linked: `Same-brand company profile · Linked: {Company name}` (+ compact badge if Approved / Stale / Restricted)

Hide search / Link / Replace / Unlink until expanded. Warnings that block unlink (approval) should either appear in the summary or force expand (prefer summary chip + expand for full copy).

### Expected UX impact

| Audience | Impact |
|----------|--------|
| Typical Series edit | Shorter page; less confusion with PA company search |
| Rare same-brand ops | One expand click; same tools as today |
| ADR-005 revoke/unlink | Summary should still show “Approved” so Admins know why Unlink is disabled before expanding |
| Company Admin | Unchanged reverse link + Manage link |

### Implementation size

| Item | Size |
|------|------|
| Wrap `SameBrandCompanyProfileSection` in disclosure; summary shows link state | **S** (~0.5–1 day) |
| + auto-expand on stale/approved/restricted | **S** (+few hours) |
| + reorder after Partner Alumni | **S** (page.tsx move only) |
| Shared Admin “AdvancedSection” primitive reused elsewhere | **S–M** (optional; not required) |
| Tests: wiring / a11y summary / expanded controls | **S** |

**No schema, API, or public routing changes.**

### Risks

| Risk | Mitigation |
|------|------------|
| Admins cannot find the control | Keep clear title; status in summary; Company “Manage link” still deep-links to Series (optionally with `?focus=same-brand` later) |
| Approval / stale issues missed while collapsed | Show badges in summary; optional auto-expand on problem states |
| Over-building an accordion system | Use one local `<details>` or simple expand state first |
| Reorder confuses muscle memory | Prefer collapse-in-place first; reorder as follow-up |

---

## 10. Implementation recommendation (when coding is authorized)

1. **Do Option B in place** on `SameBrandCompanyProfileSection` (or a thin wrapper on the Series page).  
2. Summary always shows linked / not linked (+ problem badges).  
3. Body (search, link, replace, unlink, long helper copy) only when expanded; **default collapsed**.  
4. Preserve all ADR-004/005 validation and approval gating.  
5. Add focused UI/wiring tests for collapsed summary + expand reveals controls.  
6. **Defer** page reorder and shared Advanced primitives unless product wants Editions closer to the form in the same change.  
7. Update phase/Admin docs only if the shipped label or default state diverges from this audit.

**Estimated effort:** **~0.5–1 engineering day** for collapse-in-place + tests; **~1–1.5 days** if including auto-expand-on-problem + move below Partner Alumni + doc touch.

---

## 11. What this audit does *not* authorize

- Code, schema, data, or test changes (until explicitly requested)  
- Changing Series-primary mutate ownership  
- Changing Partner Alumni or Editions behavior  
- Changing Event Brand public-profile approval UI location  
- Approving additional Companies or bulk-linking same-brand candidates  
- Commit / push  

---

## 12. Document history

| Date | Change |
|------|--------|
| 2026-08-01 | Initial documentation-only placement / prominence audit; recommend Option B collapsed-by-default on Series Admin |
| 2026-08-01 | Option B implemented: Series Admin section collapsed by default; summary shows Not linked / Linked + Approved/Stale/Restricted chips |

---

**End of audit.**
