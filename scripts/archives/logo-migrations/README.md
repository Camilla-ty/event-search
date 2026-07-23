# Intentionally versioned logo-migration rollback backups

These JSONL backups are kept in git so emergency rollback scripts retain a known-good default input.

Runtime/script-generated JSONL under `/reports` and `/tmp` must stay **untracked** (see root `.gitignore`).

| File | Used by |
|------|---------|
| `backup-logo-urls-before-relative-2026-07-07T09-55-06-042Z.jsonl` | Default `--from-backup` for `scripts/rollback-logo-urls-to-full-public-urls.ts` |
| `backup-event-editions-logo-url-2026-06-19T08-41-21-271Z.jsonl` | Default rollback reference for `scripts/cleanup-event-editions-logo-url.ts` |

Override with an explicit path or `ROLLBACK_BACKUP_PATH` when needed.
