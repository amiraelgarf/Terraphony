/**
 * Story highlights — the "notable event" for Scene 03 is found by a rule,
 * never authored by hand. Mirrors build_story_route.py:notable_event.
 */
import type { ScanSample } from './sourceTypes';

export const MIN_EDGE_SEPARATION = 6;

/** Largest finite adjacent change, at least MIN_EDGE_SEPARATION steps from both ends. Earliest wins ties. */
export function findNotableEvent(samples: ScanSample[]): { index: number; delta: number } | null {
  let best = -1;
  let bestIndex: number | null = null;
  for (let i = MIN_EDGE_SEPARATION; i < samples.length - MIN_EDGE_SEPARATION; i++) {
    const a = samples[i - 1].quantity?.value;
    const b = samples[i].quantity?.value;
    if (a === undefined || b === undefined) continue;
    const d = Math.abs(b - a);
    if (d > best + 1e-12) {
      best = d;
      bestIndex = i;
    }
  }
  return bestIndex === null ? null : { index: bestIndex, delta: best };
}
