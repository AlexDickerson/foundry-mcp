import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev server at :5173 proxies /api/* to the foundry-mcp container on :8765.
// The container binds on all interfaces by default; localhost works because
// docker-compose.local.yml maps 8765:8765. Production serves the built dist/
// directly — Vite isn't in the loop.
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
        target: 'http://localhost:8765',
        changeOrigin: false,
      },
    },
  },
});
