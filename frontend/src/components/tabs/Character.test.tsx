import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, within } from '@testing-library/react';
import amiri from '../../fixtures/amiri-prepared.json';
import type { CharacterSystem } from '../../api/types';
import { Character } from './Character';

// Amiri — level-1 human barbarian. Verified values pulled from the live
// /prepared payload: str+4 (key), dex+2, con+2, int+0, wis+0, cha+1,
// AC 18, HP 22/22, Perception +5, Fort +7, Ref +5, Will +5, Class DC 17.
const system = (amiri as unknown as { system: CharacterSystem }).system;

describe('Character tab', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the six ability modifiers with correct signs', () => {
    const { container } = render(<Character system={system} />);
    const expected: Record<string, string> = {
      str: '+4',
      dex: '+2',
      con: '+2',
      int: '+0',
      wis: '+0',
      cha: '+1',
    };
    for (const [slug, mod] of Object.entries(expected)) {
      const row = container.querySelector(`[data-attribute="${slug}"]`);
      expect(row, `ability row for ${slug}`).toBeTruthy();
      expect(within(row as HTMLElement).getByText(mod)).toBeTruthy();
    }
  });

  it("marks the character's key ability", () => {
    const { container } = render(<Character system={system} />);
    const strRow = container.querySelector('[data-attribute="str"]');
    expect(strRow?.textContent).toContain('KEY');
    // Non-key abilities should not carry the KEY badge.
    const dexRow = container.querySelector('[data-attribute="dex"]');
    expect(dexRow?.textContent).not.toContain('KEY');
  });

  it('renders the headline stats (AC, HP, Perception)', () => {
    const { container } = render(<Character system={system} />);
    expect(container.querySelector('[data-stat="hp"]')?.textContent).toContain('22');
    expect(container.querySelector('[data-stat="perception"]')?.textContent).toContain('+5');
    // AC 18 is in the StatTile without data-stat but in the first StatsBlock row.
    const acLabel = Array.from(container.querySelectorAll('span')).find((el) => el.textContent === 'AC');
    expect(acLabel, 'AC label').toBeTruthy();
  });

  it('renders the three saves with correct modifiers', () => {
    const { container } = render(<Character system={system} />);
    expect(container.querySelector('[data-stat="save-fortitude"]')?.textContent).toContain('+7');
    expect(container.querySelector('[data-stat="save-reflex"]')?.textContent).toContain('+5');
    expect(container.querySelector('[data-stat="save-will"]')?.textContent).toContain('+5');
  });

  it('renders the class DC (Barbarian @ 17)', () => {
    const { container } = render(<Character system={system} />);
    const dc = container.querySelector('[data-stat="class-dc"]');
    expect(dc, 'class DC tile').toBeTruthy();
    expect(dc?.textContent).toContain('17');
  });

  it('renders hero points pips (1 of 3)', () => {
    const { container } = render(<Character system={system} />);
    const hp = container.querySelector('[data-stat="hero-points"]');
    expect(hp, 'hero points tile').toBeTruthy();
    expect(hp?.textContent).toContain('1/3');
  });

  it('renders languages (Hallit, Common)', () => {
    const { container } = render(<Character system={system} />);
    const langs = container.querySelector('[data-section="languages"]');
    expect(langs, 'languages section').toBeTruthy();
    expect(langs?.textContent).toContain('Hallit');
    expect(langs?.textContent).toContain('Common');
  });

  it('renders traits (Human, Humanoid)', () => {
    const { container } = render(<Character system={system} />);
    const traits = container.querySelector('[data-section="traits"]');
    expect(traits?.textContent).toContain('Human');
    expect(traits?.textContent).toContain('Humanoid');
  });

  it("renders Amiri's land speed (25 ft)", () => {
    const { container } = render(<Character system={system} />);
    expect(container.textContent).toContain('25 ft');
  });
});
