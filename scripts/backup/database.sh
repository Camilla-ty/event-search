#!/usr/bin/env bash
#
# Local PostgreSQL backup for EventPixels (Supabase).
# Writes a timestamped directory under supabase/dumps/backups/db/ (gitignored).
#
# Usage:
#   SUPABASE_DB_URL='postgresql://...' ./scripts/backup/database.sh
#   SUPABASE_DB_URL='postgresql://...' ./scripts/backup/database.sh --full
#
# See scripts/backup/README.md and docs/operations/disaster-recovery.md.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

MODE="data-only"
OUTPUT_ROOT="${BACKUP_OUTPUT_ROOT:-${REPO_ROOT}/supabase/dumps/backups/db}"
DB_URL="${SUPABASE_DB_URL:-${DATABASE_URL:-}}"

usage() {
  cat <<'EOF'
Usage: database.sh [options]

Options:
  --full       Dump schema + data for public and auth (default is data-only).
  -h, --help   Show this help.

Environment:
  SUPABASE_DB_URL   Direct Postgres connection URI (preferred).
  DATABASE_URL      Fallback if SUPABASE_DB_URL is unset.
  BACKUP_OUTPUT_ROOT  Override output root (default: supabase/dumps/backups/db).

Requires: pg_dump on PATH (PostgreSQL client tools).
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --full)
      MODE="full"
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "error: unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "${DB_URL}" ]]; then
  echo "error: set SUPABASE_DB_URL (or DATABASE_URL) to a direct Postgres connection string." >&2
  echo "       Supabase Dashboard → Project Settings → Database → Connection string (Direct)." >&2
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "error: pg_dump not found. Install PostgreSQL client tools." >&2
  echo "       macOS: brew install libpq && brew link --force libpq" >&2
  exit 1
fi

TIMESTAMP="$(date -u +%Y-%m-%dT%H%M%SZ)"
BACKUP_DIR="${OUTPUT_ROOT}/${TIMESTAMP}"
DUMP_BASENAME="eventpixels-db.dump"
DUMP_PATH="${BACKUP_DIR}/${DUMP_BASENAME}"
MANIFEST_PATH="${BACKUP_DIR}/manifest.json"

mkdir -p "${BACKUP_DIR}"

PG_DUMP_ARGS=(
  --format=custom
  --no-owner
  --no-acl
  --schema=public
  --schema=auth
  --file="${DUMP_PATH}"
)

if [[ "${MODE}" == "data-only" ]]; then
  PG_DUMP_ARGS+=(--data-only)
fi

echo "==> EventPixels database backup"
echo "    mode:      ${MODE}"
echo "    output:    ${BACKUP_DIR}"
echo "    schemas:   public, auth"

pg_dump "${PG_DUMP_ARGS[@]}" "${DB_URL}"

if [[ ! -s "${DUMP_PATH}" ]]; then
  echo "error: pg_dump produced an empty file." >&2
  exit 1
fi

gzip -f "${DUMP_PATH}"
DUMP_GZ="${DUMP_PATH}.gz"
DUMP_BYTES="$(wc -c < "${DUMP_GZ}" | tr -d ' ')"

GIT_SHA=""
if command -v git >/dev/null 2>&1 && git -C "${REPO_ROOT}" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  GIT_SHA="$(git -C "${REPO_ROOT}" rev-parse HEAD 2>/dev/null || true)"
fi

MIGRATION_COUNT=0
if [[ -d "${REPO_ROOT}/supabase/migrations" ]]; then
  MIGRATION_COUNT="$(find "${REPO_ROOT}/supabase/migrations" -maxdepth 1 -name '*.sql' | wc -l | tr -d ' ')"
fi

PG_DUMP_VERSION="$(pg_dump --version 2>/dev/null || true)"

python3 - \
  "${MANIFEST_PATH}" \
  "${TIMESTAMP}" \
  "${MODE}" \
  "${DUMP_BASENAME}.gz" \
  "${DUMP_BYTES}" \
  "${GIT_SHA}" \
  "${MIGRATION_COUNT}" \
  "${PG_DUMP_VERSION}" <<'PY'
import json
import os
import sys

manifest_path = sys.argv[1]
timestamp = sys.argv[2]
mode = sys.argv[3]
dump_file = sys.argv[4]
dump_bytes = int(sys.argv[5])
git_sha = sys.argv[6]
migration_count = int(sys.argv[7]) if sys.argv[7].isdigit() else 0
pg_dump_version = sys.argv[8] if len(sys.argv) > 8 else ""

db_url = os.environ.get("SUPABASE_DB_URL") or os.environ.get("DATABASE_URL") or ""

# Generic urlparse() treats # and ? in passwords as URL delimiters; use Postgres-safe parsing.
def pg_connection_host_port(url: str) -> tuple[str | None, int | None]:
    if not url or "://" not in url:
        return None, None
    authority = url.split("://", 1)[1].split("/", 1)[0]
    host_part = authority.rsplit("@", 1)[-1] if "@" in authority else authority
    if ":" not in host_part:
        return host_part or None, None
    host, _, port_text = host_part.rpartition(":")
    try:
        return host or None, int(port_text)
    except ValueError:
        return host or None, None

connection_host, parsed_port = pg_connection_host_port(db_url)
connection_port = parsed_port if parsed_port is not None else 5432

manifest = {
    "backup_type": "database",
    "product": "eventpixels",
    "created_at": timestamp,
    "mode": mode,
    "schemas": ["public", "auth"],
    "dump_file": dump_file,
    "dump_bytes": dump_bytes,
    "dump_format": "pg_custom_gzip",
    "git_sha": git_sha or None,
    "migration_count": migration_count,
    "pg_dump_version": pg_dump_version or None,
    "connection_host": connection_host or None,
    "connection_port": connection_port,
    "restore_hint": "Apply supabase/migrations first, then pg_restore --data-only --disable-triggers (see docs/operations/disaster-recovery.md).",
}

with open(manifest_path, "w", encoding="utf-8") as fh:
    json.dump(manifest, fh, indent=2)
    fh.write("\n")
PY

echo "==> Done"
echo "    dump:      ${DUMP_GZ} (${DUMP_BYTES} bytes)"
echo "    manifest:  ${MANIFEST_PATH}"
