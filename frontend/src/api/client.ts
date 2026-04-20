import type {
  ActorSummary,
  ApiError,
  CompendiumDocument,
  CompendiumMatch,
  CompendiumPack,
  CompendiumSearchOptions,
  CompendiumSource,
  PreparedActor,
} from './types';

// Dev: Vite proxies /api → :8765. Prod: served same-origin or via a reverse
// proxy that preserves /api. Either way, paths are relative.
const BASE = '/api';

export class ApiRequestError extends Error {
  readonly status: number;
  readonly suggestion: string | undefined;

  constructor(status: number, error: string, suggestion?: string) {
    super(error);
    this.name = 'ApiRequestError';
    this.status = status;
    this.suggestion = suggestion;
  }
}

async function request<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    let body: ApiError = { error: `HTTP ${res.status.toString()}` };
    try {
      body = (await res.json()) as ApiError;
    } catch {
      // Response wasn't JSON — fall through with the status-only error.
    }
    throw new ApiRequestError(res.status, body.error, body.suggestion);
  }
  return (await res.json()) as T;
}

function buildCompendiumQuery(opts: CompendiumSearchOptions): string {
  const params = new URLSearchParams();
  if (opts.q !== undefined && opts.q.length > 0) params.set('q', opts.q);
  if (opts.packIds !== undefined && opts.packIds.length > 0) params.set('packId', opts.packIds.join(','));
  if (opts.documentType !== undefined) params.set('documentType', opts.documentType);
  if (opts.traits !== undefined && opts.traits.length > 0) params.set('traits', opts.traits.join(','));
  if (opts.sources !== undefined && opts.sources.length > 0) params.set('sources', opts.sources.join(','));
  if (opts.maxLevel !== undefined) params.set('maxLevel', opts.maxLevel.toString());
  if (opts.limit !== undefined) params.set('limit', opts.limit.toString());
  return params.toString();
}

export const api = {
  getActors: (): Promise<ActorSummary[]> => request<ActorSummary[]>('/actors'),
  getPreparedActor: (id: string): Promise<PreparedActor> => request<PreparedActor>(`/actors/${id}/prepared`),
  searchCompendium: (opts: CompendiumSearchOptions): Promise<{ matches: CompendiumMatch[] }> =>
    request<{ matches: CompendiumMatch[] }>(`/compendium/search?${buildCompendiumQuery(opts)}`),
  listCompendiumPacks: (opts: { documentType?: string } = {}): Promise<{ packs: CompendiumPack[] }> => {
    const params = new URLSearchParams();
    if (opts.documentType !== undefined) params.set('documentType', opts.documentType);
    const qs = params.toString();
    return request<{ packs: CompendiumPack[] }>(`/compendium/packs${qs ? `?${qs}` : ''}`);
  },
  getCompendiumDocument: (uuid: string): Promise<{ document: CompendiumDocument }> =>
    request<{ document: CompendiumDocument }>(`/compendium/document?uuid=${encodeURIComponent(uuid)}`),
  listCompendiumSources: (
    opts: {
      documentType?: string;
      packIds?: string[];
      q?: string;
      traits?: string[];
      maxLevel?: number;
    } = {},
  ): Promise<{ sources: CompendiumSource[] }> => {
    const params = new URLSearchParams();
    if (opts.documentType !== undefined) params.set('documentType', opts.documentType);
    if (opts.packIds !== undefined && opts.packIds.length > 0) params.set('packId', opts.packIds.join(','));
    if (opts.q !== undefined && opts.q.length > 0) params.set('q', opts.q);
    if (opts.traits !== undefined && opts.traits.length > 0) params.set('traits', opts.traits.join(','));
    if (opts.maxLevel !== undefined) params.set('maxLevel', opts.maxLevel.toString());
    const qs = params.toString();
    return request<{ sources: CompendiumSource[] }>(`/compendium/sources${qs ? `?${qs}` : ''}`);
  },
};
