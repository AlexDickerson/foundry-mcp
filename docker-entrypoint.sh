#!/usr/bin/env bash
set -euo pipefail

# ---- Install / update the foundry-api-bridge module into the data volume ----
MODULE_SRC="/opt/foundry-api-bridge"
MODULE_DST="/data/Data/modules/foundry-api-bridge"

if [ -d "$MODULE_SRC" ]; then
  mkdir -p "$MODULE_DST"
  cp -r "$MODULE_SRC"/. "$MODULE_DST"/
  echo "[foundry-mcp] Module installed → $MODULE_DST"
fi

# ---- Start the MCP server in the background --------------------------------
echo "[foundry-mcp] Starting MCP server on :8765"
node /opt/foundry-mcp/dist/index.js &
MCP_PID=$!

# Shut down MCP server when the container stops
cleanup() {
  echo "[foundry-mcp] Stopping MCP server (PID $MCP_PID)"
  kill "$MCP_PID" 2>/dev/null || true
  wait "$MCP_PID" 2>/dev/null || true
}
trap cleanup EXIT SIGTERM SIGINT

# ---- Hand off to the original felddy entrypoint -----------------------------
exec /home/foundry/entrypoint.sh "$@"
