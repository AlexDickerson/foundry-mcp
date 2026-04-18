import type { FindInCompendiumParams, FindInCompendiumResult, CompendiumMatch } from '@/commands/types';
import type { FoundryPackMetadata } from './worldTypes';

// Foundry exposes each compendium pack with an index Collection of lean
// entries. We load that via getIndex() rather than getDocuments() — the
// index is typically cached after first access and avoids hydrating full
// system data we don't need for name matching.

interface FoundryIndexEntry {
  _id: string;
  name?: string;
  type?: string;
  img?: string;
  uuid?: string;
}

interface FoundryPackIndex {
  forEach(fn: (entry: FoundryIndexEntry) => void): void;
}

interface FoundryIndexablePack {
  collection: string;
  metadata: FoundryPackMetadata;
  getIndex(): Promise<FoundryPackIndex>;
}

interface FoundryPacksCollection {
  get(id: string): FoundryIndexablePack | undefined;
  forEach(fn: (pack: FoundryIndexablePack) => void): void;
}

interface FoundryGame {
  packs: FoundryPacksCollection | undefined;
}

function getGame(): FoundryGame {
  return (globalThis as unknown as { game: FoundryGame }).game;
}

function score(entryName: string, query: string): number {
  if (entryName === query) return 0;
  if (entryName.startsWith(query)) return 1;
  return 2;
}

export async function findInCompendiumHandler(params: FindInCompendiumParams): Promise<FindInCompendiumResult> {
  const game = getGame();
  if (!game.packs) return { matches: [] };

  const query = params.name.trim().toLowerCase();
  if (!query) return { matches: [] };

  const limit = Math.max(1, Math.min(params.limit ?? 10, 100));

  // Collect all candidate packs first so we can await getIndex for each in
  // sequence — packs have internal caching so the cost is bounded by the
  // number of packs that haven't been indexed yet this session.
  const candidatePacks: FoundryIndexablePack[] = [];
  if (params.packId !== undefined) {
    const pack = game.packs.get(params.packId);
    if (!pack) {
      throw new Error(`Compendium pack not found: ${params.packId}`);
    }
    if (params.documentType !== undefined && pack.metadata.type !== params.documentType) {
      return { matches: [] };
    }
    candidatePacks.push(pack);
  } else {
    game.packs.forEach((pack) => {
      if (params.documentType !== undefined && pack.metadata.type !== params.documentType) return;
      candidatePacks.push(pack);
    });
  }

  interface ScoredMatch extends CompendiumMatch {
    rank: number;
  }

  const scored: ScoredMatch[] = [];

  for (const pack of candidatePacks) {
    const index = await pack.getIndex();
    index.forEach((entry) => {
      const entryName = entry.name ?? '';
      const lower = entryName.toLowerCase();
      if (!lower.includes(query)) return;
      scored.push({
        packId: pack.collection,
        packLabel: pack.metadata.label,
        documentId: entry._id,
        uuid: entry.uuid ?? `Compendium.${pack.collection}.${pack.metadata.type}.${entry._id}`,
        name: entryName,
        type: entry.type ?? pack.metadata.type,
        img: entry.img ?? '',
        rank: score(lower, query),
      });
    });
  }

  // Exact → prefix → contains, then alphabetical within tier.
  scored.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return a.name.localeCompare(b.name);
  });

  const matches: CompendiumMatch[] = scored.slice(0, limit).map(({ rank: _rank, ...match }) => match);
  return { matches };
}
