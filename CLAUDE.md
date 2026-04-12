# Foundry MCP

Self-hosted MCP server + Foundry API Bridge module for controlling Foundry VTT from Claude Code.

## Tech Stack
- TypeScript monorepo (module + server)
- Module: Vite bundler, ESLint 9, Jest tests, Foundry VTT types
- Server: MCP SDK, OpenAI SDK (image editing), WebSocket bridge
- Docker (felddy/foundryvtt base image)

## Build & Run

### Module (Foundry VTT plugin)
- `cd module && npm run build` — Production build
- `cd module && npm run dev` — Watch mode
- `cd module && npm run lint` — ESLint check
- `cd module && npm run type-check` — TypeScript check
- `cd module && npm run test` — Jest tests

### Server (MCP bridge)
- `cd server && npm run build` — Compile TypeScript
- `cd server && npm run dev` — Dev mode (tsx)
- `cd server && npm start` — Run compiled server

### Docker
- `docker compose up --build` — Build and run everything
- Exposes: port 30000 (Foundry), port 8765 (MCP server)

## Project Structure
- `module/` — Foundry VTT module (foundry-api-bridge)
  - `src/commands/` — Command router and handlers (actors, scenes, tokens, walls, etc.)
  - `src/transport/` — WebSocket transport layer
  - `src/ui/` — Foundry UI components
  - `src/__tests__/` — Jest test suites
- `server/` — MCP server
  - `src/tools/` — MCP tool implementations
  - `src/bridge.ts` — WebSocket bridge to Foundry
  - `src/index.ts` — Server entry point
- `Dockerfile` — Multi-stage build (server → module → production)
- `docker-compose.yml` — Deployment config
- `docker-entrypoint.sh` — Container startup script

## Git Workflow
- All work MUST be done in git worktrees. Never work directly on main.
- Worktree directory: `.claude/worktrees/<branch-name>`
- Push work to the remote frequently — at minimum after every logical unit of work, and always before ending a session.
- All changes go through PRs to main. Never commit directly to main.
- Run linting before committing. Fix lint errors before pushing.

## Key Decisions
- Module and server are independently buildable but deployed together via Docker
- Module communicates with server over WebSocket (port 8765)
- Server exposes MCP tools for Claude Code to control Foundry VTT
- OpenAI SDK used specifically for GPT-image-1 map editing (not for chat)
- No root package.json — each package manages its own dependencies
