import { z } from 'zod/v4';

export const actorIdParam = z.object({
  id: z.string().min(1),
});

export const actorTraceParams = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
});

// `traits` / `packId` accept either ?foo=a,b,c or repeated
// ?foo=a&foo=b. Fastify's default querystring parser (qs) gives us a
// string[] for the latter and a string for the former; we normalise
// both to string[].
const csvParam = z
  .union([z.string(), z.array(z.string())])
  .transform((v) => (Array.isArray(v) ? v : v.split(',')).map((t) => t.trim()).filter((t) => t.length > 0))
  .optional();

// `q` is optional so pickers can browse by trait/pack/level without a
// text query. The handler short-circuits to an empty response unless
// at least one of q / packId / traits / maxLevel is provided, to avoid
// accidentally returning the entire compendium.
export const compendiumSearchQuery = z.object({
  q: z.string().optional(),
  packId: csvParam,
  documentType: z.string().optional(),
  traits: csvParam,
  sources: csvParam,
  maxLevel: z.coerce.number().int().nonnegative().max(30).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const listCompendiumPacksQuery = z.object({
  documentType: z.string().optional(),
});

export const listCompendiumSourcesQuery = z.object({
  documentType: z.string().optional(),
  packId: csvParam,
  q: z.string().optional(),
  traits: csvParam,
  maxLevel: z.coerce.number().int().nonnegative().max(30).optional(),
});

export const getCompendiumDocumentQuery = z.object({
  uuid: z.string().min(1),
});

export const evalBody = z.object({
  script: z.string().min(1).max(100_000),
});

export interface ErrorResponse {
  error: string;
  suggestion?: string;
}
