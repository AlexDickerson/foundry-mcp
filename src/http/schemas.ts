import { z } from 'zod/v4';

export const actorIdParam = z.object({
  id: z.string().min(1),
});

export const actorTraceParams = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
});

// `traits` accepts either ?traits=a,b,c or repeated ?traits=a&traits=b.
// Fastify's default querystring parser (qs) gives us a string[] for the
// latter and a string for the former; we normalise both to string[].
const traitsParam = z
  .union([z.string(), z.array(z.string())])
  .transform((v) => (Array.isArray(v) ? v : v.split(',')).map((t) => t.trim()).filter((t) => t.length > 0))
  .optional();

export const compendiumSearchQuery = z.object({
  q: z.string().min(1),
  packId: z.string().optional(),
  documentType: z.string().optional(),
  traits: traitsParam,
  maxLevel: z.coerce.number().int().nonnegative().max(30).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const evalBody = z.object({
  script: z.string().min(1).max(100_000),
});

export interface ErrorResponse {
  error: string;
  suggestion?: string;
}
