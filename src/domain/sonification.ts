/**
 * Sonification — the one musical grammar shared by Guided, Probe, Draw and Compare.
 *
 * value --(profile range)--> u in [0,1] --round(u*10)--> one of 11 fixed notes.
 * Pure functions only: the same input and profile always give the same note.
 */
import type { NoteEvent, Quantity, ScanSample } from './sourceTypes';

export const PITCHES = ['C3', 'D3', 'E3', 'G3', 'A3', 'C4', 'D4', 'E4', 'G4', 'A4', 'C5'] as const;
export type Pitch = (typeof PITCHES)[number];

/** Spec 7.2, verbatim behaviour. */
export function valueToNote(value: number | null, min: number, max: number): Pitch | null {
  if (value === null || !Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max) || !(max > min)) return null;
  const u = Math.min(1, Math.max(0, (value - min) / (max - min)));
  return PITCHES[Math.round(u * (PITCHES.length - 1))];
}

export type MappingProfile = {
  id: string;
  quantityKind: Quantity['kind'];
  min: number;
  max: number;
  units: Quantity['units'];
  unitLabel: string;
  label: string;
};

/** Profile B — the active profile: normalized visual feature. */
export const VISUAL_FEATURE_PROFILE: MappingProfile = {
  id: 'visual-feature-v1',
  quantityKind: 'visual-feature',
  min: 0,
  max: 1,
  units: 'normalized_0_1',
  unitLabel: 'normalized (0–1), not °C',
  label: 'Normalized palette position',
};

/** Profile A — only valid once Pipeline A (numeric ECCO2) is verified. Kept for tests and future use. */
export const MODEL_SST_PROFILE: MappingProfile = {
  id: 'model-sst-v1',
  quantityKind: 'model-sst',
  min: 0,
  max: 32,
  units: 'degC',
  unitLabel: '°C (modeled)',
  label: 'Modeled sea-surface temperature',
};

export type MappingExplanation = {
  value: number;
  u: number;
  rawU: number;
  index: number;
  note: Pitch;
  clamped: boolean;
};

/** Every step of the transformation, for the inspector. Displayed value is never clamped. */
export function explainMapping(value: number, profile: MappingProfile): MappingExplanation | null {
  const note = valueToNote(value, profile.min, profile.max);
  if (note === null) return null;
  const rawU = (value - profile.min) / (profile.max - profile.min);
  const u = Math.min(1, Math.max(0, rawU));
  return { value, u, rawU, index: Math.round(u * (PITCHES.length - 1)), note, clamped: rawU !== u };
}

/** Refuse to map a quantity with the wrong profile — a runtime guard on top of the types. */
export function noteForQuantity(q: Quantity | null, profile: MappingProfile): Pitch | null {
  if (!q) return null;
  if (q.kind !== profile.quantityKind || q.units !== profile.units) {
    throw new Error(`Profile ${profile.id} cannot map quantity of kind ${q.kind} (${q.units})`);
  }
  return valueToNote(q.value, profile.min, profile.max);
}

/** Bass sits one octave below the melody's scale. */
export function bassOf(note: Pitch | null): string | null {
  if (!note) return null;
  return note.replace(/(\d)$/, (d) => String(Number(d) - 1));
}

export const BEATS_PER_BAR = 4;
export const BASS_SEGMENT = 8;

export type EventConfig = { profile: MappingProfile; accentThreshold: number };

/**
 * Build the 64 note events for a scan. Deterministic.
 *  - Melody: the sample's own value.
 *  - Rhythm: accent when |value - previous valid value| >= threshold (spatial
 *    difference along the route in listening order — not a change over time).
 *  - Bass: mean of valid melody values in each 8-step segment.
 */
