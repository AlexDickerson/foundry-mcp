import type { ActorSummary, ApiError, PreparedActor } from './types';

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

export const api = {
  getActors: (): Promise<ActorSummary[]> => request<ActorSummary[]>('/actors'),
  getPreparedActor: (id: string): Promise<PreparedActor> => request<PreparedActor>(`/actors/${id}/prepared`),
};
