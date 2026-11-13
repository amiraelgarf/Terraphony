import { describe, expect, it } from 'vitest';
import { buildEvents } from '../audio/musicMapper';
import { placeSamples } from '../data/adapters/modisNdviAdapter';
import { OceanGrid, type OceanGridMeta } from '../data/adapters/murSstAdapter';
import { LAND_RULE } from '../stories/vegetation.config';
import { oceanGrid, place } from './helpers';

const meta: OceanGridMeta = {
  width: 4, height: 3, lat0: 1, dLat: -1, lon0: 0, dLon: 1, resolutionDeg: 1,
  encoding: { scale: 0.01, units: 'degree_C', land: -32768, lake: -32767, missing: -32766, iceBase: -30000, iceThreshold: 0.15 },
  dates: {}, pooledPercentilesC: {},
};
// row 0 = lat 1, row 1 = lat 0, row 2 = lat -1 ; columns lon 0..3
const tiny = new OceanGrid(meta, Int16Array.from([
  1000, 1100, -32768, 1300,
  1000, 2000, -30040, -32766,
  1000, 1000, 1000, -32767,
]));

describe('ocean masks', () => {
  it('land, lake, sea ice and missing become rests, never values', () => {
    expect(tiny.sample(1, 2)).toMatchObject({ status: 'masked', reason: 'land', value: null });
    expect(tiny.sample(-1, 3)).toMatchObject({ status: 'masked', reason: 'lake', value: null });
    expect(tiny.sample(0, 2)).toMatchObject({ status: 'masked', reason: 'sea_ice', value: null, iceFraction: 0.4 });
    expect(tiny.sample(0, 3)).toMatchObject({ status: 'missing', value: null });
  });
  it('a point next to land is interpolated only over valid neighbours', () => {
    const s = tiny.sample(0.75, 1.4); // nearest cell (col 1, row 0) is valid; neighbours: land (col 2) and sea ice (col 2, row 1) are skipped
    expect(s.status).toBe('valid');
    expect(s.neighboursUsed).toBe(2);
    expect(s.value!).toBeGreaterThan(10);
    expect(s.value!).toBeLessThan(20);
  });
  it('bilinear inside a fully valid cell', () => {
    expect(tiny.sample(0.5, 0.5).value).toBeCloseTo((10 + 11 + 10 + 20) / 4, 6);
  });
  it('real grid: the Sahara is land and the North Atlantic is water on both days', () => {
    for (const k of ['A', 'B'] as const) {
      const g = oceanGrid(k);
      expect(g.sample(25, 5).reason).toBe('land');
      expect(g.sample(30, -40).status).toBe('valid');
    }
  });
  it('real grid: the central Arctic in winter is sea ice', () => {
    expect(oceanGrid('B').sample(85, 0).reason).toBe('sea_ice');
  });
});

describe('land QA', () => {
  it('rejected windows are rests with no value and are not interpolated', () => {
    const p = place('harvard-forest');
    const s = placeSamples(p, 'modis');
    const rests = s.filter((x) => x.status !== 'valid');
    expect(rests.length).toBe(p.summary.total - p.summary.valid);
    expect(rests.every((x) => x.numericValue === null)).toBe(true);
    expect(rests.map((x) => x.reason).sort()).toEqual(['cloud', 'snow_ice']);
    const ev = buildEvents(s, LAND_RULE);
    rests.forEach((r) => expect(ev[r.sequenceIndex].midiNote).toBeNull());
  });
  it('windows are the true 16-day composites of 2023, in order', () => {
    const p = place('nile-delta');
    expect(p.windows).toHaveLength(23);
    expect(p.windows[0].start).toBe('2023-01-01');
    expect(p.windows[1].start).toBe('2023-01-17');
    expect(p.windows[22].end).toBe('2024-01-03');
    p.windows.forEach((w) => {
      if (w.status === 'valid') expect(w.acceptedPixels / w.totalPixels).toBeGreaterThanOrEqual(p.minValidFraction);
    });
  });
});
