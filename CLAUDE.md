# foundry-mcp

Self-hosted MCP server that bridges Claude Code (or any MCP client) to a live Foundry VTT instance. Pairs with the [foundry-api-bridge](https://github.com/AlexDickerson/foundry-api-bridge) module running in the GM's browser tab, plus the [foundry-character-creator](https://github.com/AlexDickerson/foundry-character-creator) SPA for the REST-driven character creator UI.

## Tech Stack

- TypeScript (Node 20+)
- MCP SDK (`@modelcontextprotocol/sdk`) — Streamable HTTP transport
- Fastify — REST surface at `/api/*`
- `ws` — WebSocket bridge to Foundry
- OpenAI SDK — GPT-image-1 for `edit_image` map editing (not chat)
- Zod — request validation

## Build & Run

- `npm run dev` — tsx in watch-ish mode (restart on change)
- `npm run build` — Compile TypeScript → `dist/`
- `npm start` — Run compiled server (`node dist/index.js`)
- `npm run lint` / `npm run lint:fix`

Environment: copy `.env.example` to `.env` and fill in `OPENAI_API_KEY`. See `.env.example` for optional flags (`ALLOW_EVAL`, etc.).

Default ports:

- `8765` — HTTP (MCP over Streamable HTTP at `/mcp`, REST at `/api/*`, WebSocket at `/foundry`)

## Project Structure

- `src/tools/` — MCP tool implementations
- `src/bridge.ts` — WebSocket bridge to Foundry module
- `src/http/` — Fastify REST surface (consumed by foundry-character-creator)
- `src/config.ts`, `src/logger.ts`
- `src/index.ts` — Entry point
- `_http/` — REST Client `.http` files for interactive endpoint testing

## Git Workflow

- All work MUST be done in git worktrees. Never work directly on main.
- Worktree directory: `.claude/worktrees/<branch-name>`
- Push work to the remote frequently — at minimum after every logical unit of work, and always before ending a session.
- All changes go through PRs to main. Never commit directly to main.
- Run linting before committing. Fix lint errors before pushing.

## Deployment

The MCP server runs as a systemd user service on the Foundry host:

```bash
systemctl --user status foundry-mcp    # check status
systemctl --user restart foundry-mcp   # restart
journalctl --user -u foundry-mcp -f    # tail logs
```

MCP clients connect to `http://<host>:8765/mcp`. The Foundry module connects its WebSocket to `ws://<host>:8765/foundry`.

The Docker image for Foundry+module lives in the [foundry-api-bridge](https://github.com/AlexDickerson/foundry-api-bridge) repo. The server is runtime-independent: run it directly as a Node process, as a systemd service, or inside your own container.

## Key Decisions

- WebSocket bridge to Foundry lives at `/foundry`; the module opens the WS outbound from the GM browser.
- REST `/api/*` exposes the same data the MCP tools see (actors, items, compendia, scenes, etc.) for the character-creator SPA.
- OpenAI SDK used specifically for GPT-image-1 map editing (not for chat).
- Module and frontend live in separate repos now; contract between them is WS (module) + REST (frontend). No shared code.
- Server ships as a source zip + Node process. No Dockerfile here — the only Docker bundle (Foundry + module) is in foundry-api-bridge.
