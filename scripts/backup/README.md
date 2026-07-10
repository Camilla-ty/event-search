# Backup scripts

EventPixels disaster recovery tooling:

- **Phase A** — local database backups
- **Phase B** — daily database backups to Google Drive (GitHub Actions)
- **Phase C** — weekly `company-logos` storage mirror to Google Drive (GitHub Actions)

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

GitHub Actions workflow [`.github/workflows/backup-database.yml`](../../.github/workflows/backup-database.yml) runs daily at **3:00 AM US Eastern** (operating timezone; `cron: 0 7 * * *` UTC — ≈ 3:00 AM EDT, 3:00 PM Singapore). Revisit the UTC offset when US daylight saving changes.

1. `database.sh` — create dump under `${RUNNER_TEMP}/backups/db/`
2. `upload-to-drive.sh` — copy to Google Drive `db/<timestamp>/`
3. `prune-drive.sh` — delete Drive folders older than **30 days**

Setup: [docs/operations/backup-github-drive-setup.md](../../docs/operations/backup-github-drive-setup.md)

### Automated weekly storage backup (Phase C)

GitHub Actions workflow [`.github/workflows/backup-storage.yml`](../../.github/workflows/backup-storage.yml) runs weekly on **Sunday at 3:30 AM US Eastern** (operating timezone; `cron: 30 7 * * 0` UTC — ≈ 3:30 AM EDT, 3:30 PM Singapore). Revisit the UTC offset when US daylight saving changes.

1. `mirror-company-logos.ts` — query catalog `logo_url` values, then download referenced objects from the `company-logos` bucket into a local mirror tree (no recursive bucket walk)
2. `upload-storage-mirror-to-drive.sh` — `rclone copy` to Google Drive `storage/company-logos/mirror/`

**Copy behavior:** new and changed files are uploaded. Files that exist only on Drive are **not** deleted. There is **no** storage-backup prune step.

For full-bucket storage audits (orphans, legacy paths), use `npm run audit:event-logo-storage` or `scripts/audit/listStoragePrefix.ts` — not the weekly backup job.

Setup: same Google Drive OAuth secrets as Phase B, plus Supabase URL and service role key. See [docs/operations/backup-policy.md](../../docs/operations/backup-policy.md).

### What is not included

- `sponsor-imports` bucket (ephemeral import uploads)
- Storage object cleanup / orphan pruning

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

## Storage backup (`company-logos`)

From the repository root (loads Supabase credentials from `.env.local` when present):

```bash
set -a && source .env.local && set +a

# Mirror only (local tree under supabase/dumps/backups/storage/)
npx tsx scripts/backup/mirror-company-logos.ts

# Mirror + upload to Google Drive
export GDRIVE_CLIENT_ID='...'
export GDRIVE_CLIENT_SECRET='...'
export GDRIVE_REFRESH_TOKEN='...'
export GDRIVE_FOLDER_ID='...'
./scripts/backup/storage-company-logos.sh
```

### Output layout

```
supabase/dumps/backups/storage/
└── company-logos/
    └── mirror/
        ├── manifest.json
        ├── companies/
        ├── event-series/
        └── venues/
```

`manifest.json` records `source: db_referenced_paths`, referenced/downloaded counts, missing paths, skipped external/invalid URL counts, total bytes, top-level prefixes, mirror timestamp, and git SHA (no secrets).

## Google Drive scripts (CI / manual)

Requires [rclone](https://rclone.org/install/) and the same secrets as GitHub Actions:

```bash
export GDRIVE_CLIENT_ID='...'
export GDRIVE_CLIENT_SECRET='...'
export GDRIVE_REFRESH_TOKEN='...'
export GDRIVE_FOLDER_ID='...'

./scripts/backup/upload-to-drive.sh supabase/dumps/backups/db/2026-06-24T030000Z
./scripts/backup/prune-drive.sh   # BACKUP_RETENTION_DAYS=30 by default

./scripts/backup/upload-storage-mirror-to-drive.sh supabase/dumps/backups/storage/company-logos/mirror
```

## Related docs

- [Backup policy](../../docs/operations/backup-policy.md) — scope, retention, automation
- [GitHub + Drive setup](../../docs/operations/backup-github-drive-setup.md) — OAuth client and refresh token
- [Disaster recovery](../../docs/operations/disaster-recovery.md) — full restore runbook
