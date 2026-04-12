import { randomUUID } from 'node:crypto';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { WebSocketServer, WebSocket } from 'ws';
import { COMMAND_TIMEOUT_MS } from './config.js';

// ---------------------------------------------------------------------------
// Foundry Bridge — WebSocket connection to the Foundry module
// ---------------------------------------------------------------------------

interface PendingCommand {
  resolve: (data: unknown) => void;
  reject: (err: Error) => void;
}

let foundrySocket: WebSocket | null = null;
const pendingCommands = new Map<string, PendingCommand>();

export function isFoundryConnected(): boolean {
  return foundrySocket?.readyState === WebSocket.OPEN;
}

export function sendCommand(type: string, params: Record<string, unknown> = {}): Promise<unknown> {
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

/** Send a command to Foundry and wrap the result as an MCP tool response. */
export async function foundryTool(
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

// ---------------------------------------------------------------------------
// WebSocket server — accepts one Foundry module connection
// ---------------------------------------------------------------------------

export const wss = new WebSocketServer({ noServer: true });

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
