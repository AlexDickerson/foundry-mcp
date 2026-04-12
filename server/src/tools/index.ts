import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerSceneTools } from './scenes.js';
import { registerActorTools } from './actors.js';
import { registerTokenTools } from './tokens.js';
import { registerAssetTools } from './assets.js';

export function registerTools(mcp: McpServer): void {
  registerSceneTools(mcp);
  registerActorTools(mcp);
  registerTokenTools(mcp);
  registerAssetTools(mcp);
}
