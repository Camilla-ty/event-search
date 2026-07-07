#!/usr/bin/env bash
#
# Upload a local company-logos mirror to Google Drive.
#
# Usage:
#   GDRIVE_CLIENT_ID='...' GDRIVE_CLIENT_SECRET='...' GDRIVE_REFRESH_TOKEN='...' \
#   GDRIVE_FOLDER_ID='...' \
#     ./scripts/backup/upload-storage-mirror-to-drive.sh /path/to/company-logos/mirror
#
# Drive layout (relative to GDRIVE_FOLDER_ID):
#   storage/company-logos/mirror/{bucket paths...}
#   storage/company-logos/mirror/manifest.json
#
# Uses rclone copy (not sync): new/changed files are uploaded; remote-only files are kept.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/drive-rclone.sh
source "${SCRIPT_DIR}/lib/drive-rclone.sh"

usage() {
  cat <<'EOF'
Usage: upload-storage-mirror-to-drive.sh <mirror_dir>

Uploads a company-logos mirror folder to Google Drive under storage/company-logos/mirror/.

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

MIRROR_DIR="$1"
if [[ ! -d "${MIRROR_DIR}" ]]; then
  echo "error: mirror directory not found: ${MIRROR_DIR}" >&2
  exit 1
fi

if [[ ! -f "${MIRROR_DIR}/manifest.json" ]]; then
  echo "error: missing ${MIRROR_DIR}/manifest.json" >&2
  exit 1
fi

REMOTE_SUBPATH="storage/company-logos/mirror"
REMOTE="$(drive_remote_path "${REMOTE_SUBPATH}")"

drive_rclone_ensure_env

echo "==> Uploading company-logos mirror to Google Drive"
echo "    local:  ${MIRROR_DIR}"
echo "    remote: ${REMOTE_SUBPATH}/"

rclone copy "${MIRROR_DIR}" "${REMOTE}" \
  --stats-one-line \
  --stats-log-level NOTICE

echo "==> Remote top-level entries"
rclone lsf "${REMOTE}" --dirs-only

echo "==> Upload complete"
