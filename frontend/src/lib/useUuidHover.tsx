import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, ApiRequestError } from '../api/client';
import type { CompendiumDocument } from '../api/types';
import { enrichDescription } from './foundry-enrichers';

// Hover previews for `@UUID[...]` enricher links inside a rendered
// description. The caller keeps their own `dangerouslySetInnerHTML`
// container; this hook returns mouse-over / mouse-out delegation
// handlers to spread onto it, plus a portaled popover to render
// once. Fetching is lazy — the full document is pulled on first
// hover per UUID and cached per hook instance.

interface HoverState {
  uuid: string;
  rect: DOMRect;
}

type DocState =
  | { kind: 'loading' }
  | { kind: 'ready'; doc: CompendiumDocument }
  | { kind: 'error'; message: string };

const POPOVER_WIDTH = 420;
const POPOVER_GAP = 6;
const HOVER_CLOSE_DELAY_MS = 140;
const HOVER_OPEN_DELAY_MS = 300;

export function useUuidHover(): {
  delegationHandlers: {
    onMouseOver: (e: React.MouseEvent<HTMLElement>) => void;
    onMouseOut: (e: React.MouseEvent<HTMLElement>) => void;
  };
  popover: React.ReactElement | null;
} {
  const [hover, setHover] = useState<HoverState | null>(null);
  const [docs, setDocs] = useState<Map<string, DocState>>(new Map());
  const cacheRef = useRef<Map<string, DocState>>(new Map());
  const closeTimerRef = useRef<number | null>(null);
  const openTimerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (closeTimerRef.current !== null) clearTimeout(closeTimerRef.current);
      if (openTimerRef.current !== null) clearTimeout(openTimerRef.current);
    },
    [],
  );

  const cancelClose = (): void => {
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };
  const scheduleClose = (): void => {
    cancelClose();
    closeTimerRef.current = window.setTimeout(() => {
      setHover(null);
      closeTimerRef.current = null;
    }, HOVER_CLOSE_DELAY_MS);
  };
  const cancelOpen = (): void => {
    if (openTimerRef.current !== null) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
  };

  const loadDoc = async (uuid: string): Promise<void> => {
    if (cacheRef.current.has(uuid)) return;
    cacheRef.current.set(uuid, { kind: 'loading' });
    setDocs(new Map(cacheRef.current));
    try {
      const result = await api.getCompendiumDocument(uuid);
      cacheRef.current.set(uuid, { kind: 'ready', doc: result.document });
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.message : err instanceof Error ? err.message : String(err);
      cacheRef.current.set(uuid, { kind: 'error', message: msg });
    }
    setDocs(new Map(cacheRef.current));
  };

  const onMouseOver = (e: React.MouseEvent<HTMLElement>): void => {
    const link = (e.target as HTMLElement).closest('a[data-uuid]') as HTMLAnchorElement | null;
    if (!link) return;
    const uuid = link.getAttribute('data-uuid');
    if (!uuid) return;
    cancelClose();
    if (hover?.uuid === uuid) return;
    // Prefetch during the open delay so the popover opens with cached
    // content when possible instead of flashing the loading state.
    void loadDoc(uuid);
    cancelOpen();
    openTimerRef.current = window.setTimeout(() => {
      setHover({ uuid, rect: link.getBoundingClientRect() });
      openTimerRef.current = null;
    }, HOVER_OPEN_DELAY_MS);
  };

  const onMouseOut = (e: React.MouseEvent<HTMLElement>): void => {
    const link = (e.target as HTMLElement).closest('a[data-uuid]');
    if (!link) return;
    // If we were about to open but the user slid off before the delay
    // elapsed, just drop the pending open — no popover was ever shown.
    cancelOpen();
    const related = e.relatedTarget as Element | null;
    // Moving into the popover itself keeps it open so the user can
    // scroll / read the preview without it dismissing.
    if (related && related.closest('[data-uuid-popover]')) return;
    // Moving between text inside the same link: we'd get an
    // onMouseOut + onMouseOver pair; the close delay (~140ms) covers
    // the gap so the popover doesn't flicker.
    scheduleClose();
  };

  let popover: React.ReactElement | null = null;
  if (hover) {
    const maxLeft = window.innerWidth - POPOVER_WIDTH - 12;
    const left = Math.max(12, Math.min(hover.rect.left, maxLeft));
    const top = hover.rect.bottom + POPOVER_GAP;
    const state = docs.get(hover.uuid);
    popover = createPortal(
      <div
        data-uuid-popover
        data-testid="uuid-hover-popover"
        onMouseEnter={cancelClose}
        onMouseLeave={scheduleClose}
        style={{ position: 'fixed', top, left, width: POPOVER_WIDTH }}
        className="z-50 rounded border border-pf-border bg-pf-bg p-4 text-left shadow-xl"
      >
        <PopoverBody state={state} />
      </div>,
      document.body,
    );
  }

  return {
    delegationHandlers: { onMouseOver, onMouseOut },
    popover,
  };
}

function PopoverBody({ state }: { state: DocState | undefined }): React.ReactElement {
  if (!state || state.kind === 'loading') {
    return <p className="text-xs italic text-pf-alt">Loading…</p>;
  }
  if (state.kind === 'error') {
    return <p className="text-xs text-pf-primary">Couldn&apos;t load: {state.message}</p>;
  }
  return <DocPreview doc={state.doc} />;
}

function DocPreview({ doc }: { doc: CompendiumDocument }): React.ReactElement {
  const sys = doc.system as {
    description?: { value?: unknown };
    level?: { value?: unknown } | number;
    traits?: { value?: unknown };
  };
  const description = typeof sys.description?.value === 'string' ? sys.description.value : '';
  const level = typeof sys.level === 'number' ? sys.level : typeof sys.level?.value === 'number' ? sys.level.value : undefined;
  const traitsRaw = sys.traits?.value;
  const traits = Array.isArray(traitsRaw) ? traitsRaw.filter((v): v is string => typeof v === 'string') : [];

  return (
    <div>
      <div className="mb-2 flex items-start gap-2">
        {doc.img && (
          <img src={doc.img} alt="" className="h-10 w-10 shrink-0 rounded border border-pf-border bg-pf-bg-dark" />
        )}
        <div className="min-w-0 flex-1">
          <h4 className="font-serif text-base font-semibold text-pf-text">{doc.name}</h4>
          <p className="text-[10px] uppercase tracking-widest text-pf-alt">
            {doc.type}
            {level !== undefined && ` · Level ${level.toString()}`}
          </p>
          {traits.length > 0 && (
            <ul className="mt-1 flex flex-wrap gap-1">
              {traits.slice(0, 8).map((t) => (
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
      </div>
      {description.length > 0 ? (
        <div
          className="max-h-[28rem] overflow-y-auto pr-1 text-sm leading-relaxed text-pf-text [&_.pf-damage]:font-semibold [&_.pf-damage]:text-pf-primary [&_.pf-template]:italic [&_.pf-template]:text-pf-secondary [&_a]:cursor-pointer [&_a]:text-pf-primary [&_a]:underline [&_p]:my-2 [&_p]:leading-relaxed"
          dangerouslySetInnerHTML={{ __html: enrichDescription(description) }}
        />
      ) : (
        <p className="text-xs italic text-pf-alt">No description.</p>
      )}
    </div>
  );
}
