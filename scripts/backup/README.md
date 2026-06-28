# Backup scripts

EventPixels disaster recovery tooling: local database backups (Phase A) and Google Drive upload/prune helpers used by GitHub Actions (Phase B).

## Prerequisites

1. **PostgreSQL client tools** — `pg_dump` and `pg_restore` on your `PATH`.
   - macOS: `brew install libpq` then `brew link --force libpq` (or add `$(brew --prefix libpq)/bin` to `PATH`).
2. **Direct database connection string** — not the Supabase transaction pooler.
   - Supabase Dashboard → **Project Settings** → **Database** → **Connection string** → **URI** (Direct, port `5432`).
3. **Environment variable** — add to `.env.local` (never commit):

   ```bash
   SUPABASE_DB_URL='postgresql://postgres.[project-ref]:[password]@db.[project-ref].supabase.co:5432/postgres?sslmode=require'
   ```

## Database backup

From the repository root:

```bash
# Data-only (default) — for disaster recovery after migrations are applied
SUPABASE_DB_URL='postgresql://...' ./scripts/backup/database.sh

# Full schema + data snapshot (public + auth only)
SUPABASE_DB_URL='postgresql://...' ./scripts/backup/database.sh --full
```

Or load from `.env.local`:

```bash
set -a && source .env.local && set +a
./scripts/backup/database.sh
```

### Output layout

Each run creates a UTC timestamped folder under `supabase/dumps/backups/db/` (gitignored):

```
supabase/dumps/backups/db/
└── 2026-06-24T030000Z/
    ├── eventpixels-db.dump.gz   # pg_dump custom format, gzip compressed
    └── manifest.json            # metadata (no secrets)
```

### What is included

| Schema  | Default (`data-only`) | `--full` |
|---------|----------------------|----------|
| `public` | Row data             | Schema + data |
| `auth`   | Row data (`auth.users`, identities) | Schema + data |

DDL for `public` objects is version-controlled in `supabase/migrations/`. The default backup captures **data** so it can be restored into a fresh project after `supabase db push`.

### Automated daily backup (Phase B)

GitHub Actions workflow [`.github/workflows/backup-database.yml`](../../.github/workflows/backup-database.yml) runs daily at 03:00 UTC:

1. `database.sh` — create dump under `${RUNNER_TEMP}/backups/db/`
2. `upload-to-drive.sh` — copy to Google Drive `db/<timestamp>/`
3. `prune-drive.sh` — delete Drive folders older than **30 days**

Setup: [docs/operations/backup-github-drive-setup.md](../../docs/operations/backup-github-drive-setup.md)

### What is not included (yet)

- Supabase Storage (`company-logos`, `sponsor-imports`) — planned Phase C

## Restore

See [docs/operations/disaster-recovery.md](../../docs/operations/disaster-recovery.md) for restoring into a **new** Supabase project.

Quick reference after migrations are applied on the target project:

```bash
gunzip -c supabase/dumps/backups/db/2026-06-24T030000Z/eventpixels-db.dump.gz > /tmp/eventpixels-db.dump
pg_restore \
  --dbname="$TARGET_SUPABASE_DB_URL" \
  --data-only \
  --disable-triggers \
  --no-owner \
  --no-acl \
  /tmp/eventpixels-db.dump
```

## Google Drive scripts (CI / manual)

Requires [rclone](https://rclone.org/install/) and the same secrets as GitHub Actions:

```bash
export GDRIVE_CLIENT_ID='...'
export GDRIVE_CLIENT_SECRET='...'
export GDRIVE_REFRESH_TOKEN='...'
export GDRIVE_FOLDER_ID='...'

./scripts/backup/upload-to-drive.sh supabase/dumps/backups/db/2026-06-24T030000Z
./scripts/backup/prune-drive.sh   # BACKUP_RETENTION_DAYS=30 by default
```

## Related docs

- [Backup policy](../../docs/operations/backup-policy.md) — scope, retention, automation
- [GitHub + Drive setup](../../docs/operations/backup-github-drive-setup.md) — OAuth client and refresh token
- [Disaster recovery](../../docs/operations/disaster-recovery.md) — full restore runbook
