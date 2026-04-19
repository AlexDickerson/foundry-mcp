import { useState } from 'react';
import type { ClassFeatureEntry, ClassItem, CompendiumMatch, PreparedActorItem } from '../../api/types';
import { isClassItem } from '../../api/types';
import { SectionHeader } from '../common/SectionHeader';
import { FeatPicker } from '../creator/FeatPicker';

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

// Slot-key for the selection map. One level can open several slot types,
// and each could eventually have its own pick (two class feats at L12,
// a class feat + skill feat at L2, etc.), so we key by `${level}:${slot}`.
type SlotKey = string;
const slotKey = (level: number, slot: SlotType): SlotKey => `${level.toString()}:${slot}`;

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
// Class-feat slots are clickable — they open a compendium-search modal
// (FeatPicker) scoped to the character's class trait and capped at the
// slot's level. Picks are held in local state for now; the scratch-actor
// mutation flow comes later.
export function Progression({ characterLevel, items }: Props): React.ReactElement {
  const classItem = items.find(isClassItem);
  const [picks, setPicks] = useState<Map<SlotKey, CompendiumMatch>>(new Map());
  const [pickerTarget, setPickerTarget] = useState<{ level: number; slot: SlotType } | null>(null);

  if (!classItem) {
    return <p className="text-sm text-pf-alt-dark">No class item on this character.</p>;
  }

  const sys = classItem.system;
  const classTrait = sys.slug ?? classItem.name.toLowerCase();
  const featuresByLevel = groupFeaturesByLevel(sys.items);
  const levelSlots = buildLevelSlotMap(sys);

  const openPicker = (level: number, slot: SlotType): void => {
    setPickerTarget({ level, slot });
  };
  const closePicker = (): void => {
    setPickerTarget(null);
  };
  const commitPick = (match: CompendiumMatch): void => {
    if (!pickerTarget) return;
    const key = slotKey(pickerTarget.level, pickerTarget.slot);
    setPicks((prev) => {
      const next = new Map(prev);
      next.set(key, match);
      return next;
    });
    setPickerTarget(null);
  };
  const clearPick = (level: number, slot: SlotType): void => {
    setPicks((prev) => {
      const next = new Map(prev);
      next.delete(slotKey(level, slot));
      return next;
    });
  };

  return (
    <section className="space-y-4" data-section="progression">
      <div>
        <SectionHeader>{classItem.name} Progression</SectionHeader>
        <p className="mb-3 text-xs text-pf-alt">
          Class features auto-granted at each level, plus the feat and skill slots the rules open. Click a Class Feat
          chip to pick one; selections are held in memory until the scratch-actor flow lands.
        </p>
      </div>
      <ol className="space-y-1.5">
        {LEVELS.map((level) => {
          const features = featuresByLevel.get(level) ?? [];
          const slots = levelSlots.get(level) ?? [];
          return (
            <LevelRow
              key={level}
              level={level}
              characterLevel={characterLevel}
              features={features}
              slots={slots}
              picks={picks}
              onOpenPicker={openPicker}
              onClearPick={clearPick}
            />
          );
        })}
      </ol>
      {pickerTarget && pickerTarget.slot === 'class-feat' && (
        <FeatPicker
          title={`Pick a Class Feat (Level ${pickerTarget.level.toString()})`}
          filters={{
            packId: 'pf2e.feats-srd',
            documentType: 'Item',
            traits: [classTrait],
            maxLevel: pickerTarget.level,
          }}
          onPick={commitPick}
          onClose={closePicker}
        />
      )}
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
  picks,
  onOpenPicker,
  onClearPick,
}: {
  level: number;
  characterLevel: number;
  features: ClassFeatureEntry[];
  slots: readonly SlotType[];
  picks: Map<SlotKey, CompendiumMatch>;
  onOpenPicker: (level: number, slot: SlotType) => void;
  onClearPick: (level: number, slot: SlotType) => void;
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
        {slots.length > 0 && (
          <SlotChips level={level} slots={slots} picks={picks} onOpenPicker={onOpenPicker} onClearPick={onClearPick} />
        )}
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

const CLICKABLE_SLOTS: ReadonlySet<SlotType> = new Set(['class-feat']);

function SlotChips({
  level,
  slots,
  picks,
  onOpenPicker,
  onClearPick,
}: {
  level: number;
  slots: readonly SlotType[];
  picks: Map<SlotKey, CompendiumMatch>;
  onOpenPicker: (level: number, slot: SlotType) => void;
  onClearPick: (level: number, slot: SlotType) => void;
}): React.ReactElement {
  return (
    <ul className="flex flex-wrap gap-1" data-role="slots">
      {slots.map((slot) => {
        const pick = picks.get(slotKey(level, slot));
        if (pick) {
          return (
            <li key={slot} data-slot={slot} data-pick-uuid={pick.uuid}>
              <PickedChip
                slot={slot}
                pick={pick}
                onClear={(): void => {
                  onClearPick(level, slot);
                }}
              />
            </li>
          );
        }
        if (CLICKABLE_SLOTS.has(slot)) {
          return (
            <li key={slot} data-slot={slot}>
              <button
                type="button"
                onClick={(): void => {
                  onOpenPicker(level, slot);
                }}
                className={[
                  'rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                  SLOT_CLASSES[slot],
                  'hover:brightness-95',
                ].join(' ')}
                data-testid="slot-open-picker"
              >
                + {SLOT_LABEL[slot]}
              </button>
            </li>
          );
        }
        return (
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
        );
      })}
    </ul>
  );
}

function PickedChip({
  slot,
  pick,
  onClear,
}: {
  slot: SlotType;
  pick: CompendiumMatch;
  onClear: () => void;
}): React.ReactElement {
  return (
    <span
      className="inline-flex items-center gap-1 rounded border border-pf-border bg-white pl-1 pr-0.5 text-[11px] text-pf-text"
      title={`${SLOT_LABEL[slot]}: ${pick.name}`}
    >
      {pick.img && <img src={pick.img} alt="" className="h-4 w-4 rounded bg-pf-bg-dark" />}
      <span className="max-w-[16ch] truncate">{pick.name}</span>
      <button
        type="button"
        aria-label={`Clear ${SLOT_LABEL[slot]} pick`}
        onClick={onClear}
        className="ml-0.5 rounded px-1 text-pf-alt-dark hover:bg-pf-bg-dark hover:text-pf-primary"
      >
        ×
      </button>
    </span>
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
