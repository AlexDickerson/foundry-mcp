#!/usr/bin/env bash
set -euo pipefail

# ---- Config ----
REMOTE="alex@server.ad"
REMOTE_DIR="/home/alex/foundry-mcp-dev"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

usage() {
  cat <<EOF
Usage: ./dev.sh <command>

Commands:
  setup     One-time setup: clone repo on server, install deps, create .env
  sync      Rsync local source to server
  build     Build module + server on server
  restart   Restart the dev container
  deploy    sync + build + restart (the common workflow)
  logs      Tail container logs
  stop      Stop the dev container
  status    Show container and MCP health status
EOF
  exit 1
}

cmd_setup() {
  echo "==> Setting up $REMOTE_DIR on server..."
  ssh "$REMOTE" bash -s <<'SETUP'
    set -euo pipefail
    REMOTE_DIR="/home/alex/foundry-mcp-dev"

    if [ -d "$REMOTE_DIR/.git" ]; then
      echo "Repo already exists, pulling latest..."
      git -C "$REMOTE_DIR" pull --ff-only
    else
      rm -rf "$REMOTE_DIR"
      git clone https://github.com/AlexDickerson/foundry-mcp.git "$REMOTE_DIR"
    fi

    echo "Installing module deps..."
    cd "$REMOTE_DIR/module" && npm ci --silent

    echo "Installing server deps..."
    cd "$REMOTE_DIR/server" && npm ci --silent

    # Create .env if missing
    if [ ! -f "$REMOTE_DIR/.env" ]; then
      cat > "$REMOTE_DIR/.env" <<'ENV'
FOUNDRY_DATA=/home/alex/foundry-dev-data
FOUNDRY_USERNAME=Thamous
FOUNDRY_PASSWORD=syXH3^C!1Y9^*sfN
ENV
      # Copy OPENAI_API_KEY from existing setup
      if [ -f /home/alex/foundry-mcp/server/.env ]; then
        grep OPENAI_API_KEY /home/alex/foundry-mcp/server/.env >> "$REMOTE_DIR/.env"
      fi
      echo "Created .env"
    fi

    echo "==> Setup complete"
SETUP
}

cmd_sync() {
  echo "==> Syncing source to server..."
  # Clear remote src dirs, then tar-pipe the local source over
  ssh "$REMOTE" "rm -rf $REMOTE_DIR/module/src $REMOTE_DIR/server/src"
  tar -C "$SCRIPT_DIR" -cz \
    --exclude=node_modules --exclude=dist --exclude=.git --exclude=.claude \
    module/src module/package.json module/package-lock.json \
    module/tsconfig.json module/vite.config.ts \
    module/dist/module.json module/dist/styles module/dist/templates \
    server/src server/package.json server/package-lock.json \
    server/tsconfig.json \
    docker-compose.dev.yml \
    | ssh "$REMOTE" "tar -xz -C $REMOTE_DIR"
  echo "==> Sync complete"
}

cmd_build() {
  echo "==> Building on server..."
  ssh "$REMOTE" bash -s <<'BUILD'
    set -euo pipefail
    cd /home/alex/foundry-mcp-dev

    echo "Building module..."
    cd module && npx vite build 2>&1 | tail -3
    # Copy static assets not produced by vite
    cp -r dist/module.json dist/styles dist/templates dist/ 2>/dev/null || true

    echo "Building server..."
    cd ../server && npm run build 2>&1 | tail -3

    echo "==> Build complete"
BUILD
}

cmd_restart() {
  echo "==> Restarting dev container..."
  ssh "$REMOTE" bash -s <<'RESTART'
    set -euo pipefail
    cd /home/alex/foundry-mcp-dev
    docker compose -f docker-compose.dev.yml down 2>/dev/null || true
    docker compose -f docker-compose.dev.yml up -d
    sleep 5
    echo "Container status:"
    docker ps --filter name=foundry-dev --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
    echo ""
    echo "MCP health:"
    curl -s http://localhost:8766/health 2>/dev/null || echo "(waiting for startup...)"
RESTART
}

cmd_deploy() {
  cmd_sync
  cmd_build
  cmd_restart
}

cmd_logs() {
  ssh "$REMOTE" "docker logs foundry-dev --tail 50 -f"
}

cmd_stop() {
  ssh "$REMOTE" "cd $REMOTE_DIR && docker compose -f docker-compose.dev.yml down"
}

cmd_status() {
  ssh "$REMOTE" bash -s <<'STATUS'
    echo "Container:"
    docker ps --filter name=foundry-dev --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}' 2>/dev/null || echo "  not running"
    echo ""
    echo "MCP health:"
    curl -s http://localhost:8766/health 2>/dev/null | python3 -m json.tool || echo "  not reachable"
STATUS
}

[ $# -lt 1 ] && usage

case "$1" in
  setup)   cmd_setup ;;
  sync)    cmd_sync ;;
  build)   cmd_build ;;
  restart) cmd_restart ;;
  deploy)  cmd_deploy ;;
  logs)    cmd_logs ;;
  stop)    cmd_stop ;;
  status)  cmd_status ;;
  *)       usage ;;
esac
