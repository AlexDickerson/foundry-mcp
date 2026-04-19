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
});
