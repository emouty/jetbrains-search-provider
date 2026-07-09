#!/usr/bin/env bash
# Smoke-test the discovery + project-loading pipeline under real GJS against
# this machine's real home directory. Catches GJS-runtime breakage (import
# errors, Gio API misuse, hangs) that vitest's Node mocks cannot see.
set -euo pipefail
cd "$(dirname "$0")/.."

npm run build --silent

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
cp -r dist/. "$tmp/"

# Stub GNOME-Shell-only imports so the modules load in plain gjs.
sed -i -E "s|import St from .gi://St.;|const St = {Icon: class StIcon {}};|" "$tmp"/*.js
sed -i -E "s|import Shell from .gi://Shell.;|const Shell = {AppSystem: {get_default: () => ({lookup_app: (f) => ({desktopId: f})})}};|" "$tmp"/*.js

cp scripts/smoke-gjs.js "$tmp/__smoke__.js"
timeout 30 gjs -m "$tmp/__smoke__.js"
