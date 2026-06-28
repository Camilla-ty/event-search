#!/usr/bin/env bash
# Shared rclone + Google Drive OAuth configuration.
# Sourced by upload-to-drive.sh and prune-drive.sh.

drive_rclone_ensure_env() {
  if [[ -z "${GDRIVE_CLIENT_ID:-}" ]]; then
    echo "error: GDRIVE_CLIENT_ID is required" >&2
    exit 1
  fi

  if [[ -z "${GDRIVE_CLIENT_SECRET:-}" ]]; then
    echo "error: GDRIVE_CLIENT_SECRET is required" >&2
    exit 1
  fi

  if [[ -z "${GDRIVE_REFRESH_TOKEN:-}" ]]; then
    echo "error: GDRIVE_REFRESH_TOKEN is required" >&2
    exit 1
  fi

  if [[ -z "${GDRIVE_FOLDER_ID:-}" ]]; then
    echo "error: GDRIVE_FOLDER_ID is required" >&2
    exit 1
  fi

  if ! command -v rclone >/dev/null 2>&1; then
    echo "error: rclone not found on PATH" >&2
    exit 1
  fi

  export RCLONE_CONFIG_GDRIVE_TYPE=drive
  export RCLONE_CONFIG_GDRIVE_SCOPE=drive
  export RCLONE_CONFIG_GDRIVE_CLIENT_ID="${GDRIVE_CLIENT_ID}"
  export RCLONE_CONFIG_GDRIVE_CLIENT_SECRET="${GDRIVE_CLIENT_SECRET}"
  export RCLONE_CONFIG_GDRIVE_ROOT_FOLDER_ID="${GDRIVE_FOLDER_ID}"
  export RCLONE_CONFIG_GDRIVE_TOKEN="$(
    python3 - <<'PY'
import json
import os

token = {
    "access_token": "",
    "token_type": "Bearer",
    "refresh_token": os.environ["GDRIVE_REFRESH_TOKEN"],
    "expiry": "1970-01-01T00:00:00Z",
}
print(json.dumps(token))
PY
  )"
}

drive_remote_path() {
  local subpath="$1"
  echo "gdrive:${subpath}"
}
