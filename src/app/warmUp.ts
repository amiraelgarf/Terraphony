/**
 * Warm-up: while the visitor reads the invitation or the library, fetch and prepare
 * what the studios need, one small step per idle moment (never during an animation
 * frame). Opening a studio then has nothing heavy left to do, so its entrance stays
 * smooth from the first frame.
 *
 * Nothing here creates audio: the AudioContext still waits for a gesture.
 */
import { loadOceanGrid } from '../data/adapters/murSstAdapter';
import { loadPlace, loadPlaceIndex } from '../data/adapters/modisNdviAdapter';
import { loadPresets } from '../data/adapters/oceanPresets';

const BASE = import.meta.env.BASE_URL;
let started = false;

function idle(fn: () => unknown) {
  return new Promise<void>((resolve) => {
    const run = () => {
      Promise.resolve()
        .then(fn)
        .catch(() => undefined)
        .finally(() => resolve());
    };
    if (typeof window !== 'undefined' && window.requestIdleCallback) window.requestIdleCallback(run, { timeout: 3000 });
    else setTimeout(run, 300);
  });
}

function decode(src: string) {
  const img = new Image();
  img.decoding = 'async';
  img.src = `${BASE}${src}`;
  return img.decode?.() ?? Promise.resolve();
}

export function warmUp() {
  if (started) return;
  started = true;
  const steps: (() => unknown)[] = [
    () => loadPresets(),
    () => loadPlaceIndex(),
    () => decode('nasa-svs/svs3912-frame-26400.jpg'),
    () => loadOceanGrid('A'),
    () => loadPlace('nile-delta'),
    () => import('../visuals/LandAtlas'),
    () => decode('host/beethoven-stieler-1820.jpg'),
  ];
  // after the first paint has settled
  setTimeout(() => steps.reduce((p, s) => p.then(() => idle(s)), Promise.resolve()), 1200);
}
