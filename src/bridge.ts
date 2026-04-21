import { randomUUID } from 'node:crypto';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { WebSocketServer, WebSocket } from 'ws';
import { COMMAND_TIMEOUT_MS } from './config.js';
import { log } from './logger.js';

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
  const t0 = Date.now();
  log.info(`cmd >> ${type} [${id.slice(0, 8)}]`);

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingCommands.delete(id);
      log.error(`cmd timeout: ${type} [${id.slice(0, 8)}] after ${COMMAND_TIMEOUT_MS}ms`);
      reject(new Error(`Command '${type}' timed out after ${COMMAND_TIMEOUT_MS}ms`));
    }, COMMAND_TIMEOUT_MS);

    pendingCommands.set(id, {
      resolve(data) {
        clearTimeout(timer);
        const elapsed = Date.now() - t0;
        const size = JSON.stringify(data).length;
        log.info(`cmd << ${type} [${id.slice(0, 8)}] ${elapsed}ms ${(size / 1024).toFixed(1)}KB`);
        resolve(data);
      },
      reject(err) {
        clearTimeout(timer);
        const elapsed = Date.now() - t0;
        log.error(`cmd !! ${type} [${id.slice(0, 8)}] ${elapsed}ms ${err.message}`);
        reject(err);
      },
    });

    foundrySocket!.send(JSON.stringify({ id, type, params }));
  });
}

/** Send a command to Foundry and wrap the result as an MCP tool response. */
export async function foundryTool(type: string, params: Record<string, unknown> = {}): Promise<CallToolResult> {
  try {
    const data = (await sendCommand(type, params)) as Record<string, unknown> | null;

    // capture-scene returns { image, mimeType, ... } — surface image as MCP image block
    if (data && typeof data.image === 'string' && typeof data.mimeType === 'string') {
      const { image, ...meta } = data;
      return {
        content: [
          { type: 'text', text: JSON.stringify(meta) },
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
          { type: 'text', text: JSON.stringify(rest) },
          { type: 'image', data: ss.image, mimeType: ss.mimeType },
        ],
      };
    }

    return { content: [{ type: 'text', text: JSON.stringify(data) }] };
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
    log.warn('Rejecting duplicate Foundry connection');
    ws.close(4000, 'Only one Foundry module connection allowed');
    return;
  }

  foundrySocket = ws;
  log.info('Foundry module connected');

  ws.on('message', (raw: Buffer) => {
    try {
      const msg = JSON.parse(raw.toString()) as {
        id: string;
        success: boolean;
        data?: unknown;
        error?: string;
      };
      const pending = pendingCommands.get(msg.id);
      if (!pending) {
        log.warn(`Received response for unknown command: ${msg.id.slice(0, 8)}`);
        return;
      }
      pendingCommands.delete(msg.id);
      if (msg.success) {
        pending.resolve(msg.data);
      } else {
        pending.reject(new Error(msg.error ?? 'Command failed'));
      }
    } catch (err) {
      log.error(`Failed to parse Foundry message: ${err}`);
    }
  });

  ws.on('close', () => {
    log.info('Foundry module disconnected');
    foundrySocket = null;
    for (const [id, pending] of pendingCommands) {
      pending.reject(new Error('Foundry module disconnected'));
      pendingCommands.delete(id);
    }
  });

  ws.on('error', (err: Error) => log.error(`Foundry WS error: ${err.message}`));
});
