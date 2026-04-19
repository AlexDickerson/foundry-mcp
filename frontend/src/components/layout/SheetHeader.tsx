import type { PreparedCharacter } from '../../api/types';

interface Props {
  character: PreparedCharacter;
}

const RARITY_CLASSES: Record<string, string> = {
  uncommon: 'border-amber-400 bg-amber-50 text-amber-800',
  rare: 'border-sky-400 bg-sky-50 text-sky-800',
  unique: 'border-violet-400 bg-violet-50 text-violet-800',
};

const ALLIANCE_CLASSES: Record<string, string> = {
  party: 'border-emerald-400 bg-emerald-50 text-emerald-800',
  opposition: 'border-red-400 bg-red-50 text-red-800',
};

// Identity band at the top of the character sheet: name + level +
// ancestry/heritage/class/background, plus rarity/alliance badges.
// Ported in spirit from pf2e's
// static/templates/actors/character/partials/header.hbs but
// render-only (no name/level inputs, no XP bar).
export function SheetHeader({ character }: Props): React.ReactElement {
  const { name, system, items } = character;
  const level = system.details.level.value;
  const ancestry = system.details.ancestry?.name;
  const heritage = system.details.heritage?.name;
  const cls = system.details.class?.name;
  // Background lives as an item (type='background'); pf2e doesn't
  // surface it under system.details.
  const background = items.find((i) => i.type === 'background')?.name;
  const rarity = system.traits.rarity;
  const alliance = system.details.alliance;

  const identity = [heritage, ancestry].filter(Boolean).join(' ');
  const subtitle = [`Level ${level.toString()}`, cls, background, identity].filter(Boolean).join(' · ');

  return (
    <header className="mb-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-xl font-semibold text-neutral-900">{name}</h1>
        {rarity && rarity !== 'common' && (
          <Badge data-badge="rarity" label={capitalise(rarity)} className={RARITY_CLASSES[rarity] ?? ''} />
        )}
        {alliance && (
          <Badge data-badge="alliance" label={capitalise(alliance)} className={ALLIANCE_CLASSES[alliance] ?? ''} />
        )}
      </div>
      {subtitle && (
        <p className="mt-0.5 text-sm text-neutral-500" data-section="identity">
          {subtitle}
        </p>
      )}
    </header>
  );
}

function Badge({
  label,
  className,
  ...rest
}: {
  label: string;
  className: string;
  'data-badge'?: string;
}): React.ReactElement {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${className}`}
      {...rest}
    >
      {label}
    </span>
  );
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
