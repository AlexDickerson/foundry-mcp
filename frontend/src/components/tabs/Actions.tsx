import type { Strike } from '../../api/types';

interface Props {
  actions: Strike[];
}

// Actions tab — strike list only for now. pf2e's full actions tab also
// has Encounter/Exploration/Downtime sub-tabs (action macros), but those
// require item.type === "action" rendering which has its own data shape;
// we'll tackle that in a later PR. Strikes are the high-value bit for
// combat-time sheet reading.
export function Actions({ actions }: Props): React.ReactElement {
  const strikes = actions.filter((a) => a.type === 'strike' && a.visible);
  if (strikes.length === 0) {
    return <p className="text-sm text-neutral-500">No strikes available.</p>;
  }
  return (
    <section className="space-y-6">
      <div>
        <SectionHeader>Strikes</SectionHeader>
        <ul className="space-y-2">
          {strikes.map((strike) => (
            <StrikeCard key={strike.slug} strike={strike} />
          ))}
        </ul>
      </div>
    </section>
  );
}

function StrikeCard({ strike }: { strike: Strike }): React.ReactElement {
  const allTraits = [...strike.traits, ...strike.weaponTraits];
  const damage = strike.item.system.damage;
  const damageText = damage ? `${damage.dice.toString()}${damage.die} ${damage.damageType}` : null;
  const range = strike.item.system.range;

  return (
    <li
      className="rounded border border-neutral-200 bg-white p-3"
      data-strike-slug={strike.slug}
      data-ready={strike.ready ? 'true' : 'false'}
    >
      <div className="flex items-start gap-3">
        <img
          src={strike.item.img}
          alt=""
          className="h-10 w-10 flex-shrink-0 rounded border border-neutral-200 bg-neutral-50"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-medium text-neutral-900">
              {strike.label}
              {strike.quantity > 1 && (
                <span className="ml-2 text-xs font-normal text-neutral-500">×{strike.quantity}</span>
              )}
            </span>
            {damageText !== null && (
              <span className="flex-shrink-0 font-mono text-xs tabular-nums text-neutral-500">{damageText}</span>
            )}
          </div>
          <VariantStrip variants={strike.variants} />
          {allTraits.length > 0 && <TraitChips traits={allTraits} />}
          {range !== null && range !== undefined && (
            <p className="mt-1 text-[10px] text-neutral-500">
              Range: {range} ft {strike.item.system.damage?.damageType ? '' : ''}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

function VariantStrip({ variants }: { variants: { label: string }[] }): React.ReactElement {
  return (
    <ul className="mt-1 flex flex-wrap gap-1.5" role="group" aria-label="Attack variants">
      {variants.map((v, i) => (
        <li
          key={`${i.toString()}-${v.label}`}
          className={[
            'rounded border px-1.5 py-0.5 font-mono text-xs tabular-nums',
            i === 0
              ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
              : 'border-neutral-200 bg-neutral-50 text-neutral-700',
          ].join(' ')}
        >
          {v.label}
        </li>
      ))}
    </ul>
  );
}

function TraitChips({ traits }: { traits: { name: string; label: string }[] }): React.ReactElement {
  return (
    <ul className="mt-1.5 flex flex-wrap gap-1">
      {traits.map((t) => (
        <li
          key={t.name}
          className="rounded-full border border-neutral-300 bg-neutral-50 px-1.5 py-0.5 text-[10px] text-neutral-600"
          title={t.name}
        >
          {t.label}
        </li>
      ))}
    </ul>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <h2 className="mb-2 border-b border-neutral-300 pb-1 text-sm font-semibold uppercase tracking-wide text-neutral-700">
      {children}
    </h2>
  );
}
