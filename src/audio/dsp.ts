/**
 * The orchestra, rendered (pure DSP — no Web Audio, no DOM, no randomness).
 *
 * A record is ~15 s and fully known in advance, so instead of synthesising live
 * (hundreds of real-time audio nodes that a busy computer cannot always keep up
 * with: gaps, crackles, cut-outs), the whole performance is computed once into
 * sample buffers — one stereo stem per mixer layer — and then simply played back.
 * Playback of a buffer is the cheapest, most reliable sound a browser can make.
 *
 * Every instrument here is built for smoothness:
 *   - band-limited wavetables (no aliasing hiss), interpolated
 *   - raised-cosine attacks (no clicks), exponential decays, release tails that
 *     always end at exactly zero
 *   - legato bowed voices (violins, strings, basses, horns) that overlap gently
 *   - a soft stereo hall reverb
 *
 * Same input -> bit-identical output (tested), so the live record, the WAV export
 * and the tests all hear exactly the same thing.
 */
import type { Hit, PerformedEvent } from './ensemble';

export const SR = 44100;
export type Palette = 'glass' | 'wood' | 'felt';
export type StemName = 'lead' | 'bass' | 'harmony' | 'accent' | 'cadence';
export type Stereo = [Float32Array, Float32Array];
export type Rendered = { sampleRate: number; length: number; stems: Record<StemName, Stereo>; peak: number };

const TAU = Math.PI * 2;
const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

/* ------------------------------------------------------------------ */
/* Wavetables                                                          */
/* ------------------------------------------------------------------ */

const N = 2048;
const tableCache = new Map<string, Float32Array>();

/** A single-cycle table from a harmonic recipe, band-limited to `maxN` harmonics, peak-normalised. */
function table(id: string, amp: (n: number) => number, maxN: number): Float32Array {
  const key = `${id}:${maxN}`;
  let t = tableCache.get(key);
  if (t) return t;
  t = new Float32Array(N + 1);
  for (let n = 1; n <= maxN; n++) {
    const a = amp(n);
    if (a === 0) continue;
    for (let i = 0; i < N; i++) t[i] += a * Math.sin((TAU * n * i) / N);
  }
  let peak = 0;
  for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(t[i]));
  for (let i = 0; i < N; i++) t[i] /= peak || 1;
  t[N] = t[0];
  tableCache.set(key, t);
  return t;
}
const SINE = table('sine', (n) => (n === 1 ? 1 : 0), 1);

/** Harmonics allowed under `cutoff` (and safely under Nyquist) for a note of frequency f. */
const bandLimit = (f: number, cutoff: number, cap = 40) => Math.max(1, Math.min(cap, Math.floor(Math.min(cutoff, SR * 0.42) / f)));

/* ------------------------------------------------------------------ */
/* Envelopes and voices (inner loops use running multipliers: fast)    */
/* ------------------------------------------------------------------ */

type Env = { attack: number; decay: number; sustain: number; release: number };

type VoiceSpec = {
  /** one or more detuned copies (cents) for warmth */
  detune?: number[];
  env: Env;
  gain: number;
  pan: number; // -1..1
  /** wavetable recipe and brightness cutoff (Hz) */
  recipe: { id: string; amp: (n: number) => number; cutoff: number };
  vibrato?: { rate: number; depth: number; delay: number };
};

const panL = (p: number) => Math.cos(((Math.max(-1, Math.min(1, p)) + 1) * Math.PI) / 4);
const panR = (p: number) => Math.sin(((Math.max(-1, Math.min(1, p)) + 1) * Math.PI) / 4);

/**
 * A sustained (bowed / blown) note: raised-cosine attack, exponential decay to the
 * sustain level, then an exponential release with a linear taper that lands on 0.
 */
