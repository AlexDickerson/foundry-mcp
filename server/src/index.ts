import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { WebSocketServer, WebSocket } from 'ws';
import { z } from 'zod/v4';

const PORT = 8765;
const HOST = '127.0.0.1';
const COMMAND_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// Foundry Bridge — WebSocket connection to the Foundry module
// ---------------------------------------------------------------------------

interface PendingCommand {
  resolve: (data: unknown) => void;
  reject: (err: Error) => void;
}

let foundrySocket: WebSocket | null = null;
const pendingCommands = new Map<string, PendingCommand>();

function sendCommand(type: string, params: Record<string, unknown> = {}): Promise<unknown> {
  if (!foundrySocket || foundrySocket.readyState !== WebSocket.OPEN) {
    return Promise.reject(new Error('Foundry module not connected'));
  }

  const id = randomUUID();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingCommands.delete(id);
      reject(new Error(`Command '${type}' timed out after ${COMMAND_TIMEOUT_MS}ms`));
    }, COMMAND_TIMEOUT_MS);

    pendingCommands.set(id, {
      resolve(data) { clearTimeout(timer); resolve(data); },
      reject(err)   { clearTimeout(timer); reject(err); },
    });

    foundrySocket!.send(JSON.stringify({ id, type, params }));
  });
}

const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws: WebSocket) => {
  if (foundrySocket) {
    console.log('Rejecting duplicate Foundry connection');
    ws.close(4000, 'Only one Foundry module connection allowed');
    return;
  }

  foundrySocket = ws;
  console.log('Foundry module connected');

  ws.on('message', (raw: Buffer) => {
    try {
      const msg = JSON.parse(raw.toString()) as {
        id: string; success: boolean; data?: unknown; error?: string;
      };
      const pending = pendingCommands.get(msg.id);
      if (!pending) return;
      pendingCommands.delete(msg.id);
      if (msg.success) {
        pending.resolve(msg.data);
      } else {
        pending.reject(new Error(msg.error ?? 'Command failed'));
      }
    } catch (err) {
      console.error('Failed to parse Foundry message:', err);
    }
  });

  ws.on('close', () => {
    console.log('Foundry module disconnected');
    foundrySocket = null;
    for (const [id, pending] of pendingCommands) {
      pending.reject(new Error('Foundry module disconnected'));
      pendingCommands.delete(id);
    }
  });

  ws.on('error', (err: Error) => console.error('Foundry WS error:', err));
});

// ---------------------------------------------------------------------------
// MCP Server — tool definitions
// ---------------------------------------------------------------------------

const mcp = new McpServer({ name: 'foundry-mcp', version: '0.1.0' });

/** Send a command to Foundry and wrap the result as an MCP tool response. */
async function foundryTool(
  type: string,
  params: Record<string, unknown> = {},
): Promise<CallToolResult> {
  try {
    const data = await sendCommand(type, params) as Record<string, unknown> | null;

    // capture-scene returns { image, mimeType, ... } — surface image as MCP image block
    if (data && typeof data.image === 'string' && typeof data.mimeType === 'string') {
      const { image, ...meta } = data;
      return {
        content: [
          { type: 'text', text: JSON.stringify(meta, null, 2) },
          { type: 'image', data: image as string, mimeType: data.mimeType as string },
        ],
      };
    }

    // get-scene with includeScreenshot embeds screenshot as a nested object
    if (data?.screenshot && typeof (data.screenshot as Record<string, unknown>).image === 'string') {
      const ss = data.screenshot as { image: string; mimeType: string };
      const { screenshot: _, ...rest } = data;
      return {
        content: [
          { type: 'text', text: JSON.stringify(rest, null, 2) },
          { type: 'image', data: ss.image, mimeType: ss.mimeType },
        ],
      };
    }

    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
  }
}

// -- Tools --

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

// ---------------------------------------------------------------------------
// HTTP Server — routes MCP traffic and Foundry WS upgrades
// ---------------------------------------------------------------------------

const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => randomUUID(),
});

const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  // MCP Streamable HTTP endpoint
  if (req.url === '/mcp' || req.url === '/') {
    try {
      await transport.handleRequest(req, res);
    } catch (err) {
      console.error('MCP transport error:', err);
      if (!res.headersSent) {
        res.writeHead(500);
        res.end('Internal server error');
      }
    }
    return;
  }

  // Health probe
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      foundryConnected: foundrySocket?.readyState === WebSocket.OPEN,
    }));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

httpServer.on('upgrade', (req, socket, head) => {
  if (req.url?.startsWith('/foundry')) {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  } else {
    socket.destroy();
  }
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

await mcp.connect(transport);

httpServer.listen(PORT, HOST, () => {
  console.log(`foundry-mcp server listening on ${HOST}:${PORT}`);
  console.log(`  MCP endpoint: http://${HOST}:${PORT}/mcp`);
  console.log(`  Foundry WS:   ws://${HOST}:${PORT}/foundry`);
  console.log(`  Health:       http://${HOST}:${PORT}/health`);
});
