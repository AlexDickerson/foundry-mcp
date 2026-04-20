import type { PreparedActorItem, SpellItem, SpellcastingEntryItem } from '../../api/types';
import { isCantripSpell, isSpellItem, isSpellcastingEntryItem } from '../../api/types';
import { enrichDescription } from '../../lib/foundry-enrichers';
import { useUuidHover } from '../../lib/useUuidHover';
import { SectionHeader } from '../common/SectionHeader';

interface Props {
  items: PreparedActorItem[];
}

// Spells tab — read-only view of the character's spellcastingEntry +
// spell items, grouped by entry then by rank (cantrips first). Slot
// counts, prepared/spontaneous daily prep, and heightening choices are
// intentionally out of scope; those stay on the Foundry sheet for now.
export function Spells({ items }: Props): React.ReactElement {
  // Hook first — must run on every render regardless of empty-state.
  const uuidHover = useUuidHover();
  const entries = items.filter(isSpellcastingEntryItem);
  const spells = items.filter(isSpellItem);

  if (entries.length === 0 && spells.length === 0) {
    return <p className="text-sm text-neutral-500">No spellcasting.</p>;
  }

  const byEntry = new Map<string, SpellItem[]>();
  const orphans: SpellItem[] = [];
  const entryIds = new Set(entries.map((e) => e.id));
  for (const spell of spells) {
    const loc = spell.system.location?.value ?? null;
    if (loc !== null && entryIds.has(loc)) {
      const arr = byEntry.get(loc) ?? [];
      arr.push(spell);
      byEntry.set(loc, arr);
    } else {
      orphans.push(spell);
    }
  }

  return (
    <section
      className="space-y-8"
      onMouseOver={uuidHover.delegationHandlers.onMouseOver}
      onMouseOut={uuidHover.delegationHandlers.onMouseOut}
    >
      {entries.map((entry) => (
        <EntryBlock key={entry.id} entry={entry} spells={byEntry.get(entry.id) ?? []} />
      ))}
      {orphans.length > 0 && (
        <div data-testid="spells-orphans">
          <SectionHeader>Orphaned Spells</SectionHeader>
          <RankedSpellList spells={orphans} />
        </div>
      )}
      {uuidHover.popover}
    </section>
  );
}

function EntryBlock({
  entry,
  spells,
}: {
  entry: SpellcastingEntryItem;
  spells: SpellItem[];
}): React.ReactElement {
  const traditionRaw = entry.system.tradition?.value;
  const tradition = typeof traditionRaw === 'string' && traditionRaw !== '' ? traditionRaw : null;
  const prepRaw: string | undefined = entry.system.prepared?.value;
  const prep = typeof prepRaw === 'string' && prepRaw.length > 0 ? prepRaw : null;
  const flexible = entry.system.prepared?.flexible === true;
  const meta = [
    tradition !== null ? capitalise(tradition) : null,
    prep !== null ? (flexible ? `Flexible ${capitalise(prep)}` : capitalise(prep)) : null,
  ].filter((s): s is string => s !== null);
  return (
    <div data-spellcasting-entry-id={entry.id}>
      <div className="mb-2 flex flex-wrap items-baseline gap-x-2 border-b border-pf-border pb-1">
        <h2 className="font-serif text-base font-semibold text-pf-text">{entry.name}</h2>
        {meta.length > 0 && (
          <span className="text-[10px] uppercase tracking-widest text-pf-alt-dark">{meta.join(' · ')}</span>
        )}
      </div>
      {spells.length === 0 ? (
        <p className="text-xs italic text-neutral-400">No spells.</p>
      ) : (
        <RankedSpellList spells={spells} />
      )}
    </div>
  );
}

function RankedSpellList({ spells }: { spells: SpellItem[] }): React.ReactElement {
  const cantrips = spells.filter(isCantripSpell);
  const regular = spells.filter((s) => !isCantripSpell(s));

  const byRank = new Map<number, SpellItem[]>();
  for (const s of regular) {
    const arr = byRank.get(effectiveRank(s)) ?? [];
    arr.push(s);
    byRank.set(effectiveRank(s), arr);
  }
  const ranks = [...byRank.keys()].sort((a, b) => a - b);

  const sortByName = (a: SpellItem, b: SpellItem): number => a.name.localeCompare(b.name);

  return (
    <div className="space-y-4">
      {cantrips.length > 0 && <RankGroup label="Cantrips" spells={[...cantrips].sort(sortByName)} />}
      {ranks.map((r) => (
        <RankGroup key={r} label={`${ordinal(r)}-Rank Spells`} spells={[...(byRank.get(r) ?? [])].sort(sortByName)} />
      ))}
    </div>
  );
}

