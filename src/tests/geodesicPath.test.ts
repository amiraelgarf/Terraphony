import { describe, expect, it } from 'vitest';
import { haversineKm, isDegenerateRoute, resampleGeographic, thinTrace } from '../data/geodesicPath';
import { geoToMap, mapToGeo, wrapLon } from '../data/projections';

describe('geodesic routes', () => {
  it('keeps both endpoints and spaces stops equally along the surface', () => {
    const { points, lengthKm } = resampleGeographic([{ lat: 0, lon: 0 }, { lat: 60, lon: 0 }], 24);
    expect(points[0]).toEqual({ lat: 0, lon: 0 });
    expect(points[23].lat).toBeCloseTo(60, 9);
    const d = points.slice(1).map((p, i) => haversineKm([points[i].lat, points[i].lon], [p.lat, p.lon]));
    d.forEach((x) => expect(x).toBeCloseTo(lengthKm / 23, 0));
  });
  it('measures kilometres, not map pixels: 40° of longitude is far shorter at 60°N', () => {
    const eq = resampleGeographic([{ lat: 0, lon: 0 }, { lat: 0, lon: 40 }], 5).lengthKm;
    const hi = resampleGeographic([{ lat: 60, lon: 0 }, { lat: 60, lon: 40 }], 5).lengthKm;
    expect(hi).toBeLessThan(eq * 0.55);
  });
  it('crosses the antimeridian the short way', () => {
    const { points, lengthKm } = resampleGeographic([{ lat: 0, lon: 170 }, { lat: 0, lon: -170 }], 5);
    expect(lengthKm).toBeLessThan(2300);
    expect(Math.abs(points[2].lon)).toBeCloseTo(180, 6);
    points.forEach((p) => expect(Math.abs(p.lon)).toBeGreaterThanOrEqual(170 - 1e-9));
  });
  it('projection round trip and wrapping', () => {
    const p = { lat: -33.5, lon: 151.2 };
    const m = geoToMap(p);
    expect(mapToGeo(m.x, m.y).lat).toBeCloseTo(p.lat, 9);
    expect(mapToGeo(m.x, m.y).lon).toBeCloseTo(p.lon, 9);
    expect(wrapLon(190)).toBe(-170);
    expect(mapToGeo(370, 90).lon).toBeCloseTo(-170, 9);
  });
  it('pointer traces are thinned and tiny scribbles are not routes', () => {
    const trace = Array.from({ length: 200 }, (_, i) => ({ lat: 10, lon: i * 0.05 }));
    const t = thinTrace(trace, 60);
    expect(t.length).toBeLessThanOrEqual(20); // ~1090 km at >= 60 km spacing, plus the end point
    expect(t[t.length - 1]).toBe(trace[199]);
    expect(isDegenerateRoute([{ lat: 0, lon: 0 }, { lat: 0, lon: 1 }])).toBe(true);
  });
});
