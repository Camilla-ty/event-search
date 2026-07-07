# Automated database backup — Google Drive + GitHub Actions setup

Phase B: daily PostgreSQL backups from GitHub Actions to Google Drive using **OAuth** (client credentials + refresh token).

This setup avoids service account JSON keys, which many Google Workspace organizations block via `iam.disableServiceAccountKeyCreation`.

Workflows:

- Database: [`.github/workflows/backup-database.yml`](../../.github/workflows/backup-database.yml)
- Storage: [`.github/workflows/backup-storage.yml`](../../.github/workflows/backup-storage.yml)

## Overview

| Item | Value |
|------|-------|
| Operating timezone | **US Eastern** (schedules are defined in Eastern time; GitHub `cron` uses UTC) |
| Database schedule | Daily at **3:00 AM US Eastern** (`cron: 0 7 * * *` UTC — ≈ 3:00 AM EDT, 3:00 PM Singapore) |
| Storage schedule | Weekly **Sunday** at **3:30 AM US Eastern** (`cron: 30 7 * * 0` UTC — ≈ 3:30 AM EDT, 3:30 PM Singapore) |
| Manual run | Actions → **Backup database** or **Backup storage** → **Run workflow** |
| Backup script | `scripts/backup/database.sh` (data-only, `public` + `auth`) |
| Upload | `scripts/backup/upload-to-drive.sh` via **rclone** + OAuth refresh token |
| Retention | **30 days** (`scripts/backup/prune-drive.sh`) |
| Drive layout | `db/YYYY-MM-DDTHHMMSSZ/eventpixels-db.dump.gz` + `manifest.json` |

The OAuth-authorized Google account must own (or have **Editor** access to) the folder identified by `GDRIVE_FOLDER_ID`. All backup paths are relative to that folder.

**Daylight saving:** GitHub `cron` cannot follow US Eastern DST automatically. The current UTC values target **EDT** (UTC−4). When clocks switch to **EST** (UTC−5), jobs run one hour earlier in Eastern time unless the UTC `cron` is updated.

---

## 1. Google Cloud project

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project (or select an existing one), e.g. `eventpixels-backups`.
3. Note the **Project ID**.

No billing is usually required for Drive API backup volumes, but org policy may require a billing account on new projects.

---

## 2. Enable Google Drive API

1. **APIs & Services** → **Library**.
2. Search for **Google Drive API**.
3. Click **Enable**.

---

## 3. OAuth consent screen

1. **APIs & Services** → **OAuth consent screen**.
2. Choose user type:
   - **Internal** — only users in your Google Workspace (simplest if backups run under an org account).
   - **External** — required if the authorizing user is outside the Workspace.
3. Fill required app information (app name, support email).
4. **Scopes** → **Add or remove scopes** → add:
   - `https://www.googleapis.com/auth/drive` (Google Drive API — full access)
5. Save.

### Publishing status

| Status | Refresh token lifetime |
|--------|------------------------|
| **Testing** (default) | Refresh tokens may expire after **7 days** unless the app is published or the user is a test user |
| **In production** (published) | Refresh tokens remain valid until revoked |

For production backups, either:

- Publish the OAuth app (may require Google verification for sensitive scopes), or
- Keep the app in **Testing** and add the backup Google account as a **Test user** on the consent screen (works for a dedicated ops account).

---

## 4. OAuth client credentials

1. **APIs & Services** → **Credentials**.
2. **Create credentials** → **OAuth client ID**.
3. Application type: **Desktop app** (recommended for `rclone authorize`).
4. Name: `eventpixels-backup` (or similar).
5. **Create** and copy:
   - **Client ID** → `GDRIVE_CLIENT_ID`
   - **Client secret** → `GDRIVE_CLIENT_SECRET`

### If your org requires “Web application” instead

Create a **Web application** client and add this authorized redirect URI (used by rclone during authorization):

```text
http://127.0.0.1:53682/
```

Then use the Web client’s ID and secret in the steps below.

**Do not** use a service account or download service account keys.

---

## 5. Google Drive backup folder

