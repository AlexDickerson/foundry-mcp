#!/usr/bin/env bash
set -euo pipefail

# ---- Install / update the foundry-api-bridge module into the data volume ----
MODULE_SRC="/opt/foundry-api-bridge"
MODULE_DST="/data/Data/modules/foundry-api-bridge"

# When SKIP_MODULE_COPY is set (docker-compose.local.yml sets this alongside
# a direct bind-mount of module/dist to MODULE_DST), the module is already
# live at the install path — copying would self-overwrite. Skip the copy and
# let edits to module/dist appear instantly to Foundry.
if [ -n "${SKIP_MODULE_COPY:-}" ]; then
  echo "[foundry-mcp] Module bind-mounted at $MODULE_DST — skipping copy"
elif [ -d "$MODULE_SRC" ]; then
  mkdir -p "$MODULE_DST"
  cp -r "$MODULE_SRC"/. "$MODULE_DST"/
  echo "[foundry-mcp] Module installed → $MODULE_DST"
fi

# ---- Start the MCP server in the background --------------------------------
# When MCP_INSPECT is set, the Node inspector listens on 0.0.0.0:9229 so a
# host-side debugger (e.g. VS Code's "Debug MCP server (full stack)") can
# attach. Only the local-dev compose sets this; production leaves it unset.
NODE_ARGS=""
if [ -n "${MCP_INSPECT:-}" ]; then
  NODE_ARGS="--inspect=0.0.0.0:9229"
  echo "[foundry-mcp] Node inspector enabled on :9229"
fi
echo "[foundry-mcp] Starting MCP server on :8765"
# shellcheck disable=SC2086  # Intentional word-splitting of NODE_ARGS
node $NODE_ARGS /opt/foundry-mcp/dist/index.js &
MCP_PID=$!

# Shut down MCP server when the container stops
cleanup() {
  echo "[foundry-mcp] Stopping MCP server (PID $MCP_PID)"
  kill "$MCP_PID" 2>/dev/null || true
  wait "$MCP_PID" 2>/dev/null || true
}
trap cleanup EXIT SIGTERM SIGINT

# ---- Hand off to the original felddy entrypoint -----------------------------
cd /home/node
exec ./entrypoint.sh "$@"
