# Common Components

Reusable presentation primitives (buttons, cards, explorer shell, and UI states). Keep these components feature-agnostic.

## Loading (`./loading`)

Shared loading primitives and route-level skeletons.

- `PageLoadingSkeleton` — cold route loads via `loading.tsx` (`list`, `detail`, `form`, `explorer`)
- `LoadingStatus` — inline async feedback (`role="status"`, spinner + message)
- `Spinner` — spinning indicator (decorative when nested in `LoadingStatus`)
- `SkeletonBlock`, `SkeletonLine`, `SkeletonCircle` — decorative placeholders (`aria-hidden`)

**Usage policy**

| Scenario | Use |
|----------|-----|
| Cold route load | `PageLoadingSkeleton` in `loading.tsx` |
| Inline async status (search, import step) | `LoadingStatus` |
| Decorative placeholder shapes | Skeleton primitives |
| Tab panels, tables, preserve-content overlays | Deferred — build in later phases |

`PageLoadingSkeleton` is also re-exported from `./states` for existing import paths.

## States (`./states`)

- `EmptyState` — zero data in scope
- `NoResultsState` — filters/search returned no matches
- `ErrorState` — recoverable page errors
- `InlineErrorBanner` — form/API inline feedback (error, success, warning)