function note(out: Stereo, start: number, f: number, hold: number, vel: number, s: VoiceSpec) {
  const L = out[0], R = out[1];
  const i0 = Math.round(start * SR);
  if (i0 >= L.length) return;
  const e = s.env;
  const nA = Math.max(1, Math.round(Math.max(0.002, e.attack) * SR));
  const nH = Math.max(nA, Math.round(hold * SR));
  const nR = Math.max(1, Math.round(Math.max(0.01, e.release) * SR));
  const kd = Math.exp(-1 / (Math.max(0.01, e.decay) * SR));
  const kr = Math.exp(-4.6 / nR);
  const tab = table(s.recipe.id, s.recipe.amp, bandLimit(f, s.recipe.cutoff));
  const copies = s.detune ?? [0];
  const g = (s.gain * vel) / Math.sqrt(copies.length);
  const vib = s.vibrato;
  const vInc = vib ? vib.rate / SR : 0;
  const vStart = vib ? Math.round(vib.delay * SR) : 0;
  const vRamp = Math.round(0.3 * SR);
  for (let c = 0; c < copies.length; c++) {
    const inc0 = (f * Math.pow(2, copies[c] / 1200)) / SR;
    const spread = copies.length > 1 ? ((c / (copies.length - 1)) * 2 - 1) * 0.35 : 0;
    const gl = panL(s.pan + spread) * g, gr = panR(s.pan + spread) * g;
    let phase = (c * 0.37) % 1, vPhase = 0, decay = 1, rel = 1, level = 0;
    const end = Math.min(L.length - i0, nH + nR);
    for (let k = 0; k < end; k++) {
      if (k < nA) level = 0.5 - 0.5 * Math.cos((Math.PI * k) / nA);
      else if (k < nH) {
        decay *= kd;
        level = e.sustain + (1 - e.sustain) * decay;
      } else {
        rel *= kr;
      }
      const amp = k < nH ? level : level * rel * (1 - (k - nH) / nR);
      let inc = inc0;
      if (vib && k > vStart) {
        vPhase += vInc;
        vPhase -= vPhase | 0;
        const vx = vPhase * N, vj = vx | 0;
        inc *= 1 + vib.depth * Math.min(1, (k - vStart) / vRamp) * (SINE[vj] + (SINE[vj + 1] - SINE[vj]) * (vx - vj));
      }
      phase += inc;
      phase -= phase | 0;
      const x = phase * N, j = x | 0;
      const v = (tab[j] + (tab[j + 1] - tab[j]) * (x - j)) * amp;
      L[i0 + k] += v * gl;
      R[i0 + k] += v * gr;
    }
  }
}

/** A struck bar / bell with modes (ratio, amp, decay): celesta, marimba, glockenspiel, timpani, harp, felt piano. */
function struck(out: Stereo, start: number, f: number, hold: number, vel: number, opts: { modes: [number, number, number][]; attack: number; gain: number; pan: number; damp?: number; drop?: { ratio: number; time: number } }) {
  const L = out[0], R = out[1];
  const i0 = Math.round(start * SR);
  if (i0 >= L.length) return;
  const longest = Math.max(...opts.modes.map((m) => m[2]));
  const dampT = opts.damp ?? 0.35;
  const ring = Math.min(hold + dampT, longest * 5);
  const nRing = Math.round(ring * SR);
  const nHold = Math.round(hold * SR);
  const nA = Math.max(1, Math.round(opts.attack * SR));
  const nTail = Math.round(0.02 * SR);
  const kDamp = Math.exp(-4.6 / (dampT * SR));
  const modes = opts.modes.filter(([ratio]) => f * ratio < SR * 0.42);
  const M = modes.length;
  const inc = modes.map(([ratio]) => (f * ratio) / SR);
  const amp = modes.map(([, a]) => a);
  const kk = modes.map(([, , d]) => Math.exp(-1 / (d * SR)));
  const ph = modes.map((_, m) => (m * 0.21) % 1);
  const g = opts.gain * vel;
  const gl = panL(opts.pan) * g, gr = panR(opts.pan) * g;
  const drop = opts.drop;
  const kDrop = drop ? Math.exp(-1 / (drop.time * SR)) : 0;
  let bend = drop ? drop.ratio - 1 : 0, damp = 1;
  const end = Math.min(L.length - i0, nRing);
  for (let k = 0; k < end; k++) {
    const att = k < nA ? 0.5 - 0.5 * Math.cos((Math.PI * k) / nA) : 1;
    if (k > nHold) damp *= kDamp;
    const tail = k > nRing - nTail ? (nRing - k) / nTail : 1;
    if (drop) bend *= kDrop;
    let v = 0;
    for (let m = 0; m < M; m++) {
      ph[m] += inc[m] * (1 + bend);
      ph[m] -= ph[m] | 0;
      const x = ph[m] * N, j = x | 0;
      v += (SINE[j] + (SINE[j + 1] - SINE[j]) * (x - j)) * amp[m];
      amp[m] *= kk[m];
    }
    v *= att * damp * tail;
    L[i0 + k] += v * gl;
    R[i0 + k] += v * gr;
  }
}

