import { describe, expect, it } from 'vitest';
import { FeatureGrid } from '../domain/dataSampler';
import { clampViewport, geoToPixel, pixelToGeo, screenToSource, sourceToScreen, zoomAbout, type Viewport } from '../domain/projection';
import { frameA, manifest } from './helpers';

describe('geographic registration', () => {
  it('round-trips geo -> pixel -> geo', () => {
    for (const [lat, lon] of [[0, 0], [45.5, -120.25], [-60, 179.9], [89, -179.9]]) {
      const { x, y } = geoToPixel(lat, lon, 2048, 1024);
      const g = pixelToGeo(x, y, 2048, 1024);
      expect(g.lat).toBeCloseTo(lat, 9);
      expect(g.lon).toBeCloseTo(lon, 9);
    }
  });
  it('places known corners correctly', () => {
    expect(geoToPixel(90, -180, 2048, 1024)).toEqual({ x: 0, y: 0 });
    expect(geoToPixel(0, 0, 2048, 1024)).toEqual({ x: 1024, y: 512 });
  });
  it('lon 180 and -180 are the same meridian', () => {
    expect(geoToPixel(0, 180, 2048, 1024).x).toBe(geoToPixel(0, -180, 2048, 1024).x);
  });
  it('the manifest records landmark evidence for its verified registration', () => {
    expect(manifest.mapRegistrationVerified).toBe(true);
    expect(Object.values(manifest.registrationEvidence).every((s) => /^(\d+)\/\1 /.test(s))).toBe(true);
  });
  it('an unregistered frame never produces latitude/longitude', () => {
    const unreg = { ...frameA, visualProjection: 'unregistered-image' as const };
    const grid = new FeatureGrid(new Uint8Array(manifest.grid.width * manifest.grid.height * 3), manifest.grid, unreg);
    const r = grid.lookupGeo(10, 10);
    expect(r.status).toBe('no-data');
    if (r.status === 'no-data') expect(r.reason).toBe('unregistered');
    const p = grid.lookupPixel(100, 100);
    expect(p.position.lat).toBeUndefined();
    expect(p.position.lon).toBeUndefined();
  });
});

describe('screen <-> source transforms under pan and zoom', () => {
  const views: Viewport[] = [
    { baseScale: 0.5, zoom: 1, panX: 0, panY: 0 },
    { baseScale: 0.5, zoom: 3.2, panX: -812.5, panY: -301 },
    { baseScale: 0.19, zoom: 7.9, panX: -1500, panY: -20 },
  ];
  it('round-trips at every state', () => {
    for (const v of views) {
      for (const p of [{ x: 0, y: 0 }, { x: 1000.5, y: 333.25 }, { x: 2048, y: 1024 }]) {
        const back = screenToSource(sourceToScreen(p, v), v);
        expect(back.x).toBeCloseTo(p.x, 9);
        expect(back.y).toBeCloseTo(p.y, 9);
      }
    }
  });
  it('zooming keeps the source point under the pointer fixed', () => {
    const v = views[0];
    const anchor = { x: 300, y: 120 };
    const before = screenToSource(anchor, v);
    const after = screenToSource(anchor, zoomAbout(v, 2.5, anchor));
    expect(after.x).toBeCloseTo(before.x, 9);
    expect(after.y).toBeCloseTo(before.y, 9);
  });
  it('clamping keeps the image covering the stage', () => {
    const c = clampViewport({ baseScale: 0.5, zoom: 2, panX: 400, panY: -5000 }, 1024, 512, 2048, 1024);
    expect(c.panX).toBe(0);
    expect(c.panY).toBe(512 - 1024);
  });
});