export function buildEvents(samples: ScanSample[], cfg: EventConfig): NoteEvent[] {
  const segMeans = new Map<number, number | null>();
  for (let s = 0; s < samples.length; s += BASS_SEGMENT) {
    const vals = samples.slice(s, s + BASS_SEGMENT).map((x) => x.quantity?.value).filter((v): v is number => v !== undefined);
    segMeans.set(s / BASS_SEGMENT, vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null);
  }
  let prev: number | null = null;
  return samples.map((sample, i) => {
    const v = sample.quantity?.value ?? null;
    const note = noteForQuantity(sample.quantity, cfg.profile);
    const delta = v !== null && prev !== null ? v - prev : null;
    if (v !== null) prev = v;
    const seg = Math.floor(i / BASS_SEGMENT);
    const bassValue = segMeans.get(seg) ?? null;
    const bassNote = bassOf(valueToNote(bassValue, cfg.profile.min, cfg.profile.max));
    return {
      index: i,
      beat: i,
      durationBeats: 1,
      note,
      delta,
      accent: delta !== null && Math.abs(delta) >= cfg.accentThreshold,
      bassNote,
      bassValue,
      bassOnset: i % (BASS_SEGMENT / 2) === 0 && bassNote !== null,
      source: sample,
    };
  });
}

/** FNV-1a over the musically and scientifically relevant fields. */
export function eventHash(events: NoteEvent[]): string {
  const text = events
    .map((e) => [e.index, e.note ?? '-', e.accent ? 1 : 0, e.bassNote ?? '-', e.source.frameId, e.source.cell?.join(':') ?? 'x', e.source.quantity?.value ?? 'r'].join('|'))
    .join(';');
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/* ------------------------------------------------------------------ */
/* Programs: what the transport actually plays, one step per beat.     */
/* ------------------------------------------------------------------ */

export type Layer = 'melody' | 'bass' | 'rhythm' | 'atmosphere';
export const LAYERS: Layer[] = ['melody', 'bass', 'rhythm', 'atmosphere'];

export type ProgramStep = {
  frameId: string | null;
  sampleIndex: number | null;
  event: NoteEvent | null;
  layers: Record<Layer, boolean>;
  marker?: 'A' | 'B';
};

export type Program = { id: string; steps: ProgramStep[] };

const ALL_ON: Record<Layer, boolean> = { melody: true, bass: true, rhythm: true, atmosphere: true };

/**
 * Staged arrangement (Guided passage only): melody from beat 1, bass from 9,
 * atmosphere from 17, accents from 25. Aesthetic entrances; mapping unchanged.
 */
export function stagedLayers(beat: number): Record<Layer, boolean> {
  return { melody: true, bass: beat >= 8, atmosphere: beat >= 16, rhythm: beat >= 24 };
}

export function routeProgram(id: string, events: NoteEvent[], frameId: string, staged = false): Program {
  return {
    id,
    steps: events.map((e) => ({ frameId, sampleIndex: e.index, event: e, layers: staged ? stagedLayers(e.index) : ALL_ON })),
  };
}

/** A/B sequential excerpt: identical subsequence on A, a short silence, then B. */
export function abProgram(id: string, eventsA: NoteEvent[], frameA: string, eventsB: NoteEvent[], frameB: string, start: number, length: number, gap = 2): Program {
  const s = Math.max(0, Math.min(start, eventsA.length - length));
  const take = (ev: NoteEvent[], f: string, marker: 'A' | 'B'): ProgramStep[] =>
    ev.slice(s, s + length).map((e) => ({ frameId: f, sampleIndex: e.index, event: e, layers: ALL_ON, marker }));
  const silence: ProgramStep[] = Array.from({ length: gap }, () => ({ frameId: null, sampleIndex: null, event: null, layers: ALL_ON }));
  return { id, steps: [...take(eventsA, frameA, 'A'), ...silence, ...take(eventsB, frameB, 'B')] };
}

/** A short excerpt around one event, e.g. "Replay this event". */
export function excerptProgram(id: string, events: NoteEvent[], frameId: string, center: number, before = 2, after = 1): Program {
  const s = Math.max(0, center - before);
  const e = Math.min(events.length, center + after + 1);
  return { id, steps: events.slice(s, e).map((ev) => ({ frameId, sampleIndex: ev.index, event: ev, layers: ALL_ON })) };
}

export const TEMPO_BPM = 96;
export const BEAT_SECONDS = 60 / TEMPO_BPM;
