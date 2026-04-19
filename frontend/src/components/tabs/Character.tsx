import type { AbilityKey, CharacterSystem, Save } from '../../api/types';
import { ABILITY_KEYS } from '../../api/types';
import { t } from '../../i18n/t';
import { formatSignedInt } from '../../lib/format';
import { RankChip } from '../common/RankChip';

interface Props {
  system: CharacterSystem;
}

// Character landing tab — ability scores, headline defensive/offensive
// stats, hero points, speeds, languages, traits. Ported in structure
// from pf2e's static/templates/actors/character/tabs/character.hbs, but
// read-only (no input widgets) and Tailwind-styled.
export function Character({ system }: Props): React.ReactElement {
  const keyAbility = system.details.keyability.value;
  const classDC = system.attributes.classDC;
  const landSpeed = system.movement.speeds.land;
  const xp = system.details.xp;

  return (
    <section className="space-y-6">
      <AbilityBlock abilities={system.abilities} keyAbility={keyAbility} />

      <StatsBlock system={system} />

      <HeroPoints value={system.resources.heroPoints.value} max={system.resources.heroPoints.max} />

      <MetaRow>
        <MetaItem label="XP">
          <XPBar value={xp.value} max={xp.max} pct={xp.pct} />
        </MetaItem>
        {landSpeed && (
          <MetaItem label="Speed">
            <span title={landSpeed.breakdown}>{landSpeed.value} ft</span>
          </MetaItem>
        )}
        <MetaItem label="Size">{humaniseSize(system.traits.size.value)}</MetaItem>
        {classDC && (
          <MetaItem label="Class DC">
            <span>
              <strong className="tabular-nums">{classDC.dc}</strong>{' '}
              <span className="text-neutral-500">({classDC.label})</span>
            </span>
          </MetaItem>
        )}
      </MetaRow>

      <ChipList label="Languages" items={system.details.languages.value.map(humaniseSlug)} />
      <ChipList label="Traits" items={system.traits.value.map(humaniseSlug)} />
    </section>
  );
}

// ─── Sub-sections ──────────────────────────────────────────────────────