1. Sign in to [Google Drive](https://drive.google.com/) as the **same Google account** that will authorize OAuth (recommended: dedicated ops/backup account).
2. Create a folder, e.g. `EventPixels/backups`.
3. Copy the **folder ID** from the URL:

   ```text
   https://drive.google.com/drive/folders/<FOLDER_ID>
   ```

   This value becomes `GDRIVE_FOLDER_ID`.

No folder sharing step is required — the OAuth user accesses their own Drive (or Shared drives they belong to).

### Expected structure after first successful runs

```text
<EventPixels/backups>/          ← GDRIVE_FOLDER_ID
├── db/
│   └── 2026-06-24T030000Z/
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

---

## 6. Generate the refresh token (one-time, on your machine)

Install [rclone](https://rclone.org/install/) locally if needed:

```bash
# macOS
brew install rclone
```

### 6a. Run rclone authorize

Replace placeholders with your OAuth client values:

```bash
export GDRIVE_CLIENT_ID='YOUR_CLIENT_ID.apps.googleusercontent.com'
export GDRIVE_CLIENT_SECRET='YOUR_CLIENT_SECRET'

rclone authorize "drive" "${GDRIVE_CLIENT_ID}" "${GDRIVE_CLIENT_SECRET}"
```

### 6b. Complete browser sign-in

1. rclone prints a URL and may open your browser automatically.
2. Sign in as the **backup Google account** (the account that owns `GDRIVE_FOLDER_ID`).
3. Grant access to Google Drive when prompted.
4. If you see “Google hasn’t verified this app”, choose **Advanced** → **Go to … (unsafe)** (expected for internal/testing apps).
5. Return to the terminal when rclone prints **Success**.

### 6c. Copy the refresh token

rclone outputs a JSON blob, for example:

```json
{
  "access_token": "ya29....",
  "token_type": "Bearer",
  "refresh_token": "1//0gXXXXXXXX",
  "expiry": "2026-06-24T12:00:00.000000000Z"
}
```

Copy only the **`refresh_token`** value → `GDRIVE_REFRESH_TOKEN`.

Store it in a password manager. You do not need to store the `access_token`; rclone refreshes it automatically in CI.

### 6d. Verify OAuth locally (recommended)

```bash
export GDRIVE_REFRESH_TOKEN='1//0gXXXXXXXX'
export GDRIVE_FOLDER_ID='YOUR_FOLDER_ID'

# Reuse the same rclone env as CI (from repo root)
source scripts/backup/lib/drive-rclone.sh
drive_rclone_ensure_env

rclone lsf "$(drive_remote_path db)" --dirs-only
```

If this lists folders (or returns empty without error), OAuth is configured correctly.

---

## 7. Supabase database URL

The workflow needs a **direct** Postgres connection string (port **5432**), not the transaction pooler.

1. Supabase Dashboard → **Project Settings** → **Database**.
2. **Connection string** → **URI** → **Direct connection**.
3. Replace `[YOUR-PASSWORD]` with the database password.

Example:

```text
postgresql://postgres.[project-ref]:[password]@db.[project-ref].supabase.co:5432/postgres?sslmode=require
```

---

## 8. GitHub secrets

Repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.

| Secret | Required | Description |
|--------|----------|-------------|
| `SUPABASE_DB_URL` | Yes (database workflow) | Direct Postgres URI (step 7) |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes (storage workflow) | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (storage workflow) | Service role key for storage list/download |
| `GDRIVE_CLIENT_ID` | Yes | OAuth client ID (step 4) |
| `GDRIVE_CLIENT_SECRET` | Yes | OAuth client secret (step 4) |
| `GDRIVE_REFRESH_TOKEN` | Yes | Refresh token from step 6c |
| `GDRIVE_FOLDER_ID` | Yes | Drive folder ID (step 5) |

### Remove deprecated secret

Delete **`GDRIVE_SERVICE_ACCOUNT_JSON`** if it was set for an earlier Phase B version.

### Secret hygiene

- Paste the refresh token as a single line with no quotes.
- Never commit client secret or refresh token to the repository.
- Restrict who can edit workflow files and view Actions logs.

### Optional hardening

- Use a GitHub **Environment** (e.g. `production`) with required reviewers and attach secrets there.
- Use a dedicated Google account only for backups (not a personal primary account).

---

## 9. Manual verification

### 9a. Confirm secrets

Ensure all **five** secrets exist. Remove any unused `GDRIVE_SERVICE_ACCOUNT_JSON`.

### 9b. Run the workflow

1. **Actions** → **Backup database** → **Run workflow** → **Run workflow**.
2. In the job log, confirm:
   - **Run database backup** — completes without `pg_dump` errors
   - **Upload backup to Google Drive** — lists `eventpixels-db.dump.gz` and `manifest.json`
   - **Prune backups older than 30 days** — `keep:` / `prune:` lines (prune may be zero on first run)

### 9c. Confirm files on Drive

Open the backup folder in Drive → `db/` → latest `YYYY-MM-DDTHHMMSSZ/` folder.

Both files must be present:

- `eventpixels-db.dump.gz` (non-zero size)
- `manifest.json`

### 9d. Download and inspect (optional)

With the same OAuth env vars set locally:

```bash
source scripts/backup/lib/drive-rclone.sh
drive_rclone_ensure_env

LATEST="$(rclone lsf "$(drive_remote_path db)" --dirs-only | sort | tail -n 1 | tr -d '/')"
rclone copy "$(drive_remote_path "db/${LATEST}")" ./restore-test/
ls -la "./restore-test/"
```

Restore procedure: [disaster-recovery.md](./disaster-recovery.md).

---

## 10. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `invalid_grant` / token refresh failed | Expired refresh token (Testing app >7 days) | Re-run `rclone authorize`; update `GDRIVE_REFRESH_TOKEN`; add test user or publish app |
| `403` / `Insufficient Permission` | OAuth user lacks access to folder | Create folder under the authorizing account; verify `GDRIVE_FOLDER_ID` |
| `couldn't find root directory` | Wrong folder ID | Re-copy ID from Drive URL |
| `pg_dump: connection failed` | Pooler URL or wrong password | Use direct URI on port 5432; reset DB password |
| Empty dump | Invalid `SUPABASE_DB_URL` | Update secret |
| Prune deletes nothing | All backups < 30 days old | Expected; run `rclone lsf gdrive:db --dirs-only` locally |
| Browser auth succeeds but no refresh token | Missing offline consent | Revoke app access at [Google Account permissions](https://myaccount.google.com/permissions), re-run `rclone authorize` |
| Org blocks Desktop OAuth clients | IT policy | Ask admin to allow Desktop client or use Web client + `http://127.0.0.1:53682/` redirect |

---

## 11. Security notes

- The refresh token grants ongoing Drive access for the authorizing user — treat it like a password.
- `SUPABASE_DB_URL` grants full database read access.
- OAuth credentials are passed via GitHub encrypted secrets and rclone environment variables only; no key files are written to disk in CI.
- Rotate credentials if a secret is exposed: revoke the OAuth token in Google Account settings, regenerate refresh token, update GitHub secrets.

---

## Related documentation

- [backup-policy.md](./backup-policy.md) — scope and retention policy
- [disaster-recovery.md](./disaster-recovery.md) — restore into a new Supabase project
- [scripts/backup/README.md](../../scripts/backup/README.md) — local backup usage
