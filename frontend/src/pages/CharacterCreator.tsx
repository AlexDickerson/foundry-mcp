import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { CompendiumMatch, CompendiumSearchOptions } from '../api/types';
import { FeatPicker } from '../components/creator/FeatPicker';

// Module-scoped so React 18 StrictMode's dev-only double-mount
// doesn't spawn two actor-create requests. First mount creates the
// promise, second mount reuses it. Reset to null when the user
// actually leaves the wizard (back or finish), so the next session
// allocates a fresh draft actor.
let pendingActorPromise: Promise<string> | null = null;
function beginOrReusePendingActor(): Promise<string> {
  if (pendingActorPromise === null) {
    pendingActorPromise = api
      .createActor({ name: 'New Character', type: 'character' })
      .then((ref) => ref.id)
      .catch((err: unknown) => {
        // Clear so the next attempt retries fresh instead of getting
        // stuck replaying the rejection.
        pendingActorPromise = null;
        throw err;
      });
  }
  return pendingActorPromise;
}
function resetPendingActor(): void {
  pendingActorPromise = null;
}

// Character creation wizard — Phase 1: identity + core choices.
// Opening the wizard creates a blank actor in Foundry and the wizard
// patches it piecemeal as steps are filled. Text fields flush on
// step-advance; picks sync immediately (add the compendium item,
// delete the previous pick for that slot). "Finish" lands the user
// on the live sheet view for further allocation.

type Step = 'identity' | 'ancestry' | 'class' | 'background' | 'review';

// Picker targets are decoupled from wizard steps: heritage selection
// lives inside the ancestry step rather than owning a step of its own
// (heritages are always children of an ancestry in pf2e's data), and
// deity selection lives inside the identity step.
type PickerTarget = 'ancestry' | 'heritage' | 'class' | 'background' | 'deity';

interface Slot {
  match: CompendiumMatch;
  // Item id on the persisted actor. Saved so we can delete the old
  // item when the user changes their pick for this slot.
  itemId: string;
}

interface Draft {
  name: string;
  // Free-text identity fields. pf2e stores these on `system.details`;
  // we flush them to the actor when the user advances off the
  // identity step (not per-keystroke).
  gender: string;
  age: string;
  ethnicity: string;
  nationality: string;
  deity: Slot | null;
  ancestry: Slot | null;
  // Ancestry slug (e.g. 'elf', 'merfolk') fetched once after the
  // ancestry is picked — heritage filtering needs it. Stored
  // separately so an ancestry change can clear it while the refetch
  // is in-flight.
  ancestrySlug: string | null;
  heritage: Slot | null;
  class: Slot | null;
  background: Slot | null;
}

const EMPTY_DRAFT: Draft = {
  name: '',
  gender: '',
  age: '',
  ethnicity: '',
  nationality: '',
  deity: null,
  ancestry: null,
  ancestrySlug: null,
  heritage: null,
  class: null,
  background: null,
};

const STEPS: readonly Step[] = ['identity', 'ancestry', 'class', 'background', 'review'];

const STEP_LABEL: Record<Step, string> = {
  identity: 'Identity',
  ancestry: 'Ancestry',
  class: 'Class',
  background: 'Background',
  review: 'Review',
};

const PICKER_LABEL: Record<PickerTarget, string> = {
  ancestry: 'Ancestry',
  heritage: 'Heritage',
  class: 'Class',
  background: 'Background',
  deity: 'Deity',
};

type PickerFilters = Pick<
  CompendiumSearchOptions,
  'packIds' | 'documentType' | 'traits' | 'ancestrySlug'
>;

const STATIC_PICKER_FILTERS: Record<Exclude<PickerTarget, 'heritage'>, PickerFilters> = {
  ancestry: { packIds: ['pf2e.ancestries'], documentType: 'Item' },
  class: { packIds: ['pf2e.classes'], documentType: 'Item' },
  background: { packIds: ['pf2e.backgrounds'], documentType: 'Item' },
  deity: { packIds: ['pf2e.deities'], documentType: 'Item' },
};

interface Props {
  onBack: () => void;
  onFinish: (actorId: string) => void;
}

// Actor lifecycle: wizard opens → creating → ready (actor exists in
// Foundry, piecemeal patches flow through). Failed creation blocks
// the UI with a retry button.
type CreatorState =
  | { kind: 'creating' }
  | { kind: 'ready'; actorId: string }
  | { kind: 'error'; message: string };

