# Common Components

Reusable presentation primitives (buttons, cards, explorer shell, and UI states). Keep these components feature-agnostic.

## States (`./states`)

- `PageLoadingSkeleton` — route-level loading (list, detail, form, explorer)
- `EmptyState` — zero data in scope
- `NoResultsState` — filters/search returned no matches
- `ErrorState` — recoverable page errors
- `InlineErrorBanner` — form/API inline feedback (error, success, warning)
