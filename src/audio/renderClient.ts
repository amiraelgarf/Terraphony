/**
 * Render a record's orchestra in a background worker (falls back to the main thread
 * where workers are unavailable). Shared by live playback and the WAV export.
 */
import type { MusicEvent } from '../data/types';
import { arrange } from './ensemble';
import { renderStems, type Palette, type Rendered } from './dsp';

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, { resolve: (r: Rendered) => void; reject: (e: Error) => void }>();

function getWorker(): Worker | null {
  if (worker) return worker;
  if (typeof Worker === 'undefined') return null;
  try {
    worker = new Worker(new URL('./renderWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ id: number; ok: boolean; result?: Rendered; error?: string }>) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      if (e.data.ok && e.data.result) p.resolve(e.data.result);
      else p.reject(new Error(e.data.error ?? 'render failed'));
    };
    worker.onerror = () => {
      pending.forEach((p) => p.reject(new Error('render worker failed')));
      pending.clear();
      worker = null;
    };
    return worker;
  } catch {
    return null;
  }
}

export function renderRecord(events: MusicEvent[], palette: Palette, beat: number): Promise<Rendered> {
  const w = getWorker();
  if (!w) return Promise.resolve().then(() => renderStems(arrange(events), palette, beat));
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ id, events, palette, beat });
  });
}
