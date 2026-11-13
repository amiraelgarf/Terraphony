import { describe, expect, it } from 'vitest';
import { haversineKm, isDegenerateRoute, resampleGeographic, resampleImage, thinGeoTrace, unwrapLongitudes } from '../domain/routeGeometry';

describe('route geometry', () => {
  it('haversine: one degree of latitude is ~111 km', () => {
    expect(haversineKm([0, 0], [1, 0])).toBeCloseTo(111.19, 1);
  });
  it('unwraps longitudes across the antimeridian', () => {
    expect(unwrapLongitudes([[0, 170], [0, -170], [0, -160]])).toEqual([[0, 170], [0, 190], [0, 200]]);
  });
  it('a Pacific route across 180° is short, not a trip around the world', () => {
    const { lengthKm, points } = resampleGeographic([[0, 170], [0, -170]], 64);
    expect(lengthKm).toBeCloseTo(haversineKm([0, 170], [0, 190]), 3);
    expect(lengthKm).toBeLessThan(2300);
    for (const p of points) expect(Math.abs(p.lon)).toBeGreaterThanOrEqual(169.99);
  });
  it('resamples to exactly N points including both endpoints, equally spaced', () => {
    const { points } = resampleGeographic([[-30, -20], [0, -20], [30, -20]], 64);
    expect(points).toHaveLength(64);
    expect(points[0]).toEqual({ lat: -30, lon: -20 });
    expect(points[63].lat).toBeCloseTo(30, 9);
    const gaps = points.slice(1).map((p, i) => haversineKm([points[i].lat, points[i].lon], [p.lat, p.lon]));
    const mean = gaps.reduce((a, b) => a + b) / gaps.length;
    for (const g of gaps) expect(Math.abs(g - mean) / mean).toBeLessThan(0.02);
  });
  it('image routes are measured in aspect-corrected image units, never km', () => {
    const r = resampleImage([{ u: 0, v: 0 }, { u: 0.5, v: 0 }], 2, 64);
    expect(r.lengthImageUnits).toBeCloseTo(1, 9);
    expect(r).not.toHaveProperty('lengthKm');
  });
  it('a tap is a probe, not a 64-note route', () => {
    expect(isDegenerateRoute([{ lat: 10, lon: 10 }])).toBe(true);
    expect(isDegenerateRoute([{ lat: 10, lon: 10 }, { lat: 10.1, lon: 10.1 }])).toBe(true);
    expect(isDegenerateRoute([{ lat: 10, lon: 10 }, { lat: 20, lon: 10 }])).toBe(false);
  });
  it('thins dense pointer traces but keeps the endpoint', () => {
    const trace = Array.from({ length: 500 }, (_, i) => ({ lat: 0, lon: i * 0.02 }));
    const thin = thinGeoTrace(trace, 40);
    expect(thin.length).toBeLessThan(40);
    expect(thin[thin.length - 1]).toBe(trace[trace.length - 1]);
  });
});
