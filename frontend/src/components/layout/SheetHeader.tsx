import type { PreparedCharacter } from '../../api/types';

interface Props {
  character: PreparedCharacter;
}

// Identity band at the top of the character sheet: name + level +
// ancestry/heritage/class. Ported in spirit from pf2e's
// static/templates/actors/character/partials/header.hbs but
// render-only (no name/level inputs, no XP bar).
export function SheetHeader({ character }: Props): React.ReactElement {
  const { name, system } = character;
  const level = system.details.level.value;
  const ancestry = system.details.ancestry?.name;
  const heritage = system.details.heritage?.name;
  const cls = system.details.class?.name;

  const identity = [heritage, ancestry].filter(Boolean).join(' ');
  const subtitle = [`Level ${level.toString()}`, cls, identity].filter(Boolean).join(' · ');

  return (
    <header className="mb-4">
      <h1 className="text-xl font-semibold text-neutral-900">{name}</h1>
      {subtitle && <p className="mt-0.5 text-sm text-neutral-500">{subtitle}</p>}
    </header>
  );
}
