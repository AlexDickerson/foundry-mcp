import type { FastifyInstance } from 'fastify';
import { sendCommand } from '../../bridge.js';
import { compendiumSearchQuery } from '../schemas.js';

export function registerCompendiumRoutes(app: FastifyInstance): void {
  app.get('/api/compendium/search', async (req) => {
    const { q, packId, documentType, limit } = compendiumSearchQuery.parse(req.query);
    return sendCommand('find-in-compendium', {
      name: q,
      packId,
      documentType,
      limit,
    });
  });
}
