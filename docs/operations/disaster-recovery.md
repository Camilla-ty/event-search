# Disaster recovery

Restore EventPixels into a **brand-new Supabase project** after total loss of the production database, storage, or both.

**Phase A/B** covers database restore from `pg_dump` backups (local or downloaded from Google Drive). **Phase C** mirrors the `company-logos` bucket to Google Drive at `storage/company-logos/mirror/` for storage restore.

## Overview

```mermaid
flowchart TD
  A[Create new Supabase project] --> B[Apply migrations: supabase db push]
  B --> C[Create Storage buckets + policies]
  C --> D[Restore database from backup]
  D --> E[Restore company-logos objects]
  E --> F[Update app env vars + OAuth]
  F --> G[Run verification SQL + smoke tests]
```

**Principle:** schema from Git (`supabase/migrations/`), row data from backup, files from storage archive (when available).

## Prerequisites

- Access to this Git repository
- A backup directory with `eventpixels-db.dump.gz` and `manifest.json`:
  - **Local:** `supabase/dumps/backups/db/<timestamp>/`
  - **Google Drive:** `db/<timestamp>/` under the backup folder (download via rclone — see [backup-github-drive-setup.md](./backup-github-drive-setup.md))
- `pg_restore` and `psql` (PostgreSQL client tools)
- Supabase CLI (`supabase`) linked to the **new** project
- New project credentials: URL, anon key, service role key, database password

## Step 1 — Create a new Supabase project

1. Supabase Dashboard → **New project** (prefer the same region as production).
2. Record:
   - Project URL (`NEXT_PUBLIC_SUPABASE_URL`)
   - Anon key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`)
   - Service role key (`SUPABASE_SERVICE_ROLE_KEY`)
   - Database password and **direct** connection string (`SUPABASE_DB_URL`)

## Step 2 — Apply schema (migrations)

From the repository root, link and push all migrations:

```bash
supabase link --project-ref <new-project-ref>
supabase db push
```

This creates tables, views, RPCs, RLS policies, and triggers (including `on_auth_user_created` on `auth.users`). There are **33** incremental migrations in `supabase/migrations/`; the base catalog tables predate the earliest migration and must already exist on a fresh Supabase project created for this app (they are referenced by migrations but not created in-repo).

If `db push` fails on a completely empty `public` schema, you need a one-time baseline schema export from production (not in this repo) before applying incremental migrations. Contact the team owner for the baseline `schema_dump.sql` if applicable.

## Step 3 — Storage buckets

Bucket creation is **not** in SQL migrations. Recreate manually in the new project.

### `company-logos` (required)

| Setting | Value |
|---------|-------|
| Name | `company-logos` |
| Public | **Yes** |
| Purpose | Company logos (`companies/{companyId}/logo.*`), event-series logos (`event-series/{seriesId}/logo.*`), venue logos (`venues/{venueId}/logo.*`) |

Export policies from the old project (Dashboard → Storage → `company-logos` → Policies) and recreate equivalent rules. Public read access is required for logo URLs embedded in the database.

### `sponsor-imports` (optional)

| Setting | Value |
|---------|-------|
| Name | `sponsor-imports` |
| Public | **No** |
| File size limit | 20 MB |

The app creates this bucket at runtime if missing (`ensureSponsorImportBucket`). Only needed if you plan to run sponsor imports immediately after restore.

## Step 4 — Restore database

Use the **data-only** backup produced by `scripts/backup/database.sh` (default mode).

### 4a. Decompress the dump

```bash
BACKUP_DIR="supabase/dumps/backups/db/2026-06-24T030000Z"
gunzip -c "${BACKUP_DIR}/eventpixels-db.dump.gz" > /tmp/eventpixels-db.dump
```

### 4b. Restore with `pg_restore`

Target the **new** project's direct connection string:

```bash
export TARGET_SUPABASE_DB_URL='postgresql://postgres.[ref]:[password]@db.[ref].supabase.co:5432/postgres?sslmode=require'

pg_restore \
  --dbname="${TARGET_SUPABASE_DB_URL}" \
  --data-only \
  --disable-triggers \
  --no-owner \
  --no-acl \
  --verbose \
  /tmp/eventpixels-db.dump
```

`--disable-triggers` defers FK and trigger checks during load. The `on_auth_user_created` trigger may attempt to insert duplicate profiles if users already exist — for a fresh empty project this is usually fine. Review `pg_restore` warnings; duplicate-key errors on `profiles` may be safe to ignore if profiles were loaded by the dump.

### 4c. If restore fails on FK order

Restore in two passes:

```bash
# Auth first
pg_restore --dbname="${TARGET_SUPABASE_DB_URL}" --data-only --disable-triggers \
  --no-owner --no-acl --schema=auth /tmp/eventpixels-db.dump

# Then public
pg_restore --dbname="${TARGET_SUPABASE_DB_URL}" --data-only --disable-triggers \
  --no-owner --no-acl --schema=public /tmp/eventpixels-db.dump
```

### 4d. Full-mode backup (`--full`)

If the backup was taken with `--full`, omit `--data-only`:

```bash
pg_restore --dbname="${TARGET_SUPABASE_DB_URL}" --disable-triggers \
  --no-owner --no-acl /tmp/eventpixels-db.dump
