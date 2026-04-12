import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, normalize, resolve } from 'node:path';
import { homedir } from 'node:os';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { WebSocketServer, WebSocket } from 'ws';
import { z } from 'zod/v4';

const PORT = 8765;
const HOST = '0.0.0.0';
const COMMAND_TIMEOUT_MS = 30_000;
const FOUNDRY_DATA_DIR = resolve(homedir(), 'foundry-dev-data', 'Data');

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
// MCP — tool definitions & per-session server factory
// ---------------------------------------------------------------------------

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

/** Register all Foundry tools on an McpServer instance. */
function registerTools(mcp: McpServer): void {
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

  mcp.registerTool('upload_asset', {
    title: 'Upload Asset',
    description: 'Upload a file (image, audio, etc.) to the Foundry VTT Data directory. Returns the relative path for use in scene creation and other tools.',
    inputSchema: {
      path: z.string().describe('Destination path relative to Foundry Data dir (e.g. "maps/castle.png")'),
      data: z.string().describe('Base64-encoded file content'),
    },
  }, async ({ path: relPath, data }): Promise<CallToolResult> => {
    try {
      const safePath = normalize(relPath);
      if (safePath.startsWith('..') || safePath.includes('/..') || safePath.includes('\\..')) {
        return { content: [{ type: 'text', text: 'Error: path must not escape the Data directory' }], isError: true };
      }
      const absPath = resolve(FOUNDRY_DATA_DIR, safePath);
      if (!absPath.startsWith(FOUNDRY_DATA_DIR)) {
        return { content: [{ type: 'text', text: 'Error: path must not escape the Data directory' }], isError: true };
      }
      await mkdir(dirname(absPath), { recursive: true });
      await writeFile(absPath, Buffer.from(data, 'base64'));
      return { content: [{ type: 'text', text: JSON.stringify({ path: safePath, bytes: Buffer.from(data, 'base64').length }) }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
    }
  });
}

// ---------------------------------------------------------------------------
// Session management — one transport + McpServer per MCP client
// ---------------------------------------------------------------------------

const sessions = new Map<string, StreamableHTTPServerTransport>();

async function createSession(): Promise<StreamableHTTPServerTransport> {
  const mcp = new McpServer({ name: 'foundry-mcp', version: '0.1.0' });
  registerTools(mcp);

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (sessionId: string) => {
      console.log(`MCP session created: ${sessionId}`);
      sessions.set(sessionId, transport);
    },
  });

  transport.onclose = () => {
    const sid = transport.sessionId;
    if (sid) {
      sessions.delete(sid);
      console.log(`MCP session closed: ${sid}`);
    }
  };

  await mcp.connect(transport);
  return transport;
}

// ---------------------------------------------------------------------------
// HTTP Server — routes MCP traffic and Foundry WS upgrades
// ---------------------------------------------------------------------------

const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  // MCP Streamable HTTP endpoint
  if (req.url === '/mcp' || req.url === '/') {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    if (sessionId && sessions.has(sessionId)) {
      transport = sessions.get(sessionId)!;
    } else if (!sessionId) {
      transport = await createSession();
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message: 'Invalid session ID' }, id: null }));
      return;
    }

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
      activeSessions: sessions.size,
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

httpServer.listen(PORT, HOST, () => {
  console.log(`foundry-mcp server listening on ${HOST}:${PORT}`);
  console.log(`  MCP endpoint: http://${HOST}:${PORT}/mcp`);
  console.log(`  Foundry WS:   ws://${HOST}:${PORT}/foundry`);
  console.log(`  Health:       http://${HOST}:${PORT}/health`);
});