export function CharacterCreator({ onBack, onFinish }: Props): React.ReactElement {
  const [step, setStep] = useState<Step>('identity');
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [openPicker, setOpenPicker] = useState<PickerTarget | null>(null);
  const [creator, setCreator] = useState<CreatorState>({ kind: 'creating' });

  useEffect(() => {
    let cancelled = false;
    beginOrReusePendingActor()
      .then((actorId) => {
        if (cancelled) return;
        setCreator({ kind: 'ready', actorId });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setCreator({ kind: 'error', message });
      });
    return (): void => {
      cancelled = true;
    };
  }, []);

  const actorId = creator.kind === 'ready' ? creator.actorId : null;

  const stepIdx = STEPS.indexOf(step);
  const isFirst = stepIdx === 0;
  const isReview = step === 'review';

  const canAdvance = (): boolean => {
    if (actorId === null) return false;
    switch (step) {
      case 'identity':
        return draft.name.trim().length > 0;
      case 'ancestry':
        // Advancing requires both an ancestry AND a heritage — heritage
        // is a sub-choice embedded inside the ancestry step.
        return draft.ancestry !== null && draft.heritage !== null;
      case 'class':
        return draft.class !== null;
      case 'background':
        return draft.background !== null;
      case 'review':
        return false;
    }
  };

  const goPrev = (): void => {
    if (!isFirst) setStep(STEPS[stepIdx - 1] ?? 'identity');
  };

  // Push text-field draft state to the actor when advancing off the
  // identity step. Picks are already synced on selection, so other
  // steps don't need a flush here.
  const flushIdentity = async (id: string): Promise<void> => {
    await api.updateActor(id, {
      name: draft.name.trim().length > 0 ? draft.name : 'New Character',
      system: {
        details: {
          gender: draft.gender,
          age: draft.age,
          ethnicity: draft.ethnicity,
          nationality: draft.nationality,
        },
      },
    });
  };

  const goNext = (): void => {
    if (stepIdx >= STEPS.length - 1) return;
    if (step === 'identity' && actorId !== null) {
      void flushIdentity(actorId);
    }
    setStep(STEPS[stepIdx + 1] ?? 'review');
  };

  const applyPick = (match: CompendiumMatch): void => {
    const target = openPicker;
    if (target === null || actorId === null) return;
    setOpenPicker(null);
    // Picks sync eagerly: add the new compendium item, then delete the
    // previous pick for this slot (if any) once the add succeeds. The
    // draft only updates on the response so a failed add leaves state
    // consistent with the actor in Foundry.
    void persistPick(actorId, target, match, draft)
      .then((slot) => {
        setDraft((d) => applyPickedSlot(d, target, slot));
      })
      .catch((err: unknown) => {
        // Surface the failure as a soft error on the creator state so
        // the user can retry. Draft is untouched.
        const message = err instanceof Error ? err.message : String(err);
        setCreator({ kind: 'error', message: `Couldn't apply ${target}: ${message}` });
      });
  };

  // Resolve the ancestry's slug from its full document so the heritage
  // picker can scope its search. pf2e doesn't expose slug in the
  // compendium index by default, so we pay one extra fetch per
  // ancestry pick.
  useEffect(() => {
    const ancestry = draft.ancestry;
    if (ancestry === null || draft.ancestrySlug !== null) return;
    let cancelled = false;
    void api
      .getCompendiumDocument(ancestry.match.uuid)
      .then((res) => {
        if (cancelled) return;
        const sys = res.document.system as { slug?: unknown };
        const slug = typeof sys.slug === 'string' ? sys.slug : null;
        setDraft((d) => (d.ancestry === ancestry ? { ...d, ancestrySlug: slug } : d));
      })
      .catch(() => {
        // Swallow — falling back to unfiltered heritages is acceptable.
      });
    return (): void => {
      cancelled = true;
    };
  }, [draft.ancestry, draft.ancestrySlug]);

  const pickerFilters = openPicker !== null ? filtersForTarget(openPicker, draft) : undefined;

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={(): void => {
            // Null the module-scope cache so re-entering the wizard
            // allocates a fresh draft actor instead of reusing the
            // one the user is stepping away from.
            resetPendingActor();
            onBack();
          }}
          className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-50"
        >
          ← Actors
        </button>
        <h1 className="font-serif text-2xl font-semibold text-pf-text">New Character</h1>
      </div>

      {creator.kind === 'creating' && (
        <p className="rounded border border-pf-border bg-white p-4 text-sm italic text-pf-alt-dark">
          Creating draft actor…
        </p>
      )}
      {creator.kind === 'error' && (
        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm">
          <p className="font-medium text-red-900">Couldn&apos;t create the draft actor</p>
          <p className="mt-1 text-red-800">{creator.message}</p>
        </div>
      )}

      {creator.kind === 'ready' && (
        <>
          <StepNav steps={STEPS} active={step} onJump={(s): void => setStep(s)} draft={draft} />

          <div className="my-6 min-h-[14rem] rounded border border-pf-border bg-white p-4">
            {step === 'identity' && (
              <IdentityStep
                draft={draft}
                onChange={(patch): void => setDraft((d) => ({ ...d, ...patch }))}
                onPickDeity={(): void => setOpenPicker('deity')}
              />
            )}
            {step === 'ancestry' && (
              <AncestryStep
                ancestry={draft.ancestry?.match ?? null}
                heritage={draft.heritage?.match ?? null}
                ancestrySlugResolved={draft.ancestrySlug !== null}
                onPickAncestry={(): void => setOpenPicker('ancestry')}
                onPickHeritage={(): void => setOpenPicker('heritage')}
              />
            )}
            {step === 'class' && (
              <PickerCard
                label="Class"
                selection={draft.class?.match ?? null}
                onOpen={(): void => setOpenPicker('class')}
              />
            )}
            {step === 'background' && (
              <PickerCard
                label="Background"
                selection={draft.background?.match ?? null}
                onOpen={(): void => setOpenPicker('background')}
              />
            )}
            {step === 'review' && <ReviewStep draft={draft} />}
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={goPrev}
              disabled={isFirst}
              className="rounded border border-pf-border bg-white px-3 py-1.5 text-sm text-pf-text disabled:opacity-40"
            >
              ← Back
            </button>
            {isReview ? (
              <button
                type="button"
                onClick={(): void => {
                  if (actorId === null) return;
                  resetPendingActor();
                  onFinish(actorId);
                }}
                disabled={actorId === null}
                className="rounded border border-pf-primary bg-pf-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-pf-primary-dark disabled:opacity-40"
              >
                Open sheet →
              </button>
            ) : (
              <button
                type="button"
                onClick={goNext}
                disabled={!canAdvance()}
                className="rounded border border-pf-primary bg-pf-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-pf-primary-dark disabled:opacity-40"
              >
                Next →
              </button>
            )}
          </div>

          {openPicker !== null && pickerFilters !== undefined && (
            <FeatPicker
              title={`Choose a ${PICKER_LABEL[openPicker]}`}
              filters={pickerFilters}
              onPick={applyPick}
              onClose={(): void => setOpenPicker(null)}
            />
          )}
        </>
      )}
    </div>
  );
}

