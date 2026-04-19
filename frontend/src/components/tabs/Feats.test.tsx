import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, within } from '@testing-library/react';
import amiri from '../../fixtures/amiri-prepared.json';
import type { PreparedActorItem } from '../../api/types';
import { Feats } from './Feats';

// Amiri's expected feats grouped by category, from the live fixture.
// Shape: { category: [featName, featName, ...] }
const EXPECTED: Record<string, string[]> = {
  ancestry: ['Natural Ambition'],
  class: ['Raging Intimidation', 'Sudden Charge'],
  classfeature: ['Instinct', 'Rage', 'Giant Instinct', 'Quick-Tempered'],
  skill: ['Survey Wildlife', 'Intimidating Glare'],
  general: ['Diehard'],
};

const items = (amiri as unknown as { items: PreparedActorItem[] }).items;

describe('Feats tab', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders a section per populated category', () => {
    const { container } = render(<Feats items={items} />);
    for (const category of Object.keys(EXPECTED)) {
      const section = container.querySelector(`[data-feat-category="${category}"]`);
      expect(section, `feats section for ${category}`).toBeTruthy();
    }
  });

  it("places each of Amiri's feats in the expected category", () => {
    const { container } = render(<Feats items={items} />);
    for (const [category, featNames] of Object.entries(EXPECTED)) {
      const section = container.querySelector(`[data-feat-category="${category}"]`);
      for (const name of featNames) {
        expect(within(section as HTMLElement).getByText(name), `${name} in ${category}`).toBeTruthy();
      }
    }
  });

  it('shows a level label on each feat card', () => {
    const { container } = render(<Feats items={items} />);
    // Every feat should show "Lv <n>" (Amiri's feats are all level 1).
    const levelLabels = container.querySelectorAll('[data-feat-slug]');
    expect(levelLabels.length).toBeGreaterThan(0);
    for (const el of Array.from(levelLabels)) {
      expect(el.textContent).toMatch(/Lv \d/);
    }
  });

  it('renders empty-state when the actor has no feats', () => {
    const { container } = render(<Feats items={[]} />);
    expect(container.textContent).toContain('No feats yet');
  });
});
