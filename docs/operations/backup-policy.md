# Backup policy

EventPixels disaster recovery policy. **Phase B** (current): daily automated database backups to Google Drive plus local manual backups. Storage backups are planned for Phase C.

## Scope

### Automated (Phase B)

| Asset | Method | Frequency | Destination |
|-------|--------|-----------|-------------|
| **PostgreSQL** (`public` + `auth`) | GitHub Actions → `database.sh` → `upload-to-drive.sh` | Daily (03:00 UTC) | Google Drive `db/<timestamp>/` |

Workflow: [`.github/workflows/backup-database.yml`](../../.github/workflows/backup-database.yml)  
Setup: [backup-github-drive-setup.md](./backup-github-drive-setup.md)

### Local manual (Phase A)

| Asset | Method | Frequency | Location |
|-------|--------|-----------|----------|
| **PostgreSQL** (`public` + `auth`) | `pg_dump` via `scripts/backup/database.sh` | Operator runs | `supabase/dumps/backups/db/<timestamp>/` |

### Planned (not implemented yet)

| Asset | Method | Target frequency | Destination |
|-------|--------|------------------|-------------|
| Supabase Storage (`company-logos`) | Service-role list/download → `tar.gz` | Weekly | Google Drive |

## What each backup contains

### Database (`public` schema)

Production catalog and admin working data:

- **Catalog:** `companies`, `company_domains`, `event_series`, `event_editions`, `event_sponsors`, `event_edition_organizers`, `venues`, `keyword`, `event_series_keyword`, location tables (`countries`, `states`, `cities`)

**Note:** Legacy `event_organizers` / standalone `organizers` tables were rejected in design and never existed in repository migrations; organizer data lives in `event_edition_organizers` (companies-only join).
- **Admin:** `profiles`, `company_merges`, `company_slug_redirects`
- **Imports (ephemeral):** `sponsor_import_*` — batches are deleted on publish/discard; backups only matter while an import is in progress

Views (e.g. `company_sponsor_stats`) and RPCs are **not** backed up as data — they are recreated by `supabase/migrations/`.

### Database (`auth` schema)

Required for admin login recovery:

- `auth.users`, `auth.identities` (OAuth)
- Trigger `on_auth_user_created` → `public.profiles` is defined in migrations, not in the dump

### Storage (not backed up in Phase A)

| Bucket | Visibility | Priority |
|--------|------------|----------|
| `company-logos` | Public | **Critical** — company and event-series logos |
| `sponsor-imports` | Private | **Low** — ephemeral Excel uploads; auto-deleted on discard/publish |

Storage bucket policies are project-level Supabase configuration, not in this repository. Document bucket settings when restoring (see [disaster-recovery.md](./disaster-recovery.md)).

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
    └── db/
        └── YYYY-MM-DDTHHMMSSZ/
            ├── eventpixels-db.dump.gz
            └── manifest.json
```

### Google Drive (automated runs)

Relative to `GDRIVE_FOLDER_ID`:

```
db/
└── YYYY-MM-DDTHHMMSSZ/
    ├── eventpixels-db.dump.gz
    └── manifest.json
```

`manifest.json` records timestamp, mode, file size, git SHA, migration count, and connection host (no credentials).

## Retention

| Location | Backup type | Retention |
|----------|-------------|-----------|
| Google Drive | Daily database | **30 days** rolling (`prune-drive.sh` after each upload) |
| Local (manual) | Database | **30 days** recommended; delete older folders manually |
| Google Drive (planned) | Weekly storage (`company-logos`) | **12 weeks** rolling |
| Google Drive (optional) | Monthly database archive | **12 months** |

## Environment and secrets

### Local backups

| Variable | Required for | Notes |
|----------|--------------|-------|
| `SUPABASE_DB_URL` | Local DB backup | Direct Postgres URI (port 5432). **Do not** use the transaction pooler for `pg_dump`. |
| `DATABASE_URL` | Fallback | Used if `SUPABASE_DB_URL` is unset |

Store in `.env.local` or a password manager — never commit.

### GitHub Actions (Phase B)

| Secret | Required | Notes |
|--------|----------|-------|
| `SUPABASE_DB_URL` | Yes | Direct Postgres URI |
| `GDRIVE_CLIENT_ID` | Yes | OAuth 2.0 client ID |
| `GDRIVE_CLIENT_SECRET` | Yes | OAuth 2.0 client secret |
| `GDRIVE_REFRESH_TOKEN` | Yes | OAuth refresh token (long-lived) |
| `GDRIVE_FOLDER_ID` | Yes | Backup folder ID owned by the OAuth user |

Setup walkthrough: [backup-github-drive-setup.md](./backup-github-drive-setup.md).

## Operational cadence

| When | Action |
|------|--------|
| Daily (automated) | GitHub Actions **Backup database** workflow |
| Before a migration | Run `./scripts/backup/database.sh` locally (optional extra copy) |
| Before bulk admin edits | Manual local backup |
| Quarterly (recommended) | Full restore drill to a staging Supabase project |
| Weekly (recommended) | Confirm latest Drive backup in `db/`; investigate failed workflow runs |

## Related documentation

- [scripts/backup/README.md](../../scripts/backup/README.md) — how to run local backups
- [backup-github-drive-setup.md](./backup-github-drive-setup.md) — Google Cloud, OAuth, refresh token, GitHub secrets
- [disaster-recovery.md](./disaster-recovery.md) — restore into a new Supabase project
