#!/usr/bin/env bash
# Audit client components for side-effect ownership candidates.
# Run: bash scripts/audit-side-effects.sh
#
# Informational only — exit 0. Findings require manual review.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

section() {
  echo ""
  echo "== $1 =="
}

section "onAuthStateChange"
rg -n "onAuthStateChange" src --glob '*.{ts,tsx}' || true

section "router.refresh()"
rg -n "router\.refresh\(\)" src --glob '*.{ts,tsx}' || true

section "addEventListener / removeEventListener"
rg -n "addEventListener|removeEventListener" src --glob '*.{ts,tsx}' || true

section "popstate listeners"
rg -n "popstate" src --glob '*.{ts,tsx}' || true

section "setInterval"
rg -n "setInterval" src --glob '*.{ts,tsx}' || true

section "Supabase realtime channels"
rg -n "\.channel\(|realtime" src --glob '*.{ts,tsx}' || true

section "Presentational components with global listeners (manual review)"
for name in SessionControls GlobalSearchBar InfoHelpPopover NavigationShell; do
  matches="$(rg -l "addEventListener|onAuthStateChange|router\.refresh" src --glob "*${name}*" 2>/dev/null || true)"
  if [ -n "$matches" ]; then
    echo "-- ${name} --"
    echo "$matches"
    rg -n "addEventListener|onAuthStateChange|router\.refresh" $matches 2>/dev/null || true
  fi
done

section "Responsive desktop/mobile duplicate-mount candidates"
echo "SessionControls mount sites:"
rg -n "SessionControls" src/components/layout src/features/admin --glob '*.tsx' || true
echo ""
echo "WARN: SessionControls in multiple layout files should share one auth listener owner."

section "Auth listener owners (expected: AuthSessionRefreshProvider only in client shells)"
rg -n "AuthSessionRefreshProvider|MarketingBrowseAuthBoundary" src --glob '*.{ts,tsx}' || true

section "Summary counts"
echo "onAuthStateChange files: $(rg -l 'onAuthStateChange' src --glob '*.{ts,tsx}' 2>/dev/null | wc -l | tr -d ' ')"
echo "router.refresh files: $(rg -l 'router\.refresh\(\)' src --glob '*.{ts,tsx}' 2>/dev/null | wc -l | tr -d ' ')"
echo "popstate listener files: $(rg -l 'popstate' src --glob '*.{ts,tsx}' 2>/dev/null | wc -l | tr -d ' ')"

echo ""
echo "Done. Review hits against docs/architecture/side-effect-ownership.md"