/* ------------------------------------------------------------------ */
/* The instruments                                                     */
/* ------------------------------------------------------------------ */

const saw = (roll: number) => (n: number) => (1 / n) * Math.exp(-n / roll);

function lead(out: Stereo, p: Palette, at: number, f: number, hold: number, vel: number) {
  if (p === 'glass') {
    // celesta: fundamental + the bright 4th-ish partial, short shimmer
    struck(out, at, f, hold, vel, { modes: [[1, 1, 1.1], [2, 0.18, 0.5], [4.02, 0.22, 0.18], [6.9, 0.05, 0.08]], attack: 0.006, gain: 0.42, pan: -0.08, damp: 0.6 });
  } else if (p === 'wood') {
    // marimba: modes near 1 : 4 : 10, woody and short
    struck(out, at, f, hold, vel, { modes: [[1, 1, 0.55], [3.98, 0.32, 0.12], [9.9, 0.06, 0.04]], attack: 0.006, gain: 0.46, pan: -0.08, damp: 0.4 });
  } else {
    // felt piano: soft hammer, warm harmonics that fade faster as they go up
    struck(out, at, f, hold, vel, { modes: [[1, 1, 1.6], [2.002, 0.42, 0.9], [3.006, 0.2, 0.55], [4.01, 0.1, 0.35], [5.02, 0.05, 0.25]], attack: 0.012, gain: 0.4, pan: -0.08, damp: 0.5 });
  }
}

const VIOLINS: VoiceSpec = { detune: [-5, 5], env: { attack: 0.09, decay: 0.4, sustain: 0.8, release: 0.32 }, gain: 0.18, pan: -0.35, recipe: { id: 'violin', amp: saw(9), cutoff: 4200 }, vibrato: { rate: 5.3, depth: 0.0028, delay: 0.16 } };
const strings = (p: Palette): VoiceSpec => ({ detune: [-7, 0, 7], env: { attack: 0.5, decay: 0.8, sustain: 0.85, release: 0.9 }, gain: 0.11, pan: 0, recipe: { id: `strings-${p}`, amp: saw(p === 'felt' ? 4 : 6), cutoff: p === 'felt' ? 1400 : 2200 } });
const HORNS: VoiceSpec = { detune: [-3, 3], env: { attack: 0.16, decay: 0.5, sustain: 0.8, release: 0.5 }, gain: 0.16, pan: 0.3, recipe: { id: 'horn', amp: (n) => Math.pow(n, -1.1) * Math.exp(-n / 3.2), cutoff: 1600 } };
const BASSES: VoiceSpec = { detune: [-4, 4], env: { attack: 0.12, decay: 0.6, sustain: 0.8, release: 0.6 }, gain: 0.34, pan: 0.05, recipe: { id: 'bass', amp: saw(3.5), cutoff: 900 } };
const CADENCE: VoiceSpec = { detune: [-6, 6], env: { attack: 0.4, decay: 1.2, sustain: 0.6, release: 2.0 }, gain: 0.13, pan: 0, recipe: { id: 'cadence', amp: saw(2.2), cutoff: 1800 } };

