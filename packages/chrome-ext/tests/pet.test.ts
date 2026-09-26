import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPet, petState } from '../src/util/pet.js';
import type { PetManifest } from '../src/util/pet.js';

describe('petState', () => {
  it('sleeps when there is no score', () => {
    expect(petState(null)).toBe('sleep');
  });

  it('jumps for joy only at a perfect score', () => {
    expect(petState(100)).toBe('happy');
    expect(petState(99)).toBe('content');
  });

  it.each([
    [80, 'content'],
    [79, 'skeptical'],
    [60, 'skeptical'],
    [59, 'sick'],
    [40, 'sick'],
    [39, 'drip'],
    [20, 'drip'],
    [19, 'grave'],
    [0, 'grave'],
  ])('maps %i to %s', (score, state) => {
    expect(petState(score)).toBe(state);
  });
});

describe('createPet', () => {
  const manifest: PetManifest = {
    frameSize: 32,
    durations: {
      sleep: [100, 200],
      happy: [50, 50, 50],
      content: [100],
      skeptical: [100],
      sick: [100],
      drip: [100],
      grave: [100],
    },
  };
  const sheetUrl = (state: string) => `images/pet/${state}.png`;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sizes the element and its sheet by the scale', () => {
    const element = document.createElement('span');
    createPet(element, manifest, sheetUrl, 2, true).show('happy');

    expect(element.style.width).toBe('64px');
    expect(element.style.height).toBe('64px');
    expect(element.style.backgroundSize).toBe('192px 64px');
    expect(element.style.backgroundImage).toContain('images/pet/happy.png');
  });

  it('steps through the frames on their own durations and loops', () => {
    const element = document.createElement('span');
    createPet(element, manifest, sheetUrl, 1, true).show('sleep');

    expect(element.style.backgroundPosition).toBe('0px 0px');

    vi.advanceTimersByTime(100);
    expect(element.style.backgroundPosition).toBe('-32px 0px');

    vi.advanceTimersByTime(199);
    expect(element.style.backgroundPosition).toBe('-32px 0px');

    vi.advanceTimersByTime(1);
    expect(element.style.backgroundPosition).toBe('0px 0px');
  });

  it('keeps playing when shown the state it already shows', () => {
    const element = document.createElement('span');
    const pet = createPet(element, manifest, sheetUrl, 1, true);
    pet.show('sleep');
    vi.advanceTimersByTime(100);

    pet.show('sleep');

    expect(element.style.backgroundPosition).toBe('-32px 0px');
  });

  it('starts a new state from its first frame', () => {
    const element = document.createElement('span');
    const pet = createPet(element, manifest, sheetUrl, 1, true);
    pet.show('sleep');
    vi.advanceTimersByTime(100);

    pet.show('happy');

    expect(element.style.backgroundPosition).toBe('0px 0px');
    vi.advanceTimersByTime(50);
    expect(element.style.backgroundPosition).toBe('-32px 0px');
  });

  it('holds the first frame when animation is off', () => {
    const element = document.createElement('span');
    createPet(element, manifest, sheetUrl, 1, false).show('happy');

    vi.advanceTimersByTime(1000);

    expect(element.style.backgroundPosition).toBe('0px 0px');
  });
});
