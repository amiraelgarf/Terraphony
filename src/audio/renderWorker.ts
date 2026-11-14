/**
 * Background renderer: turns a record's events into the five stereo stems of the
 * orchestra, off the page's main thread (so rendering never makes the page stutter).
 */
import { arrange } from './ensemble';
import { renderStems, type Palette } from './dsp';
import type { MusicEvent } from '../data/types';

type Job = { id: number; events: MusicEvent[]; palette: Palette; beat: number };

self.onmessage = (e: MessageEvent<Job>) => {
  const { id, events, palette, beat } = e.data;
  try {
    const r = renderStems(arrange(events), palette, beat);
    const transfer: ArrayBuffer[] = [];
    Object.values(r.stems).forEach(([l, rr]) => transfer.push(l.buffer as ArrayBuffer, rr.buffer as ArrayBuffer));
    (self as unknown as Worker).postMessage({ id, ok: true, result: r }, transfer);
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, ok: false, error: String((err as Error)?.message ?? err) });
  }
};
