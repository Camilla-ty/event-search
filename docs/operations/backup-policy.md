# Backup policy

EventPixels disaster recovery policy. **Phase B** (database) and **Phase C** (storage) run via GitHub Actions to Google Drive, with local manual database backups supported.

**Operating timezone:** US Eastern for automated backup schedules. GitHub Actions `cron` expressions use UTC; revisit UTC offsets when US daylight saving time changes (EST vs EDT).

## Scope

### Automated (Phase B)

| Asset | Method | Frequency | Destination |
|-------|--------|-----------|-------------|
| **PostgreSQL** (`public` + `auth`) | GitHub Actions → `database.sh` → `upload-to-drive.sh` | Daily at 3:00 AM US Eastern (`0 7 * * *` UTC; ≈ 3:00 AM EDT, 3:00 PM Singapore) | Google Drive `db/<timestamp>/` |

Workflow: [`.github/workflows/backup-database.yml`](../../.github/workflows/backup-database.yml)  
Setup: [backup-github-drive-setup.md](./backup-github-drive-setup.md)

### Automated (Phase C)

| Asset | Method | Frequency | Destination |
|-------|--------|-----------|-------------|
| **Supabase Storage** (`company-logos` bucket) | GitHub Actions → `mirror-company-logos.ts` → `upload-storage-mirror-to-drive.sh` | Weekly Sunday at 3:30 AM US Eastern (`30 7 * * 0` UTC; ≈ 3:30 AM EDT, 3:30 PM Singapore) | Google Drive `storage/company-logos/mirror/` |

Workflow: [`.github/workflows/backup-storage.yml`](../../.github/workflows/backup-storage.yml)

**Copy behavior:** `rclone copy` uploads new and changed objects. Remote-only files on Drive are **not** deleted. There is **no** prune step for storage backups.

**Preserved structure:** `companies/`, `event-series/`, `venues/`, and any legacy top-level folders still present in the bucket.

### Local manual (Phase A)

| Asset | Method | Frequency | Location |
|-------|--------|-----------|----------|
| **PostgreSQL** (`public` + `auth`) | `pg_dump` via `scripts/backup/database.sh` | Operator runs | `supabase/dumps/backups/db/<timestamp>/` |
| **Storage** (`company-logos`) | `scripts/backup/mirror-company-logos.ts` | Operator runs | `supabase/dumps/backups/storage/company-logos/mirror/` |

### Not backed up

| Asset | Reason |
|-------|--------|
| `sponsor-imports` bucket | Ephemeral Excel uploads; auto-deleted on discard/publish |

## What each backup contains

### Database (`public` schema)

Production catalog and admin working data:

- **Catalog:** `companies`, `company_domains`, `event_series`, `event_editions`, `event_sponsors`, `event_edition_organizers`, `event_partner_alumni`, `event_partner_alumni_companies`, `event_partner_alumni_snapshots`, `event_partner_alumni_snapshot_companies`, `venues`, `keyword`, `event_series_keyword`, location tables (`countries`, `states`, `cities`)

**Note:** Legacy `event_organizers` / standalone `organizers` tables were rejected in design and never existed in repository migrations; organizer data lives in `event_edition_organizers` (companies-only join).
- **Admin:** `profiles`, `company_merges`, `company_slug_redirects`
- **Imports (ephemeral):** `sponsor_import_*` — batches are deleted on publish/discard; backups only matter while an import is in progress

Views (e.g. `company_sponsor_stats`) and RPCs are **not** backed up as data — they are recreated by `supabase/migrations/`.

### Database (`auth` schema)

Required for admin login recovery:

- `auth.users`, `auth.identities` (OAuth)
- Trigger `on_auth_user_created` → `public.profiles` is defined in migrations, not in the dump

### Storage (`company-logos`)

| Prefix | Contents |
|--------|----------|
| `companies/{uuid}/logo.*` | Company logos |
| `event-series/{uuid}/logo.*` | Event series logos |
| `venues/{uuid}/logo.*` | Venue logos (storage-backed) |
| Legacy folders | Preserved until explicit cleanup |

Database `logo_url` values are bucket-relative paths; the mirror restores objects by path. External venue URLs (non-Supabase) are stored only in the database, not in this bucket.

## Backup modes