function AbilityBlock({
  abilities,
  keyAbility,
}: {
  abilities: CharacterSystem['abilities'];
  keyAbility: AbilityKey;
}): React.ReactElement {
  return (
    <div>
      <SectionHeader>Ability Modifiers</SectionHeader>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {ABILITY_KEYS.map((ak) => {
          const a = abilities[ak];
          const isKey = ak === keyAbility;
          return (
            <li
              key={ak}
              data-attribute={ak}
              className={[
                'relative flex flex-col items-center rounded border px-2 py-3',
                isKey ? 'border-emerald-300 bg-emerald-50' : 'border-neutral-200 bg-white',
              ].join(' ')}
            >
              {isKey && (
                <span
                  className="absolute right-1 top-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-700"
                  title="Key attribute"
                >
                  KEY
                </span>
              )}
              <span className="text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
                {t(a.shortLabel)}
              </span>
              <span className="mt-0.5 font-mono text-2xl font-semibold tabular-nums text-neutral-900">
                {formatSignedInt(a.mod)}
              </span>
              <span className="text-[10px] text-neutral-500">{t(a.label)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function StatsBlock({ system }: { system: CharacterSystem }): React.ReactElement {
  const { ac, hp } = system.attributes;
  const { perception } = system;
  const saves = system.saves;

  return (
    <div>
      <SectionHeader>Key Stats</SectionHeader>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile label="AC" value={ac.value.toString()} title={ac.breakdown} />
        <StatTile
          label="HP"
          value={
            hp.temp > 0
              ? `${hp.value.toString()} (+${hp.temp.toString()})`
              : `${hp.value.toString()} / ${hp.max.toString()}`
          }
          title={hp.breakdown}
          data-stat="hp"
        />
        <StatTile
          label="Perception"
          value={formatSignedInt(perception.value)}
          title={perception.breakdown}
          rank={perception.rank}
          data-stat="perception"
        />
        {classDCTile(system)}
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2">
        <SaveTile save={saves.fortitude} />
        <SaveTile save={saves.reflex} />
        <SaveTile save={saves.will} />
      </div>
    </div>
  );
}

function classDCTile(system: CharacterSystem): React.ReactElement {
  const classDC = system.attributes.classDC;
  if (!classDC) return <StatTile label="Class DC" value="—" />;
  return (
    <StatTile
      label="Class DC"
      value={classDC.dc.toString()}
      title={classDC.breakdown}
      rank={classDC.rank}
      data-stat="class-dc"
    />
  );
}

function SaveTile({ save }: { save: Save }): React.ReactElement {
  return (
    <StatTile
      label={t(save.label)}
      value={formatSignedInt(save.value)}
      title={save.breakdown}
      rank={save.rank}
      data-stat={`save-${save.slug}`}
    />
  );
}

function StatTile({
  label,
  value,
  title,
  rank,
  ...rest
}: {
  label: string;
  value: string;
  title?: string;
  rank?: import('../../api/types').ProficiencyRank;
  'data-stat'?: string;
}): React.ReactElement {
  return (
    <div
      className="flex flex-col items-center rounded border border-neutral-200 bg-white px-3 py-2"
      title={title}
      {...rest}
    >
      <span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">{label}</span>
      <span className="mt-0.5 font-mono text-xl font-semibold tabular-nums text-neutral-900">{value}</span>
      {rank !== undefined && <RankChip rank={rank} className="mt-1" />}
    </div>
  );
}

function HeroPoints({ value, max }: { value: number; max: number }): React.ReactElement {
  return (
    <div className="flex items-center gap-3" data-stat="hero-points">
      <span className="text-[11px] font-semibold uppercase tracking-widest text-neutral-500">Hero Points</span>
      <div className="flex gap-1" aria-label={`${value.toString()} of ${max.toString()}`}>
        {Array.from({ length: max }, (_, i) => (
          <span
            key={i}
            className={[
              'inline-block h-3 w-3 rounded-full border',
              i < value ? 'border-rose-400 bg-rose-500' : 'border-neutral-300 bg-white',
            ].join(' ')}
          />
        ))}
      </div>
      <span className="font-mono text-xs tabular-nums text-neutral-500">
        {value}/{max}
      </span>
    </div>
  );
}

function MetaRow({ children }: { children: React.ReactNode }): React.ReactElement {
  return <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">{children}</div>;
}

function XPBar({ value, max, pct }: { value: number; max: number; pct: number }): React.ReactElement {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <span className="flex items-center gap-2" data-stat="xp">
      <span className="font-mono tabular-nums text-neutral-900">
        {value} / {max}
      </span>
      <span
        className="inline-block h-1.5 w-16 overflow-hidden rounded bg-neutral-200"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        title={`${clamped.toString()}% to next level`}
      >
        <span className="block h-full bg-emerald-500" style={{ width: `${clamped.toString()}%` }} />
      </span>
    </span>
  );
}

function MetaItem({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">{label}</span>
      <span className="text-neutral-900">{children}</span>
    </div>
  );
}

function ChipList({ label, items }: { label: string; items: string[] }): React.ReactElement | null {
  if (items.length === 0) return null;
  return (
    <div data-section={label.toLowerCase()}>
      <SectionHeader>{label}</SectionHeader>
      <ul className="flex flex-wrap gap-1.5">
        {items.map((it) => (
          <li
            key={it}
            className="rounded-full border border-neutral-300 bg-neutral-50 px-2.5 py-0.5 text-xs text-neutral-700"
          >
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <h2 className="mb-2 border-b border-neutral-300 pb-1 text-sm font-semibold uppercase tracking-wide text-neutral-700">
      {children}
    </h2>
  );
}

function humaniseSlug(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function humaniseSize(size: string): string {
  const map: Record<string, string> = {
    tiny: 'Tiny',
    sm: 'Small',
    med: 'Medium',
    lg: 'Large',
    huge: 'Huge',
    grg: 'Gargantuan',
  };
  return map[size] ?? humaniseSlug(size);
}
