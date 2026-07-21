# EventPixels — Terminology

This document is the source of truth for EventPixels domain terminology. It defines the distinction between internal model names and language shown to users.

## Canonical mapping

| Concept | Internal model term | User-facing term |
|---|---|---|
| A recurring event identity that groups related occurrences | Event Series / `event_series` | **Event Brand** |
| A specific occurrence with its own date, year, or location | Event Edition / `event_editions` | **Event** |

Use the user-facing terms in both singular and plural form:

- **Event Brand** / **Event Brands**
- **Event** / **Events**

## Internal model terms

The existing database and code model remain unchanged. Internal names include:

- `event_series`
- `event_editions`
- `series_id`
- `event_editions_id`
- `event_edition_id`
- related API routes, URL segments, storage paths, TypeScript symbols, function names, component names, and filenames

Engineering documentation may use **Event Series** or **Event Edition** only when referring explicitly to one of these internal models or exact technical identifiers. Internal names should not be renamed as part of user-facing copy changes.

## User-facing terms

All public and admin experiences must use:

- **Event Brand** for the recurring identity
- **Event** for a specific occurrence

This applies to:

- public UI
- admin UI
- headings, navigation, tabs, buttons, labels, placeholders, and tooltips
- empty states, validation messages, errors, and success messages shown to users
- accessibility text such as `aria-label` values and image alternative text
- generated factual summaries
- metadata, SEO descriptions, and social sharing copy
- user-facing documentation and examples

**Event Series** and **Event Edition** must never appear in user-facing copy.

## Terminology rules

1. Use **Event Brand**, not **Event Series**, when describing the recurring identity.
2. Use **Event**, not **Event Edition**, when describing a dated or location-specific occurrence.
3. Do not expose internal table, field, route, or code names as display labels.
4. Preserve internal identifiers and technical contracts. A copy change must not rename database tables, API routes, storage namespaces, URL paths, or code symbols.
5. When prose includes both concepts, make the relationship explicit. For example:
   - Preferred: “TOKEN2049 is an Event Brand.”
   - Preferred: “TOKEN2049 Singapore 2026 is an Event from the TOKEN2049 Event Brand.”
   - Avoid: “TOKEN2049 is an Event Series.”
   - Avoid: “TOKEN2049 Singapore 2026 is an Event Edition.”
6. Tests that assert user-visible text must use the user-facing terms. Tests of internal models and technical contracts should continue to use their exact internal names.
7. Do not perform an unscoped global replacement of `series` or `edition`. Those words may be part of internal identifiers, technical contracts, historical records, or unrelated language.

When terminology is unclear, follow this document before introducing new copy.
