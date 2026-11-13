/**
 * The browser must reproduce the offline pipeline exactly: the Python script
 * scripts/build_ocean_presets.py resamples each preset route and samples the
 * MUR grids; here the TypeScript code does the same from the same files.
 */
import { describe, expect, it } from 'vitest';
import { valueToMidi } from '../audio/normalize';
import { presetWaypoints } from '../data/adapters/oceanPresets';
import { resampleGeographic } from '../data/geodesicPath';
import { OCEAN_RULE } from '../stories/ocean.config';
import { oceanGrid, presets } from './helpers';

const file = presets();

describe('TypeScript sampler == Python reference', () => {
  it('uses the same domain the app publishes', () => {
    expect(file.domainC).toEqual([OCEAN_RULE.domainMin, OCEAN_RULE.domainMax]);
    expect(file.accentC).toBe(OCEAN_RULE.accentThreshold);
  });
  for (const p of file.presets) {
    for (const key of ['A', 'B'] as const) {
      it(`${p.id} on ${key}: stops, statuses, values and notes match`, () => {
        const { points, lengthKm } = resampleGeographic(presetWaypoints(p), file.stops);
        expect(lengthKm).toBeCloseTo(p.lengthKm, 0);
        const g = oceanGrid(key);
        p.reference[key].forEach((ref, i) => {
          expect(points[i].lat).toBeCloseTo(ref.lat, 4);
          expect(points[i].lon).toBeCloseTo(ref.lon, 4);
          const s = g.sample(points[i].lat, points[i].lon);
          expect(s.status).toBe(ref.status);
          expect(s.cell).toEqual(ref.cell);
          if (ref.value === null) expect(s.value).toBeNull();
          else {
            expect(s.value!).toBeCloseTo(ref.value, 3);
            expect(valueToMidi(s.value!, OCEAN_RULE.domainMin, OCEAN_RULE.domainMax).midi).toBe(ref.midi);
          }
        });
      });
    }
  }
});