function RankGroup({ label, spells }: { label: string; spells: SpellItem[] }): React.ReactElement {
  return (
    <div data-spell-rank={label}>
      <h3 className="mb-1 font-serif text-xs font-semibold uppercase tracking-widest text-pf-alt-dark">{label}</h3>
      <ul className="space-y-1">
        {spells.map((spell) => (
          <SpellCard key={spell.id} spell={spell} />
        ))}
      </ul>
    </div>
  );
}

function SpellCard({ spell }: { spell: SpellItem }): React.ReactElement {
  const traitsRaw = spell.system.traits?.value;
  const traits = Array.isArray(traitsRaw) ? traitsRaw.filter((t) => t !== 'cantrip') : [];
  const castCost = formatCastCost(spell.system.time?.value);
  const description = spell.system.description?.value ?? '';
  const enriched = description.length > 0 ? enrichDescription(description) : '';

  return (
    <li
      className="rounded border border-pf-border bg-white"
      data-item-id={spell.id}
      data-spell-slug={spell.system.slug ?? ''}
    >
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 hover:bg-pf-bg-dark/40">
          <img src={spell.img} alt="" className="h-6 w-6 flex-shrink-0 rounded border border-pf-border bg-pf-bg-dark" />
          <span className="truncate text-sm font-medium text-pf-text">{spell.name}</span>
          {castCost !== null && (
            <span
              className="flex-shrink-0 rounded border border-pf-border bg-pf-bg px-1 font-mono text-[10px] text-pf-alt-dark"
              aria-label={`Cast ${castCost}`}
            >
              {castCost}
            </span>
          )}
          {traits.length > 0 && (
            <ul className="flex flex-wrap gap-1">
              {traits.slice(0, 6).map((t) => (
                <li
                  key={t}
                  className="rounded-full border border-pf-tertiary-dark bg-pf-tertiary/40 px-1.5 py-0.5 text-[10px] text-pf-alt-dark"
                >
                  {capitaliseSlug(t)}
                </li>
              ))}
            </ul>
          )}
          <span className="ml-auto text-[10px] text-pf-alt-dark group-open:hidden">▸</span>
          <span className="ml-auto hidden text-[10px] text-pf-alt-dark group-open:inline">▾</span>
        </summary>
        <div className="border-t border-pf-border bg-pf-bg/60 px-3 py-2 text-sm text-pf-text">
          <SpellMeta spell={spell} />
          {enriched.length > 0 ? (
            <div
              className="mt-2 leading-relaxed [&_.pf-damage]:font-semibold [&_.pf-damage]:text-pf-primary [&_.pf-template]:italic [&_.pf-template]:text-pf-secondary [&_a]:cursor-pointer [&_a]:text-pf-primary [&_a]:underline [&_p]:my-2"
              dangerouslySetInnerHTML={{ __html: enriched }}
            />
          ) : (
            <p className="mt-2 italic text-neutral-400">No description.</p>
          )}
        </div>
      </details>
    </li>
  );
}

function SpellMeta({ spell }: { spell: SpellItem }): React.ReactElement | null {
  const range = nonEmpty(spell.system.range?.value);
  const area = formatArea(spell.system.area);
  const target = nonEmpty(spell.system.target?.value);
  const parts: Array<[string, string]> = [];
  if (range !== null) parts.push(['Range', range]);
  if (area !== null) parts.push(['Area', area]);
  if (target !== null) parts.push(['Targets', target]);
  if (parts.length === 0) return null;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-pf-alt-dark">
      {parts.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="font-semibold uppercase tracking-widest">{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────

// The rank a spell is actually cast/slotted at. For prepared slots and
// spontaneous repertoire entries, pf2e stores the slot's rank in
// `location.heightenedLevel`; fall back to the spell's base rank.
function effectiveRank(spell: SpellItem): number {
  const heightened = spell.system.location?.heightenedLevel;
  if (typeof heightened === 'number' && heightened > 0) return heightened;
  const base = spell.system.level?.value;
  return typeof base === 'number' ? base : 0;
}

function formatCastCost(time: string | undefined): string | null {
  if (time === undefined || time === '') return null;
  if (time === '1') return '◆';
  if (time === '2') return '◆◆';
  if (time === '3') return '◆◆◆';
  if (time === 'reaction') return '↺';
  if (time === 'free') return '◇';
  return time;
}

function formatArea(area: SpellItem['system']['area']): string | null {
  if (area === undefined || area === null) return null;
  const { value, type } = area;
  if (value === undefined || value === '' || value === 0) return null;
  const v = typeof value === 'number' ? `${value.toString()}-foot` : String(value);
  return type !== undefined && type !== '' ? `${v} ${type}` : v;
}

function nonEmpty(s: string | undefined): string | null {
  return s !== undefined && s.trim() !== '' ? s : null;
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function capitaliseSlug(s: string): string {
  return s
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n.toString()}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}
