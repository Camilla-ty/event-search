#!/usr/bin/env bash
# Unit test runner for local + CI (ARC-005).
# Enables Node's experimental module mocks when available (logo upload tests).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

NODE_ARGS=(--import tsx --test)
if node --help 2>&1 | grep -q -- '--experimental-test-module-mocks'; then
  NODE_ARGS=(--experimental-test-module-mocks "${NODE_ARGS[@]}")
fi

if [[ "${1:-}" == "link3" ]]; then
  exec node "${NODE_ARGS[@]}" \
    src/lib/domain/hostedPlatformWebsite.test.ts \
    src/lib/domain/importWebsiteMatchKey.test.ts \
    src/lib/companies/companyImportMatching.test.ts \
    src/features/partner-alumni-import/server/validateRows.test.ts \
    src/features/sponsor-import/server/validateRows.test.ts \
    src/features/sponsor-import/server/importWebsiteSelection.test.ts
fi

# Bash 3-compatible file list (macOS ships Bash 3.2; avoid mapfile).
TEST_FILES=()
while IFS= read -r -d '' file; do
  TEST_FILES+=("$file")
done < <(find src \( -name '*.test.ts' -o -name '*.test.tsx' \) -print0 | sort -z)

if [[ ${#TEST_FILES[@]} -eq 0 ]]; then
  echo "error: no test files found under src/" >&2
  exit 1
fi

exec node "${NODE_ARGS[@]}" "${TEST_FILES[@]}"
