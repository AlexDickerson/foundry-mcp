// Foundry's enricher system turns inline tokens like
// `@UUID[Compendium.pf2e.spells-srd.Item.abc]{Qi Blast}` into proper
// links at render time. We don't run that system client-side, so the
// tokens come through verbatim in pf2e description HTML. This module
// preprocesses the HTML and replaces the ones we care about with
// styled inline elements ahead of dangerouslySetInnerHTML.
//
// Handlers so far:
//   @UUID[...]{Label}            → styled anchor (no navigation yet)
//   @Damage[1d8[type]]{opt}      → inline bold "1d8 type"
//   @Template[emanation|...]     → italic "15-foot emanation"
//   @Check[will|against:...]     → inline bold "Will save against …"
//   [[/r 1d4 #flavor]]{opt}      → inline bold "1d4" (or the label)
//
// Unhandled tokens still render as literal text. Add handlers here as
// they become painful.

const UUID_PATTERN = /@UUID\[([^\]]+)\](?:\{([^}]+)\})?/g;
const TEMPLATE_PATTERN = /@Template\[([^\]]+)\](?:\{([^}]+)\})?/g;
const CHECK_PATTERN = /@Check\[([^\]]+)\](?:\{([^}]+)\})?/g;
const INLINE_ROLL_PATTERN = /\[\[\/(\w+)\s+([^\]]+)\]\](?:\{([^}]+)\})?/g;

export function enrichDescription(html: string): string {
  // Damage first — its content can contain nested brackets so the
  // walker-based scanner handles it cleanly before any regex passes.
  let out = replaceDamageTokens(html);
  // Inline rolls ([[/r 1d4 #flavor]]{label}) next — contained to their
  // own [[…]] delimiters so order-sensitive to sit before any single-
  // bracket regex. Most pf2e inline rolls carry an explicit label.
  out = out.replace(INLINE_ROLL_PATTERN, (_match, kind: string, content: string, label?: string) => {
    const fromFormula = content.split('#')[0]?.trim() ?? content;
    const displayLabel = label !== undefined && label.trim().length > 0 ? label : fromFormula;
    return `<span class="pf-damage" title="${escapeAttr(`[[/${kind} ${content}]]`)}">${escapeText(displayLabel)}</span>`;
  });
  // Templates (area shapes) — rendered italic since they're
  // descriptive ("15-foot emanation") rather than actionable.
  out = out.replace(TEMPLATE_PATTERN, (_match, content: string, label?: string) => {
    const displayLabel = label !== undefined && label.trim().length > 0 ? label : formatTemplateContent(content);
    return `<span class="pf-template" title="@Template[${escapeAttr(content)}]">${escapeText(displayLabel)}</span>`;
  });
  // Checks/saves. Rendered bold like damage since they're the
  // mechanical verbs of an ability.
  out = out.replace(CHECK_PATTERN, (_match, content: string, label?: string) => {
    const displayLabel = label !== undefined && label.trim().length > 0 ? label : formatCheckContent(content);
    return `<span class="pf-damage" title="@Check[${escapeAttr(content)}]">${escapeText(displayLabel)}</span>`;
  });
  // UUIDs have no nested brackets inside the `[...]` slot, so a flat
  // regex is fine and runs last so the anchor HTML it produces can't
  // be re-matched by the earlier passes.
  out = out.replace(UUID_PATTERN, (_match, uuid: string, label?: string) => {
    const displayLabel = label !== undefined && label.trim().length > 0 ? label : extractFallbackLabel(uuid);
    return `<a data-uuid="${escapeAttr(uuid)}" class="pf-uuid-link" title="${escapeAttr(uuid)}">${escapeText(displayLabel)}</a>`;
  });
  return out;
}

// ─── @Template / @Check formatters ─────────────────────────────────────

// "emanation|distance:15" → "15-foot emanation"
// "cone|distance:30"      → "30-foot cone"
function formatTemplateContent(content: string): string {
  const params = parsePipeParams(content);
  const type = (params['type'] ?? 'area').toLowerCase();
  const distance = params['distance'];
  return distance !== undefined ? `${distance}-foot ${type}` : type;
}

const SAVE_SLUGS = new Set(['will', 'fortitude', 'reflex']);

