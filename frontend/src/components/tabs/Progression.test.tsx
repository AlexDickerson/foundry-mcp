import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, within } from '@testing-library/react';
import amiri from '../../fixtures/amiri-prepared.json';
import type { PreparedActorItem } from '../../api/types';
import { Progression } from './Progression';

const items = (amiri as unknown as { items: PreparedActorItem[] }).items;

describe('Progression tab', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders all 20 character levels', () => {
    const { container } = render(<Progression characterLevel={1} items={items} />);
    const rows = container.querySelectorAll('[data-level]');
    expect(rows).toHaveLength(20);
  });

  it("marks the character's current level", () => {
    const { container } = render(<Progression characterLevel={1} items={items} />);
    const row = container.querySelector('[data-level="1"]');
    expect(row?.getAttribute('data-state')).toBe('current');
  });

  it('marks higher levels as future', () => {
    const { container } = render(<Progression characterLevel={1} items={items} />);
    expect(container.querySelector('[data-level="2"]')?.getAttribute('data-state')).toBe('future');
    expect(container.querySelector('[data-level="20"]')?.getAttribute('data-state')).toBe('future');
  });

  it('marks lower levels as past when character has advanced', () => {
    const { container } = render(<Progression characterLevel={5} items={items} />);
    expect(container.querySelector('[data-level="1"]')?.getAttribute('data-state')).toBe('past');
    expect(container.querySelector('[data-level="4"]')?.getAttribute('data-state')).toBe('past');
    expect(container.querySelector('[data-level="5"]')?.getAttribute('data-state')).toBe('current');
    expect(container.querySelector('[data-level="6"]')?.getAttribute('data-state')).toBe('future');
  });

  it("shows Amiri's level-1 Barbarian features (Instinct, Rage)", () => {
    const { container } = render(<Progression characterLevel={1} items={items} />);
    const row = container.querySelector('[data-level="1"]') as HTMLElement;
    expect(within(row).getByText('Instinct')).toBeTruthy();
    expect(within(row).getByText('Rage')).toBeTruthy();
  });

  it("places Brutality at level 5 (one of Barbarian's class features)", () => {
    const { container } = render(<Progression characterLevel={1} items={items} />);
    const row = container.querySelector('[data-level="5"]') as HTMLElement;
    expect(within(row).getByText('Brutality')).toBeTruthy();
  });

  it('renders class feat slot at every classFeatLevels entry', () => {
    const { container } = render(<Progression characterLevel={1} items={items} />);
    // Barbarian classFeatLevels: [1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20]
    for (const level of [1, 2, 4, 6, 8]) {
      const row = container.querySelector(`[data-level="${level.toString()}"]`);
      const slot = row?.querySelector('[data-slot="class-feat"]');
      expect(slot, `class feat slot at level ${level.toString()}`).toBeTruthy();
    }
    // Level 3 is NOT in classFeatLevels for Barbarian.
    const level3 = container.querySelector('[data-level="3"]');
    expect(level3?.querySelector('[data-slot="class-feat"]')).toBeNull();
  });

  it('renders ancestry feat slot at the core rulebook levels', () => {
    const { container } = render(<Progression characterLevel={1} items={items} />);
    // ancestryFeatLevels: [1, 5, 9, 13, 17]
    for (const level of [1, 5, 9, 13, 17]) {
      const row = container.querySelector(`[data-level="${level.toString()}"]`);
      expect(
        row?.querySelector('[data-slot="ancestry-feat"]'),
        `ancestry slot at level ${level.toString()}`,
      ).toBeTruthy();
    }
    expect(container.querySelector('[data-level="2"]')?.querySelector('[data-slot="ancestry-feat"]')).toBeNull();
  });

  it('renders ability-boosts slot at levels 5, 10, 15, 20', () => {
    const { container } = render(<Progression characterLevel={1} items={items} />);
    for (const level of [5, 10, 15, 20]) {
      const row = container.querySelector(`[data-level="${level.toString()}"]`);
      expect(
        row?.querySelector('[data-slot="ability-boosts"]'),
        `ability boosts at level ${level.toString()}`,
      ).toBeTruthy();
    }
    expect(container.querySelector('[data-level="4"]')?.querySelector('[data-slot="ability-boosts"]')).toBeNull();
  });

  it('renders skill increase slot starting at level 3', () => {
    const { container } = render(<Progression characterLevel={1} items={items} />);
    for (const level of [3, 5, 7, 9]) {
      const row = container.querySelector(`[data-level="${level.toString()}"]`);
      expect(
        row?.querySelector('[data-slot="skill-increase"]'),
        `skill increase at level ${level.toString()}`,
      ).toBeTruthy();
    }
    for (const level of [1, 2, 4]) {
      expect(
        container.querySelector(`[data-level="${level.toString()}"]`)?.querySelector('[data-slot="skill-increase"]'),
      ).toBeNull();
    }
  });

  it('falls back to a friendly message when no class item is present', () => {
    const noClass = items.filter((i) => i.type !== 'class');
    const { container } = render(<Progression characterLevel={1} items={noClass} />);
    expect(container.textContent).toContain('No class item');
  });
});
