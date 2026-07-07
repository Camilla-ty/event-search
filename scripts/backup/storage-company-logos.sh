#!/usr/bin/env bash
#
# Mirror the Supabase company-logos bucket locally, then upload to Google Drive.
#
# Usage:
#   NEXT_PUBLIC_SUPABASE_URL='...' SUPABASE_SERVICE_ROLE_KEY='...' \
#   GDRIVE_CLIENT_ID='...' GDRIVE_CLIENT_SECRET='...' GDRIVE_REFRESH_TOKEN='...' \
#   GDRIVE_FOLDER_ID='...' \
#     ./scripts/backup/storage-company-logos.sh
#
# See scripts/backup/README.md and docs/operations/backup-policy.md.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

OUTPUT_ROOT="${BACKUP_OUTPUT_ROOT:-${REPO_ROOT}/supabase/dumps/backups/storage}"
MIRROR_DIR="${OUTPUT_ROOT}/company-logos/mirror"

export BACKUP_OUTPUT_ROOT="${OUTPUT_ROOT}"

echo "==> Mirroring Supabase Storage bucket: company-logos"
echo "    output: ${MIRROR_DIR}"

npx tsx "${REPO_ROOT}/scripts/backup/mirror-company-logos.ts"

if [[ ! -f "${MIRROR_DIR}/manifest.json" ]]; then
  echo "error: mirror manifest not found at ${MIRROR_DIR}/manifest.json" >&2
  exit 1
fi

chmod +x "${SCRIPT_DIR}/upload-storage-mirror-to-drive.sh"
"${SCRIPT_DIR}/upload-storage-mirror-to-drive.sh" "${MIRROR_DIR}"

echo "==> Storage backup complete"
