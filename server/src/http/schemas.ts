import { z } from 'zod/v4';

export const actorIdParam = z.object({
  id: z.string().min(1),
});

export const actorTraceParams = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
});

export const compendiumSearchQuery = z.object({
  q: z.string().min(1),
  packId: z.string().optional(),
  documentType: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const evalBody = z.object({
  script: z.string().min(1).max(100_000),
});

export interface ErrorResponse {
  error: string;
  suggestion?: string;
}
