#!/usr/bin/env bash
# Audit client components for soft-navigation patterns that often trigger redundant RSC work.
# Run: bash scripts/audit-soft-navigation.sh
#
# Findings require manual review — this script flags candidates, not definitive violations.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== router.replace / router.push in client components =="
rg -n "router\.(replace|push)\(" src --glob '*.tsx' \
  | rg -v 'login|signup|auth|/new\?|/new"|merge|Discard|discarded|onDiscarded' \
  || true

echo ""
echo "== router.replace / router.push inside useEffect (high priority) =="
rg -n "useEffect\(" src --glob '*.tsx' -l \
  | while read -r file; do
      if rg -q "router\.(replace|push)\(" "$file"; then
        rg -n "useEffect\(|router\.(replace|push)\(" "$file"
        echo "---"
      fi
    done

echo ""
echo "== router.refresh() in client components =="
rg -n "router\.refresh\(\)" src --glob '*.tsx' || true

echo ""
echo "Done. Review hits against docs/architecture/navigation-and-data-fetching.md"
