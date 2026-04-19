import { useEffect, useState } from 'react';
import { api, ApiRequestError } from '../api/client';
import type { PreparedActor, PreparedCharacter } from '../api/types';
import { Proficiencies } from '../components/tabs/Proficiencies';

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string; suggestion?: string }
  | { kind: 'ready'; actor: PreparedCharacter };

interface Props {
  actorId: string;
  onBack: () => void;
}

export function CharacterSheet({ actorId, onBack }: Props): React.ReactElement {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    api
      .getPreparedActor(actorId)
      .then((actor: PreparedActor): void => {
        if (cancelled) return;
        if (actor.type !== 'character') {
          setState({
            kind: 'error',
            message: `Actor "${actor.name}" is a ${actor.type}, not a character.`,
            suggestion: 'Pick a character actor from the list.',
          });
          return;
        }
        setState({ kind: 'ready', actor: actor as unknown as PreparedCharacter });
      })
      .catch((err: unknown): void => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        const suggestion = err instanceof ApiRequestError ? err.suggestion : undefined;
        setState(suggestion !== undefined ? { kind: 'error', message, suggestion } : { kind: 'error', message });
      });
    return (): void => {
      cancelled = true;
    };
  }, [actorId]);

  return (
    <div>
      <header className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-50"
        >
          ← Actors
        </button>
        {state.kind === 'ready' && <h1 className="text-xl font-semibold">{state.actor.name}</h1>}
      </header>

      {state.kind === 'loading' && <p className="text-sm text-neutral-500">Loading character…</p>}

      {state.kind === 'error' && (
        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm">
          <p className="font-medium text-red-900">Couldn&apos;t load character</p>
          <p className="mt-1 text-red-800">{state.message}</p>
          {state.suggestion !== undefined && <p className="mt-2 text-red-700">{state.suggestion}</p>}
        </div>
      )}

      {state.kind === 'ready' && <Proficiencies system={state.actor.system} />}
    </div>
  );
}
