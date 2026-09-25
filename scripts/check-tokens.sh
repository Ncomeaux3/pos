#!/usr/bin/env bash
# The holon-apple sweep guard (docs/plans/holon-apple.md, Module sweeps).
#
# A swept screen takes its type from the holon-ui type styles and its radii
# from the radius tokens or .concentric, so an arbitrary `text-[..]` or
# `rounded-[..]` in one is a regression. Hex colours are allowed only in the
# Skills constellation and the Travel globe, which keep their own palette.
#
# SWEPT grows by one module per sweep PR. Paths are files or folders.
set -euo pipefail

cd "$(dirname "$0")/.."

SWEPT=(
  # Home
  'app/(app)/page.tsx'
  'app/(app)/Bento.tsx'
  'app/(app)/DashboardTiles.tsx'
  'app/(app)/Inbox.tsx'
  'app/(app)/RunNow.tsx'
  'app/(app)/loading.tsx'
)

# The two surfaces kept unchanged in feel (owner, 2026-09-18).
HEX_ALLOWED='modules/skills/ui/|modules/travel/ui/Globe'

fail=0

arbitrary=$(grep -rnE 'text-\[|rounded-\[' --include='*.tsx' --include='*.ts' "${SWEPT[@]}" || true)
if [ -n "$arbitrary" ]; then
  echo 'Arbitrary text or radius in a swept module; use a type style or a radius token:'
  echo "$arbitrary"
  fail=1
fi

# A hex colour in code, not a PR number in a comment: comment lines are skipped.
hex=$(grep -rnE "[\"'\`[( :]#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b" \
  --include='*.tsx' --include='*.ts' "${SWEPT[@]}" \
  | grep -vE '^[^:]+:[0-9]+:\s*(//|\*|/\*|\{/\*)' \
  | grep -vE "^($HEX_ALLOWED)" || true)
if [ -n "$hex" ]; then
  echo 'Hex colour in a swept module; use a token:'
  echo "$hex"
  fail=1
fi

if [ "$fail" -eq 0 ]; then
  echo "check-tokens: ${#SWEPT[@]} swept paths clean"
fi
exit "$fail"
