import { describe, expect, it } from 'vitest';
import { resampleGeographic } from '../domain/routeGeometry';
import { sampleRoute } from '../domain/scan';
import { VISUAL_FEATURE_PROFILE, buildEvents, eventHash } from '../domain/sonification';
import { SourceError, validateManifest } from '../domain/sourceRegistry';
import { findNotableEvent } from '../domain/storyHighlights';
import { frameA, frameB, loadGrid, manifest, storyRoute } from './helpers';

describe('manifest integrity', () => {
  it('is real visual-frame data, not a fixture, from SVS 3912', () => {
    expect(() => validateManifest(manifest)).not.toThrow();
    expect(manifest.primaryOfficialResourceId).toBe(3912);
    expect(manifest.fidelity).toBe('verified-visual-frame');
    expect(manifest.dataIntegrity.fixture).toBe(false);
    expect(manifest.variable).toBe('image_feature_normalized');
    expect(manifest.units).toBe('normalized_0_1');
  });
  it('every frame has a NASA timestamp inside the documented range and a checksum', () => {
    const [start, end] = manifest.timeRangeDocumentedUTC.map((t) => Date.parse(t));
    for (const f of manifest.availableFrames) {
      expect(f.captureOrModelTimeUTC).not.toBeNull();
      const t = Date.parse(f.captureOrModelTimeUTC!);
      expect(t).toBeGreaterThanOrEqual(start);
      expect(t).toBeLessThanOrEqual(end);
      expect(f.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });
  it('rejects a fixture dressed as real data', () => {
    expect(() => validateManifest({ ...manifest, dataIntegrity: { ...manifest.dataIntegrity, fixture: true } })).toThrow(SourceError);
  });
  it('rejects a visual-frame manifest that claims temperature', () => {
    const bad = { ...manifest, availableFrames: manifest.availableFrames.map((f) => ({ ...f, variable: 'sst_absolute_degC' as const })) };
    expect(() => validateManifest(bad)).toThrow(SourceError);
  });
});

describe('TypeScript sampler matches the Python pipeline exactly', () => {
  const { points, lengthKm } = resampleGeographic(storyRoute.waypoints, storyRoute.sampleCount);

  it('route length agrees', () => {
    expect(lengthKm).toBeCloseTo(storyRoute.lengthKm, 0);
  });

  for (const [key, frame] of [['A', frameA], ['B', frameB]] as const) {
    it(`frame ${key}: every point, cell, status and value agrees`, () => {
      const ref = storyRoute.reference[key].samples;
      const samples = sampleRoute(points, loadGrid(frame));
      samples.forEach((s, i) => {
        expect(s.position.lat).toBeCloseTo(ref[i].lat, 4);
        expect(s.position.lon).toBeCloseTo(ref[i].lon, 4);
        expect(s.cell).toEqual(ref[i].cell);
        if (ref[i].value === null) expect(s.quantity).toBeNull();
        else expect(s.quantity!.value).toBeCloseTo(ref[i].value!, 6);
        if (ref[i].status !== 'ok') expect(s.invalidReason).toBe(ref[i].status);
      });
    });
    it(`frame ${key}: notable event agrees with the build-time rule`, () => {
      const samples = sampleRoute(points, loadGrid(frame));
      expect(findNotableEvent(samples)?.index ?? null).toBe(storyRoute.reference[key].notableIndex);
    });
  }

  it('replaying the story route yields an identical event hash', () => {
    const cfg = { profile: VISUAL_FEATURE_PROFILE, accentThreshold: storyRoute.accentThreshold };
    const a1 = buildEvents(sampleRoute(points, loadGrid(frameA)), cfg);
    const a2 = buildEvents(sampleRoute(resampleGeographic(storyRoute.waypoints).points, loadGrid(frameA)), cfg);
    expect(eventHash(a1)).toBe(eventHash(a2));
  });
});

describe('no-data handling', () => {
  const grid = loadGrid(frameA);
  it('land returns a rest with reason, never a value', () => {
    const r = grid.lookupGeo(25, 5); // Sahara
    expect(r.status).toBe('no-data');
    if (r.status === 'no-data') expect(r.reason).toBe('land');
  });
  it('open ocean returns a typed visual feature in [0,1]', () => {
    const r = grid.lookupGeo(28, -45);
    expect(r.status).toBe('ok');
    if (r.status === 'ok') {
      expect(r.quantity.kind).toBe('visual-feature');
      expect(r.quantity.value).toBeGreaterThanOrEqual(0);
      expect(r.quantity.value).toBeLessThanOrEqual(1);
    }
  });
  it('out-of-bounds pixels are explicit', () => {
    const r = grid.lookupPixel(-5, 10);
    expect(r.status).toBe('no-data');
    if (r.status === 'no-data') expect(r.reason).toBe('out-of-bounds');
  });
});
