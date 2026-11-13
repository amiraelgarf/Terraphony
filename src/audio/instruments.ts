/**
 * Instrument characters — art changes TIMBRE, never the measurement-to-pitch rule.
 *
 * Each record is played by a small orchestra (who plays what, and when, is decided
 * by ensemble.ts; the data notes themselves never change):
 *
 *   lead      the palette's solo instrument — data: one note per sample
 *               glass  celesta (soft FM bell)   wood  marimba   felt  felt piano
 *   violins   double the data melody (bowed, from section 2)
 *   strings   sustained chords (violas / cellos), from the first bar
 *   horns     warm chord swells (from section 3)
 *   harp      eighth-note broken chords — the rhythm (from section 3)
 *   basses    data: the block mean, bowed
 *   timpani   soft strokes on each bar's downbeat, tuned to the bass
 *   glocken   data: a declared change (a soft bell)
 *   cadence   ARTISTIC: the closing chord
 *
 * Five mixer buses (mute / solo without clicks):
 *   lead     melody + violins        bass    basses
 *   harmony  strings, horns, harp, timpani (derived, add no data)
 *   accent   glockenspiel            cadence closing chord
 *
 * Click-free by construction: every bowed / blown voice has a soft attack, every
 * voice comes from a round-robin pool sized so that no voice is ever retriggered
 * while it is still sounding (retriggering a sounding voice is what clicks), and
 * the mix keeps headroom so the limiter never has to work.
 *
 * createVoices() receives the Tone module (loaded only after a user gesture) and
 * uses its current context, so the same code renders the live record and the WAV.
 */
import type * as ToneNS from 'tone';
import type { InstrumentId } from '../data/types';
import type { Hit, PerformedEvent } from './ensemble';

export type Layer = 'lead' | 'bass' | 'harmony' | 'accent' | 'cadence';
export const LAYERS: Layer[] = ['lead', 'bass', 'harmony', 'accent', 'cadence'];
export const LAYER_LEVELS: Record<Layer, number> = { lead: 1, bass: 0.6, harmony: 0.5, accent: 0.45, cadence: 0.45 };
export const ALL_LAYERS_ON: Record<Layer, boolean> = { lead: true, bass: true, harmony: true, accent: true, cadence: true };

export const PALETTES: { id: InstrumentId; name: string; description: string }[] = [
  { id: 'glass', name: 'Glass & tide', description: 'Celesta solo with strings, horns and harp' },
  { id: 'wood', name: 'Wood & earth', description: 'Marimba solo with strings, horns and harp' },
  { id: 'felt', name: 'Felt & dusk', description: 'Felt piano solo with dark strings and harp' },
];
export const paletteName = (id: InstrumentId) => PALETTES.find((p) => p.id === id)?.name ?? id;

type Mono = ToneNS.Synth | ToneNS.FMSynth | ToneNS.MonoSynth | ToneNS.MembraneSynth;

/**
 * A fixed set of single-note voices used round-robin. Never drops notes that are
 * scheduled far ahead (a whole record is queued at once) and costs nothing extra.
 */
export class VoicePool {
  private next = 0;
  constructor(private voices: Mono[]) {}
  connect(node: ToneNS.InputNode) {
    this.voices.forEach((v) => v.connect(node));
    return this;
  }
  triggerAttackRelease(notes: string | number | (string | number)[], duration: number, time: number, velocity = 1) {
    for (const note of Array.isArray(notes) ? notes : [notes]) {
      const v = this.voices[this.next++ % this.voices.length];
      v.triggerAttackRelease(note, duration, time, velocity);
    }
  }
  releaseAll(time: number) {
    this.voices.forEach((v) => v.triggerRelease(time));
  }
  dispose() {
    this.voices.forEach((v) => v.dispose());
  }
}

/** The playing instruments of one play session (see Voices.renew). */
export type SynthSet = {
  lead: VoicePool;
  violins: VoicePool;
  strings: VoicePool;
  horns: VoicePool;
  harp: VoicePool;
  bass: VoicePool;
  timpani: VoicePool;
  chime: VoicePool;
  cadence: VoicePool;
  dispose: () => void;
  fadeOut: (seconds: number) => void;
  fadeIn: () => void;
};

