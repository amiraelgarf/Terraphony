/**
 * Instrument characters — art changes TIMBRE, never the measurement-to-pitch rule.
 *
 * This is the original, proven sound engine (lead, bass, closing chord, one reverb,
 * gentle compressor + limiter) with three small additions for depth:
 *   - a soft, low string pad (harmony built on the data bass — adds no data)
 *   - a slightly rounder, lower bass
 *   - change accents are soft bells instead of filtered noise bursts
 *
 *   glass  Glass & tide  struck FM bell, long controlled decay, airy room
 *   wood   Wood & earth  short mallet (4:1 FM partial), warm and dry
 *   felt   Felt & dusk   filtered soft triangle, rounded, intimate
 *
 * Five buses so layers can be muted / soloed without clicks:
 *   lead     data: the sample value
 *   bass     data: block mean, an octave lower
 *   harmony  strings: a pad on the bass (derived, no data)
 *   accent   data: a declared change between neighbouring samples
 *   cadence  ARTISTIC: the closing chord, never data
 *
 * createVoices() receives the Tone module (loaded only after a user gesture) and
 * uses its current context, so the very same code renders the live record and
 * the offline WAV export.
 */
import type * as ToneNS from 'tone';
import type { InstrumentId } from '../data/types';
import type { PerformedEvent } from './ensemble';

export type Layer = 'lead' | 'bass' | 'harmony' | 'accent' | 'cadence';
export const LAYERS: Layer[] = ['lead', 'bass', 'harmony', 'accent', 'cadence'];
export const LAYER_LEVELS: Record<Layer, number> = { lead: 0.95, bass: 0.65, harmony: 0.5, accent: 0.5, cadence: 0.35 };
export const ALL_LAYERS_ON: Record<Layer, boolean> = { lead: true, bass: true, harmony: true, accent: true, cadence: true };

export const PALETTES: { id: InstrumentId; name: string; description: string }[] = [
  { id: 'glass', name: 'Glass & tide', description: 'Airy, resonant struck glass' },
  { id: 'wood', name: 'Wood & earth', description: 'Tactile, mellow mallet' },
  { id: 'felt', name: 'Felt & dusk', description: 'Warm, intimate felt' },
];
export const paletteName = (id: InstrumentId) => PALETTES.find((p) => p.id === id)?.name ?? id;

type Mono = ToneNS.Synth | ToneNS.FMSynth;

/**
 * A fixed set of single-note voices used round-robin. Unlike PolySynth it never
 * drops notes that are scheduled far ahead (a whole record is queued at once),
 * and its cost is constant.
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

/** The playing instruments. A fresh set is made for each play session (see Voices.renew). */
export type SynthSet = {
  lead: VoicePool;
  bass: ToneNS.MonoSynth;
  pad: VoicePool;
  chime: VoicePool;
  cadence: ToneNS.PolySynth;
  dispose: () => void;
  fadeOut: (seconds: number) => void;
};

export type Voices = {
  /** Current instruments; replaced by renew(). */
  set: SynthSet;
  /**
   * Notes are handed to the audio engine well ahead of time, so they survive a busy
   * page. To stop instantly (pause / seek), the current instruments fade out in 30 ms
   * and are thrown away with any notes still queued on them; a fresh set takes over.
   */
  renew: () => void;
  thump: ToneNS.MembraneSynth;
  buses: Record<Layer, ToneNS.Gain>;
  master: ToneNS.Volume;
  output: ToneNS.ToneAudioNode;
  ready: Promise<void>;
  dispose: () => void;
};

const SPEC: Record<InstrumentId, { reverb: { decay: number; wet: number; preDelay: number }; leadFilter: number; padFilter: number }> = {
  glass: { reverb: { decay: 4, wet: 0.3, preDelay: 0.03 }, leadFilter: 5200, padFilter: 1100 },
  wood: { reverb: { decay: 2.6, wet: 0.17, preDelay: 0.01 }, leadFilter: 3000, padFilter: 900 },
  felt: { reverb: { decay: 4.2, wet: 0.26, preDelay: 0.05 }, leadFilter: 1100, padFilter: 650 },
};

function makeLeadVoice(Tone: typeof ToneNS, id: InstrumentId): Mono {
  if (id === 'glass') {
    return new Tone.FMSynth({
      harmonicity: 3.01,
      modulationIndex: 1.6,
      oscillator: { type: 'sine' },
      modulation: { type: 'sine' },
      envelope: { attack: 0.003, decay: 1.5, sustain: 0, release: 1.6 },
      modulationEnvelope: { attack: 0.002, decay: 0.45, sustain: 0, release: 0.4 },
      volume: 0,
    });
  }
  if (id === 'wood') {
    return new Tone.FMSynth({
      harmonicity: 4,
      modulationIndex: 3.2,
      oscillator: { type: 'sine' },
      modulation: { type: 'triangle' },
      envelope: { attack: 0.002, decay: 0.55, sustain: 0, release: 0.35 },
      modulationEnvelope: { attack: 0.001, decay: 0.07, sustain: 0, release: 0.05 },
      volume: 1,
    });
  }
  return new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.022, decay: 1.1, sustain: 0.04, release: 1.3 },
    volume: 2,
  });
}

