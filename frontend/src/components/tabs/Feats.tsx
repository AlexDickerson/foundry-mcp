import type { FeatCategory, FeatItem, PreparedActorItem } from '../../api/types';
import { isFeatItem } from '../../api/types';
import { FEAT_CATEGORY_LABEL, FEAT_CATEGORY_ORDER } from '../../lib/pf2e-maps';
import { SectionHeader } from '../common/SectionHeader';

interface Props {
  items: PreparedActorItem[];
}

// Canonical categories that always render a section, empty or not — so
// the reader can see which slots exist even when unfilled (in particular
// Bonus Feats, which many low-level characters don't have yet).
// `pfsboon` stays hidden when empty since it only matters for organized
// play.
const ALWAYS_SHOW: readonly FeatCategory[] = ['ancestry', 'class', 'classfeature', 'skill', 'general', 'bonus'];

// Feats tab — groups character's feat items by `system.category`, ordered
// to roughly match how pf2e's sheet lays them out. Canonical categories
// render even when empty to advertise the slot.
export function Feats({ items }: Props): React.ReactElement {
  const feats = items.filter(isFeatItem);
  const grouped = groupByCategory(feats);

  return (
    <section className="space-y-6">
      {FEAT_CATEGORY_ORDER.map((category) => {
        const inCategory = grouped.get(category) ?? [];
        const isCanonical = ALWAYS_SHOW.includes(category);
        if (inCategory.length === 0 && !isCanonical) return null;
        return (
          <div key={category} data-feat-category={category}>
            <SectionHeader>{FEAT_CATEGORY_LABEL[category] ?? category}</SectionHeader>
            {inCategory.length === 0 ? (
              <p className="text-xs italic text-neutral-400">None yet</p>
            ) : (
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {inCategory.map((feat) => (
                  <FeatCard key={feat.id} feat={feat} />
                ))}
              </ul>
            )}
          </div>
        );
      })}
      {renderUnknownCategories(grouped)}
    </section>
  );
}

function FeatCard({ feat }: { feat: FeatItem }): React.ReactElement {
  const level = feat.system.level.value;
  const traits = feat.system.traits.value.filter((t) => t !== feat.system.category);
  return (
    <li
      className="flex items-start gap-3 rounded border border-pf-border bg-white px-3 py-2"
      data-item-id={feat.id}
      data-feat-slug={feat.system.slug ?? ''}
    >
      <img
        src={feat.img}
        alt=""
        className="mt-0.5 h-8 w-8 flex-shrink-0 rounded border border-pf-border bg-pf-bg-dark"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-medium text-pf-text">{feat.name}</span>
          <span className="flex-shrink-0 font-mono text-[10px] uppercase tracking-widest text-pf-alt-dark">
            Lv {level}
          </span>
        </div>
        {traits.length > 0 && <TraitChips traits={traits} />}
      </div>
    </li>
  );
}

function TraitChips({ traits }: { traits: string[] }): React.ReactElement {
  return (
    <ul className="mt-1 flex flex-wrap gap-1">
      {traits.map((t) => (
        <li
          key={t}
          className="rounded-full border border-pf-tertiary-dark bg-pf-tertiary/40 px-1.5 py-0.5 text-[10px] text-pf-alt-dark"
        >
          {capitaliseSlug(t)}
        </li>
      ))}
    </ul>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────

function groupByCategory(feats: FeatItem[]): Map<string, FeatItem[]> {
  const out = new Map<string, FeatItem[]>();
  for (const feat of feats) {
    const arr = out.get(feat.system.category) ?? [];
    arr.push(feat);
    out.set(feat.system.category, arr);
  }
  // Sort within each group by level asc, then name.
  for (const [, arr] of out) {
    arr.sort((a, b) => a.system.level.value - b.system.level.value || a.name.localeCompare(b.name));
  }
  return out;
}

function renderUnknownCategories(grouped: Map<string, FeatItem[]>): React.ReactElement | null {
  const known = new Set(FEAT_CATEGORY_ORDER);
  const extras = Array.from(grouped.entries()).filter(([cat]) => !known.has(cat));
  if (extras.length === 0) return null;
  return (
    <>
      {extras.map(([category, feats]) => (
        <div key={category} data-feat-category={category}>
          <SectionHeader>{FEAT_CATEGORY_LABEL[category] ?? capitaliseSlug(category)}</SectionHeader>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {feats.map((feat) => (
              <FeatCard key={feat.id} feat={feat} />
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}

function capitaliseSlug(s: string): string {
  return s
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
