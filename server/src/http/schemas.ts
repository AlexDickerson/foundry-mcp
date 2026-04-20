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
  ancestrySlug: z.string().optional(),
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

// Minimal creation payload for the character-creator flow: a type +
// a (possibly empty) name is enough to instantiate a blank actor that
// the wizard will patch piecemeal. Callers can seed `system` as well
// when they already have partial details.
export const createActorBody = z.object({
  name: z.string(),
  type: z.string().min(1),
  folder: z.string().optional(),
  img: z.string().optional(),
  system: z.record(z.string(), z.unknown()).optional(),
});

// Partial-merge update. Any subset of fields can be supplied; Foundry
// does a deep merge on `system`, so patching e.g. `system.details.age`
// leaves every other detail untouched.
export const updateActorBody = z.object({
  name: z.string().optional(),
  img: z.string().optional(),
  folder: z.string().optional(),
  system: z.record(z.string(), z.unknown()).optional(),
});

// Item-on-actor operations for the wizard's piecemeal picks
// (ancestry, heritage, class, background, deity). Copies the source
// document out of the compendium, strips its `_id`, and attaches it
// to the target actor.
export const addItemFromCompendiumBody = z.object({
  packId: z.string().min(1),
  itemId: z.string().min(1),
  name: z.string().optional(),
  quantity: z.coerce.number().int().positive().optional(),
});

export const actorItemIdParams = z.object({
  id: z.string().min(1),
  itemId: z.string().min(1),
});

export interface ErrorResponse {
  error: string;
  suggestion?: string;
}
