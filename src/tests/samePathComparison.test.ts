import { describe, expect, it } from 'vitest';
import { buildEvents, eventHash } from '../audio/musicMapper';
import { sampleRoute } from '../data/adapters/murSstAdapter';
import { presetWaypoints } from '../data/adapters/oceanPresets';
import { resampleGeographic } from '../data/geodesicPath';
import type { MusicEvent } from '../data/types';
import { buildRecord } from '../export/recordRecipe';
import { OCEAN_RULE, OCEAN_SOURCE } from '../stories/ocean.config';
import { oceanGrid, presets } from './helpers';

const gulf = presets().presets.find((p) => p.id === 'gulf-stream')!;
const { points } = resampleGeographic(presetWaypoints(gulf), 24);

describe('comparisons use fixed parameters', () => {
  it('same route, two days: same stops, same rule, different values', () => {
    const a = sampleRoute(oceanGrid('A'), 'A', points, 'mur');
    const b = sampleRoute(oceanGrid('B'), 'B', points, 'mur');
    expect(a.map((s) => s.position)).toEqual(b.map((s) => s.position));
    const mean = (e: MusicEvent[]) => e.reduce((s, x) => s + (x.midiNote ?? 0), 0) / e.length;
    // the North Atlantic is warmer in August than in February, and the fixed range lets us hear it
    expect(mean(buildEvents(a, OCEAN_RULE))).toBeGreaterThan(mean(buildEvents(b, OCEAN_RULE)));
  });
  it('the same value always gives the same note, whatever the day', () => {
    const a = sampleRoute(oceanGrid('A'), 'A', points, 'mur');
    const b = sampleRoute(oceanGrid('B'), 'B', points, 'mur');
    const pairs = [...a, ...b].map((o) => [o.numericValue, buildEvents([o], OCEAN_RULE)[0].midiNote] as const);
    const byNote = new Map<number, number[]>();
    pairs.forEach(([v, m]) => m !== null && v !== null && byNote.set(m, [...(byNote.get(m) ?? []), v]));
    const ranges = [...byNote.entries()].sort((x, y) => x[0] - y[0]).map(([, vs]) => [Math.min(...vs), Math.max(...vs)]);
    for (let i = 1; i < ranges.length; i++) expect(ranges[i][0]).toBeGreaterThan(ranges[i - 1][1]);
  });
  it('instrument palette never changes the notes', () => {
    const observations = sampleRoute(oceanGrid('A'), 'A', points, OCEAN_SOURCE.sourceId);
    const base = {
      title: 't', story: 'ocean' as const, source: OCEAN_SOURCE, geometry: { kind: 'route' as const, points, label: 'x' },
      timeWindow: { label: 'd', start: 'a', end: 'b' }, observations, rule: OCEAN_RULE, narrativeText: [], credits: [],
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const hashes = (['glass', 'wood', 'felt'] as const).map((instrument) => eventHash(buildRecord({ ...base, instrument }).events));
    expect(new Set(hashes).size).toBe(1);
  });
});
