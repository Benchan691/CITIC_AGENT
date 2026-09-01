#!/usr/bin/env bash

set -euo pipefail

if [ "$#" -ne 0 ]; then
  printf 'Usage: %s\n' "$(basename "$0")" >&2
  exit 2
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

if ! git -C "$SCRIPT_DIR" rev-parse --show-toplevel >/dev/null 2>&1; then
  printf 'error: update.sh must be run from a Git checkout.\n' >&2
  exit 1
fi

if [ ! -f "$SCRIPT_DIR/setup.sh" ]; then
  printf 'error: setup.sh is missing from the repository root.\n' >&2
  exit 1
fi

status="$(git -C "$SCRIPT_DIR" status --porcelain --untracked-files=all)"
if [ -n "$status" ]; then
  printf 'error: the working tree is not clean; update stopped.\n' >&2
  printf '%s\n' "$status" >&2
  printf 'Commit or save these changes before running update.sh again.\n' >&2
  exit 1
fi

echo "Updating the current branch from its configured GitHub upstream…"
git -C "$SCRIPT_DIR" pull --ff-only

echo "Refreshing dependencies, builds, and profile wiring…"
(cd "$SCRIPT_DIR" && bash "$SCRIPT_DIR/setup.sh" --plugins)

echo "Update complete. Restart the web app manually if it is running."
