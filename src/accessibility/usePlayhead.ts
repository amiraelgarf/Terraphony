/**
 * Smooth playhead for animation: reads the transport clock every frame while
 * playing (the audio clock is the single source of truth; no CSS timers).
 */
import { useEffect, useRef, useState } from 'react';
import { transport } from '../audio/transport';

export function useSmoothPlayhead(playing: boolean, fallback: number | null): number | null {
  const [pos, setPos] = useState<number | null>(fallback);
  const raf = useRef(0);
  useEffect(() => {
    if (!playing) {
      setPos(fallback);
      return;
    }
    // ~30 updates a second is smooth for a cursor and keeps the page light, so the
    // audio thread is never starved by redraws
    let last = 0;
    const tick = (t: number) => {
      if (t - last >= 33) {
        last = t;
        setPos(transport.position());
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, fallback]);
  return pos;
}