// ─── Step components ───────────────────────────────────────────────────

function StepNav({
  steps,
  active,
  onJump,
  draft,
}: {
  steps: readonly Step[];
  active: Step;
  onJump: (s: Step) => void;
  draft: Draft;
}): React.ReactElement {
  return (
    <ol className="flex flex-wrap items-center gap-1 text-[11px] uppercase tracking-widest text-pf-alt-dark">
      {steps.map((s, idx) => {
        const isActive = s === active;
        const filled = isStepFilled(s, draft);
        return (
          <li key={s} className="contents">
            <button
              type="button"
              onClick={(): void => onJump(s)}
              data-step={s}
              aria-current={isActive ? 'step' : undefined}
              className={[
                'rounded border px-2 py-1 transition-colors',
                isActive
                  ? 'border-pf-primary bg-pf-primary text-white'
                  : filled
                    ? 'border-pf-border bg-pf-bg text-pf-text hover:bg-pf-bg-dark'
                    : 'border-pf-border bg-white text-pf-alt-dark hover:bg-pf-bg',
              ].join(' ')}
            >
              {STEP_LABEL[s]}
            </button>
            {idx < steps.length - 1 && <span className="px-1 text-pf-alt-dark">·</span>}
          </li>
        );
      })}
    </ol>
  );
}

// Identity text fields beyond name are free-form — pf2e stores them
// as arbitrary strings on `system.details` and the sheet renders them
// verbatim. Deity is the one exception; it has to land in the picker
// because pf2e keys deity by compendium uuid for clergy/cleric gates
// later on.
type IdentityTextField = 'name' | 'gender' | 'age' | 'ethnicity' | 'nationality';

