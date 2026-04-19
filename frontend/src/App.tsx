import { useState } from 'react';
import { ActorList } from './components/ActorList';
import { CharacterSheet } from './pages/CharacterSheet';

export function App(): React.ReactElement {
  const [selectedActorId, setSelectedActorId] = useState<string | null>(null);

  return (
    <main className="mx-auto max-w-3xl p-6 font-sans">
      {selectedActorId === null ? (
        <>
          <h1 className="mb-4 text-2xl font-semibold">foundry-mcp — Character Sheet</h1>
          <p className="mb-6 text-sm text-neutral-500">
            Pick a character actor to view their proficiencies tab. Pulls from{' '}
            <code className="rounded bg-neutral-100 px-1 py-0.5">/api/actors</code> and{' '}
            <code className="rounded bg-neutral-100 px-1 py-0.5">/api/actors/:id/prepared</code>.
          </p>
          <ActorList
            onSelect={(a): void => {
              setSelectedActorId(a.id);
            }}
          />
        </>
      ) : (
        <CharacterSheet
          actorId={selectedActorId}
          onBack={(): void => {
            setSelectedActorId(null);
          }}
        />
      )}
    </main>
  );
}
