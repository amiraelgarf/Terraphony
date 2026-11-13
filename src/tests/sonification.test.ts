import { describe, expect, it } from 'vitest';
import {
  MODEL_SST_PROFILE, PITCHES, VISUAL_FEATURE_PROFILE, abProgram, buildEvents, eventHash, explainMapping,
  noteForQuantity, routeProgram, stagedLayers, valueToNote,
} from '../domain/sonification';
import type { Quantity, ScanSample } from '../domain/sourceTypes';

const feature = (value: number): Quantity => ({ kind: 'visual-feature', value, units: 'normalized_0_1', featureName: 'f', confidence: 1, provenanceId: 'p' });
const sample = (index: number, value: number | null): ScanSample => ({
  index, frameId: 'f', timeUTC: null, position: { pixelX: index, pixelY: 0 }, cell: [index, 0],
  quantity: value === null ? null : feature(value), invalidReason: value === null ? 'occluded' : undefined,
});
const cfg = { profile: VISUAL_FEATURE_PROFILE, accentThreshold: 0.1 };

describe('valueToNote (spec 17.4)', () => {
  it('returns null for null, NaN and invalid spans', () => {
    expect(valueToNote(null, 0, 32)).toBeNull();
    expect(valueToNote(NaN, 0, 32)).toBeNull();
    expect(valueToNote(10, 5, 5)).toBeNull();
    expect(valueToNote(10, 32, 0)).toBeNull();
    expect(valueToNote(10, 0, Infinity)).toBeNull();
  });
  it('maps the numeric SST profile 0→C3, 16→C4, 32→C5', () => {
    expect(valueToNote(0, 0, 32)).toBe('C3');
    expect(valueToNote(16, 0, 32)).toBe('C4');
    expect(valueToNote(32, 0, 32)).toBe('C5');
  });
  it('maps the image-feature profile 0→C3, 0.5→C4, 1→C5', () => {
    expect(valueToNote(0, 0, 1)).toBe('C3');
    expect(valueToNote(0.5, 0, 1)).toBe('C4');
    expect(valueToNote(1, 0, 1)).toBe('C5');
  });
  it('uses exactly 11 ascending notes', () => {
    expect(PITCHES).toHaveLength(11);
    const seen = new Set(Array.from({ length: 101 }, (_, i) => valueToNote(i / 100, 0, 1)));
    expect(seen.size).toBe(11);
  });
});

describe('explainMapping', () => {
  it('clamps only the audio, never the displayed value', () => {
    const e = explainMapping(1.3, VISUAL_FEATURE_PROFILE)!;
    expect(e.value).toBe(1.3);
    expect(e.note).toBe('C5');
    expect(e.clamped).toBe(true);
    expect(explainMapping(0.5, VISUAL_FEATURE_PROFILE)!.clamped).toBe(false);
  });
  it('shows the index arithmetic', () => {
    const e = explainMapping(0.734, VISUAL_FEATURE_PROFILE)!;
    expect(e.index).toBe(7);
    expect(e.note).toBe(PITCHES[7]);
  });
});

describe('quantity kinds cannot be confused', () => {
  it('refuses to map an image feature with the SST profile and vice versa', () => {
    expect(() => noteForQuantity(feature(0.5), MODEL_SST_PROFILE)).toThrow();
    const sst: Quantity = { kind: 'model-sst', value: 20, units: 'degC', provenanceId: 'x' };
    expect(() => noteForQuantity(sst, VISUAL_FEATURE_PROFILE)).toThrow();
    expect(noteForQuantity(sst, MODEL_SST_PROFILE)).toBe('D4'); // 20/32=0.625 -> index 6
  });
  it('visual profile never advertises °C as its unit', () => {
    expect(VISUAL_FEATURE_PROFILE.units).toBe('normalized_0_1');
    expect(VISUAL_FEATURE_PROFILE.unitLabel).toContain('not °C');
  });
});

describe('buildEvents', () => {
  const samples = [0.1, 0.12, null, 0.4, 0.42, 0.41, 0.8, 0.79, 0.5, null].map((v, i) => sample(i, v));
  const events = buildEvents(samples, cfg);

  it('produces one event per sample and rests for missing data', () => {
    expect(events).toHaveLength(samples.length);
    expect(events[2].note).toBeNull();
    expect(events[9].note).toBeNull();
  });
  it('accents use spatial differences to the previous valid sample in listening order', () => {
    expect(events[3].delta).toBeCloseTo(0.28); // 0.4 - 0.12, skipping the rest
    expect(events[3].accent).toBe(true);
    expect(events[4].accent).toBe(false);
    expect(events[0].delta).toBeNull();
  });
  it('bass is the mean of valid values in each 8-step segment', () => {
    const mean = (0.1 + 0.12 + 0.4 + 0.42 + 0.41 + 0.8 + 0.79) / 7;
    expect(events[0].bassValue).toBeCloseTo(mean);
    expect(events[0].bassOnset).toBe(true);
    expect(events[4].bassOnset).toBe(true);
    expect(events[1].bassOnset).toBe(false);
    expect(events[8].bassValue).toBeCloseTo(0.5);
  });
  it('reversing the route recomputes accents in the new order', () => {
    const rev = buildEvents([...samples].reverse().map((s, i) => ({ ...s, index: i })), cfg);
    expect(rev[6].delta).toBeCloseTo(0.4 - 0.42); // reversed order: ...0.42 then 0.4
  });
  it('is deterministic: identical input gives an identical hash', () => {
    expect(eventHash(buildEvents(samples, cfg))).toBe(eventHash(events));
    const changed = buildEvents(samples.map((s, i) => (i === 4 ? sample(4, 0.9) : s)), cfg);
    expect(eventHash(changed)).not.toBe(eventHash(events));
  });
});

describe('programs', () => {
  const events = buildEvents(Array.from({ length: 64 }, (_, i) => sample(i, i / 63)), cfg);
  it('staged arrangement only changes entrances, never notes', () => {
    const staged = routeProgram('s', events, 'f', true);
    const plain = routeProgram('p', events, 'f', false);
    expect(staged.steps.map((s) => s.event?.note)).toEqual(plain.steps.map((s) => s.event?.note));
    expect(stagedLayers(0)).toEqual({ melody: true, bass: false, atmosphere: false, rhythm: false });
    expect(stagedLayers(24)).toEqual({ melody: true, bass: true, atmosphere: true, rhythm: true });
  });
  it('A/B program plays the identical subsequence on both frames, sequentially', () => {
    const p = abProgram('ab', events, 'fa', events, 'fb', 10, 8, 2);
    expect(p.steps).toHaveLength(18);
    expect(p.steps.slice(0, 8).map((s) => s.sampleIndex)).toEqual(p.steps.slice(10).map((s) => s.sampleIndex));
    expect(p.steps[8].event).toBeNull();
    expect(new Set(p.steps.slice(0, 8).map((s) => s.frameId))).toEqual(new Set(['fa']));
    expect(new Set(p.steps.slice(10).map((s) => s.frameId))).toEqual(new Set(['fb']));
  });
});
