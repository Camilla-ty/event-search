#!/usr/bin/env bash
#
# Delete database backup folders on Google Drive older than the retention window.
#
# Usage:
#   GDRIVE_CLIENT_ID='...' GDRIVE_CLIENT_SECRET='...' GDRIVE_REFRESH_TOKEN='...' \
#   GDRIVE_FOLDER_ID='...' \
#     ./scripts/backup/prune-drive.sh
#
# Default retention: 30 days (override with BACKUP_RETENTION_DAYS).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/drive-rclone.sh
source "${SCRIPT_DIR}/lib/drive-rclone.sh"

RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

if ! [[ "${RETENTION_DAYS}" =~ ^[0-9]+$ ]] || [[ "${RETENTION_DAYS}" -lt 1 ]]; then
  echo "error: BACKUP_RETENTION_DAYS must be a positive integer" >&2
  exit 1
fi

drive_rclone_ensure_env

echo "==> Pruning Google Drive database backups older than ${RETENTION_DAYS} days"

python3 - "${RETENTION_DAYS}" <<'PY'
import datetime
import os
import re
import subprocess
import sys

retention_days = int(sys.argv[1])
cutoff = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=retention_days)
pattern = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{6}Z$")

listed = subprocess.run(
    ["rclone", "lsf", "gdrive:db", "--dirs-only"],
    check=True,
    capture_output=True,
    text=True,
)

pruned = 0
skipped = 0

for line in listed.stdout.splitlines():
    name = line.strip().rstrip("/")
    if not name:
        continue
    if not pattern.match(name):
        print(f"skip (unexpected name): db/{name}")
        skipped += 1
        continue

    created = datetime.datetime.strptime(name, "%Y-%m-%dT%H%M%SZ").replace(
        tzinfo=datetime.timezone.utc
    )
    if created >= cutoff:
        print(f"keep: db/{name}")
        continue

    remote = f"gdrive:db/{name}"
    print(f"prune: {remote} (created {created.isoformat()})")
    subprocess.run(["rclone", "purge", remote], check=True)
    pruned += 1

print(f"==> Prune complete (removed={pruned}, skipped={skipped})")
PY
