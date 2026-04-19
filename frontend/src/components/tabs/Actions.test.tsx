import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, within } from '@testing-library/react';
import amiri from '../../fixtures/amiri-prepared.json';
import type { Strike } from '../../api/types';
import { Actions } from './Actions';

// Amiri's three strikes with their expected attack modifiers (as per
// /prepared's pre-computed variants). MAP values: -5 and -10 for normal
// weapons; -4 and -8 for agile weapons like unarmed.
const EXPECTED_STRIKES = {
  'basic-unarmed': { label: 'Unarmed Attack', variants: ['+7', '+3 (MAP -4)', '-1 (MAP -8)'] },
  'bastard-sword': { label: 'Bastard Sword', variants: ['+7', '+2 (MAP -5)', '-3 (MAP -10)'] },
  javelin: { label: 'Javelin', variants: ['+5', '+0 (MAP -5)', '-5 (MAP -10)'] },
};

const actions = (amiri as unknown as { system: { actions: Strike[] } }).system.actions;

describe('Actions tab', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders a card per visible strike', () => {
    const { container } = render(<Actions actions={actions} />);
    for (const slug of Object.keys(EXPECTED_STRIKES)) {
      const card = container.querySelector(`[data-strike-slug="${slug}"]`);
      expect(card, `strike card for ${slug}`).toBeTruthy();
    }
  });

  it('renders each strike label', () => {
    const { container } = render(<Actions actions={actions} />);
    for (const [slug, { label }] of Object.entries(EXPECTED_STRIKES)) {
      const card = container.querySelector(`[data-strike-slug="${slug}"]`);
      expect(within(card as HTMLElement).getByText(label)).toBeTruthy();
    }
  });

  it("renders each strike's three attack variants with MAP labels", () => {
    const { container } = render(<Actions actions={actions} />);
    for (const [slug, { variants }] of Object.entries(EXPECTED_STRIKES)) {
      const card = container.querySelector(`[data-strike-slug="${slug}"]`);
      for (const label of variants) {
        expect(within(card as HTMLElement).getByText(label), `${slug} variant ${label}`).toBeTruthy();
      }
    }
  });

  it('shows weapon traits on the Bastard Sword card', () => {
    const { container } = render(<Actions actions={actions} />);
    const card = container.querySelector('[data-strike-slug="bastard-sword"]');
    // Two-Hand d12 trait should be present.
    expect(card?.textContent).toContain('Two-Hand d12');
  });

  it("shows Amiri's javelin quantity (4)", () => {
    const { container } = render(<Actions actions={actions} />);
    const card = container.querySelector('[data-strike-slug="javelin"]');
    expect(card?.textContent).toContain('×4');
  });

  it('renders empty-state when no strikes are visible', () => {
    const { container } = render(<Actions actions={[]} />);
    expect(container.textContent).toContain('No strikes available');
  });
});
