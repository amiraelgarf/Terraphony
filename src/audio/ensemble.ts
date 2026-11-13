/**
 * The ensemble — how a record's events are PERFORMED (pure, no sound).
 *
 * The record's MusicEvents (lead note per sample, bass = block mean, accent =
 * declared change, closing chord) stay exactly as the musical rule defines them.
 * arrange() only adds one derived voice for depth, so the data mapping, recipes
 * and tests never change:
 *
 *   lead     data: the sample's note (as the original engine played it)
 *   bass     data: block mean, unchanged
 *   chord    soft strings: a pentatonic triad on the bass note (sections 2–3), or on
 *            the current melody note in the resolve — derived, adds no data
 *   chime    data: a declared change, now a soft bell (was a noise burst)
 *   cadence  the closing chord (artistic)
 *
 * Section 1 is still the lead alone, so the listener first hears the data unaccompanied.
 */
import type { MusicEvent } from '../data/types';
import { PITCHES_MIDI } from './normalize';

export type Hit = { midi: number; at: number; dur: number; vel: number };
export type PerformedEvent = {
  index: number;
  lead: Hit | null;
  bass: Hit | null;
  chord: Hit[];
  chime: Hit | null;
  cadence: Hit[];
};

const BLOCK = 4;
/** Pitch classes of the pentatonic collection the notes come from (C D E G A). */
const SCALE_PC = [...new Set(PITCHES_MIDI.map((m) => m % 12))].sort((a, b) => a - b);

/** The scale note `steps` pentatonic degrees above `midi` (midi snapped down to the scale first). */
export function scaleStep(midi: number, steps: number): number {
  let m = midi;
  while (!SCALE_PC.includes(((m % 12) + 12) % 12)) m--;
  let k = 0;
  while (k < steps) {
    m++;
    if (SCALE_PC.includes(m % 12)) k++;
  }
  return m;
}

/** A consonant pentatonic triad on `root`: root, two and three degrees up (C-E-G, D-G-A, E-A-C, G-C-D, A-D-E). */
export function triad(root: number): number[] {
  return [root, scaleStep(root, 2), scaleStep(root, 3)];
}

export function arrange(events: MusicEvent[]): PerformedEvent[] {
  let chordRoot: number | null = null;
  return events.map((e, i) => {
    const section = e.section;
    const blockStart = i % BLOCK === 0;
    const bassEv = e.supportingEvents.find((s) => s.instrumentId === 'bass' && s.midiNote !== undefined);
    const accent = e.supportingEvents.find((s) => s.instrumentId === 'accent');
    const cad = e.supportingEvents.find((s) => s.instrumentId === 'cadence' && s.midiNotes);

    // the strings follow the data's own bass (block mean); in the resolve they follow the melody
    if (bassEv) chordRoot = bassEv.midiNote! + 12;
    else if (section === 4 && blockStart && e.midiNote !== null) chordRoot = scaleStep(e.midiNote - 12, 0);
    if (section === 1) chordRoot = null;

    const out: PerformedEvent = { index: i, lead: null, bass: null, chord: [], chime: null, cadence: [] };
    if (e.midiNote !== null) out.lead = { midi: e.midiNote, at: 0, dur: 0.92, vel: 0.72 };
    if (bassEv) out.bass = { midi: bassEv.midiNote!, at: 0, dur: 3.7, vel: bassEv.velocity ?? 0.6 };
    if (chordRoot !== null && blockStart && section >= 2) out.chord = triad(chordRoot).map((m) => ({ midi: m, at: 0, dur: 3.8, vel: 0.4 }));
    if (accent) out.chime = { midi: (e.midiNote ?? 72) + 12, at: 0.002, dur: 0.6, vel: Math.min(0.7, accent.velocity ?? 0.6) };
    if (cad) out.cadence = cad.midiNotes!.map((m) => ({ midi: m, at: 1, dur: 3, vel: cad.velocity ?? 0.35 }));
    return out;
  });
}

// The audio engine holds live browser audio state (AudioContext, instruments, scheduled
// notes). Hot-swapping this module in development would leave the page with a fresh,
// silent engine; reload the page instead.
if (import.meta.hot) import.meta.hot.accept(() => window.location.reload());
