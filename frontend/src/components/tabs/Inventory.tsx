import type { PhysicalItem, PreparedActorItem } from '../../api/types';
import { isCoin, isContainer, isPhysicalItem } from '../../api/types';

interface Props {
  items: PreparedActorItem[];
}

// Inventory tab — reads `items[]`, filters to physical item types
// (weapon/armor/equipment/consumable/treasure/backpack), renders a
// single scrolling list with inline badges for "equipped" / "held" and
// containers expanded to show their contents. Coins break out to a
// dedicated strip at the top since they don't usefully carry bulk in
// the normal item layout.
//
// Ported in spirit from pf2e's static/templates/actors/character/tabs/
// inventory.hbs, but flattened — our read-only viewer doesn't need
// stow/carry/drop controls or quantity adjusters.
export function Inventory({ items }: Props): React.ReactElement {
  const physical = items.filter(isPhysicalItem);
  if (physical.length === 0) {
    return <p className="text-sm text-neutral-500">No items yet.</p>;
  }

  const coins = physical.filter(isCoin);
  const nonCoin = physical.filter((i) => !isCoin(i));

  // Items nested inside containers are rendered under the container,
  // not at the top level of the list.
  const topLevel = nonCoin.filter((i) => !i.system.containerId);
  const byContainer = new Map<string, PhysicalItem[]>();
  for (const item of nonCoin) {
    const cid = item.system.containerId;
    if (!cid) continue;
    const arr = byContainer.get(cid) ?? [];
    arr.push(item);
    byContainer.set(cid, arr);
  }

  return (
    <section className="space-y-4">
      {coins.length > 0 && <CoinStrip coins={coins} />}
      <ul className="space-y-1.5">
        {topLevel.map((item) => (
          <ItemRow key={item.id} item={item} contents={isContainer(item) ? (byContainer.get(item.id) ?? []) : []} />
        ))}
      </ul>
    </section>
  );
}

// ─── Coin strip ─────────────────────────────────────────────────────────

// Slug → denomination order (largest first — pp > gp > sp > cp). Amiri's
// coin items have slugs like "silver-pieces" / "gold-pieces"; unknown
// slugs fall back to reading system.price.value for the denomination
// weight, multiplied by quantity.
const COIN_SLUG_DENOM: Record<string, 'pp' | 'gp' | 'sp' | 'cp'> = {
  'platinum-pieces': 'pp',
  'gold-pieces': 'gp',
  'silver-pieces': 'sp',
  'copper-pieces': 'cp',
};

function CoinStrip({ coins }: { coins: PhysicalItem[] }): React.ReactElement {
  const totals: Record<'pp' | 'gp' | 'sp' | 'cp', number> = { pp: 0, gp: 0, sp: 0, cp: 0 };
  for (const coin of coins) {
    const denom = coin.system.slug ? COIN_SLUG_DENOM[coin.system.slug] : undefined;
    if (denom) {
      totals[denom] += coin.system.quantity;
    }
  }
  return (
    <div className="flex items-center gap-4 rounded border border-amber-300 bg-amber-50 px-3 py-2" data-section="coins">
      <span className="text-[11px] font-semibold uppercase tracking-widest text-amber-800">Coins</span>
      {(['pp', 'gp', 'sp', 'cp'] as const).map((denom) => (
        <span
          key={denom}
          className={[
            'font-mono text-sm tabular-nums',
            totals[denom] > 0 ? 'text-neutral-900' : 'text-neutral-300',
          ].join(' ')}
        >
          <strong>{totals[denom]}</strong>{' '}
          <span className="text-[10px] uppercase tracking-wider text-neutral-500">{denom}</span>
        </span>
      ))}
    </div>
  );
}

// ─── Item row ───────────────────────────────────────────────────────────

function ItemRow({ item, contents }: { item: PhysicalItem; contents: PhysicalItem[] }): React.ReactElement {
  const isContainerRow = isContainer(item);
  const bulk = item.system.bulk;
  const capacityText =
    isContainerRow && typeof bulk.capacity === 'number'
      ? `capacity ${bulk.capacity.toString()}${typeof bulk.ignored === 'number' ? ` (${bulk.ignored.toString()} ignored)` : ''}`
      : undefined;

  return (
    <li className="rounded border border-pf-border bg-white" data-item-id={item.id} data-item-type={item.type}>
      <div className="flex items-center gap-3 px-3 py-2">
        <img src={item.img} alt="" className="h-8 w-8 flex-shrink-0 rounded border border-pf-border bg-pf-bg-dark" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate text-sm text-neutral-900">{item.name}</span>
            {item.system.quantity > 1 && (
              <span className="flex-shrink-0 text-xs text-neutral-500">×{item.system.quantity}</span>
            )}
            {capacityText !== undefined && (
              <span className="flex-shrink-0 text-[10px] uppercase tracking-wider text-neutral-500">
                {capacityText}
              </span>
            )}
          </div>
        </div>
        <EquippedBadge item={item} />
        <BulkLabel value={bulk.value} />
      </div>
      {isContainerRow && contents.length > 0 && (
        <ul className="divide-y divide-neutral-100 border-t border-neutral-100 pl-6" data-container-contents={item.id}>
          {contents.map((child) => (
            <ContainerChildRow key={child.id} item={child} />
          ))}
        </ul>
      )}
    </li>
  );
}

function ContainerChildRow({ item }: { item: PhysicalItem }): React.ReactElement {
  return (
    <li className="flex items-center gap-3 px-3 py-1.5" data-item-id={item.id} data-item-type={item.type}>
      <img src={item.img} alt="" className="h-6 w-6 flex-shrink-0 rounded border border-pf-border bg-pf-bg-dark" />
      <div className="min-w-0 flex-1">
        <span className="truncate text-sm text-neutral-800">{item.name}</span>
        {item.system.quantity > 1 && <span className="ml-2 text-xs text-neutral-500">×{item.system.quantity}</span>}
      </div>
      <BulkLabel value={item.system.bulk.value} />
    </li>
  );
}

function EquippedBadge({ item }: { item: PhysicalItem }): React.ReactElement | null {
  const eq = item.system.equipped;
  if (eq.handsHeld !== undefined && eq.handsHeld > 0) {
    return <Badge color="emerald">Held ({eq.handsHeld}H)</Badge>;
  }
  if (item.type === 'armor' && eq.inSlot === true) {
    return <Badge color="emerald">Equipped</Badge>;
  }
  if (item.type === 'backpack' && eq.inSlot === true) {
    return <Badge color="sky">Worn</Badge>;
  }
  if (eq.invested === true) {
    return <Badge color="violet">Invested</Badge>;
  }
  return null;
}

function Badge({
  color,
  children,
}: {
  color: 'emerald' | 'sky' | 'violet';
  children: React.ReactNode;
}): React.ReactElement {
  const palette: Record<string, string> = {
    emerald: 'border-emerald-300 bg-emerald-50 text-emerald-800',
    sky: 'border-sky-300 bg-sky-50 text-sky-800',
    violet: 'border-violet-300 bg-violet-50 text-violet-800',
  };
  return (
    <span
      className={[
        'rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider',
        palette[color] ?? '',
      ].join(' ')}
    >
      {children}
    </span>
  );
}

function BulkLabel({ value }: { value: number }): React.ReactElement {
  const label = value === 0 ? '—' : value < 1 ? 'L' : value.toString();
  return (
    <span className="w-6 flex-shrink-0 text-right font-mono text-[10px] uppercase tracking-wider text-neutral-400">
      {label}
    </span>
  );
}
