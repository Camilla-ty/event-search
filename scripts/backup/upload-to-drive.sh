#!/usr/bin/env bash
#
# Upload a local database backup directory to Google Drive.
#
# Usage:
#   GDRIVE_CLIENT_ID='...' GDRIVE_CLIENT_SECRET='...' GDRIVE_REFRESH_TOKEN='...' \
#   GDRIVE_FOLDER_ID='...' \
#     ./scripts/backup/upload-to-drive.sh /path/to/2026-06-24T030000Z
#
# Drive layout (relative to GDRIVE_FOLDER_ID):
#   db/YYYY-MM-DDTHHMMSSZ/eventpixels-db.dump.gz
#   db/YYYY-MM-DDTHHMMSSZ/manifest.json

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/drive-rclone.sh
source "${SCRIPT_DIR}/lib/drive-rclone.sh"

usage() {
  cat <<'EOF'
Usage: upload-to-drive.sh <backup_dir>

Uploads a timestamped backup folder to Google Drive under db/<timestamp>/.

Environment:
  GDRIVE_CLIENT_ID             OAuth client ID (required).
  GDRIVE_CLIENT_SECRET         OAuth client secret (required).
  GDRIVE_REFRESH_TOKEN         OAuth refresh token (required).
  GDRIVE_FOLDER_ID             Backup folder ID (required).
EOF
}

if [[ $# -ne 1 ]]; then
  usage >&2
  exit 1
fi

BACKUP_DIR="$1"
if [[ ! -d "${BACKUP_DIR}" ]]; then
  echo "error: backup directory not found: ${BACKUP_DIR}" >&2
  exit 1
fi

TIMESTAMP="$(basename "${BACKUP_DIR}")"
REMOTE_SUBPATH="db/${TIMESTAMP}"
REMOTE="$(drive_remote_path "${REMOTE_SUBPATH}")"

if [[ ! -f "${BACKUP_DIR}/eventpixels-db.dump.gz" ]]; then
  echo "error: missing ${BACKUP_DIR}/eventpixels-db.dump.gz" >&2
  exit 1
fi

if [[ ! -f "${BACKUP_DIR}/manifest.json" ]]; then
  echo "error: missing ${BACKUP_DIR}/manifest.json" >&2
  exit 1
fi

drive_rclone_ensure_env

echo "==> Uploading database backup to Google Drive"
echo "    local:  ${BACKUP_DIR}"
echo "    remote: ${REMOTE_SUBPATH}/"

rclone copy "${BACKUP_DIR}" "${REMOTE}" \
  --stats-one-line \
  --stats-log-level NOTICE

echo "==> Remote contents"
rclone lsf "${REMOTE}"

echo "==> Upload complete"