export function createVoices(Tone: typeof ToneNS, id: InstrumentId): Voices {
  const spec = SPEC[id];
  // levels: the mix peaks near -3 dBFS like ordinary music; a gentle compressor only
  // rounds off the loudest moments (no pumping), the limiter is a safety net
  const limiter = new Tone.Limiter(-1);
  const compressor = new Tone.Compressor({ threshold: -10, ratio: 2, attack: 0.02, release: 0.3 }).connect(limiter);
  const master = new Tone.Volume(4).connect(compressor);
  const reverb = new Tone.Reverb(spec.reverb).connect(master);

  const buses = {
    lead: new Tone.Gain(LAYER_LEVELS.lead).connect(reverb),
    bass: new Tone.Gain(LAYER_LEVELS.bass).connect(master),
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
    const leadTone = new Tone.Filter({ frequency: spec.leadFilter, type: 'lowpass', rolloff: -12 }).connect(gates.lead);
    const lead = new VoicePool(Array.from({ length: 6 }, () => makeLeadVoice(Tone, id))).connect(leadTone);

    // a little lower and rounder than before: more depth, same notes
    const bass = new Tone.MonoSynth({
      oscillator: { type: 'triangle' },
      filter: { type: 'lowpass', Q: 0.4, rolloff: -24 },
      filterEnvelope: { attack: 0.03, decay: 0.5, sustain: 0.5, release: 1, baseFrequency: id === 'felt' ? 120 : 160, octaves: 1.3 },
      envelope: { attack: 0.05, decay: 0.6, sustain: 0.6, release: 1.2 },
      volume: -11,
    }).connect(gates.bass);

    // soft low strings: slow attack, plain triangle, low-passed (no detune, no chorus)
    const padTone = new Tone.Filter({ frequency: spec.padFilter, type: 'lowpass', rolloff: -24 }).connect(gates.harmony);
    const pad = new VoicePool(
      Array.from({ length: 6 }, () => new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.5, decay: 0.6, sustain: 0.7, release: 1.2 }, volume: -25 })),
    ).connect(padTone);

    // a declared change: a soft bell (was a filtered noise burst)
    const chime = new VoicePool(
      Array.from({ length: 3 }, () => new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.002, decay: 0.7, sustain: 0, release: 0.5 }, volume: -16 })),
    ).connect(gates.accent);

    const cadenceTone = new Tone.Filter({ frequency: 1400, type: 'lowpass', rolloff: -24 }).connect(gates.cadence);
    const cadence = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fatsine', count: 3, spread: 14 },
      envelope: { attack: 0.35, decay: 1.2, sustain: 0.55, release: 2.6 },
      volume: -14,
    }).connect(cadenceTone);
    const own: { dispose(): unknown }[] = [lead, leadTone, bass, pad, padTone, chime, cadence, cadenceTone, ...Object.values(gates)];
    return {
      lead, bass, pad, chime, cadence,
      dispose: () => own.forEach((n) => n.dispose()),
      fadeOut: (seconds) => {
        const now = Tone.immediate();
        Object.values(gates).forEach((g) => {
          g.gain.cancelScheduledValues(now);
          g.gain.setValueAtTime(g.gain.value, now);
          g.gain.linearRampToValueAtTime(0, now + seconds);
        });
      },
    };
  };
  let set = makeSet();

  // stylus touch for the press (UI punctuation, not data)
  const thump = new Tone.MembraneSynth({ pitchDecay: 0.02, octaves: 2, envelope: { attack: 0.001, decay: 0.22, sustain: 0, release: 0.1 }, volume: -20 }).connect(master);

  const nodes: { dispose(): unknown }[] = [thump, reverb, master, compressor, limiter, ...Object.values(buses)];
  const voices: Voices = {
    set,
    renew: () => {
      const old = set;
      old.fadeOut(0.03);
      setTimeout(() => old.dispose(), 250);
      set = makeSet();
      voices.set = set;
    },
    thump, buses, master, output: limiter,
    ready: reverb.ready,
    dispose: () => {
      set.dispose();
      nodes.forEach((n) => n.dispose());
    },
  };
  return voices;
}

/** Play one performed event at `time` (seconds on the voices' context). Used live and offline. */
export function perform(Tone: typeof ToneNS, voices: Voices, p: PerformedEvent, time: number, beat: number) {
  const v = voices.set;
  const f = (m: number) => Tone.Frequency(m, 'midi').toFrequency();
  if (p.lead) v.lead.triggerAttackRelease(f(p.lead.midi), p.lead.dur * beat, time, p.lead.vel);
  if (p.bass) v.bass.triggerAttackRelease(f(p.bass.midi), p.bass.dur * beat, time, p.bass.vel);
  if (p.chord.length) v.pad.triggerAttackRelease(p.chord.map((h) => f(h.midi)), p.chord[0].dur * beat, time, p.chord[0].vel);
  if (p.chime) v.chime.triggerAttackRelease(f(p.chime.midi), p.chime.dur * beat, time + p.chime.at * beat, p.chime.vel);
  if (p.cadence.length) v.cadence.triggerAttackRelease(p.cadence.map((h) => f(h.midi)), p.cadence[0].dur * beat, time + p.cadence[0].at * beat, p.cadence[0].vel);
}

/** Release every sustained voice now (pause / seek). */
export function releaseAll(voices: Voices, now: number) {
  const v = voices.set;
  v.lead.releaseAll(now);
  v.bass.triggerRelease(now);
  v.pad.releaseAll(now);
  v.chime.releaseAll(now);
  v.cadence.releaseAll(now);
}

// The audio engine holds live browser audio state (AudioContext, instruments, scheduled
// notes). Hot-swapping this module in development would leave the page with a fresh,
// silent engine; reload the page instead.
if (import.meta.hot) import.meta.hot.accept(() => window.location.reload());
