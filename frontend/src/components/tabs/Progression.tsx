import type { ClassFeatureEntry, ClassItem, PreparedActorItem } from '../../api/types';
import { isClassItem } from '../../api/types';
import { SectionHeader } from '../common/SectionHeader';

interface Props {
  characterLevel: number;
  items: PreparedActorItem[];
}

// pf2e ability boosts happen at these fixed levels (4 boosts each). This
// is the only piece of the progression that isn't encoded on the class
// item itself (every other slot lives in `class.system.*FeatLevels`).
// See pf2e Core Rulebook "Advancing Your Character" (p.32).
const ABILITY_BOOST_LEVELS: readonly number[] = [5, 10, 15, 20];

// Levels every character can reach (pf2e core: 1-20).
const LEVELS: readonly number[] = Array.from({ length: 20 }, (_, i) => i + 1);

// Progression tab — vertical timeline of levels 1-20, each row showing
// the auto-granted class features at that level plus chips for every
// slot the pf2e rules open up (class feat, ancestry feat, skill feat,
// general feat, skill increase, ability boosts).
//
// Reads the character's class item from items[type='class'] and walks
// `class.system.items` + the `*FeatLevels` arrays to build each row.
// The current character level is highlighted; past levels are muted,
// future levels render as a normal preview.
//
// Read-only for now — this tab is the bridge into Phase 3 creator work,
// where the slot chips become clickable picks.
export function Progression({ characterLevel, items }: Props): React.ReactElement {
  const classItem = items.find(isClassItem);
  if (!classItem) {
    return <p className="text-sm text-pf-alt-dark">No class item on this character.</p>;
  }

  const sys = classItem.system;
  const featuresByLevel = groupFeaturesByLevel(sys.items);
  const levelSlots = buildLevelSlotMap(sys);

  return (
    <section className="space-y-4" data-section="progression">
      <div>
        <SectionHeader>{classItem.name} Progression</SectionHeader>
        <p className="mb-3 text-xs text-pf-alt">
          Class features auto-granted at each level, plus the feat and skill slots the rules open.
        </p>
      </div>
      <ol className="space-y-1.5">
        {LEVELS.map((level) => {
          const features = featuresByLevel.get(level) ?? [];
          const slots = levelSlots.get(level) ?? [];
          if (features.length === 0 && slots.length === 0 && level > characterLevel) {
            // Filler level with nothing to show — still render so the
            // ladder's cadence is visible.
            return <LevelRow key={level} level={level} characterLevel={characterLevel} features={[]} slots={[]} />;
          }
          return (
            <LevelRow key={level} level={level} characterLevel={characterLevel} features={features} slots={slots} />
          );
        })}
      </ol>
    </section>
  );
}

// ─── Row ───────────────────────────────────────────────────────────────

type LevelState = 'past' | 'current' | 'future';

function LevelRow({
  level,
  characterLevel,
  features,
  slots,
}: {
  level: number;
  characterLevel: number;
  features: ClassFeatureEntry[];
  slots: readonly SlotType[];
}): React.ReactElement {
  const state: LevelState = level < characterLevel ? 'past' : level === characterLevel ? 'current' : 'future';
  return (
    <li
      data-level={level}
      data-state={state}
      className={[
        'grid grid-cols-[3rem_1fr] items-start gap-3 rounded border px-3 py-2',
        state === 'current' ? 'border-pf-primary bg-pf-tertiary/30' : 'border-pf-border bg-white',
        state === 'past' ? 'opacity-60' : '',
      ].join(' ')}
    >
      <LevelBadge level={level} state={state} />
      <div className="min-w-0 space-y-1.5">
        {features.length > 0 && <FeatureList features={features} />}
        {slots.length > 0 && <SlotChips slots={slots} />}
        {features.length === 0 && slots.length === 0 && (
          <span className="text-xs italic text-pf-alt">No class features or new slots.</span>
        )}
      </div>
    </li>
  );
}

