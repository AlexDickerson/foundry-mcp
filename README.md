# foundry-mcp

Self-hosted MCP server that bridges Claude (or any MCP client) to a live Foundry VTT instance over WebSocket.

## Architecture

```
MCP Client ──HTTP──> foundry-mcp server ──WebSocket──> Foundry API Bridge module (in GM browser)
                          (server.ad:8765)                      (Foundry VTT v13)
```

- **`server/`** — Node.js MCP server using Streamable HTTP transport. Accepts MCP tool calls, translates them to Foundry commands, and relays them over a WebSocket to the GM's browser session. Also handles asset uploads directly to the Foundry data directory.
- **`module/`** — Forked Foundry VTT module that runs in the GM's browser tab. Receives commands via WebSocket, executes them against the Foundry API, and returns results.

## MCP Tools

| Tool | Description |
|------|-------------|
| `get_scenes_list` | List all scenes with id, name, active status |
| `get_scene` | Full scene detail: grid, tokens, walls, lights, notes, ASCII map |
| `activate_scene` | Set a scene as active for all players |
| `capture_scene` | WebP screenshot of the active scene canvas |
| `create_scene` | Create a new scene with background image and grid settings |
| `upload_asset` | Upload a file (image, audio) to the Foundry data directory |

## Setup

The MCP server runs as a systemd user service on the Foundry host:

```bash
systemctl --user status foundry-mcp    # check status
systemctl --user restart foundry-mcp   # restart
journalctl --user -u foundry-mcp -f    # tail logs
```

MCP clients connect to `http://server.ad:8765/mcp`. The Foundry module connects its WebSocket to `ws://server.ad:8765/foundry`.

## Acknowledgments

The Foundry VTT module in `module/` is a fork of [foundry-api-bridge](https://github.com/alexivenkov/foundry-api-bridge-module) v7.7.0 by [Alex Ivenkov](https://github.com/alexivenkov) (AI DM Project), licensed under MIT.

The fork removes all upstream SaaS connectivity (Patreon auth flow, auto-update manifest, external WebSocket default) and adds a `create-scene` command handler. All modifications are documented in [`module/PATCHES.md`](module/PATCHES.md). The original license and copyright are preserved in `module/LICENSE`.
