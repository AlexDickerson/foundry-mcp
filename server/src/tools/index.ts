import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerSceneTools } from './scenes.js';
import { registerAssetTools } from './assets.js';

export function registerTools(mcp: McpServer): void {
  registerSceneTools(mcp);
  registerAssetTools(mcp);
}
