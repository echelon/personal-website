#!/usr/bin/env bash
set -euo pipefail

# The dev launcher runs the Rust watcher, serves the site, and reloads browsers.
site_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$site_root"

# Replace the shell so Ctrl-C reaches the launcher and stops its child processes.
exec node frontend/tools/dev.ts "$@"
