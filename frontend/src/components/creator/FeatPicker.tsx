import { useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiRequestError } from '../../api/client';
import type { CompendiumMatch, CompendiumSearchOptions } from '../../api/types';
import { useDebounce } from '../../lib/useDebounce';

type SortMode = 'alpha' | 'level';

interface Props {
  title: string;
  /** Pre-filters applied to every search. Text query is layered on top. */
  filters: Pick<CompendiumSearchOptions, 'packId' | 'documentType' | 'traits' | 'maxLevel'>;
  onPick: (match: CompendiumMatch) => void;
  onClose: () => void;
}

type FetchState =
  | { kind: 'loading' }
  | { kind: 'ready'; matches: CompendiumMatch[] }
  | { kind: 'error'; message: string };

// Modal picker for creator slot choices. Starts in "browse mode" (no
// q, filters only) and narrows live as the user types. Used by the
// Progression tab for class feat slots; will be reused for ancestry /
// skill / general feat slots.
export function FeatPicker({ title, filters, onPick, onClose }: Props): React.ReactElement {
  const [query, setQuery] = useState('');
  const [state, setState] = useState<FetchState>({ kind: 'loading' });
  const [sort, setSort] = useState<SortMode>('alpha');
  const debouncedQuery = useDebounce(query.trim(), 200);
  const inputRef = useRef<HTMLInputElement>(null);

  // Apply sort on top of whatever order the server returned. Client-side
  // is fine because the server already caps results (limit 50 by default
  // from the picker), so the sort runs over a tiny array. Entries missing
  // a level sink to the bottom of level-sorted lists and stay alpha among
  // themselves.
  const visibleMatches = useMemo(() => {
    if (state.kind !== 'ready') return [];
    const copy = [...state.matches];
    if (sort === 'level') {
      copy.sort((a, b) => {
        const al = a.level ?? Number.POSITIVE_INFINITY;
        const bl = b.level ?? Number.POSITIVE_INFINITY;
        if (al !== bl) return al - bl;
        return a.name.localeCompare(b.name);
      });
    } else {
      copy.sort((a, b) => a.name.localeCompare(b.name));
    }
    return copy;
  }, [state, sort]);

  // Stable filter key for the effect dep array. Callers typically pass
  // a fresh object each render; we memoise so the fetch only refires
  // when the actual filter values change.
  const filterKey = useMemo(
    () =>
      JSON.stringify({
        packId: filters.packId ?? null,
        documentType: filters.documentType ?? null,
        traits: filters.traits ?? [],
        maxLevel: filters.maxLevel ?? null,
      }),
    [filters.packId, filters.documentType, filters.traits, filters.maxLevel],
  );

  useEffect(() => {
    let cancelled = false;
    // Deliberately not flipping state back to 'loading' here — that
    // would trigger an extra render (react-hooks/set-state-in-effect)
    // and flash the empty-list state between keystrokes. Instead the
    // previous `ready` matches stay visible until the next response
    // lands, giving a calm "narrow-in-place" feel to the picker.
    api
      .searchCompendium({ ...filters, q: debouncedQuery, limit: 50 })
      .then((result) => {
        if (cancelled) return;
        setState({ kind: 'ready', matches: result.matches });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof ApiRequestError ? err.message : err instanceof Error ? err.message : String(err);
        setState({ kind: 'error', message });
      });
    return (): void => {
      cancelled = true;
    };
    // filterKey captures every filter field; exhaustive-deps is happy.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, filterKey]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return (): void => {
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-testid="feat-picker"
      className="fixed inset-0 z-50 flex items-center justify-center bg-pf-text/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-xl flex-col rounded border border-pf-border bg-pf-bg shadow-xl"
        onClick={(e): void => {
          e.stopPropagation();
        }}
      >
        <header className="flex items-center justify-between border-b border-pf-border px-4 py-2">
          <h2 className="font-serif text-lg font-semibold text-pf-text">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close picker"
            className="rounded px-2 py-0.5 text-lg text-pf-alt-dark hover:bg-pf-bg-dark hover:text-pf-primary"
          >
            ×
          </button>
        </header>

        <div className="border-b border-pf-border px-4 py-2">
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e): void => {
              setQuery(e.target.value);
            }}
            placeholder="Type to filter…"
            className="w-full rounded border border-pf-border bg-white px-2 py-1 text-sm text-pf-text placeholder:text-pf-alt focus:border-pf-primary focus:outline-none"
            data-testid="feat-picker-input"
          />
          <div className="mt-1 flex items-center justify-between gap-2">
            <FilterSummary filters={filters} />
            <SortToggle sort={sort} onChange={setSort} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto" data-testid="feat-picker-results">
          {state.kind === 'loading' && <p className="p-4 text-sm italic text-pf-alt">Searching…</p>}
          {state.kind === 'error' && <p className="p-4 text-sm text-pf-primary">Search failed: {state.message}</p>}
          {state.kind === 'ready' && visibleMatches.length === 0 && (
            <p className="p-4 text-sm italic text-pf-alt">No matches. Loosen the filters or search term.</p>
          )}
          {state.kind === 'ready' && visibleMatches.length > 0 && (
            <ul className="divide-y divide-pf-border">
              {visibleMatches.map((match) => (
                <li key={match.uuid}>
                  <MatchRow match={match} onPick={onPick} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function SortToggle({ sort, onChange }: { sort: SortMode; onChange: (next: SortMode) => void }): React.ReactElement {
  const options: Array<{ value: SortMode; label: string }> = [
    { value: 'alpha', label: 'A–Z' },
    { value: 'level', label: 'Level' },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Sort results"
      data-testid="feat-picker-sort"
      className="inline-flex shrink-0 rounded border border-pf-border overflow-hidden text-[10px] font-semibold uppercase tracking-widest"
    >
      {options.map((opt) => {
        const active = sort === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            data-sort-option={opt.value}
            onClick={(): void => {
              onChange(opt.value);
            }}
            className={[
              'px-2 py-0.5 transition-colors',
              active
                ? 'bg-pf-primary text-white'
                : 'bg-white text-pf-alt-dark hover:bg-pf-tertiary/40 hover:text-pf-primary',
            ].join(' ')}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function FilterSummary({ filters }: { filters: Props['filters'] }): React.ReactElement | null {
  const parts: string[] = [];
  if (filters.traits && filters.traits.length > 0) parts.push(`traits: ${filters.traits.join(', ')}`);
  if (filters.maxLevel !== undefined) parts.push(`level ≤ ${filters.maxLevel.toString()}`);
  if (filters.packId !== undefined) parts.push(`pack: ${filters.packId}`);
  if (parts.length === 0) return null;
  return <p className="mt-1 text-[10px] uppercase tracking-widest text-pf-alt">{parts.join(' · ')}</p>;
}

function MatchRow({
  match,
  onPick,
}: {
  match: CompendiumMatch;
  onPick: (match: CompendiumMatch) => void;
}): React.ReactElement {
  const traitsSummary = match.traits && match.traits.length > 0 ? match.traits.slice(0, 5).join(', ') : '';
  return (
    <button
      type="button"
      onClick={(): void => {
        onPick(match);
      }}
      data-match-uuid={match.uuid}
      className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-pf-tertiary/20"
    >
      {match.img && (
        <img src={match.img} alt="" className="h-8 w-8 shrink-0 rounded border border-pf-border bg-pf-bg-dark" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-medium text-pf-text">{match.name}</span>
          {match.level !== undefined && (
            <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-pf-alt-dark">
              L{match.level}
            </span>
          )}
        </div>
        <div className="flex items-baseline justify-between gap-2 text-[10px] text-pf-alt">
          <span className="truncate">{match.packLabel}</span>
          {traitsSummary && <span className="truncate">{traitsSummary}</span>}
        </div>
      </div>
    </button>
  );
}
