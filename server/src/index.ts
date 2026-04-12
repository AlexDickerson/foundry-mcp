import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { PORT, HOST } from './config.js';
import { wss, isFoundryConnected } from './bridge.js';
import { registerTools } from './tools/index.js';

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
      foundryConnected: isFoundryConnected(),
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