function LevelBadge({ level, state }: { level: number; state: LevelState }): React.ReactElement {
  return (
    <span
      className={[
        'flex h-8 w-12 items-center justify-center rounded border font-mono text-sm font-semibold tabular-nums',
        state === 'current'
          ? 'border-pf-primary bg-pf-primary text-white'
          : 'border-pf-border bg-pf-bg-dark text-pf-alt-dark',
      ].join(' ')}
      title={state === 'current' ? 'Current level' : state === 'past' ? 'Past level' : 'Upcoming level'}
    >
      L{level}
    </span>
  );
}

function FeatureList({ features }: { features: ClassFeatureEntry[] }): React.ReactElement {
  return (
    <ul className="flex flex-wrap gap-1.5" data-role="features">
      {features.map((f) => (
        <li
          key={f.uuid}
          className="inline-flex items-center gap-1.5 rounded border border-pf-border bg-white px-1.5 py-0.5 text-xs text-pf-text"
          data-feature-uuid={f.uuid}
        >
          <img src={f.img} alt="" className="h-4 w-4 rounded bg-pf-bg-dark" />
          <span className="truncate">{f.name}</span>
        </li>
      ))}
    </ul>
  );
}

// ─── Slot chips ────────────────────────────────────────────────────────

type SlotType = 'class-feat' | 'ancestry-feat' | 'skill-feat' | 'general-feat' | 'skill-increase' | 'ability-boosts';

const SLOT_LABEL: Record<SlotType, string> = {
  'class-feat': 'Class Feat',
  'ancestry-feat': 'Ancestry Feat',
  'skill-feat': 'Skill Feat',
  'general-feat': 'General Feat',
  'skill-increase': 'Skill Increase',
  'ability-boosts': 'Ability Boosts (4)',
};

const SLOT_CLASSES: Record<SlotType, string> = {
  'class-feat': 'border-pf-primary bg-pf-primary/10 text-pf-primary',
  'ancestry-feat': 'border-pf-secondary bg-pf-secondary/10 text-pf-secondary',
  'skill-feat': 'border-pf-alt-dark bg-pf-alt/10 text-pf-alt-dark',
  'general-feat': 'border-pf-tertiary-dark bg-pf-tertiary/40 text-pf-alt-dark',
  'skill-increase': 'border-pf-prof-expert bg-pf-prof-expert/10 text-pf-prof-expert',
  'ability-boosts': 'border-pf-rarity-unique bg-pf-rarity-unique/10 text-pf-rarity-unique',
};

function SlotChips({ slots }: { slots: readonly SlotType[] }): React.ReactElement {
  return (
    <ul className="flex flex-wrap gap-1" data-role="slots">
      {slots.map((slot) => (
        <li
          key={slot}
          data-slot={slot}
          className={[
            'rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
            SLOT_CLASSES[slot],
          ].join(' ')}
        >
          {SLOT_LABEL[slot]}
        </li>
      ))}
    </ul>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────

function groupFeaturesByLevel(items: ClassItem['system']['items']): Map<number, ClassFeatureEntry[]> {
  const out = new Map<number, ClassFeatureEntry[]>();
  for (const entry of Object.values(items)) {
    const arr = out.get(entry.level) ?? [];
    arr.push(entry);
    out.set(entry.level, arr);
  }
  for (const [, arr] of out) arr.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

function buildLevelSlotMap(sys: ClassItem['system']): Map<number, readonly SlotType[]> {
  // Render order for slots on a given level. Class feats come first because
  // they're the most character-defining; ability boosts last because they
  // collapse into a single "4 boosts" chip.
  const rules: Array<[SlotType, readonly number[]]> = [
    ['class-feat', sys.classFeatLevels.value],
    ['ancestry-feat', sys.ancestryFeatLevels.value],
    ['skill-feat', sys.skillFeatLevels.value],
    ['general-feat', sys.generalFeatLevels.value],
    ['skill-increase', sys.skillIncreaseLevels.value],
    ['ability-boosts', ABILITY_BOOST_LEVELS],
  ];
  const out = new Map<number, SlotType[]>();
  for (const [slot, levels] of rules) {
    for (const level of levels) {
      const arr = out.get(level) ?? [];
      arr.push(slot);
      out.set(level, arr);
    }
  }
  return out;
}
