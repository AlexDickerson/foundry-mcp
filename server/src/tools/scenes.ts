import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod/v4';
import { foundryTool } from '../bridge.js';

export function registerSceneTools(mcp: McpServer): void {
  mcp.registerTool('get_scenes_list', {
    title: 'List Scenes',
    description: 'List all scenes in the Foundry VTT world with id, name, active status, and thumbnail path',
    inputSchema: {},
  }, async (): Promise<CallToolResult> => foundryTool('get-scenes-list'));

  mcp.registerTool('get_scene', {
    title: 'Get Scene',
    description:
      'Get full detail for a scene: grid, tokens (with HP/AC/conditions), walls, lights, notes, '
      + 'drawings, regions, and an ASCII tactical map. Optionally include a WebP screenshot.',
    inputSchema: {
      sceneId: z.string().optional().describe('Scene ID. Omit for the currently active scene.'),
      includeScreenshot: z.boolean().optional().describe('Include a base64 WebP screenshot of the canvas'),
    },
  }, async ({ sceneId, includeScreenshot }): Promise<CallToolResult> =>
    foundryTool('get-scene', { sceneId, includeScreenshot }),
  );

  mcp.registerTool('activate_scene', {
    title: 'Activate Scene',
    description: 'Set a scene as the active scene visible to all players',
    inputSchema: {
      sceneId: z.string().describe('ID of the scene to activate'),
    },
  }, async ({ sceneId }): Promise<CallToolResult> =>
    foundryTool('activate-scene', { sceneId }),
  );

  mcp.registerTool('capture_scene', {
    title: 'Capture Scene',
    description: 'Capture a WebP screenshot of the active scene canvas (includes grid overlay)',
    inputSchema: {},
  }, async (): Promise<CallToolResult> => foundryTool('capture-scene'));

  mcp.registerTool('create_scene', {
    title: 'Create Scene',
    description: 'Create a new scene in Foundry VTT with optional background image and grid settings',
    inputSchema: {
      name: z.string().describe('Scene name'),
      img: z.string().optional().describe('Background image path relative to Foundry Data dir (e.g. "maps/my_map.png")'),
      width: z.number().optional().describe('Scene width in pixels'),
      height: z.number().optional().describe('Scene height in pixels'),
      gridSize: z.number().optional().describe('Grid square size in pixels (default 100)'),
      gridUnits: z.string().optional().describe('Grid distance units (default "ft")'),
      gridDistance: z.number().optional().describe('Distance per grid square (default 5)'),
    },
  }, async ({ name, img, width, height, gridSize, gridUnits, gridDistance }): Promise<CallToolResult> =>
    foundryTool('create-scene', { name, img, width, height, gridSize, gridUnits, gridDistance }),
  );
}
