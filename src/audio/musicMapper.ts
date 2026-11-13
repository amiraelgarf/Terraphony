/**
 * Observations -> musical events. Deterministic: same samples + same rule
 * => same events (unit-tested). Order is never changed.
 *
 * Arrangement (brief section 7.3), proportional to the record length N:
 *   section 1  lead only                         first ~5/24
 *   section 2  + bass, re-struck every 4 events  until ~12/24
 *   section 3  + accents on declared changes     until ~20/24
 *   section 4  resolve: bass rests, accents stay, then an ARTISTIC cadence chord
 *
 * Data layers:   lead  = the sample value
 *                bass  = mean of the valid values in the current block of 4 events, an octave down
 *                accent= |value - previous valid value| >= rule.accentThreshold
 * Artistic layer: cadence chord after the last event (marked artistic, never data).
 */
import type { MusicEvent, MusicalRule, ObservationSample, SupportingEvent } from '../data/types';
import { PITCHES_MIDI, valueToMidi } from './normalize';

export const BLOCK = 4;
export const CADENCE_MIDI = [48, 55, 64, 67]; // C3 G3 E4 G4 — consonant with the scale; artistic

export function sectionBounds(n: number) {
  return {
    bassFrom: Math.round((n * 5) / 24),
    accentFrom: Math.round((n * 12) / 24),
    resolveFrom: Math.round((n * 20) / 24),
  };
}

export function sectionOf(i: number, n: number): 1 | 2 | 3 | 4 {
  const b = sectionBounds(n);
  if (i >= b.resolveFrom) return 4;
  if (i >= b.accentFrom) return 3;
  if (i >= b.bassFrom) return 2;
  return 1;
}

export function blockMean(samples: ObservationSample[], i: number): number | null {
  const start = Math.floor(i / BLOCK) * BLOCK;
  const vals = samples.slice(start, start + BLOCK).flatMap((s) => (s.status === 'valid' && s.numericValue !== null ? [s.numericValue] : []));
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

/** Change from the previous VALID sample in listening order (null if none). */
export function changeFromPrevious(samples: ObservationSample[], i: number): number | null {
  const s = samples[i];
  if (s.status !== 'valid' || s.numericValue === null) return null;
  for (let j = i - 1; j >= 0; j--) {
    const p = samples[j];
    if (p.status === 'valid' && p.numericValue !== null) return s.numericValue - p.numericValue;
  }
  return null;
}

export function buildEvents(samples: ObservationSample[], rule: MusicalRule): MusicEvent[] {
  const n = samples.length;
  const pitches = rule.noteCollectionMidi.length ? rule.noteCollectionMidi : [...PITCHES_MIDI];
  return samples.map((s, i) => {
    const section = sectionOf(i, n);
    const valid = s.status === 'valid' && s.numericValue !== null;
    const mapped = valid ? valueToMidi(s.numericValue!, rule.domainMin, rule.domainMax, pitches) : null;
    const delta = changeFromPrevious(samples, i);
    const changeMarked = delta !== null && Math.abs(delta) >= rule.accentThreshold;
    const support: SupportingEvent[] = [];

    if ((section === 2 || section === 3) && i % BLOCK === 0) {
      const m = blockMean(samples, i);
      if (m !== null) support.push({ instrumentId: 'bass', midiNote: valueToMidi(m, rule.domainMin, rule.domainMax, pitches).midi - 12, velocity: 0.6 });
    }
    if (section >= 3 && changeMarked) support.push({ instrumentId: 'accent', velocity: Math.min(1, 0.45 + Math.abs(delta!) / (rule.accentThreshold * 6)) });
    if (i === n - 1) support.push({ instrumentId: 'cadence', midiNotes: CADENCE_MIDI, velocity: 0.35, artistic: true });

    return {
      sequenceIndex: i,
      atBeat: i,
      durationBeats: 1,
      midiNote: mapped ? mapped.midi : null,
      supportingEvents: support,
      sampleId: s.id,
      section,
      changeMarked,
      clamped: mapped?.clamped ?? false,
    };
  });
}

/** Index of the largest change between neighbouring valid samples (>= 2 from either end). */
export function notableIndex(samples: ObservationSample[]): number | null {
  let best: number | null = null, bestAbs = -1;
  for (let i = 2; i < samples.length - 1; i++) {
    const d = changeFromPrevious(samples, i);
    if (d !== null && Math.abs(d) > bestAbs) {
      bestAbs = Math.abs(d);
      best = i;
    }
  }
  return best;
}

/** Stable short hash of the audible content (used for record ids and tests). */
export function eventHash(events: MusicEvent[]): string {
  let h = 0x811c9dc5;
  const str = events
    .map((e) => `${e.sequenceIndex}:${e.midiNote ?? 'r'}:${e.supportingEvents.map((s) => `${s.instrumentId}${s.midiNote ?? ''}`).join(',')}`)
    .join('|');
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
