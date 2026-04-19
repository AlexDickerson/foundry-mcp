import type { FastifyInstance } from 'fastify';
import { sendCommand } from '../../bridge.js';
import { actorIdParam, actorTraceParams } from '../schemas.js';

export function registerActorRoutes(app: FastifyInstance): void {
  app.get('/api/actors', async () => sendCommand('get-actors'));

  app.get('/api/actors/:id', async (req) => {
    const { id } = actorIdParam.parse(req.params);
    return sendCommand('get-actor', { actorId: id });
  });

  app.get('/api/actors/:id/prepared', async (req) => {
    const { id } = actorIdParam.parse(req.params);
    return sendCommand('get-prepared-actor', { actorId: id });
  });

  app.get('/api/actors/:id/trace/:slug', async (req) => {
    const { id, slug } = actorTraceParams.parse(req.params);
    return sendCommand('get-statistic-trace', { actorId: id, slug });
  });

  app.get('/api/actors/:id/items', async (req) => {
    const { id } = actorIdParam.parse(req.params);
    return sendCommand('get-actor-items', { actorId: id });
  });
}