function harp(out: Stereo, at: number, f: number, hold: number, vel: number) {
  struck(out, at, f, hold, vel, { modes: [[1, 1, 0.9], [2, 0.45, 0.45], [3, 0.2, 0.25], [4, 0.1, 0.15]], attack: 0.004, gain: 0.42, pan: 0.4, damp: 0.6 });
}
function timpani(out: Stereo, at: number, f: number, hold: number, vel: number) {
  struck(out, at, f, hold, vel, { modes: [[1, 1, 0.9], [1.5, 0.45, 0.5], [1.99, 0.22, 0.35]], attack: 0.006, gain: 0.6, pan: -0.15, damp: 1.2, drop: { ratio: 1.04, time: 0.06 } });
}
function glockenspiel(out: Stereo, at: number, f: number, hold: number, vel: number) {
  struck(out, at, f, hold, vel, { modes: [[1, 1, 0.8], [2.76, 0.25, 0.25], [5.4, 0.08, 0.1]], attack: 0.004, gain: 0.3, pan: 0.45, damp: 0.8 });
}

/* ------------------------------------------------------------------ */
/* Room                                                                */
/* ------------------------------------------------------------------ */

let scratch: Float32Array[] = [];
const scratchOf = (k: number, len: number) => {
  if (!scratch[k] || scratch[k].length < len) scratch[k] = new Float32Array(len);
  const a = scratch[k].subarray(0, len);
  a.fill(0);
  return a;
};

/** A soft stereo hall (Freeverb-style: damped combs into allpasses), added in place. */
function reverb(st: Stereo, decay: number, wet: number) {
  if (wet <= 0) return;
  const [L, R] = st;
  // skip the silence before the stem's first sound (bass, bells and the closing chord start late)
  let first = 0;
  while (first < L.length && L[first] === 0 && R[first] === 0) first += 64;
  if (first >= L.length) return;
  first = Math.max(0, first - 64);
  const len = L.length - first;
  const combs = [1116, 1277, 1422, 1557];
  const aps = [556, 341];
  const mono = scratchOf(0, len);
  for (let i = 0; i < len; i++) mono[i] = (L[first + i] + R[first + i]) * 0.04;
  const run = (spread: number, slot: number): Float32Array => {
    const out = scratchOf(slot, len);
    for (const c of combs) {
      const d = c + spread;
      const fb = Math.pow(10, (-3 * d) / (decay * SR));
      const buf = new Float32Array(d);
      let idx = 0, low = 0;
      for (let i = 0; i < len; i++) {
        const y = buf[idx];
        low = y * 0.72 + low * 0.28; // damping: highs fade faster, like a real room
        buf[idx] = mono[i] + low * fb;
        out[i] += y;
        if (++idx === d) idx = 0;
      }
    }
    for (const ap of aps) {
      const d = ap + spread;
      const buf = new Float32Array(d);
      let idx = 0;
      for (let i = 0; i < len; i++) {
        const b = buf[idx];
        const x = out[i];
        buf[idx] = x + b * 0.5;
        out[i] = b - x;
        if (++idx === d) idx = 0;
      }
    }
    return out;
  };
  const wl = run(0, 1), wr = run(23, 2);
  const w = wet * 1.25;
  for (let i = 0; i < len; i++) {
    L[first + i] += wl[i] * w;
    R[first + i] += wr[i] * w;
  }
}

/* ------------------------------------------------------------------ */
/* The record                                                          */
/* ------------------------------------------------------------------ */

const ROOM: Record<Palette, { decay: number; wet: Record<StemName, number> }> = {
  glass: { decay: 2.8, wet: { lead: 0.5, bass: 0.25, harmony: 0.55, accent: 0.6, cadence: 0.6 } },
  wood: { decay: 2.0, wet: { lead: 0.38, bass: 0.2, harmony: 0.45, accent: 0.5, cadence: 0.5 } },
  felt: { decay: 2.4, wet: { lead: 0.42, bass: 0.22, harmony: 0.5, accent: 0.55, cadence: 0.55 } },
};

/** Seconds of tail after the last beat (closing chord + room). */
export const RENDER_TAIL = 3.5;

/**
 * Render a performed record into five stereo stems (one per mixer layer). The stems
 * are scaled together so that their sum peaks at about -3 dBFS.
 */
