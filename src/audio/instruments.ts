/**
 * Instrument characters — art changes TIMBRE, never the measurement-to-pitch rule.
 *
 *   glass  Glass & tide  struck FM bell, long controlled decay, airy room
 *   wood   Wood & earth  short mallet (4:1 FM partial), warm and dry
 *   felt   Felt & dusk   filtered soft triangle, rounded, intimate
 *
 * Every palette has the same four voices on separate buses so layers can be
 * muted / soloed without clicks:
 *   lead    data: the sample value
 *   bass    data: block mean, an octave lower
 *   accent  data: a declared change between neighbouring samples
 *   cadence ARTISTIC: the closing chord, never data
 *
 * createVoices() receives the Tone module (loaded only after a user gesture) and
 * uses its current context, so the very same code renders the live record and
 * the offline WAV export.
 */
import type * as ToneNS from 'tone';
import type { InstrumentId } from '../data/types';

export type Layer = 'lead' | 'bass' | 'accent' | 'cadence';
export const LAYERS: Layer[] = ['lead', 'bass', 'accent', 'cadence'];
export const LAYER_LEVELS: Record<Layer, number> = { lead: 0.95, bass: 0.6, accent: 0.5, cadence: 0.35 };

export const PALETTES: { id: InstrumentId; name: string; description: string }[] = [
  { id: 'glass', name: 'Glass & tide', description: 'Airy, resonant struck glass' },
  { id: 'wood', name: 'Wood & earth', description: 'Tactile, mellow mallet' },
  { id: 'felt', name: 'Felt & dusk', description: 'Warm, intimate felt' },
];
export const paletteName = (id: InstrumentId) => PALETTES.find((p) => p.id === id)?.name ?? id;

export type Voices = {
  lead: ToneNS.PolySynth;
  bass: ToneNS.MonoSynth;
  accent: ToneNS.NoiseSynth;
  cadence: ToneNS.PolySynth;
  thump: ToneNS.MembraneSynth;
  buses: Record<Layer, ToneNS.Gain>;
  master: ToneNS.Volume;
  output: ToneNS.ToneAudioNode;
  ready: Promise<void>;
  dispose: () => void;
};

const SPEC: Record<InstrumentId, { reverb: { decay: number; wet: number; preDelay: number }; leadFilter: number; accentBand: number; accentQ: number }> = {
  glass: { reverb: { decay: 6.5, wet: 0.34, preDelay: 0.03 }, leadFilter: 5200, accentBand: 5200, accentQ: 2.2 },
  wood: { reverb: { decay: 2.6, wet: 0.17, preDelay: 0.01 }, leadFilter: 3000, accentBand: 1300, accentQ: 3.5 },
  felt: { reverb: { decay: 4.2, wet: 0.26, preDelay: 0.05 }, leadFilter: 1100, accentBand: 650, accentQ: 1.2 },
};

function makeLead(Tone: typeof ToneNS, id: InstrumentId): ToneNS.PolySynth {
  if (id === 'glass') {
    return new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3.01,
      modulationIndex: 1.6,
      oscillator: { type: 'sine' },
      modulation: { type: 'sine' },
      envelope: { attack: 0.003, decay: 1.5, sustain: 0, release: 1.6 },
      modulationEnvelope: { attack: 0.002, decay: 0.45, sustain: 0, release: 0.4 },
      volume: -11,
    });
  }
  if (id === 'wood') {
    return new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 4,
      modulationIndex: 3.2,
      oscillator: { type: 'sine' },
      modulation: { type: 'triangle' },
      envelope: { attack: 0.002, decay: 0.55, sustain: 0, release: 0.35 },
      modulationEnvelope: { attack: 0.001, decay: 0.07, sustain: 0, release: 0.05 },
      volume: -9,
    });
  }
  return new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.022, decay: 1.1, sustain: 0.04, release: 1.3 },
    volume: -8,
  });
}

export function createVoices(Tone: typeof ToneNS, id: InstrumentId): Voices {
  const spec = SPEC[id];
  const limiter = new Tone.Limiter(-3);
  const compressor = new Tone.Compressor({ threshold: -18, ratio: 3, attack: 0.01, release: 0.25 }).connect(limiter);
  const master = new Tone.Volume(-8).connect(compressor);
  const reverb = new Tone.Reverb(spec.reverb).connect(master);

  const buses = {
    lead: new Tone.Gain(LAYER_LEVELS.lead).connect(reverb),
    bass: new Tone.Gain(LAYER_LEVELS.bass).connect(master),
    accent: new Tone.Gain(LAYER_LEVELS.accent).connect(reverb),
    cadence: new Tone.Gain(LAYER_LEVELS.cadence).connect(reverb),
  } satisfies Record<Layer, ToneNS.Gain>;

  const leadTone = new Tone.Filter({ frequency: spec.leadFilter, type: 'lowpass', rolloff: -12 }).connect(buses.lead);
  const lead = makeLead(Tone, id).connect(leadTone);
  lead.maxPolyphony = 10;

  const bass = new Tone.MonoSynth({
    oscillator: { type: 'triangle' },
    filter: { type: 'lowpass', Q: 0.4, rolloff: -24 },
    filterEnvelope: { attack: 0.03, decay: 0.5, sustain: 0.5, release: 1, baseFrequency: id === 'felt' ? 140 : 190, octaves: 1.3 },
    envelope: { attack: 0.05, decay: 0.6, sustain: 0.5, release: 1.2 },
    volume: -13,
  }).connect(buses.bass);

  const accentTone = new Tone.Filter({ frequency: spec.accentBand, type: 'bandpass', Q: spec.accentQ }).connect(buses.accent);
  const accent = new Tone.NoiseSynth({
    noise: { type: id === 'felt' ? 'brown' : 'pink' },
    envelope: { attack: 0.001, decay: id === 'wood' ? 0.06 : 0.11, sustain: 0, release: 0.04 },
    volume: -12,
  }).connect(accentTone);

  const cadenceTone = new Tone.Filter({ frequency: 1400, type: 'lowpass', rolloff: -24 }).connect(buses.cadence);
  const cadence = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'fatsine', count: 3, spread: 14 },
    envelope: { attack: 0.35, decay: 1.2, sustain: 0.55, release: 2.6 },
    volume: -14,
  }).connect(cadenceTone);

  // stylus touch for the press (UI punctuation, not data)
  const thump = new Tone.MembraneSynth({ pitchDecay: 0.02, octaves: 2, envelope: { attack: 0.001, decay: 0.22, sustain: 0, release: 0.1 }, volume: -20 }).connect(master);

  const nodes: { dispose(): unknown }[] = [lead, leadTone, bass, accent, accentTone, cadence, cadenceTone, thump, reverb, master, compressor, limiter, ...Object.values(buses)];
  return {
    lead, bass, accent, cadence, thump, buses, master, output: limiter,
    ready: reverb.ready,
    dispose: () => nodes.forEach((n) => n.dispose()),
  };
}
