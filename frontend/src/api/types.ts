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

// ─── Character landing-tab fields ──────────────────────────────────────

export type AbilityKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';

export const ABILITY_KEYS: readonly AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

export interface Ability {
  mod: number;
  base: number;
  label: string; // i18n key, e.g. "PF2E.AbilityStr"
  shortLabel: string; // i18n key, e.g. "PF2E.AbilityId.str"
}

export interface HPAttribute {
  value: number;
  max: number;
  temp: number;
  totalModifier: number;
  breakdown: string;
}

export interface ACAttribute {
  value: number;
  totalModifier: number;
  dc: number;
  breakdown: string;
  attribute: string;
}

export interface Perception {
  slug: string;
  label: string;
  value: number;
  totalModifier: number;
  dc: number;
  rank: ProficiencyRank;
  attribute: string;
  breakdown: string;
  modifiers: Modifier[];
}

export interface Save {
  slug: string;
  label: string;
  value: number;
  totalModifier: number;
  dc: number;
  rank: ProficiencyRank;
  attribute: string;
  breakdown: string;
  modifiers: Modifier[];
}

export interface HeroPoints {
  value: number;
  max: number;
}

export interface Speed {
  type: string;
  slug: string;
  label: string;
  value: number;
  base: number;
  breakdown: string;
}

// Foundry ships every speed slot; unpopulated ones are null.
export interface Movement {
  speeds: {
    land: Speed | null;
    burrow: Speed | null;
    climb: Speed | null;
    fly: Speed | null;
    swim: Speed | null;
    travel?: Speed | null;
  };
}

export interface CharacterTraits {
  value: string[]; // trait slugs like "human", "humanoid"
  rarity: string;
  size: { value: string; long: number; wide: number };
}

export interface CharacterDetails {
  level: { value: number };
  keyability: { value: AbilityKey };
  languages: { value: string[]; details: string };
  ancestry: { name: string; trait: string | null } | null;
  heritage: { name: string; trait: string | null } | null;
  class: { name: string; trait: string | null } | null;
  background?: { name: string } | null;
  deity?: { image?: string; value?: string } | null;
}

export interface CharacterSystem {
  abilities: Record<AbilityKey, Ability>;
  attributes: {
    ac: ACAttribute;
    hp: HPAttribute;
    classDC: ClassDC | null;
  };
  details: CharacterDetails;
  perception: Perception;
  resources: {
    heroPoints: HeroPoints;
  };
  movement: Movement;
  traits: CharacterTraits;
  saves: Record<'fortitude' | 'reflex' | 'will', Save>;
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