export type Voices = {
  /** Current instruments (built on first use after a renew). */
  readonly set: SynthSet;
  /**
   * Stop instantly: if the current instruments still have notes queued, they fade out
   * in 30 ms and are set aside (muted) until those notes have passed, and a ready spare
   * set takes over. Sets are built once, in idle time, and recycled — pausing, seeking
   * or changing scene never builds instruments.
   */
  renew: () => void;
  /** perform() reports how long the current set has notes queued. */
  busy: (until: number) => void;
  thump: ToneNS.MembraneSynth;
  buses: Record<Layer, ToneNS.Gain>;
  master: ToneNS.Volume;
  output: ToneNS.ToneAudioNode;
  ready: Promise<void>;
  dispose: () => void;
};

type Spec = { reverb: { decay: number; wet: number }; stringsCut: number; hornCut: number; harpCut: number };
const SPEC: Record<InstrumentId, Spec> = {
  glass: { reverb: { decay: 3.6, wet: 0.3 }, stringsCut: 1500, hornCut: 1000, harpCut: 3400 },
  wood: { reverb: { decay: 2.4, wet: 0.22 }, stringsCut: 1300, hornCut: 900, harpCut: 3000 },
  felt: { reverb: { decay: 3.0, wet: 0.27 }, stringsCut: 950, hornCut: 750, harpCut: 2200 },
};

function makeLeadVoice(Tone: typeof ToneNS, id: InstrumentId): Mono {
  if (id === 'glass') {
    // celesta: a round bell; low modulation keeps it sweet, the 6 ms attack keeps it click-free
    return new Tone.FMSynth({
      harmonicity: 3.01,
      modulationIndex: 0.7,
      oscillator: { type: 'sine' },
      modulation: { type: 'sine' },
      envelope: { attack: 0.008, decay: 1.4, sustain: 0.05, release: 1.2 },
      // the bright overtones bloom over 25 ms instead of striking at once: a bell without the "tick"
      modulationEnvelope: { attack: 0.025, decay: 0.45, sustain: 0, release: 0.4 },
      volume: -2,
    });
  }
  if (id === 'wood') {
    return new Tone.FMSynth({
      harmonicity: 4,
      modulationIndex: 1.3,
      oscillator: { type: 'sine' },
      modulation: { type: 'sine' },
      envelope: { attack: 0.008, decay: 0.7, sustain: 0.04, release: 0.5 },
      modulationEnvelope: { attack: 0.018, decay: 0.1, sustain: 0, release: 0.08 },
      volume: -1,
    });
  }
  return new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.02, decay: 1.1, sustain: 0.06, release: 1.0 }, volume: 0 });
}

const pool = (n: number, make: () => Mono) => new VoicePool(Array.from({ length: n }, make));

/**
 * Voices per instrument and their longest release (s). A voice is reused only after
 * every other voice of its pool has played, which must be later than its previous note
 * has fully died away — checked against the real arrangement in src/tests/ensemble.test.ts.
 */
export const POOL_PLAN = {
  lead: { voices: 4, release: 1.2 },
  violin: { voices: 3, release: 0.35 },
  strings: { voices: 6, release: 1.0 },
  horns: { voices: 4, release: 0.6 },
  harp: { voices: 4, release: 0.4 },
  bass: { voices: 2, release: 0.8 },
  timpani: { voices: 2, release: 0.4 },
  chime: { voices: 3, release: 0.5 },
  cadence: { voices: 4, release: 2.4 },
} as const;

