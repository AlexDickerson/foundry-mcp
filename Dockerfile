# =============================================================================
# foundry-mcp  —  all-in-one image
# Foundry VTT (felddy) + foundry-api-bridge module + MCP server
# =============================================================================

# -- Build: MCP server --
FROM node:20-alpine AS build-server
WORKDIR /app
COPY server/package.json server/package-lock.json* ./
RUN npm ci
COPY server/tsconfig.json ./
COPY server/src ./src
RUN npm run build && npm prune --production

# -- Build: Foundry module --
FROM node:20-alpine AS build-module
WORKDIR /app
COPY module/package.json module/package-lock.json* ./
RUN npm ci
COPY module/tsconfig.json module/vite.config.ts ./
COPY module/src ./src
RUN npx vite build

# Copy the static dist assets that aren't produced by vite
COPY module/dist/module.json module/dist/module.json
COPY module/dist/styles ./dist/styles
COPY module/dist/templates ./dist/templates

# -- Production: layer onto felddy/foundryvtt --
FROM felddy/foundryvtt:release

# MCP server lives at /opt/foundry-mcp
COPY --from=build-server /app/dist        /opt/foundry-mcp/dist
COPY --from=build-server /app/node_modules /opt/foundry-mcp/node_modules
COPY --from=build-server /app/package.json /opt/foundry-mcp/package.json

# Module staged for install on first boot
COPY --from=build-module /app/dist /opt/foundry-api-bridge

# Entrypoint wrapper (--chmod avoids needing root for RUN chmod)
COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

ENV FOUNDRY_DATA_DIR=/data/Data

EXPOSE 30000 8765

ENTRYPOINT ["docker-entrypoint.sh"]
# Restore the CMD that felddy's entrypoint expects — our ENTRYPOINT
# override resets it to empty, causing "$1: unbound variable".
CMD ["resources/app/main.js", "--port=30000", "--headless", "--noupdate", "--dataPath=/data"]
