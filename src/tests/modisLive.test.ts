/**
 * The browser's live MODIS builder (any place on the map) applies exactly the
 * pipeline's QA rules: rebuilt from the same raw service responses, it gives
 * the same windows as scripts/build_land_series.py.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildLandPlace, compositeDates, parsePointId, pointId, type RawBands } from '../data/adapters/modisLiveAdapter';
import { place } from './helpers';

const RAW = resolve(__dirname, '../../data-raw/modis');

describe('live MODIS points', () => {
  it('knows the 23 composite dates of 2023', () => {
    const d = compositeDates(2023);
    expect(d).toHaveLength(23);
    expect(d[0]).toBe('A2023001');
    expect(d[22]).toBe('A2023353');
  });

  it('encodes the coordinate in the place id', () => {
    expect(pointId(48.8566, 2.3522)).toBe('pt:48.86,2.35');
    expect(parsePointId('pt:-33.90,18.42')).toEqual({ lat: -33.9, lon: 18.42 });
    expect(parsePointId('nile-delta')).toBeNull();
  });

  for (const id of ['nile-delta', 'harvard-forest', 'sahel-dahra']) {
    it.runIf(existsSync(resolve(RAW, `${id}.json`)))(`reproduces the pipeline for ${id}`, () => {
      const raw = JSON.parse(readFileSync(resolve(RAW, `${id}.json`), 'utf-8'));
      const b = raw.bands;
      const meta = b['250m_16_days_NDVI'].meta;
      const bands: RawBands = {
        dates: raw.dates,
        ndvi: b['250m_16_days_NDVI'].subset,
        reliability: b['250m_16_days_pixel_reliability'].subset,
        doy: b['250m_16_days_composite_day_of_the_year'].subset,
        meta: { nrows: meta.nrows, ncols: meta.ncols, cellsize: meta.cellsize },
      };
      const ref = place(id);
      const got = buildLandPlace(bands, { id, name: ref.name, region: ref.region, lat: ref.lat, lon: ref.lon, landscape: ref.landscape });
      expect(got.windows).toHaveLength(ref.windows.length);
      got.windows.forEach((w, i) => {
        const r = ref.windows[i];
        expect([w.start, w.end, w.status, w.reason, w.acceptedPixels, w.observedDays]).toEqual([r.start, r.end, r.status, r.reason, r.acceptedPixels, r.observedDays]);
        if (r.ndvi === null) expect(w.ndvi).toBeNull();
        else {
          expect(w.ndvi!).toBeCloseTo(r.ndvi, 4);
          expect(w.std!).toBeCloseTo(r.std!, 4);
        }
      });
      expect(got.summary.valid).toBe(ref.summary.valid);
    });
  }
});
