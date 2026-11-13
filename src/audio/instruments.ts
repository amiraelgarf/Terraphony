/**
 * Instruments — the fixed, original sound palette. Built once after audio unlock.
 *
 *   melody     soft FM "felt-mallet" voice            (data: sample value)
 *   bass       rounded triangle mono synth            (data: 8-step segment mean)
 *   rhythm     short low-pitched wooden "tok"         (data: spatial change >= threshold)
 *   atmosphere slow filtered pad, constant chord      (artistic, not data)
 *
 * Each layer has its own bus so solo/mute can ramp gain without clicks.
 * Reverb is aesthetic only; it never encodes data.
 */
import * as Tone from 'tone';
import type { Layer } from '../domain/sonification';

export type Instruments = {
  melody: Tone.PolySynth<Tone.FMSynth>;
  bass: Tone.MonoSynth;
  rhythm: Tone.MembraneSynth;
  pad: Tone.PolySynth<Tone.Synth>;
  buses: Record<Layer, Tone.Gain>;
  master: Tone.Volume;
  dispose: () => void;
};

/** Artistic pad chord — consonant with the melody's pentatonic scale. */
export const PAD_CHORD = ['C3', 'G3', 'D4', 'E4'];

export const LAYER_LEVELS: Record<Layer, number> = { melody: 0.9, bass: 0.55, rhythm: 0.35, atmosphere: 0.18 };

export function createInstruments(): Instruments {
  const limiter = new Tone.Limiter(-3).toDestination();
  const master = new Tone.Volume(-6).connect(limiter);
  const reverb = new Tone.Reverb({ decay: 5.5, preDelay: 0.02, wet: 0.28 }).connect(master);

  const buses = {
    melody: new Tone.Gain(LAYER_LEVELS.melody).connect(reverb),
    bass: new Tone.Gain(LAYER_LEVELS.bass).connect(master),
    rhythm: new Tone.Gain(LAYER_LEVELS.rhythm).connect(reverb),
    atmosphere: new Tone.Gain(LAYER_LEVELS.atmosphere).connect(reverb),
  } satisfies Record<Layer, Tone.Gain>;

  const melodyTone = new Tone.Filter({ frequency: 2600, type: 'lowpass', rolloff: -12 }).connect(buses.melody);
  const melody = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 2,
    modulationIndex: 1.4,
    oscillator: { type: 'sine' },
    modulation: { type: 'sine' },
    envelope: { attack: 0.006, decay: 0.7, sustain: 0.06, release: 1.6 },
    modulationEnvelope: { attack: 0.002, decay: 0.25, sustain: 0, release: 0.3 },
    volume: -10,
  }).connect(melodyTone);
  melody.maxPolyphony = 8;

  const bass = new Tone.MonoSynth({
    oscillator: { type: 'triangle' },
    filter: { type: 'lowpass', Q: 0.5, rolloff: -24 },
    filterEnvelope: { attack: 0.02, decay: 0.4, sustain: 0.5, release: 1, baseFrequency: 180, octaves: 1.4 },
    envelope: { attack: 0.04, decay: 0.5, sustain: 0.55, release: 1.4 },
    volume: -12,
  }).connect(buses.bass);

  const rhythmTone = new Tone.Filter({ frequency: 1800, type: 'lowpass' }).connect(buses.rhythm);
  const rhythm = new Tone.MembraneSynth({
    pitchDecay: 0.012,
    octaves: 1.6,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.14, sustain: 0, release: 0.08 },
    volume: -14,
  }).connect(rhythmTone);

  const padTone = new Tone.Filter({ frequency: 900, type: 'lowpass', rolloff: -24 }).connect(buses.atmosphere);
  const pad = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'fatsine', count: 3, spread: 18 },
    envelope: { attack: 2.5, decay: 1, sustain: 0.8, release: 4 },
    volume: -16,
  }).connect(padTone);

  const nodes: { dispose(): unknown }[] = [melody, melodyTone, bass, rhythm, rhythmTone, pad, padTone, reverb, master, limiter, ...Object.values(buses)];
  return { melody, bass, rhythm, pad, buses, master, dispose: () => nodes.forEach((n) => n.dispose()) };
}
