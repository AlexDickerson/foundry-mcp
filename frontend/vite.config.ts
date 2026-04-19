import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev server at :5173.
//   /api/*         → foundry-mcp bridge on :8765 (our REST surface)
//   /icons, /systems, /modules, /worlds, /assets
//                  → Foundry VTT on :30000 (character portraits, item
//                    icons, system and module assets). The prepared-actor
//                    payload returns relative paths like
//                    "systems/pf2e/icons/iconics/portraits/amiri.webp" and
//                    "icons/weapons/swords/sword-guard.webp" that Foundry
//                    serves directly from its static tree.
//
// FOUNDRY_URL / MCP_URL env vars let you point at a remote Foundry /
// bridge (e.g. a LAN server) instead of localhost. Production serves the
// built dist/ and is expected to sit behind a reverse proxy that handles
// the same path prefixes.
const FOUNDRY_URL = process.env['FOUNDRY_URL'] ?? 'http://localhost:30000';
const MCP_URL = process.env['MCP_URL'] ?? 'http://localhost:8765';

const FOUNDRY_ASSET_PREFIXES = ['/icons', '/systems', '/modules', '/worlds', '/assets'];

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: MCP_URL,
        changeOrigin: false,
      },
      ...Object.fromEntries(
        FOUNDRY_ASSET_PREFIXES.map((prefix) => [prefix, { target: FOUNDRY_URL, changeOrigin: false }]),
      ),
    },
  },
});
