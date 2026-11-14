/**
 * The rendered orchestra (dsp.ts): deterministic, at a fixed loudness, every
 * instrument group where the arrangement puts it, and free of clicks.
 */
import { describe, expect, it } from 'vitest';
import { arrange } from '../audio/ensemble';
import { buildEvents } from '../audio/musicMapper';
import { renderStems, SR, type Palette, type Rendered, type StemName } from '../audio/dsp';
import { OCEAN_RULE } from '../stories/ocean.config';
import { obs, presets } from './helpers';

const gulf = presets().presets.find((p) => p.id === 'gulf-stream')!;
const events = buildEvents(obs(gulf.reference.A.map((r) => r.value)), OCEAN_RULE);
const perf = arrange(events);
const BEAT = OCEAN_RULE.beatSeconds;
const cache = new Map<Palette, Rendered>();
const render = (p: Palette) => cache.get(p) ?? (cache.set(p, renderStems(perf, p, BEAT)), cache.get(p)!);

const rmsDb = (ch: Float32Array, a: number, b: number) => {
  let s = 0;
  const i0 = Math.round(a * SR), i1 = Math.round(b * SR);
  for (let i = i0; i < i1; i++) s += ch[i] * ch[i];
  return 10 * Math.log10(s / (i1 - i0) + 1e-20);
};
const mix = (r: Rendered) => {
  const L = new Float32Array(r.length);
  for (const k of Object.keys(r.stems) as StemName[]) for (let i = 0; i < r.length; i++) L[i] += r.stems[k][0][i];
  return L;
};

describe('rendered orchestra', () => {
  it('is deterministic: the same record renders bit-identically', () => {
    const a = renderStems(perf, 'glass', BEAT), b = render('glass');
    const sum = (x: Float32Array) => {
      let h = 0;
      for (let i = 0; i < x.length; i++) h = (h * 31 + Math.round(x[i] * 1e7)) % 2147483647;
      return h;
    };
    for (const k of Object.keys(a.stems) as StemName[]) expect(sum(a.stems[k][0])).toBe(sum(b.stems[k][0]));
  });

  it('is normalised: the full mix peaks at -3 dBFS, never clipping', () => {
    for (const p of ['glass', 'wood', 'felt'] as Palette[]) expect(20 * Math.log10(render(p).peak)).toBeCloseTo(-3, 1);
  });

  it('brings each group in where the arrangement does, with the orchestra clearly present', () => {
    const r = render('glass');
    const sec = (k: StemName, a: number, b: number) => rmsDb(r.stems[k][0], a, b);
    // opening: the solo, with strings underneath (not silent, not louder than the solo)
    expect(sec('harmony', 0.5, 2.4)).toBeGreaterThan(sec('lead', 0.5, 2.4) - 14);
    expect(sec('bass', 0.2, 2.3)).toBeLessThan(-90); // basses enter in section 2
    // full orchestra: strings, horns, harp and timpani as loud as the melody (within 4 dB)
    expect(Math.abs(sec('harmony', 6.5, 9.5) - sec('lead', 6.5, 9.5))).toBeLessThan(4);
    expect(sec('bass', 3, 9)).toBeGreaterThan(sec('lead', 3, 9) - 12);
    expect(sec('cadence', 12.5, 14)).toBeGreaterThan(-60);
  });

  it('has no clicks: the waveform never jumps (second difference stays smooth)', () => {
    for (const p of ['glass', 'wood', 'felt'] as Palette[]) {
      const L = mix(render(p));
      let worst = 0;
      for (let i = 2; i < L.length; i++) worst = Math.max(worst, Math.abs(L[i] - 2 * L[i - 1] + L[i - 2]));
      // a click is a jump of the order of the signal itself; smooth music stays far below
      expect(worst, p).toBeLessThan(0.06);
    }
  });

  it('renders quickly enough to be ready before you press play', () => {
    const t = performance.now();
    renderStems(perf, 'wood', BEAT);
    expect(performance.now() - t).toBeLessThan(8000);
  });
});
