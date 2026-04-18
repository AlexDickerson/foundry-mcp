import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod/v4';
import { foundryTool } from '../bridge.js';

export function registerCompendiumTools(mcp: McpServer): void {
  mcp.registerTool(
    'find_in_compendium',
    {
      title: 'Find in Compendium',
      description:
        'Search compendium packs for documents whose name contains every word of the query (case-insensitive, word-order independent). A single-word query behaves like a substring match; "adult blue dragon" also matches "Blue Dragon (Adult)". Returns lean matches suitable for passing to create_actor_from_compendium or add_item_from_compendium. Results are ranked exact → phrase prefix → phrase contained → tokens scattered, alphabetically within each tier.',
      inputSchema: {
        name: z.string().describe('Name substring to search for (case-insensitive)'),
        packId: z.string().optional().describe('Restrict to a single pack (e.g. "pf2e.pathfinder-bestiary")'),
        documentType: z
          .string()
          .optional()
          .describe('Restrict to packs of this document type (e.g. "Actor", "Item", "JournalEntry")'),
        limit: z.number().int().positive().optional().describe('Max results (default 10, hard-capped at 100)'),
      },
    },
    async ({ name, packId, documentType, limit }): Promise<CallToolResult> =>
      foundryTool('find-in-compendium', { name, packId, documentType, limit }),
  );
}