`scripts/backup/database.sh` supports two modes:

| Mode | Flag | Use case |
|------|------|----------|
| **Data-only** (default) | _(none)_ | Disaster recovery: apply migrations on a new project, then restore row data |
| **Full** | `--full` | Portable snapshot of `public` + `auth` schema and data (larger; useful for audits or non-migration restore) |

Both modes dump only `public` and `auth`. Supabase internal schemas (`_realtime`, `storage`, etc.) are excluded.

## Folder structure

### Local (manual runs)

All local backups live under `supabase/dumps/` (gitignored):

```
supabase/dumps/
└── backups/
    ├── db/
    │   └── YYYY-MM-DDTHHMMSSZ/
    │       ├── eventpixels-db.dump.gz
    │       └── manifest.json
    └── storage/
        └── company-logos/
            └── mirror/
                ├── manifest.json
                ├── companies/
                ├── event-series/
                └── venues/
```

### Google Drive (automated runs)

Relative to `GDRIVE_FOLDER_ID`:

```
db/
└── YYYY-MM-DDTHHMMSSZ/
    ├── eventpixels-db.dump.gz
    └── manifest.json

storage/
└── company-logos/
    └── mirror/
        ├── manifest.json
        ├── companies/
        ├── event-series/
        └── venues/
```

Database `manifest.json` records timestamp, mode, file size, git SHA, migration count, and connection host (no credentials).

Storage `manifest.json` records mirror timestamp, object count, total bytes, top-level prefixes, Supabase host, and git SHA.

## Retention

| Location | Backup type | Retention |
|----------|-------------|-----------|
| Google Drive | Daily database | **30 days** rolling (`prune-drive.sh` after each upload) |
| Google Drive | Weekly storage mirror | **Indefinite** (no automated prune) |
| Local (manual) | Database | **30 days** recommended; delete older folders manually |
| Local (manual) | Storage mirror | Operator-managed |

## Environment and secrets

### Local backups

| Variable | Required for | Notes |
|----------|--------------|-------|
| `SUPABASE_DB_URL` | Local DB backup | Direct Postgres URI (port 5432). **Do not** use the transaction pooler for `pg_dump`. |
| `DATABASE_URL` | Fallback | Used if `SUPABASE_DB_URL` is unset |
| `NEXT_PUBLIC_SUPABASE_URL` | Storage mirror | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Storage mirror | Service role key (list/download storage) |

Store in `.env.local` or a password manager — never commit.

### GitHub Actions

| Secret | Phase B (DB) | Phase C (storage) | Notes |
|--------|:------------:|:-----------------:|-------|
| `SUPABASE_DB_URL` | Yes | — | Direct Postgres URI |
| `NEXT_PUBLIC_SUPABASE_URL` | — | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | — | Yes | Storage list/download |
| `GDRIVE_CLIENT_ID` | Yes | Yes | OAuth 2.0 client ID |
| `GDRIVE_CLIENT_SECRET` | Yes | Yes | OAuth 2.0 client secret |
| `GDRIVE_REFRESH_TOKEN` | Yes | Yes | OAuth refresh token (long-lived) |
| `GDRIVE_FOLDER_ID` | Yes | Yes | Backup folder ID owned by the OAuth user |

Setup walkthrough: [backup-github-drive-setup.md](./backup-github-drive-setup.md).

## Operational cadence

| When | Action |
|------|--------|
| Daily (automated) | GitHub Actions **Backup database** workflow |
| Weekly (automated) | GitHub Actions **Backup storage** workflow |
| Before a migration | Run `./scripts/backup/database.sh` locally (optional extra copy) |
| Before bulk admin edits | Manual local backup |
| Quarterly (recommended) | Full restore drill to a staging Supabase project |
| Weekly (recommended) | Confirm latest Drive backup in `db/`; investigate failed workflow runs |
| Monthly (recommended) | Spot-check `storage/company-logos/mirror/manifest.json` object counts |

## Related documentation

- [scripts/backup/README.md](../../scripts/backup/README.md) — how to run local backups
- [backup-github-drive-setup.md](./backup-github-drive-setup.md) — Google Cloud, OAuth, refresh token, GitHub secrets
- [disaster-recovery.md](./disaster-recovery.md) — restore into a new Supabase project
