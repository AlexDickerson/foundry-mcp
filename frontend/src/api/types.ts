// Types for the foundry-mcp REST API surface.
//
// Kept deliberately minimal: we type the slice of `system.*` that the
// active tab actually reads. `PreparedActor.system` stays as
// `Record<string, unknown>` generically; narrower actor types like
// `PreparedCharacter` type the fields we consume.

export interface ActorSummary {
  id: string;
  name: string;
  type: string;
  img: string;
}

export interface PreparedActorItem {
  id: string;
  name: string;
  type: string;
  img: string;
  system: Record<string, unknown>;
}

export interface PreparedActor {
  id: string;
  uuid: string;
  name: string;
  type: string;
  img: string;
  system: Record<string, unknown>;
  items: PreparedActorItem[];
}

export interface ApiError {
  error: string;
  suggestion?: string;
}

// ─── PF2e character-specific shapes (used by the Proficiencies tab) ────

export type ProficiencyRank = 0 | 1 | 2 | 3 | 4;

export type ModifierKind = 'modifier' | 'bonus' | 'penalty';

export interface Modifier {
  slug: string;
  label: string;
  modifier: number;
  type: string;
  enabled: boolean;
  ignored: boolean;
  kind: ModifierKind;
  hideIfDisabled?: boolean;
}

export interface SkillStatistic {
  slug: string;
  label: string;
  value: number;
  totalModifier: number;
  dc: number;
  breakdown: string;
  modifiers: Modifier[];
  rank: ProficiencyRank;
  attribute: string;
  armor?: boolean;
  itemId?: string | null;
  lore?: boolean;
}

export interface MartialProficiency {
  rank: ProficiencyRank;
  value: number;
  breakdown: string;
  visible?: boolean;
  custom?: boolean;
  label?: string;
}

export interface ClassDC {
  slug: string;
  label: string;
  rank: ProficiencyRank;
  attribute: string;
  primary: boolean;
  value: number;
  totalModifier: number;
  dc: number;
  breakdown: string;
  modifiers: Modifier[];
}

export interface SpellcastingProficiency {
  rank: ProficiencyRank;
}

export interface CharacterSystem {
  skills: Record<string, SkillStatistic>;
  proficiencies: {
    attacks: Record<string, MartialProficiency>;
    defenses: Record<string, MartialProficiency>;
    classDCs: Record<string, ClassDC>;
    spellcasting: SpellcastingProficiency;
  };
}

export interface PreparedCharacter {
  id: string;
  uuid: string;
  name: string;
  type: 'character';
  img: string;
  system: CharacterSystem;
  items: PreparedActorItem[];
}
