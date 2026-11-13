import { describe, expect, it } from 'vitest';
import { checkTemporalComparable, comparePoint } from '../domain/compare';
import { VISUAL_FEATURE_PROFILE } from '../domain/sonification';
import type { Quantity } from '../domain/sourceTypes';
import { frameA, frameB, manifest } from './helpers';

const f = (value: number): Quantity => ({ kind: 'visual-feature', value, units: 'normalized_0_1', featureName: 'f', confidence: 1, provenanceId: 'p' });

describe('temporal comparability', () => {
  it('accepts the validated pair', () => {
    expect(checkTemporalComparable(manifest, frameA, frameB)).toEqual({ ok: true });
  });
  it('rejects a frame compared with itself', () => {
    expect(checkTemporalComparable(manifest, frameA, frameA).ok).toBe(false);
  });
  it('rejects a different camera/registration', () => {
    expect(checkTemporalComparable(manifest, frameA, { ...frameB, visualProjection: 'unregistered-image' }).ok).toBe(false);
    expect(checkTemporalComparable(manifest, frameA, { ...frameB, width: 1920 }).ok).toBe(false);
  });
  it('rejects mismatched time provenance', () => {
    expect(checkTemporalComparable(manifest, frameA, { ...frameB, captureOrModelTimeUTC: null }).ok).toBe(false);
  });
  it('rejects incompatible quantity profiles', () => {
    expect(checkTemporalComparable(manifest, frameA, { ...frameB, variable: 'sst_absolute_degC' }).ok).toBe(false);
  });
  it('rejects pairs that did not pass alignment validation', () => {
    expect(checkTemporalComparable({ ...manifest, availableComparablePairs: [] }, frameA, frameB).ok).toBe(false);
  });
});

describe('point comparison', () => {
  it('computes B − A in the quantity’s own units', () => {
    const c = comparePoint(f(0.3), f(0.62), VISUAL_FEATURE_PROFILE);
    expect(c.comparable).toBe(true);
    if (c.comparable) {
      expect(c.delta).toBeCloseTo(0.32);
      expect(c.units).toBe('normalized_0_1');
    }
  });
  it('never invents a difference when one side is missing', () => {
    expect(comparePoint(f(0.3), null, VISUAL_FEATURE_PROFILE).comparable).toBe(false);
  });
  it('detects the same note from different values (quantization)', () => {
    const c = comparePoint(f(0.71), f(0.74), VISUAL_FEATURE_PROFILE);
    expect(c.comparable && c.sameNote).toBe(true);
    if (c.comparable) expect(c.delta).not.toBe(0);
  });
  it('refuses to compare different quantity kinds', () => {
    const sst: Quantity = { kind: 'model-sst', value: 20, units: 'degC', provenanceId: 'x' };
    expect(comparePoint(f(0.3), sst, VISUAL_FEATURE_PROFILE).comparable).toBe(false);
  });
});
