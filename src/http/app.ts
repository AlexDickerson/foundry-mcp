import Fastify, { type FastifyInstance } from 'fastify';
import { ZodError } from 'zod/v4';
import { log } from '../logger.js';
import { registerActorRoutes } from './routes/actors.js';
import { registerCompendiumRoutes } from './routes/compendium.js';
import { registerEvalRoutes } from './routes/eval.js';
import { registerPromptRoutes } from './routes/prompts.js';

export async function buildHttpApp(): Promise<FastifyInstance> {
  // We route `/api/*` requests into this Fastify instance from the parent
  // http.Server via `app.routing(req, res)` — see server/src/index.ts. The
  // parent already has its own logger, so Fastify's is off to avoid double
  // log lines.
  const app = Fastify({ logger: false });

  // Permissive CORS. Personal-use on LAN; tighten to an allowlist once the
  // frontend's origin is pinned.
  app.addHook('onRequest', async (req, reply) => {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      reply.code(204).send();
    }
  });

  // Response envelope: plain JSON on 2xx, `{error, suggestion?}` on 4xx/5xx.
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError) {
      const suggestion = err.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
      log.warn(`api ${req.method} ${req.url} 400 zod: ${suggestion}`);
      reply.code(400).send({ error: 'Invalid request parameters', suggestion });
      return;
    }

    const msg = err instanceof Error ? err.message : String(err);

    if (msg.toLowerCase().includes('not connected')) {
      log.error(`api ${req.method} ${req.url} 503 ${msg}`);
      reply.code(503).send({
        error: 'Foundry module not connected',
        suggestion: 'Start Foundry and enable the foundry-api-bridge module so it can connect to this server.',
      });
      return;
    }

    if (msg.toLowerCase().includes('not found')) {
      log.info(`api ${req.method} ${req.url} 404 ${msg}`);
      reply.code(404).send({ error: msg });
      return;
    }

    if (msg.toLowerCase().includes('timed out')) {
      log.error(`api ${req.method} ${req.url} 504 ${msg}`);
      reply.code(504).send({
        error: msg,
        suggestion:
          'The Foundry module may be busy preparing data for a large world. Try again, or check the Foundry console for errors.',
      });
      return;
    }

    log.error(`api ${req.method} ${req.url} 500 ${msg}`);
    reply.code(500).send({ error: msg });
  });

  app.setNotFoundHandler((req, reply) => {
    reply.code(404).send({
      error: `Route ${req.method} ${req.url} not found`,
      suggestion: 'See available endpoints under /api/ — actors, compendium.',
    });
  });

  registerActorRoutes(app);
  registerCompendiumRoutes(app);
  registerEvalRoutes(app);
  registerPromptRoutes(app);

  await app.ready();
  return app;
}
