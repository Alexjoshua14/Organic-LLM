#!/usr/bin/env bash
# Sync lib/organic-relay from organic-llm (canonical) to sibling Introspection repo.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${1:-$REPO_ROOT/../Introspection/lib/organic-relay}"

if [[ ! -d "$REPO_ROOT/lib/organic-relay" ]]; then
  echo "Source lib/organic-relay not found" >&2
  exit 1
fi

mkdir -p "$(dirname "$TARGET")"
rsync -a --delete "$REPO_ROOT/lib/organic-relay/" "$TARGET/"
echo "Synced lib/organic-relay → $TARGET"
