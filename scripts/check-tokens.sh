#!/usr/bin/env bash
# The holon-apple sweep guard (docs/plans/holon-apple.md, Module sweeps).
#
# A swept screen takes its type from the holon-ui type styles and its radii
# from the radius tokens or .concentric, so an arbitrary `text-[..]` or
# `rounded-[..]` in one is a regression, as is a Holon alias token. Hex
# colours are allowed only in the Skills constellation and the Travel globe,
# which keep their own palette.
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
  # Tasks
  'modules/tasks/ui'
  # Finance
  'modules/finance/ui'
)

# The two surfaces kept unchanged in feel (owner, 2026-09-18).
HEX_ALLOWED='modules/skills/ui/|modules/travel/ui/Globe'

fail=0

# A renamed or mistyped path would make grep exit 2 and the guard pass.
for p in "${SWEPT[@]}"; do
  if [ ! -e "$p" ]; then
    echo "check-tokens: swept path missing: $p"
    fail=1
  fi
done
[ "$fail" -eq 0 ] || exit 1

# Code only: comment lines are dropped, and so is anything after a //, so a
# PR number such as (#151) in a comment is never read as a colour.
code() {
  grep -rnE "$1" --include='*.tsx' --include='*.ts' "${SWEPT[@]}" \
    | grep -vE '^[^:]+:[0-9]+:\s*(//|\*|/\*|\{/\*)' \
    | sed -E 's#([^:])//.*$#\1#' \
    | grep -E "$1" || true
}

# text-[..], text-(length:..), rounded-[..] and the per-corner forms.
arbitrary=$(code '(text|rounded(-[trblse]{1,2})?)-[[(]')
if [ -n "$arbitrary" ]; then
  echo 'Arbitrary text or radius in a swept module; use a type style or a radius token:'
  echo "$arbitrary"
  fail=1
fi

# A hex colour in a class or a style value. After a quote only the six and
# eight digit forms count, so an anchor such as href="#add" is not a colour.
hex=$(code '([[( :]#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})|["'"'"'`]#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}))\b' | grep -vE "^($HEX_ALLOWED)" || true)
if [ -n "$hex" ]; then
  echo 'Hex colour in a swept module; use a token:'
  echo "$hex"
  fail=1
fi

# The Holon alias layer is deleted at the close, so a swept file names the
# package's tokens instead (label, secondary-label, accent, separator, fill,
# grouped, red, orange, green), its type styles rather than `t-caption`, and
# its focus ring rather than `--accent-soft`.
alias=$(code '\b(text|bg|border|ring|fill|stroke|outline|divide|accent|caret|decoration)-(ink(-[234])?|rule(-2)?|action|bad|warn|ok|brand(-soft)?|sand(-surface)?|glass(-[a-z]+)?|bg-elev|bg|field)\b|\bt-caption\b|--accent-soft\b')
if [ -n "$alias" ]; then
  echo 'Holon alias token in a swept module; use the holon-ui name:'
  echo "$alias"
  fail=1
fi

if [ "$fail" -eq 0 ]; then
  echo "check-tokens: ${#SWEPT[@]} swept paths clean"
fi
exit "$fail"
