# foundry-mcp-frontend

Character-creator/viewer SPA for Pathfinder 2e that consumes the
foundry-mcp REST API. Renders post-`prepareData()` actor state with
PF2e's styling conventions.

## Temporary home

This package lives inside the foundry-mcp monorepo for development
ergonomics (shared CI, one `local.sh rebuild` loop, easy backend route
additions). It will be split to its own repo once the surface stabilises.

No cross-package imports from `module/` or `server/` — the only contract
is the REST API at `/api/*`. This constraint makes the future split a
`git subtree split --prefix=frontend` operation with no code changes.

## Dev loop

```bash
# Backend (in a separate terminal):
cd foundry-mcp && ./local.sh up   # or `rebuild` if already set up

# Frontend:
cd frontend
npm install
npm run dev                        # Vite on :5173, proxies /api → :8765
```

Open http://localhost:5173 — the scaffold renders an actor list pulled
from `/api/actors`.

## Scripts

- `npm run dev` — Vite dev server on :5173 with HMR
- `npm run build` — type-check + production build to `dist/`
- `npm run preview` — serve the built dist
- `npm run lint` / `lint:fix`
- `npm run typecheck`
- `npm run test` / `test:watch`

## Attribution

See [NOTICE](./NOTICE) for licenses of vendored/derived files.
