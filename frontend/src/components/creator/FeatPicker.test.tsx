import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { api } from '../../api/client';
import type { CompendiumMatch } from '../../api/types';
import { FeatPicker } from './FeatPicker';

const sampleMatches: CompendiumMatch[] = [
  {
    packId: 'pf2e.feats-srd',
    packLabel: 'Class Feats',
    documentId: 'a',
    uuid: 'Compendium.pf2e.feats-srd.Item.a',
    name: 'Sudden Charge',
    type: 'feat',
    img: 'icons/sudden.webp',
    level: 1,
    traits: ['barbarian', 'fighter'],
  },
  {
    packId: 'pf2e.feats-srd',
    packLabel: 'Class Feats',
    documentId: 'b',
    uuid: 'Compendium.pf2e.feats-srd.Item.b',
    name: 'Raging Intimidation',
    type: 'feat',
    img: 'icons/raging.webp',
    level: 1,
    traits: ['barbarian'],
  },
];

describe('FeatPicker', () => {
  let searchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    searchSpy = vi.spyOn(api, 'searchCompendium').mockResolvedValue({ matches: sampleMatches });
  });
  afterEach(() => {
    searchSpy.mockRestore();
    cleanup();
  });

  it('renders the title, filter summary, and match list', async () => {
    const { container, getByText } = render(
      <FeatPicker
        title="Pick a Class Feat (Level 1)"
        filters={{ packId: 'pf2e.feats-srd', documentType: 'Item', traits: ['barbarian'], maxLevel: 1 }}
        onPick={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(getByText('Pick a Class Feat (Level 1)')).toBeTruthy();
    await waitFor(() => {
      expect(container.querySelector('[data-match-uuid]')).toBeTruthy();
    });
    expect(getByText('Sudden Charge')).toBeTruthy();
    expect(getByText('Raging Intimidation')).toBeTruthy();
    expect(container.textContent).toContain('traits: barbarian');
    expect(container.textContent).toContain('level ≤ 1');
  });

  it('calls searchCompendium with the configured filters', async () => {
    render(
      <FeatPicker
        title="t"
        filters={{ packId: 'pf2e.feats-srd', documentType: 'Item', traits: ['barbarian'], maxLevel: 1 }}
        onPick={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    await waitFor(() => {
      expect(searchSpy).toHaveBeenCalled();
    });
    const call = searchSpy.mock.calls[0]?.[0];
    expect(call?.packId).toBe('pf2e.feats-srd');
    expect(call?.documentType).toBe('Item');
    expect(call?.traits).toEqual(['barbarian']);
    expect(call?.maxLevel).toBe(1);
    // Browse mode: q starts empty.
    expect(call?.q).toBe('');
  });

  it('calls onPick with the selected match', async () => {
    const onPick = vi.fn();
    const { container } = render(
      <FeatPicker title="t" filters={{ traits: ['barbarian'] }} onPick={onPick} onClose={vi.fn()} />,
    );
    await waitFor(() => {
      expect(container.querySelector('[data-match-uuid]')).toBeTruthy();
    });
    const row = container.querySelector('[data-match-uuid="Compendium.pf2e.feats-srd.Item.a"]') as HTMLElement;
    fireEvent.click(row);
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick.mock.calls[0]?.[0].name).toBe('Sudden Charge');
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<FeatPicker title="t" filters={{ traits: ['barbarian'] }} onPick={vi.fn()} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('closes when the backdrop is clicked but not when the card is clicked', async () => {
    const onClose = vi.fn();
    const { getByTestId, container } = render(
      <FeatPicker title="t" filters={{ traits: ['barbarian'] }} onPick={vi.fn()} onClose={onClose} />,
    );
    await waitFor(() => {
      expect(container.querySelector('[data-match-uuid]')).toBeTruthy();
    });
    // Click the card — should NOT close.
    fireEvent.click(getByTestId('feat-picker-results'));
    expect(onClose).not.toHaveBeenCalled();
    // Click the backdrop (the outer dialog).
    fireEvent.click(getByTestId('feat-picker'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows an empty-state message when no matches come back', async () => {
    searchSpy.mockResolvedValueOnce({ matches: [] });
    const { container } = render(
      <FeatPicker title="t" filters={{ traits: ['barbarian'] }} onPick={vi.fn()} onClose={vi.fn()} />,
    );
    await waitFor(() => {
      expect(container.textContent).toMatch(/no matches/i);
    });
  });

  it('shows an error banner when the search throws', async () => {
    searchSpy.mockRejectedValueOnce(new Error('boom'));
    const { container } = render(
      <FeatPicker title="t" filters={{ traits: ['barbarian'] }} onPick={vi.fn()} onClose={vi.fn()} />,
    );
    await waitFor(() => {
      expect(container.textContent).toMatch(/search failed/i);
    });
  });

  // --- Sort toggle --------------------------------------------------------

  it('renders an A-Z / Level sort toggle with A-Z selected by default', async () => {
    const { container, getByTestId } = render(
      <FeatPicker title="t" filters={{ traits: ['barbarian'] }} onPick={vi.fn()} onClose={vi.fn()} />,
    );
    await waitFor(() => {
      expect(container.querySelector('[data-match-uuid]')).toBeTruthy();
    });
    const toggle = getByTestId('feat-picker-sort');
    const alpha = toggle.querySelector('[data-sort-option="alpha"]');
    const level = toggle.querySelector('[data-sort-option="level"]');
    expect(alpha?.getAttribute('aria-checked')).toBe('true');
    expect(level?.getAttribute('aria-checked')).toBe('false');
  });

  it('sorts matches A-Z by default regardless of server order', async () => {
    // Server returns Sudden Charge first; A-Z should surface Raging Intimidation first.
    const { container } = render(
      <FeatPicker title="t" filters={{ traits: ['barbarian'] }} onPick={vi.fn()} onClose={vi.fn()} />,
    );
    await waitFor(() => {
      expect(container.querySelector('[data-match-uuid]')).toBeTruthy();
    });
    const names = Array.from(container.querySelectorAll('[data-match-uuid]')).map(
      (el) => el.querySelector('span')?.textContent,
    );
    expect(names).toEqual(['Raging Intimidation', 'Sudden Charge']);
  });

  it('switches to Level sort and orders ascending by level', async () => {
    searchSpy.mockResolvedValueOnce({
      matches: [
        {
          packId: 'p',
          packLabel: 'l',
          documentId: 'b',
          uuid: 'B',
          name: 'B-Feat',
          type: 'feat',
          img: '',
          level: 1,
          traits: [],
        },
        {
          packId: 'p',
          packLabel: 'l',
          documentId: 'a',
          uuid: 'A',
          name: 'A-Feat',
          type: 'feat',
          img: '',
          level: 5,
          traits: [],
        },
        {
          packId: 'p',
          packLabel: 'l',
          documentId: 'c',
          uuid: 'C',
          name: 'C-Feat',
          type: 'feat',
          img: '',
          level: 3,
          traits: [],
        },
      ],
    });
    const { container, getByTestId } = render(
      <FeatPicker title="t" filters={{ traits: ['x'] }} onPick={vi.fn()} onClose={vi.fn()} />,
    );
    await waitFor(() => {
      expect(container.querySelector('[data-match-uuid]')).toBeTruthy();
    });
    const levelBtn = getByTestId('feat-picker-sort').querySelector('[data-sort-option="level"]') as HTMLElement;
    fireEvent.click(levelBtn);

    const order = Array.from(container.querySelectorAll('[data-match-uuid]')).map((el) =>
      el.getAttribute('data-match-uuid'),
    );
    // Ascending by level: 1, 3, 5 → B, C, A
    expect(order).toEqual(['B', 'C', 'A']);
    // aria-checked flipped.
    expect(levelBtn.getAttribute('aria-checked')).toBe('true');
  });

  it('sinks matches missing a level to the bottom of a Level sort, keeping alpha within each tier', async () => {
    searchSpy.mockResolvedValueOnce({
      matches: [
        {
          packId: 'p',
          packLabel: 'l',
          documentId: 'u',
          uuid: 'U-noLvl',
          name: 'Unspecified Feat',
          type: 'feat',
          img: '',
          traits: [],
        },
        {
          packId: 'p',
          packLabel: 'l',
          documentId: 'a',
          uuid: 'Alvl1',
          name: 'Alpha',
          type: 'feat',
          img: '',
          level: 1,
          traits: [],
        },
        {
          packId: 'p',
          packLabel: 'l',
          documentId: 'b',
          uuid: 'Blvl1',
          name: 'Beta',
          type: 'feat',
          img: '',
          level: 1,
          traits: [],
        },
      ],
    });
    const { container, getByTestId } = render(
      <FeatPicker title="t" filters={{ traits: ['x'] }} onPick={vi.fn()} onClose={vi.fn()} />,
    );
    await waitFor(() => {
      expect(container.querySelector('[data-match-uuid]')).toBeTruthy();
    });
    fireEvent.click(getByTestId('feat-picker-sort').querySelector('[data-sort-option="level"]') as HTMLElement);
    const order = Array.from(container.querySelectorAll('[data-match-uuid]')).map((el) =>
      el.getAttribute('data-match-uuid'),
    );
    // L1 alpha first (Alpha before Beta), then the unlevelled entry at the bottom.
    expect(order).toEqual(['Alvl1', 'Blvl1', 'U-noLvl']);
  });
});
