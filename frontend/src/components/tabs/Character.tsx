import type { AbilityKey, CharacterSystem, IWREntry, Save, Speed } from '../../api/types';
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
  const speeds = populatedSpeeds(system.movement.speeds);
  const xp = system.details.xp;

  return (
    <section className="space-y-6">
      <AbilityBlock abilities={system.abilities} keyAbility={keyAbility} />

      <StatsBlock system={system} />

      <ConditionsRow
        dying={system.attributes.dying}
        wounded={system.attributes.wounded}
        doomed={system.attributes.doomed}
      />

      <ResourcesRow resources={system.resources} />

      <MetaRow>
        <MetaItem label="XP">
          <XPBar value={xp.value} max={xp.max} pct={xp.pct} />
        </MetaItem>
        {speeds.length > 0 && (
          <MetaItem label="Speed">
            <SpeedList speeds={speeds} />
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

      <IWRBlock
        immunities={system.attributes.immunities}
        weaknesses={system.attributes.weaknesses}
        resistances={system.attributes.resistances}
      />

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
  const { perception, initiative } = system;
  const saves = system.saves;

  return (
    <div>
      <SectionHeader>Key Stats</SectionHeader>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
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
        <StatTile
          label="Initiative"
          value={formatSignedInt(initiative.value)}
          title={initiative.breakdown}
          data-stat="initiative"
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

function ResourcesRow({ resources }: { resources: CharacterSystem['resources'] }): React.ReactElement {
  const { heroPoints, focus, investiture, mythicPoints } = resources;
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
      <PipResource
        label="Hero Points"
        value={heroPoints.value}
        max={heroPoints.max}
        colorOn="border-rose-400 bg-rose-500"
        data-stat="hero-points"
      />
      {focus.max > 0 && (
        <PipResource
          label="Focus"
          value={focus.value}
          max={focus.max}
          colorOn="border-indigo-400 bg-indigo-500"
          title={`Cap ${focus.cap.toString()}`}
          data-stat="focus"
        />
      )}
      {mythicPoints.max > 0 && (
        <PipResource
          label="Mythic"
          value={mythicPoints.value}
          max={mythicPoints.max}
          colorOn="border-amber-400 bg-amber-500"
          data-stat="mythic-points"
        />
      )}
      {investiture.max > 0 && (
        <CountResource label="Invested" value={investiture.value} max={investiture.max} data-stat="investiture" />
      )}
    </div>
  );
}

function PipResource({
  label,
  value,
  max,
  colorOn,
  title,
  ...rest
}: {
  label: string;
  value: number;
  max: number;
  colorOn: string;
  title?: string;
  'data-stat'?: string;
}): React.ReactElement {
  return (
    <div className="flex items-center gap-2" title={title} {...rest}>
      <span className="text-[11px] font-semibold uppercase tracking-widest text-neutral-500">{label}</span>
      <div className="flex gap-1" aria-label={`${value.toString()} of ${max.toString()}`}>
        {Array.from({ length: max }, (_, i) => (
          <span
            key={i}
            className={[
              'inline-block h-3 w-3 rounded-full border',
              i < value ? colorOn : 'border-neutral-300 bg-white',
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

function CountResource({
  label,
  value,
  max,
  ...rest
}: {
  label: string;
  value: number;
  max: number;
  'data-stat'?: string;
}): React.ReactElement {
  return (
    <div className="flex items-center gap-2" {...rest}>
      <span className="text-[11px] font-semibold uppercase tracking-widest text-neutral-500">{label}</span>
      <span className="font-mono text-sm tabular-nums text-neutral-900">
        {value}
        <span className="text-neutral-400">/{max}</span>
      </span>
    </div>
  );
}

function ConditionsRow({
  dying,
  wounded,
  doomed,
}: {
  dying: CharacterSystem['attributes']['dying'];
  wounded: CharacterSystem['attributes']['wounded'];
  doomed: CharacterSystem['attributes']['doomed'];
}): React.ReactElement {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2" data-section="conditions">
      <Condition
        label="Dying"
        value={dying.value}
        max={dying.max}
        colorOn="border-red-500 bg-red-600"
        title={`Recovery DC ${dying.recoveryDC.toString()}`}
        data-stat="dying"
      />
      <Condition
        label="Wounded"
        value={wounded.value}
        max={wounded.max}
        colorOn="border-amber-500 bg-amber-600"
        data-stat="wounded"
      />
      <Condition
        label="Doomed"
        value={doomed.value}
        max={doomed.max}
        colorOn="border-violet-500 bg-violet-700"
        data-stat="doomed"
      />
    </div>
  );
}

function Condition({
  label,
  value,
  max,
  colorOn,
  title,
  ...rest
}: {
  label: string;
  value: number;
  max: number;
  colorOn: string;
  title?: string;
  'data-stat'?: string;
}): React.ReactElement {
  return (
    <div className="flex items-center gap-2" title={title} {...rest}>
      <span className="text-[11px] font-semibold uppercase tracking-widest text-neutral-500">{label}</span>
      <div className="flex gap-1" aria-label={`${value.toString()} of ${max.toString()}`}>
        {Array.from({ length: max }, (_, i) => (
          <span
            key={i}
            className={[
              'inline-block h-2.5 w-2.5 rounded-sm border',
              i < value ? colorOn : 'border-neutral-300 bg-white',
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

const SPEED_LABELS: Record<string, string> = {
  land: 'Land',
  burrow: 'Burrow',
  climb: 'Climb',
  fly: 'Fly',
  swim: 'Swim',
  travel: 'Travel',
};

function populatedSpeeds(speeds: CharacterSystem['movement']['speeds']): Array<{ key: string; speed: Speed }> {
  const order: (keyof CharacterSystem['movement']['speeds'])[] = ['land', 'burrow', 'climb', 'fly', 'swim', 'travel'];
  const out: Array<{ key: string; speed: Speed }> = [];
  for (const key of order) {
    const s = speeds[key];
    if (s) out.push({ key, speed: s });
  }
  return out;
}

function SpeedList({ speeds }: { speeds: Array<{ key: string; speed: Speed }> }): React.ReactElement {
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5" data-section="speeds">
      {speeds.map(({ key, speed }, idx) => (
        <span key={key} className="inline-flex items-center gap-1" data-speed={key} title={speed.breakdown}>
          <span className="tabular-nums">{speed.value} ft</span>
          <span className="text-xs text-neutral-500">{SPEED_LABELS[key] ?? humaniseSlug(key)}</span>
          {idx < speeds.length - 1 && <span className="text-neutral-300">·</span>}
        </span>
      ))}
    </span>
  );
}

function IWRBlock({
  immunities,
  weaknesses,
  resistances,
}: {
  immunities: IWREntry[];
  weaknesses: IWREntry[];
  resistances: IWREntry[];
}): React.ReactElement | null {
  if (immunities.length === 0 && weaknesses.length === 0 && resistances.length === 0) return null;
  return (
    <div data-section="iwr" className="space-y-2">
      <SectionHeader>Defenses</SectionHeader>
      <IWRRow label="Immunities" entries={immunities} />
      <IWRRow label="Weaknesses" entries={weaknesses} />
      <IWRRow label="Resistances" entries={resistances} />
    </div>
  );
}

function IWRRow({ label, entries }: { label: string; entries: IWREntry[] }): React.ReactElement | null {
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5" data-iwr={label.toLowerCase()}>
      <span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">{label}</span>
      {entries.map((e, i) => (
        <span
          key={`${e.type}-${i.toString()}`}
          className="rounded-full border border-neutral-300 bg-neutral-50 px-2.5 py-0.5 text-xs text-neutral-700"
          title={e.exceptions?.length ? `except ${e.exceptions.join(', ')}` : undefined}
        >
          {humaniseSlug(e.type)}
          {e.value !== undefined ? ` ${e.value.toString()}` : ''}
        </span>
      ))}
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
