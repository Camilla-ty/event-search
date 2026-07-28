# EventPixels — Terminology

This document is the source of truth for EventPixels domain terminology. It defines the distinction between internal model names and language shown to users.

**Public UI and Admin UI intentionally use different user-facing terms** for the same underlying models. Always choose copy based on surface, not a single global label.

## Canonical mapping

| Concept | Internal model | Public UI | Admin UI |
|---|---|---|---|
| A recurring event identity that groups related occurrences | Event Series / `event_series` | **Event Brand** | **Event Series** |
| A specific occurrence with its own date, year, or location | Event Edition / `event_editions` | **Event** | **Event Edition** |

### Public UI terms

- **Event Brand** / **Event Brands**
- **Event** / **Events**

Public may omit “edition” when referring to a dated occurrence.

### Admin UI terms

- **Event Series** (plural: event series)
- **Event Edition** / **Event Editions**

Admin may keep **Events** only as the umbrella workspace / primary sidebar label for `/admin/events`. That label names the workspace, not the edition entity.

Admin must **not** use:

- **Event Brand** / **Event Brands**
- Ambiguous standalone **Event** / **Create event** / **Edit event** / similar phrasing when the entity is an Event Edition

Prefer the full Admin terms in navigation, page titles, form labels, CTAs, tables, empty states, dialogs, errors, and success messages. Sentence casing is fine in body copy (for example, “Event series updated successfully.”).

Admin helper text that describes the public site may keep public terms (for example, “public event pages”).

## Internal model terms

The existing database and code model remain unchanged. Internal names include:

- `event_series`
- `event_editions`
- `series_id`
- `event_editions_id`
- `event_edition_id`
- related API routes, URL segments, storage paths, TypeScript symbols, function names, component names, and filenames

Database names, routes, APIs, and internal identifiers are **not** being renamed as part of terminology work. Engineering documentation may use **Event Series** or **Event Edition** when referring to these models or technical identifiers.

## Where terms apply

User-facing terms apply to:

- headings, navigation, tabs, buttons, labels, placeholders, and tooltips
- empty states, validation messages, errors, and success messages shown to users
- accessibility text such as `aria-label` values and image alternative text
- generated factual summaries (use Public terms on public surfaces)
- metadata, SEO descriptions, and social sharing copy (Public terms)
- user-facing documentation and examples (match the surface being described)

Do not expose internal table, field, route, or code names as display labels.

## Terminology rules

1. Choose terms by surface: Public uses Event Brand / Event; Admin uses Event Series / Event Edition.
2. Do not use **Event Brand** in Admin UI.
3. In Admin UI, do not use ambiguous standalone **Event** when the entity is an Event Edition. Prefer **Event Edition** (for example, “Create event edition,” not “Create event”).
4. In Admin UI, **Events** is reserved for the umbrella workspace label only.
5. Preserve internal identifiers and technical contracts. A copy change must not rename database tables, API routes, storage namespaces, URL paths, or code symbols.
6. When prose includes both concepts, make the relationship explicit for that surface:
   - Public preferred: “TOKEN2049 is an Event Brand.”
   - Public preferred: “TOKEN2049 Singapore 2026 is an Event from the TOKEN2049 Event Brand.”
   - Admin preferred: “TOKEN2049 is an Event Series.”
   - Admin preferred: “TOKEN2049 Singapore 2026 is an Event Edition of the TOKEN2049 Event Series.”
7. Tests that assert user-visible text must use the terms for that surface (`PublicTerminology` / `AdminTerminology`). Tests of internal models and technical contracts should continue to use their exact internal names.
8. Do not perform an unscoped global replacement of `series` or `edition`. Those words may be part of internal identifiers, technical contracts, historical records, or unrelated language.

When terminology is unclear, follow this document before introducing new copy.
