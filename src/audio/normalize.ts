/**
 * value -> u in [0,1] -> pentatonic note. The ONE mapping every story uses.
 *
 *   u = clamp((value - lo) / (hi - lo), 0, 1)
 *   index = round(u * (PITCHES.length - 1))
 *
 * The domain [lo, hi] is fixed per story (published in the UI and in every
 * record recipe) and never re-scaled between places, dates or routes.
 */
export const PITCHES_MIDI = [48, 50, 52, 55, 57, 60, 62, 64, 67, 69, 72] as const;
export const SCALE_LABEL = 'C major pentatonic, C3–C5 (11 notes)';
export const NORMALIZER_VERSION = 'linear-clamp-1.0';

const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const NAMES_ASCII = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const midiToName = (m: number) => `${NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;
/** Tone.js-compatible name */
export const midiToTone = (m: number) => `${NAMES_ASCII[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;

export function normalize(value: number, lo: number, hi: number) {
  const raw = (value - lo) / (hi - lo);
  return { u: Math.min(1, Math.max(0, raw)), clamped: raw < 0 || raw > 1 };
}

export function noteIndex(u: number, n: number = PITCHES_MIDI.length) {
  // Math.round(x) == floor(x + 0.5) for x >= 0 — identical to the Python reference.
  return Math.round(u * (n - 1));
}

export function valueToMidi(value: number, lo: number, hi: number, pitches: readonly number[] = PITCHES_MIDI) {
  const { u, clamped } = normalize(value, lo, hi);
  const index = noteIndex(u, pitches.length);
  return { midi: pitches[index], index, u, clamped };
}

/** The value interval that maps to a given note index (for "why this note?"). */
export function noteBand(index: number, lo: number, hi: number, n: number = PITCHES_MIDI.length) {
  const step = (hi - lo) / (n - 1);
  const a = index === 0 ? -Infinity : lo + (index - 0.5) * step;
  const b = index === n - 1 ? Infinity : lo + (index + 0.5) * step;
  return [a, b] as const;
}
