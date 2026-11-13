/** Test helpers: read the real processed data from public/ (no network). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { OceanGrid, type OceanGridMeta } from '../data/adapters/murSstAdapter';
import type { LandPlace } from '../data/adapters/modisNdviAdapter';
import type { PresetFile } from '../data/adapters/oceanPresets';
import type { ObservationSample } from '../data/types';

const PUB = resolve(__dirname, '../../public');
export const readJson = <T,>(rel: string): T => JSON.parse(readFileSync(resolve(PUB, rel), 'utf-8')) as T;

export function oceanGrid(key: 'A' | 'B'): OceanGrid {
  const meta = readJson<OceanGridMeta>('data/ocean/grid.json');
  const buf = readFileSync(resolve(PUB, meta.dates[key].file));
  const arr = new Int16Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  return new OceanGrid(meta, arr);
}
export const presets = () => readJson<PresetFile>('data/ocean/presets.json');
export const place = (id: string) => readJson<LandPlace>(`data/land/${id}.json`);

/** A synthetic observation list (for mapping tests only — never shipped). */
export function obs(values: (number | null)[]): ObservationSample[] {
  return values.map((v, i) => ({
    id: `t-${i}`,
    sequenceIndex: i,
    timeStart: '2000-01-01T00:00:00Z',
    timeEnd: '2000-01-01T23:59:59Z',
    status: v === null ? 'masked' : 'valid',
    reason: v === null ? 'land' : undefined,
    numericValue: v,
    sourceId: 'test',
  }));
}