// pf2e descriptions embed checks inside sentence context —
//   "must succeed at a @Check[will|against:intimidation] save against your Intimidation DC"
// — so the enricher needs to render the *minimum* needed slug, not a
// fully-formed clause, or the surrounding prose duplicates it.
//
// Defaults (matching pf2e's own enricher):
//   "will|against:X"                 → "Will"
//   "athletics|dc:15"                → "DC 15 Athletics"
//   "fortitude|basic:true"           → "basic Fortitude save"
//   "fortitude|basic:true|dc:25"     → "basic DC 25 Fortitude save"
//
// We deliberately drop `against:X` — the calling prose almost always
// already reads "against the …" so echoing it would duplicate.
function formatCheckContent(content: string): string {
  const params = parsePipeParams(content);
  const slug = params['type'] ?? '';
  const pretty = capitaliseFirst(slug);
  const isSave = SAVE_SLUGS.has(slug.toLowerCase());
  const dc = params['dc'];
  const basic = params['basic'] === 'true' && isSave;

  if (basic) {
    return dc !== undefined ? `basic DC ${dc} ${pretty} save` : `basic ${pretty} save`;
  }
  if (dc !== undefined) {
    return `DC ${dc} ${pretty}`;
  }
  return pretty;
}

// Split "type|key:value|key:value" into a Record. The first segment is
// allowed to be a bare slug (no colon) and lands under `type`; any
// second colon in a value is preserved intact, so compound options
// like `options:area-effect,inflicts:frightened` survive.
function parsePipeParams(raw: string): Record<string, string> {
  const parts = raw.split('|');
  const out: Record<string, string> = {};
  const first = parts[0];
  if (first !== undefined && !first.includes(':')) {
    out['type'] = first.trim();
    parts.shift();
  }
  for (const p of parts) {
    const idx = p.indexOf(':');
    if (idx > 0) {
      out[p.slice(0, idx).trim()] = p.slice(idx + 1).trim();
    }
  }
  return out;
}

function capitaliseFirst(s: string): string {
  return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── @Damage ───────────────────────────────────────────────────────────

function replaceDamageTokens(input: string): string {
  const prefix = '@Damage[';
  let out = '';
  let i = 0;
  while (i < input.length) {
    const next = input.indexOf(prefix, i);
    if (next === -1) {
      out += input.slice(i);
      break;
    }
    out += input.slice(i, next);
    const parsed = scanBalancedBrackets(input, next + prefix.length);
    if (!parsed) {
      // Malformed; emit literal opener and keep walking.
      out += prefix;
      i = next + prefix.length;
      continue;
    }
    let labelEnd = parsed.end;
    let label: string | undefined;
    if (input[parsed.end] === '{') {
      const closeIdx = input.indexOf('}', parsed.end + 1);
      if (closeIdx !== -1) {
        label = input.slice(parsed.end + 1, closeIdx);
        labelEnd = closeIdx + 1;
      }
    }
    const display = label !== undefined && label.trim().length > 0 ? label : formatDamageContent(parsed.content);
    out += `<span class="pf-damage" title="@Damage[${escapeAttr(parsed.content)}]">${escapeText(display)}</span>`;
    i = labelEnd;
  }
  return out;
}

// Starts *inside* the opening bracket and consumes until the matching
// closing bracket, tracking depth. Returns the content (exclusive of
// the outer brackets) and the index just past the closing bracket.
function scanBalancedBrackets(input: string, start: number): { end: number; content: string } | null {
  let i = start;
  let depth = 1;
  while (i < input.length && depth > 0) {
    const c = input[i];
    if (c === '[') depth++;
    else if (c === ']') depth--;
    if (depth > 0) i++;
  }
  if (depth !== 0) return null;
  return { end: i + 1, content: input.slice(start, i) };
}

// "1d8[bludgeoning]"                        → "1d8 bludgeoning"
// "2d4[bludgeoning],1d6[persistent,fire]"   → "2d4 bludgeoning, 1d6 persistent fire"
// "(1d6+2)[fire]"                           → "(1d6+2) fire"
function formatDamageContent(content: string): string {
  return content
    .replace(/\[([^\]]+)\]/g, (_match, types: string) => ' ' + types.replace(/,/g, ' '))
    .replace(/,\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── @UUID fallbacks ───────────────────────────────────────────────────

function extractFallbackLabel(uuid: string): string {
  // UUIDs end in opaque IDs; there's no human name to glean without a
  // compendium round-trip. Use the type segment ("Item", "Actor", …)
  // as a weak hint so at least something sensible shows.
  const parts = uuid.split('.');
  return parts.length >= 2 ? (parts[parts.length - 2] ?? 'link') : 'link';
}

// ─── HTML escaping ─────────────────────────────────────────────────────

function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