export function createVoices(Tone: typeof ToneNS, id: InstrumentId): Voices {
  const spec = SPEC[id];
  // headroom first: the mix peaks around -5 dBFS, a gentle glue compressor, limiter only as a net
  const limiter = new Tone.Limiter(-1);
  const compressor = new Tone.Compressor({ threshold: -16, ratio: 2, attack: 0.03, release: 0.25 }).connect(limiter);
  const master = new Tone.Volume(0).connect(compressor);
  const reverb = new Tone.Reverb({ decay: spec.reverb.decay, preDelay: 0.03, wet: spec.reverb.wet }).connect(master);

  const buses = {
    lead: new Tone.Gain(LAYER_LEVELS.lead).connect(reverb),
    bass: new Tone.Gain(LAYER_LEVELS.bass).connect(reverb),
    harmony: new Tone.Gain(LAYER_LEVELS.harmony).connect(reverb),
    accent: new Tone.Gain(LAYER_LEVELS.accent).connect(reverb),
    cadence: new Tone.Gain(LAYER_LEVELS.cadence).connect(reverb),
  } satisfies Record<Layer, ToneNS.Gain>;

  const makeSet = (): SynthSet => {
    const gates = {
      lead: new Tone.Gain(1).connect(buses.lead),
      bass: new Tone.Gain(1).connect(buses.bass),
      harmony: new Tone.Gain(1).connect(buses.harmony),
      accent: new Tone.Gain(1).connect(buses.accent),
      cadence: new Tone.Gain(1).connect(buses.cadence),
    } satisfies Record<Layer, ToneNS.Gain>;
    const filt = (hz: number, to: ToneNS.InputNode) => new Tone.Filter({ frequency: hz, type: 'lowpass', rolloff: -24, Q: 0.5 }).connect(to);

    // solo (data) — 6 voices: a voice is reused only after 3 s, longer than any note rings
    const leadTone = filt(id === 'felt' ? 2600 : id === 'wood' ? 3200 : 4200, gates.lead);
    const lead = pool(POOL_PLAN.lead.voices, () => makeLeadVoice(Tone, id)).connect(leadTone);

    // violins double the melody: bowed, soft attack, gentle release
    const violinTone = filt(2600, gates.lead);
    const violins = pool(POOL_PLAN.violin.voices, () => new Tone.Synth({ oscillator: { type: 'fatsawtooth', count: 2, spread: 8 }, envelope: { attack: 0.08, decay: 0.2, sustain: 0.85, release: 0.35 }, volume: -24 })).connect(violinTone);

    // strings: sustained chords (3 notes, every bar) — 12 voices, each reused after 8 s
    const stringTone = filt(spec.stringsCut, gates.harmony);
    const strings = pool(POOL_PLAN.strings.voices, () => new Tone.Synth({ oscillator: { type: 'fatsawtooth', count: 2, spread: 10 }, envelope: { attack: 0.45, decay: 0.4, sustain: 0.8, release: 1.0 }, volume: -27 })).connect(stringTone);

    // horns: round, warm swells (2 notes per bar)
    const hornTone = filt(spec.hornCut, gates.harmony);
    const horns = pool(POOL_PLAN.horns.voices, () => new Tone.Synth({ oscillator: { type: 'fattriangle', count: 2, spread: 6 }, envelope: { attack: 0.18, decay: 0.3, sustain: 0.75, release: 0.6 }, volume: -17 })).connect(hornTone);

    // harp: plucked eighth notes — the rhythm
    const harpTone = filt(spec.harpCut, gates.harmony);
    const harp = pool(POOL_PLAN.harp.voices, () => new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.007, decay: 0.55, sustain: 0, release: 0.4 }, volume: -15 })).connect(harpTone);

    // basses (data): bowed, round — 2 voices alternate, so a sounding note is never retriggered
    const bassTone = filt(520, gates.bass);
    const bass = pool(POOL_PLAN.bass.voices, () => new Tone.Synth({ oscillator: { type: 'fatsawtooth', count: 2, spread: 6 }, envelope: { attack: 0.12, decay: 0.3, sustain: 0.85, release: 0.8 }, volume: -12 })).connect(bassTone);

    // timpani: soft, tuned strokes on the downbeat
    const timpaniTone = filt(700, gates.harmony);
    const timpani = pool(POOL_PLAN.timpani.voices, () => new Tone.MembraneSynth({ pitchDecay: 0.08, octaves: 1.2, oscillator: { type: 'sine' }, envelope: { attack: 0.01, decay: 0.8, sustain: 0, release: 0.4 }, volume: -10 })).connect(timpaniTone);

    // glockenspiel (data: a declared change)
    const chime = pool(POOL_PLAN.chime.voices, () => new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.01, decay: 0.7, sustain: 0, release: 0.5 }, volume: -18 })).connect(gates.accent);

    // closing chord (artistic)
    const cadenceTone = filt(1600, gates.cadence);
    const cadence = pool(POOL_PLAN.cadence.voices, () => new Tone.Synth({ oscillator: { type: 'fatsine', count: 2, spread: 12 }, envelope: { attack: 0.35, decay: 1.2, sustain: 0.55, release: 2.4 }, volume: -10 })).connect(cadenceTone);

    const own: { dispose(): unknown }[] = [lead, leadTone, violins, violinTone, strings, stringTone, horns, hornTone, harp, harpTone, bass, bassTone, timpani, timpaniTone, chime, cadence, cadenceTone, ...Object.values(gates)];
    return {
      lead, violins, strings, horns, harp, bass, timpani, chime, cadence,
      dispose: () => own.forEach((n) => n.dispose()),
      fadeOut: (seconds) => {
        const now = Tone.immediate();
        Object.values(gates).forEach((g) => {
          g.gain.cancelScheduledValues(now);
          g.gain.setValueAtTime(g.gain.value, now);
          g.gain.linearRampToValueAtTime(0, now + seconds);
        });
      },
      fadeIn: () => {
        const now = Tone.immediate();
        Object.values(gates).forEach((g) => {
          g.gain.cancelScheduledValues(now);
          g.gain.setValueAtTime(1, now);
        });
      },
    };
  };

  // the stylus touch for the press (UI punctuation, not data)
  const thump = new Tone.MembraneSynth({ pitchDecay: 0.02, octaves: 2, envelope: { attack: 0.002, decay: 0.22, sustain: 0, release: 0.1 }, volume: -20 }).connect(master);

  type Slot = { set: SynthSet; busyUntil: number };
  let active: Slot = { set: makeSet(), busyUntil: 0 };
  const spares: Slot[] = [];
  const muted: Slot[] = [];
  let idle: number | null = null;
  const hasWindow = typeof window !== 'undefined';
  const now = () => Tone.immediate();
  /** Muted sets whose queued notes have all passed become spares again. */
  const recycle = () => {
    for (let k = muted.length - 1; k >= 0; k--) {
      if (muted[k].busyUntil < now()) {
        const slot = muted.splice(k, 1)[0];
        if (spares.length < 2) {
          slot.set.fadeIn();
          slot.busyUntil = 0;
          spares.push(slot);
        } else slot.set.dispose();
      }
    }
  };
  /** Keep one spare ready, built when the page is idle. */
  const ensureSpare = () => {
    recycle();
    if (spares.length || idle !== null || !hasWindow) return;
    const run = () => {
      idle = null;
      recycle();
      if (!spares.length) spares.push({ set: makeSet(), busyUntil: 0 });
    };
    idle = window.requestIdleCallback ? window.requestIdleCallback(run, { timeout: 4000 }) : (setTimeout(run, 400) as unknown as number);
  };
  const nodes: { dispose(): unknown }[] = [thump, reverb, master, compressor, limiter, ...Object.values(buses)];
  return {
    get set() {
      return active.set;
    },
    busy: (until) => {
      active.busyUntil = Math.max(active.busyUntil, until);
    },
    renew: () => {
      // nothing queued on the current set: keep using it (no work at all)
      if (active.busyUntil <= now()) return;
      active.set.fadeOut(0.03);
      muted.push(active);
      recycle();
      active = spares.pop() ?? { set: makeSet(), busyUntil: 0 };
      ensureSpare();
    },
    thump, buses, master, output: limiter,
    ready: reverb.ready,
    dispose: () => {
      [active, ...spares, ...muted].forEach((x) => x.set.dispose());
      nodes.forEach((n) => n.dispose());
    },
  };
}