function IdentityStep({
  draft,
  onChange,
  onPickDeity,
}: {
  draft: Draft;
  onChange: (patch: Partial<Draft>) => void;
  onPickDeity: () => void;
}): React.ReactElement {
  const textFields: Array<{
    key: IdentityTextField;
    label: string;
    placeholder: string;
    autoFocus?: boolean;
    fullWidth?: boolean;
  }> = [
    { key: 'name', label: 'Name', placeholder: 'e.g. Lutharion Saverin', autoFocus: true, fullWidth: true },
    { key: 'gender', label: 'Gender / Pronouns', placeholder: 'e.g. she/her, non-binary' },
    { key: 'age', label: 'Age', placeholder: 'e.g. 31' },
    { key: 'ethnicity', label: 'Ethnicity', placeholder: 'e.g. Taldan' },
    { key: 'nationality', label: 'Nationality', placeholder: 'e.g. Andoran' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {textFields.map(({ key, label, placeholder, autoFocus, fullWidth }) => (
          <label
            key={key}
            className={[
              'block text-xs font-semibold uppercase tracking-widest text-pf-alt-dark',
              fullWidth === true ? 'sm:col-span-2' : '',
            ].join(' ')}
          >
            {label}
            <input
              id={`creator-${key}`}
              type="text"
              value={draft[key]}
              onChange={(e): void => onChange({ [key]: e.target.value } as Partial<Draft>)}
              autoFocus={autoFocus}
              placeholder={placeholder}
              className="mt-1 w-full rounded border border-pf-border bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-pf-text focus:border-pf-primary focus:outline-none"
            />
          </label>
        ))}
      </div>
      <div className="border-t border-pf-border pt-4" data-creator-subpicker="deity">
        <PickerCard label="Deity" selection={draft.deity?.match ?? null} onOpen={onPickDeity} />
      </div>
    </div>
  );
}

function AncestryStep({
  ancestry,
  heritage,
  ancestrySlugResolved,
  onPickAncestry,
  onPickHeritage,
}: {
  ancestry: CompendiumMatch | null;
  heritage: CompendiumMatch | null;
  ancestrySlugResolved: boolean;
  onPickAncestry: () => void;
  onPickHeritage: () => void;
}): React.ReactElement {
  return (
    <div className="space-y-4">
      <PickerCard label="Ancestry" selection={ancestry} onOpen={onPickAncestry} />
      {ancestry !== null && (
        <div className="border-t border-pf-border pt-4" data-creator-subpicker="heritage">
          <PickerCard
            label="Heritage"
            selection={heritage}
            onOpen={onPickHeritage}
            disabled={!ancestrySlugResolved}
            {...(ancestrySlugResolved ? {} : { disabledHint: 'Resolving ancestry…' })}
          />
        </div>
      )}
    </div>
  );
}

function PickerCard({
  label,
  selection,
  onOpen,
  disabled,
  disabledHint,
}: {
  label: string;
  selection: CompendiumMatch | null;
  onOpen: () => void;
  disabled?: boolean;
  disabledHint?: string;
}): React.ReactElement {
  if (selection === null) {
    return (
      <div className="flex flex-col items-start gap-2" data-picker-card={label.toLowerCase()}>
        <p className="text-sm text-pf-text">No {label.toLowerCase()} selected yet.</p>
        <button
          type="button"
          onClick={onOpen}
          disabled={disabled === true}
          className="rounded border border-pf-primary bg-pf-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-pf-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          Choose {label}
        </button>
        {disabled === true && disabledHint !== undefined && (
          <p className="text-xs italic text-pf-alt-dark">{disabledHint}</p>
        )}
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3" data-picker-card={label.toLowerCase()}>
      {selection.img !== undefined && (
        <img
          src={selection.img}
          alt=""
          className="h-14 w-14 flex-shrink-0 rounded border border-pf-border bg-pf-bg-dark"
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="font-serif text-base font-semibold text-pf-text">{selection.name}</p>
        <p className="text-[10px] uppercase tracking-widest text-pf-alt-dark">
          {label}
          {selection.level !== undefined && ` · Level ${selection.level.toString()}`}
        </p>
        {selection.traits !== undefined && selection.traits.length > 0 && (
          <ul className="mt-1 flex flex-wrap gap-1">
            {selection.traits.slice(0, 8).map((t) => (
              <li
                key={t}
                className="rounded-full border border-pf-tertiary-dark bg-pf-tertiary/40 px-1.5 py-0.5 text-[10px] text-pf-alt-dark"
              >
                {t}
              </li>
            ))}
          </ul>
        )}
      </div>
      <button
        type="button"
        onClick={onOpen}
        disabled={disabled === true}
        className="rounded border border-pf-border bg-white px-2 py-1 text-xs text-pf-text hover:bg-pf-bg-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        Change
      </button>
    </div>
  );
}

function ReviewStep({ draft }: { draft: Draft }): React.ReactElement {
  const textRow = (v: string): string | null => (v.trim().length > 0 ? v : null);
  const rows: Array<[string, string | null]> = [
    ['Name', textRow(draft.name)],
    ['Gender / Pronouns', textRow(draft.gender)],
    ['Age', textRow(draft.age)],
    ['Ethnicity', textRow(draft.ethnicity)],
    ['Nationality', textRow(draft.nationality)],
    ['Deity', draft.deity?.match.name ?? null],
    ['Ancestry', draft.ancestry?.match.name ?? null],
    ['Heritage', draft.heritage?.match.name ?? null],
    ['Class', draft.class?.match.name ?? null],
    ['Background', draft.background?.match.name ?? null],
  ];
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm text-pf-text">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="font-semibold uppercase tracking-widest text-pf-alt-dark">{label}</dt>
          <dd>
            {value === null ? (
              <span className="italic text-neutral-400">Not chosen</span>
            ) : (
              value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function filtersForTarget(target: PickerTarget, draft: Draft): PickerFilters {
  if (target === 'heritage') {
    const base: PickerFilters = { packIds: ['pf2e.heritages'], documentType: 'Item' };
    if (draft.ancestrySlug !== null) base.ancestrySlug = draft.ancestrySlug;
    return base;
  }
  return STATIC_PICKER_FILTERS[target];
}

function isStepFilled(step: Step, draft: Draft): boolean {
  switch (step) {
    case 'identity':
      return draft.name.trim().length > 0;
    case 'ancestry':
      return draft.ancestry !== null && draft.heritage !== null;
    case 'class':
      return draft.class !== null;
    case 'background':
      return draft.background !== null;
    case 'review':
      return false;
  }
}

// Add the newly-picked compendium item to the actor, then delete the
// previous pick for this slot (if any). Returns the new Slot for the
// caller to commit into the draft. Order matters: add first so a
// transient network failure doesn't leave the actor with zero items
// for the slot.
async function persistPick(
  actorId: string,
  target: PickerTarget,
  match: CompendiumMatch,
  draft: Draft,
): Promise<Slot> {
  const created = await api.addItemFromCompendium(actorId, {
    packId: match.packId,
    itemId: match.documentId,
  });
  const previousId = previousItemIdFor(draft, target);
  if (previousId !== null) {
    // Best-effort cleanup — if the old item vanished externally the
    // delete returns 404 and that's fine for the user's state.
    await api.deleteActorItem(actorId, previousId).catch(() => {
      /* ignore */
    });
  }
  // Heritage gets auto-discarded when ancestry changes — also clean
  // up the old heritage embedded item now so the actor doesn't wear
  // a dwarf heritage under an elf ancestry.
  if (target === 'ancestry' && draft.heritage !== null) {
    await api.deleteActorItem(actorId, draft.heritage.itemId).catch(() => {
      /* ignore */
    });
  }
  return { match, itemId: created.id };
}

function previousItemIdFor(draft: Draft, target: PickerTarget): string | null {
  switch (target) {
    case 'ancestry':
      return draft.ancestry?.itemId ?? null;
    case 'heritage':
      return draft.heritage?.itemId ?? null;
    case 'class':
      return draft.class?.itemId ?? null;
    case 'background':
      return draft.background?.itemId ?? null;
    case 'deity':
      return draft.deity?.itemId ?? null;
  }
}

function applyPickedSlot(draft: Draft, target: PickerTarget, slot: Slot): Draft {
  switch (target) {
    case 'ancestry':
      // A new ancestry wipes the heritage + cached slug. The slug
      // effect refetches from the new ancestry's document and the
      // heritage picker re-opens in its initial "nothing chosen" state.
      return { ...draft, ancestry: slot, ancestrySlug: null, heritage: null };
    case 'heritage':
      return { ...draft, heritage: slot };
    case 'class':
      return { ...draft, class: slot };
    case 'background':
      return { ...draft, background: slot };
    case 'deity':
      return { ...draft, deity: slot };
  }
}
