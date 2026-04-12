import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod/v4';
import { foundryTool } from '../bridge.js';

export function registerTokenTools(mcp: McpServer): void {
  mcp.registerTool('get_scene_tokens', {
    title: 'List Scene Tokens',
    description: 'List all tokens on a scene with position, HP, AC, conditions, and disposition',
    inputSchema: {
      sceneId: z.string().optional().describe('Scene ID. Omit for the active scene.'),
    },
  }, async ({ sceneId }): Promise<CallToolResult> =>
    foundryTool('get-scene-tokens', { sceneId }),
  );

  mcp.registerTool('create_token', {
    title: 'Place Token',
    description: 'Place an actor\'s token on a scene at the given pixel coordinates',
    inputSchema: {
      actorId: z.string().describe('Actor ID to create a token for'),
      x: z.number().describe('X position in pixels'),
      y: z.number().describe('Y position in pixels'),
      sceneId: z.string().optional().describe('Scene ID. Omit for the active scene.'),
      hidden: z.boolean().optional().describe('Place token as hidden (GM only)'),
      elevation: z.number().optional().describe('Elevation in grid units'),
      rotation: z.number().optional().describe('Rotation in degrees'),
      scale: z.number().optional().describe('Token scale multiplier'),
    },
  }, async ({ actorId, x, y, sceneId, hidden, elevation, rotation, scale }): Promise<CallToolResult> =>
    foundryTool('create-token', { actorId, x, y, sceneId, hidden, elevation, rotation, scale }),
  );

  mcp.registerTool('move_token', {
    title: 'Move Token',
    description: 'Move a token to new pixel coordinates on the scene',
    inputSchema: {
      tokenId: z.string().describe('Token ID'),
      x: z.number().describe('New X position in pixels'),
      y: z.number().describe('New Y position in pixels'),
      sceneId: z.string().optional().describe('Scene ID. Omit for the active scene.'),
      elevation: z.number().optional().describe('New elevation in grid units'),
      rotation: z.number().optional().describe('New rotation in degrees'),
      animate: z.boolean().optional().describe('Animate the movement (default true)'),
    },
  }, async ({ tokenId, x, y, sceneId, elevation, rotation, animate }): Promise<CallToolResult> =>
    foundryTool('move-token', { tokenId, x, y, sceneId, elevation, rotation, animate }),
  );

  mcp.registerTool('update_token', {
    title: 'Update Token',
    description: 'Update token properties: visibility, elevation, rotation, scale, name, disposition',
    inputSchema: {
      tokenId: z.string().describe('Token ID'),
      sceneId: z.string().optional().describe('Scene ID. Omit for the active scene.'),
      hidden: z.boolean().optional().describe('Toggle visibility'),
      elevation: z.number().optional().describe('Elevation in grid units'),
      rotation: z.number().optional().describe('Rotation in degrees'),
      scale: z.number().optional().describe('Scale multiplier'),
      name: z.string().optional().describe('Display name override'),
      displayName: z.number().optional().describe('Name display mode (0=none, 10=control, 20=hovered, 30=hover+control, 40=always, 50=always+control)'),
      disposition: z.number().optional().describe('Disposition (-2=secret, -1=hostile, 0=neutral, 1=friendly)'),
      lockRotation: z.boolean().optional().describe('Lock token rotation'),
    },
  }, async ({ tokenId, sceneId, hidden, elevation, rotation, scale, name, displayName, disposition, lockRotation }): Promise<CallToolResult> =>
    foundryTool('update-token', { tokenId, sceneId, hidden, elevation, rotation, scale, name, displayName, disposition, lockRotation }),
  );

  mcp.registerTool('delete_token', {
    title: 'Delete Token',
    description: 'Remove a token from a scene (does not delete the actor)',
    inputSchema: {
      tokenId: z.string().describe('Token ID to remove'),
      sceneId: z.string().optional().describe('Scene ID. Omit for the active scene.'),
    },
  }, async ({ tokenId, sceneId }): Promise<CallToolResult> =>
    foundryTool('delete-token', { tokenId, sceneId }),
  );
}