export function renderStems(perf: PerformedEvent[], palette: Palette, beat: number, sampleRate = SR): Rendered {
  if (sampleRate !== SR) throw new Error('renderStems renders at 44.1 kHz');
  const length = Math.ceil((perf.length * beat + RENDER_TAIL + 2 * beat) * SR);
  const mk = (): Stereo => [new Float32Array(length), new Float32Array(length)];
  const stems: Record<StemName, Stereo> = { lead: mk(), bass: mk(), harmony: mk(), accent: mk(), cadence: mk() };
  const at = (i: number, h: Hit) => (i + h.at) * beat;
  const sustained = (out: Stereo, i: number, h: Hit, spec: VoiceSpec) => note(out, at(i, h), hz(h.midi), h.dur * beat, h.vel, spec);

  perf.forEach((p, i) => {
    if (p.lead) lead(stems.lead, palette, at(i, p.lead), hz(p.lead.midi), p.lead.dur * beat, p.lead.vel);
    if (p.violin) sustained(stems.lead, i, p.violin, VIOLINS);
    for (const h of p.strings) sustained(stems.harmony, i, h, strings(palette));
    for (const h of p.horns) sustained(stems.harmony, i, h, HORNS);
    for (const h of p.harp) harp(stems.harmony, at(i, h), hz(h.midi), h.dur * beat, h.vel);
    if (p.timpani) timpani(stems.harmony, at(i, p.timpani), hz(p.timpani.midi), p.timpani.dur * beat, p.timpani.vel);
    if (p.bass) sustained(stems.bass, i, p.bass, BASSES);
    if (p.chime) glockenspiel(stems.accent, at(i, p.chime), hz(p.chime.midi), p.chime.dur * beat, p.chime.vel);
    for (const h of p.cadence) sustained(stems.cadence, i, h, CADENCE);
  });

  const room = ROOM[palette];
  (Object.keys(stems) as StemName[]).forEach((k) => reverb(stems[k], room.decay, room.wet[k]));

  // one gain for all stems: the full mix peaks at -3 dBFS (0.708)
  const names = Object.keys(stems) as StemName[];
  const sumL = new Float32Array(length), sumR = new Float32Array(length);
  for (const k of names) {
    const [l, r] = stems[k];
    for (let i = 0; i < length; i++) {
      sumL[i] += l[i];
      sumR[i] += r[i];
    }
  }
  let peak = 0;
  for (let i = 0; i < length; i++) {
    const a = Math.abs(sumL[i]), b = Math.abs(sumR[i]);
    if (a > peak) peak = a;
    if (b > peak) peak = b;
  }
  const g = peak > 0 ? 0.708 / peak : 1;
  for (const k of names) for (const ch of stems[k]) for (let i = 0; i < length; i++) ch[i] *= g;
  scratch = [];
  return { sampleRate: SR, length, stems, peak: peak * g };
}

/** A single note or chord (previews, the press, the opening chime), as a stereo buffer. */
export function renderOneShot(kind: 'lead' | 'harp' | 'chord' | 'thump', palette: Palette, midis: number[], dur: number, spacing = 0): Stereo {
  const length = Math.ceil((dur + spacing * midis.length + 2.5) * SR);
  const out: Stereo = [new Float32Array(length), new Float32Array(length)];
  midis.forEach((m, k) => {
    const t = k * spacing;
    if (kind === 'lead') lead(out, palette, t, hz(m), dur, 0.75);
    else if (kind === 'harp') harp(out, t, hz(m), dur, 0.7);
    else if (kind === 'thump') timpani(out, t, hz(m), dur, 0.5);
    else note(out, 0, hz(m), dur, 0.45, CADENCE);
  });
  reverb(out, ROOM[palette].decay, 0.45);
  // a one-shot sits at the same loudness as the record (about -6 dBFS)
  let peak = 0;
  for (const ch of out) for (let i = 0; i < length; i++) peak = Math.max(peak, Math.abs(ch[i]));
  const g = peak > 0 ? 0.5 / peak : 1;
  for (const ch of out) for (let i = 0; i < length; i++) ch[i] *= g;
  return out;
}
