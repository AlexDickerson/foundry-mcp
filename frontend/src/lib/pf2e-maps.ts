import type { ProficiencyRank } from '../api/types';

// PF2e proficiency-rank labels and palette.
// Labels match the en.json `PF2E.ProficiencyLevel{0..4}` keys; we duplicate
// them here because this map is keyed by number and used everywhere we
// render a rank chip. The colours are Tailwind classes inspired by pf2e's
// rank palette (dark green/blue/purple/amber) without vendoring Foundry's
// full SCSS token system.

export const RANK_LABEL: Record<ProficiencyRank, string> = {
  0: 'Untrained',
  1: 'Trained',
  2: 'Expert',
  3: 'Master',
  4: 'Legendary',
};

export const RANK_I18N_KEY: Record<ProficiencyRank, string> = {
  0: 'PF2E.ProficiencyLevel0',
  1: 'PF2E.ProficiencyLevel1',
  2: 'PF2E.ProficiencyLevel2',
  3: 'PF2E.ProficiencyLevel3',
  4: 'PF2E.ProficiencyLevel4',
};

export const RANK_BG: Record<ProficiencyRank, string> = {
  0: 'bg-neutral-500',
  1: 'bg-emerald-700',
  2: 'bg-sky-700',
  3: 'bg-purple-700',
  4: 'bg-amber-600',
};
