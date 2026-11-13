import { describe, expect, it } from 'vitest';
import { placeSamples } from '../data/adapters/modisNdviAdapter';
import { sampleRoute } from '../data/adapters/murSstAdapter';
import { presetWaypoints } from '../data/adapters/oceanPresets';
import { resampleGeographic } from '../data/geodesicPath';
import { buildRecord, catalogueNumber, parseRecipe, RecipeError, toRecipeJson } from '../export/recordRecipe';
import { OCEAN_RULE, OCEAN_SOURCE } from '../stories/ocean.config';
import { LAND_RULE, LAND_SOURCE } from '../stories/vegetation.config';
import { sleeveArt } from '../visuals/geometry';
import { oceanGrid, place, presets } from './helpers';

function oceanRecord() {
  const pr = presets().presets[2];
  const { points, lengthKm } = resampleGeographic(presetWaypoints(pr), 24);
  return buildRecord({
    title: 'Around the Cape', story: 'ocean', source: OCEAN_SOURCE,
    geometry: { kind: 'route', points, lengthKm, label: pr.name },
    timeWindow: { label: '18 August 2007', start: '2007-08-18T00:00:00Z', end: '2007-08-18T23:59:59Z' },
    observations: sampleRoute(oceanGrid('A'), 'A', points, OCEAN_SOURCE.sourceId),
    rule: OCEAN_RULE, instrument: 'felt', narrativeText: ['n'], credits: ['c'], createdAt: '2026-11-13T10:00:00.000Z',
  });
}
function landRecord() {
  const p = place('sahel-dahra');
  return buildRecord({
    title: 'Dahra', story: 'vegetation', source: LAND_SOURCE,
    geometry: { kind: 'location', points: [{ lat: p.lat, lon: p.lon }], areaId: p.id, label: p.name },
    timeWindow: { label: '2023', start: '2023-01-01T00:00:00Z', end: '2024-01-03T23:59:59Z' },
    observations: placeSamples(p, LAND_SOURCE.sourceId), rule: LAND_RULE, instrument: 'wood', narrativeText: ['n'], credits: ['c'],
    createdAt: '2026-11-13T10:00:00.000Z',
  });
}

describe('record recipe round trip', () => {
  for (const [name, make] of [['ocean', oceanRecord], ['vegetation', landRecord]] as const) {
    it(`${name}: same recipe -> same events and the same sleeve`, () => {
      const r = make();
      const back = parseRecipe(toRecipeJson(r));
      expect(back.events).toEqual(r.events);
      expect(sleeveArt(back)).toEqual(sleeveArt(r));
      expect(catalogueNumber(back)).toBe(catalogueNumber(r));
      expect(back.sourceStatus).toBe('verified_observations');
    });
  }
  it('records carry provenance: source, units, rule, geometry and time', () => {
    const r = oceanRecord();
    expect(r.source.units).toBe('°C');
    expect(r.musicalRule.domainMin).toBe(-2);
    expect(r.geometry.points).toHaveLength(24);
    expect(r.observations.every((o) => o.position && o.timeStart.startsWith('2007-08-18'))).toBe(true);
  });
  it('refuses a recipe whose notes were edited', () => {
    const j = JSON.parse(toRecipeJson(oceanRecord()));
    j.events[3].midiNote = j.events[3].midiNote === 72 ? 48 : 72;
    expect(() => parseRecipe(JSON.stringify(j))).toThrow(RecipeError);
  });
  it('refuses a recipe that invents a value for a rest', () => {
    const j = JSON.parse(toRecipeJson(landRecord()));
    const rest = j.observations.find((o: { status: string }) => o.status !== 'valid');
    rest.numericValue = 0.5;
    expect(() => parseRecipe(JSON.stringify(j))).toThrow(RecipeError);
  });
  it('refuses synthetic or foreign files', () => {
    const j = JSON.parse(toRecipeJson(oceanRecord()));
    j.sourceStatus = 'synthetic_demo';
    expect(() => parseRecipe(JSON.stringify(j))).toThrow(RecipeError);
    expect(() => parseRecipe('{"hello":1}')).toThrow(RecipeError);
    expect(() => parseRecipe('not json')).toThrow(RecipeError);
  });
});
