/**
 * The guided journey's singletons: one narrator, one director, and the small
 * registry scenes use to lend the director their own transitions.
 */
import { cueById, narration } from './narration';
import { TourDirector } from './tourDirector';
import type { StudioStory } from '../app/recordMachine';

export const tourDirector = new TourDirector({
  play: (id) => narration.play(id),
  pause: () => narration.pause(),
  resume: () => narration.resume(),
  stop: () => narration.stop(),
  cueText: (id) => cueById(id)?.phrases.map((p) => p.text).join(' ') ?? '',
});

/**
 * Scenes register their signature transitions here while mounted, so the guided
 * journey uses exactly the same motion as a visitor's own click.
 */
export const sceneHooks: {
  leaveArrival?: () => Promise<void>;
  openStory?: (story: StudioStory) => Promise<void>;
} = {};

/** True while the director itself is acting (so its actions are not read as the visitor's). */
let driving = 0;
export function drive<T>(fn: () => T): T {
  driving++;
  try {
    return fn();
  } finally {
    driving--;
  }
}
export const isDriving = () => driving > 0;

/** End-to-end test hook: fast captions, no voice. Never set by the app itself. */
try {
  if (typeof window !== 'undefined' && window.localStorage.getItem('earth-records:guide-test') === 'fast') {
    narration.timeScale = 0.12;
    narration.settings = { ...narration.settings, voice: false };
    tourDirector.timeScale = 0.1;
  }
} catch {
  /* storage blocked */
}

export { narration };
