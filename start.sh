#!/usr/bin/env bash
# Start the Softbody vehicle sandbox on Ubuntu (or any Linux/macOS with Node.js 18+).
#   ./start.sh            -> serves on http://localhost:8080 and opens your browser
#   ./start.sh 3000       -> custom port
#   NO_BROWSER=1 ./start.sh   -> don't try to open a browser
set -euo pipefail
cd "$(dirname "$0")"
PORT="${1:-${PORT:-8080}}"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed."
  if command -v apt-get >/dev/null 2>&1; then
    echo "Installing Node.js with apt (needs sudo)..."
    sudo apt-get update && sudo apt-get install -y nodejs
  else
    echo "Please install Node.js 18+ from https://nodejs.org and re-run." >&2
    exit 1
  fi
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "Node.js $NODE_MAJOR is too old; version 18 or newer is required." >&2
  echo "On Ubuntu: sudo apt-get install -y nodejs   (or use https://github.com/nodesource/distributions)" >&2
  exit 1
fi

URL="http://localhost:${PORT}"
echo "Starting Softbody on ${URL}  (Ctrl+C to stop)"
if [ -z "${NO_BROWSER:-}" ]; then
  # open the browser shortly after the server is up (hardware acceleration recommended)
  (sleep 1; xdg-open "$URL" >/dev/null 2>&1 || true) &
fi
exec node server.js "$PORT"
