export type PetState = 'sleep' | 'happy' | 'content' | 'skeptical' | 'sick' | 'drip' | 'grave';

/** What `scripts/pet/build.mjs` writes next to the sprite sheets. */
export type PetManifest = {
  frameSize: number;
  durations: Record<PetState, number[]>;
};

/**
 * The mood for a conformance score. A perfect 100 gets a band of its own —
 * Core rounds down, so it is reached only by a script with no finding at all;
 * below it the scale is cut into equal twenties. An unscored script sleeps.
 */
export function petState(score: number | null): PetState {
  if (score === null) {
    return 'sleep';
  }

  if (score >= 100) {
    return 'happy';
  }

  if (score >= 80) {
    return 'content';
  }

  if (score >= 60) {
    return 'skeptical';
  }

  if (score >= 40) {
    return 'sick';
  }

  if (score >= 20) {
    return 'drip';
  }

  return 'grave';
}

export type Pet = {
  show(state: PetState): void;
};

/**
 * Plays the sprite sheets on `element`, each pixel drawn `scale` times over.
 * Showing the state already playing is a no-op, so a caller can pass the mood
 * on every update without restarting the loop. With `animate` off only the
 * first frame is shown.
 */
export function createPet(
  element: HTMLElement,
  manifest: PetManifest,
  sheetUrl: (state: PetState) => string,
  scale: number,
  animate: boolean,
): Pet {
  const size = manifest.frameSize * scale;
  let current: PetState | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  element.style.width = `${size}px`;
  element.style.height = `${size}px`;

  function play(durations: readonly number[], frame: number): void {
    element.style.backgroundPosition = `${-frame * size}px 0`;

    if (!animate) {
      return;
    }

    timer = setTimeout(() => play(durations, (frame + 1) % durations.length), durations[frame]);
  }

  return {
    show(state) {
      if (state === current) {
        return;
      }

      current = state;
      clearTimeout(timer);

      const durations = manifest.durations[state];
      element.style.backgroundImage = `url('${sheetUrl(state)}')`;
      element.style.backgroundSize = `${durations.length * size}px ${size}px`;
      play(durations, 0);
    },
  };
}
