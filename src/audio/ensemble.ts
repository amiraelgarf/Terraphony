/**
 * The ensemble — how a record's events are PERFORMED by a small orchestra (pure,
 * no sound). The record's MusicEvents (lead note per sample, bass = block mean,
 * accent = declared change, closing chord) stay exactly as the musical rule
 * defines them; arrange() only decides the orchestration around them, so the data
 * mapping, recipes and tests never change.
 *
 * Every bar is 4 notes (one bass block). Harmony is a pentatonic triad built on the
 * data's own bass (sections 2–3) or on the melody (sections 1 and 4), so every added
 * note belongs to the same 5-note collection as the data notes — nothing clashes.
 *
 *   section 1  solo + soft strings                     the data, gently supported
 *   section 2  + violins double the melody, basses (data), timpani on the downbeat
 *   section 3  + horns swell, harp eighth notes (the rhythm), glockenspiel on changes
 *   section 4  resolve: harp in quarter notes, strings and horns hold, closing chord
 */
import type { MusicEvent } from '../data/types';
import { PITCHES_MIDI } from './normalize';

export type Hit = { midi: number; at: number; dur: number; vel: number };
export type PerformedEvent = {
  index: number;
  lead: Hit | null;
  violin: Hit | null;
  strings: Hit[];
  horns: Hit[];
  harp: Hit[];
  bass: Hit | null;
  timpani: Hit | null;
  chime: Hit | null;
  cadence: Hit[];
};

const BAR = 4;
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

/** Keep a voice inside its comfortable register. */
const within = (m: number, lo: number, hi: number) => {
  let x = m;
  while (x < lo) x += 12;
  while (x > hi) x -= 12;
  return x;
};

export function arrange(events: MusicEvent[]): PerformedEvent[] {
  let root: number | null = null; // current bar's harmony root (around C3–C4)
  return events.map((e, i) => {
    const section = e.section;
    const downbeat = i % BAR === 0;
    const bassEv = e.supportingEvents.find((s) => s.instrumentId === 'bass' && s.midiNote !== undefined);
    const accent = e.supportingEvents.find((s) => s.instrumentId === 'accent');
    const cad = e.supportingEvents.find((s) => s.instrumentId === 'cadence' && s.midiNotes);

    // the bar's harmony: the data bass when there is one, otherwise the melody's first note of the bar
    if (bassEv) root = within(bassEv.midiNote! + 12, 48, 59);
    else if (downbeat) {
      const anchor = e.midiNote ?? events.slice(i, i + BAR).find((x) => x.midiNote !== null)?.midiNote ?? null;
      if (anchor !== null) root = within(scaleStep(anchor, 0), 48, 59);
    }

    const out: PerformedEvent = { index: i, lead: null, violin: null, strings: [], horns: [], harp: [], bass: null, timpani: null, chime: null, cadence: [] };

    // the data melody: solo, doubled by the violins from section 2
    if (e.midiNote !== null) {
      out.lead = { midi: e.midiNote, at: 0, dur: 0.92, vel: 0.75 };
      if (section >= 2) out.violin = { midi: within(e.midiNote, 60, 79), at: 0, dur: 0.96, vel: section === 4 ? 0.5 : 0.62 };
    }

    if (root !== null) {
      const chord = triad(root);
      // strings hold the bar's chord from the very first bar (softly at first)
      if (downbeat) out.strings = chord.map((m) => ({ midi: m, at: 0, dur: 3.85, vel: section === 1 ? 0.7 : 0.75 }));
      // horns: warm root + fifth swells
      if (downbeat && section >= 3) out.horns = [root, chord[2]].map((m) => ({ midi: within(m, 48, 62), at: 0, dur: 3.6, vel: section === 4 ? 0.5 : 0.6 }));
      // harp: the rhythm — eighth notes in section 3, quarter notes in the resolve
      if (section === 3) out.harp = [0, 0.5].map((at, k) => ({ midi: within(chord[(i * 2 + k) % 3] + 12, 60, 84), at, dur: 0.45, vel: k === 0 ? 0.62 : 0.48 }));
      if (section === 4) out.harp = [{ midi: within(chord[i % 3] + 12, 60, 84), at: 0, dur: 0.8, vel: 0.5 }];
      // basses: the data bass (sections 2–3); in the resolve they hold the chord root
      if (bassEv) out.bass = { midi: bassEv.midiNote!, at: 0, dur: 3.8, vel: bassEv.velocity ?? 0.65 };
      else if (section === 4 && downbeat) out.bass = { midi: within(root - 12, 36, 47), at: 0, dur: 3.8, vel: 0.55 };
      // timpani: a soft stroke on each downbeat from section 2, tuned to the bar's root
      if (downbeat && section >= 2) out.timpani = { midi: within(root - 12, 36, 45), at: 0, dur: 0.5, vel: section === 4 ? 0.45 : 0.6 };
    }

    if (accent) out.chime = { midi: within((e.midiNote ?? 72) + 12, 72, 96), at: 0.002, dur: 0.5, vel: Math.min(0.7, accent.velocity ?? 0.6) };
    if (cad) out.cadence = cad.midiNotes!.map((m) => ({ midi: m, at: 1, dur: 3, vel: cad.velocity ?? 0.35 }));
    return out;
  });
}
