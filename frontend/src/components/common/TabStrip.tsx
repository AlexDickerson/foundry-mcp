export interface Tab<Id extends string> {
  id: Id;
  label: string;
}

interface Props<Id extends string> {
  tabs: readonly Tab<Id>[];
  active: Id;
  onChange: (id: Id) => void;
}

export function TabStrip<Id extends string>({ tabs, active, onChange }: Props<Id>): React.ReactElement {
  return (
    <nav className="mb-6 flex border-b border-neutral-200" role="tablist">
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            data-tab={tab.id}
            onClick={(): void => {
              onChange(tab.id);
            }}
            className={[
              'px-4 py-2 text-sm font-medium transition-colors',
              '-mb-px border-b-2',
              isActive
                ? 'border-emerald-700 text-emerald-900'
                : 'border-transparent text-neutral-500 hover:text-neutral-800',
            ].join(' ')}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