/** Play one performed event at `time` (seconds on the voices' context). Used live and offline. */
export function perform(Tone: typeof ToneNS, voices: Voices, p: PerformedEvent, time: number, beat: number) {
  const v = voices.set;
  const f = (m: number) => Tone.Frequency(m, 'midi').toFrequency();
  const at = (h: Hit) => time + h.at * beat;
  const play = (pool: VoicePool, hits: Hit[]) => hits.forEach((h) => pool.triggerAttackRelease(f(h.midi), h.dur * beat, at(h), h.vel));
  if (p.lead) play(v.lead, [p.lead]);
  if (p.violin) play(v.violins, [p.violin]);
  play(v.strings, p.strings);
  play(v.horns, p.horns);
  play(v.harp, p.harp);
  if (p.bass) play(v.bass, [p.bass]);
  if (p.timpani) play(v.timpani, [p.timpani]);
  if (p.chime) play(v.chime, [p.chime]);
  play(v.cadence, p.cadence);
  // the set holds queued sound until the longest note of this event has died away
  voices.busy(time + 5 * beat + 2.5);
}

/** Release every sustained voice now (natural end). */
export function releaseAll(voices: Voices, now: number) {
  const v = voices.set;
  [v.lead, v.violins, v.strings, v.horns, v.harp, v.bass, v.timpani, v.chime, v.cadence].forEach((p) => p.releaseAll(now));
}
