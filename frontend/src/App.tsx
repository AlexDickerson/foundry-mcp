import { ActorList } from './components/ActorList';

export function App(): React.ReactElement {
  return (
    <main className="mx-auto max-w-3xl p-6 font-sans">
      <h1 className="mb-4 text-2xl font-semibold">foundry-mcp — Character Sheet</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Scaffold proof-of-life. Pulls from <code className="rounded bg-neutral-100 px-1 py-0.5">/api/actors</code> via
        the Vite proxy to the foundry-mcp container on :8765.
      </p>
      <ActorList />
    </main>
  );
}