```

Prefer data-only backups for new-project restore when migrations are applied first.

### 4e. Re-enable triggers

```bash
psql "${TARGET_SUPABASE_DB_URL}" -c "SET session_replication_role = DEFAULT;"
```

## Step 5 — Restore Storage (`company-logos`)

### 5a. Download the Drive mirror (recommended)

Phase C stores a path-preserving mirror at `storage/company-logos/mirror/` under the backup folder (`GDRIVE_FOLDER_ID`).

With the same OAuth env vars as CI:

```bash
source scripts/backup/lib/drive-rclone.sh
drive_rclone_ensure_env

mkdir -p ./restore-storage/company-logos
rclone copy "$(drive_remote_path storage/company-logos/mirror)" ./restore-storage/company-logos/mirror
```

Inspect `restore-storage/company-logos/mirror/manifest.json` for `referenced_path_count`, `downloaded_count`, and `missing_paths`.

### 5b. Upload objects to the new project

Options:

1. **Supabase CLI** — from the downloaded mirror tree:

   ```bash
   supabase storage cp --recursive ./restore-storage/company-logos/mirror/companies ss:///company-logos/companies
   supabase storage cp --recursive ./restore-storage/company-logos/mirror/event-series ss:///company-logos/event-series
   supabase storage cp --recursive ./restore-storage/company-logos/mirror/venues ss:///company-logos/venues
   ```

   The weekly mirror backs up catalog-referenced paths only. Legacy/orphan bucket objects are not included; recover those only if you have a separate full-bucket audit export.

2. **Supabase Dashboard** — upload objects preserving paths (`companies/...`, `event-series/...`, `venues/...`).
3. **Service-role script** — reuse patterns from `scripts/backup/mirror-company-logos.ts` to upload from a local directory tree. For full-bucket investigations, use `scripts/audit/listStoragePrefix.ts`.

### 5c. Database logo paths

After logo URL normalization, `logo_url` values are **bucket-relative** paths (for example `companies/<id>/logo.png`). No host rewrite is required when restoring to a new Supabase project — the runtime resolver builds public URLs from `NEXT_PUBLIC_SUPABASE_URL`.

External venue logos (non-Supabase URLs) are stored only in `venues.logo_url` and are not part of the `company-logos` mirror.

## Step 6 — Application configuration

Update deployment environment (e.g. Vercel):

| Variable | Action |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | New project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | New anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | New service role key |

Redeploy the Next.js app.

### Auth / OAuth

In the new Supabase project → **Authentication** → **Providers**:

- Reconfigure Google (or other) OAuth client IDs and secrets
- Add redirect URLs for the app (`/auth/callback`, local dev URLs)

Restored `auth.users` rows retain emails; users may need to sign in again depending on provider token state.

### Admin access

Confirm at least one restored `profiles` row has `role = 'admin'` for your operator account:

```sql
SELECT id, role FROM profiles WHERE role = 'admin';
```

## Step 7 — Verification

### Row counts (smoke check)

```sql
SELECT 'companies' AS tbl, count(*) FROM companies
UNION ALL SELECT 'event_editions', count(*) FROM event_editions
UNION ALL SELECT 'event_sponsors', count(*) FROM event_sponsors
UNION ALL SELECT 'profiles', count(*) FROM profiles
UNION ALL SELECT 'company_domains', count(*) FROM company_domains;
```

Compare counts to `manifest.json` notes or a pre-disaster export if available.

### Repository verification scripts

Run against the new database (via `psql` or Supabase SQL editor):

- `supabase/verify/rls_tier_access.sql`
- `supabase/verify/keyword_public_read.sql`
- `supabase/verify/sponsor_discovery_rpc.sql`
- `supabase/verify/event_editions_unique_constraints.sql`

### Application smoke tests

1. `GET /api/health/supabase` — healthy response
2. Public site — event detail page loads with tier-1 sponsors
3. Admin — sign in, open an edition roster, verify logos render
4. Admin — sponsor import upload (confirms `sponsor-imports` bucket)

## Recovery time objectives (guidance)

| Scenario | RTO estimate | Notes |
|----------|--------------|-------|
| DB only, backup on hand | 1–3 hours | Migrations + `pg_restore` + env update |
| DB + storage | 4–8+ hours | Depends on `company-logos` object count and upload bandwidth |
| No backup | Undefined | Rebuild from exports; may be partial |

## Known limitations

- **Baseline schema** — earliest migrations assume core tables exist; a blank Supabase project may need a baseline dump not stored in this repo.
- **Storage policies** — must be recreated manually; missing policies cause broken or blocked logo URLs.
- **Ephemeral imports** — in-progress sponsor import batches are optional to restore; published data lives in `event_sponsors`.
- **Supabase platform backups** — if on Pro/Team, Dashboard/PITR backups are a complementary recovery path alongside these operator-controlled dumps.

## Related documentation

- [backup-policy.md](./backup-policy.md) — what is backed up and retention
- [scripts/backup/README.md](../../scripts/backup/README.md) — running local backups
