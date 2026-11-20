#!/bin/sh
# Mac/Linux: ./start.sh   (optional: ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=... ./start.sh on first run)
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Install Node.js LTS from https://nodejs.org first."; exit 1; }
[ -d node_modules ] || npm install
echo "Open http://localhost:3000"
node server/index.js
