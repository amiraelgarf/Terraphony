/**
 * MUR SST adapter — numeric sea-surface temperature for the ocean story.
 *
 * Grid: public/data/ocean/mur-sst-<date>.bin (int16 LE, 1440 x 720, row 0 = north),
 * described by public/data/ocean/grid.json. Encoding (see build_ocean_grids.py):
 *   >= -3000            SST in 0.01 °C
 *   iceBase - p         sea ice, p = ice fraction in percent (>= 15 %)  -> masked
 *   missing / lake / land codes                                           -> missing / masked
 *
 * Sampling rule (mirrors scripts/build_ocean_presets.py:sample):
 *   1. the NEAREST grid cell decides the status; land, lake and sea ice are
 *      masked, no analysed value is missing -> the note becomes a rest;
 *   2. otherwise bilinear interpolation over the valid neighbours of the
 *      enclosing 2 x 2 cell, weights renormalised if some are invalid.
 * Invalid points are never snapped to nearby ocean.
 */
import { mod } from '../projections';
import type { GeoPosition, ObservationSample, SampleStatus } from '../types';

export type OceanGridMeta = {
  width: number;
  height: number;
  lat0: number;
  dLat: number;
  lon0: number;
  dLon: number;
  resolutionDeg: number;
  encoding: { scale: number; units: string; land: number; lake: number; missing: number; iceBase: number; iceThreshold: number };
  dates: Record<string, { date: string; nominalTimeUTC: string; file: string; dataMap: string }>;
  pooledPercentilesC: Record<string, number>;
};

export const VALID_MIN = -3000;

export type GridSample = {
  status: SampleStatus;
  reason: string | null;
  value: number | null;
  cell: [number, number];
  neighboursUsed?: number;
  iceFraction?: number;
};

export class OceanGrid {
  constructor(readonly meta: OceanGridMeta, readonly data: Int16Array) {
    if (data.length !== meta.width * meta.height) throw new Error('Ocean grid has an unexpected size');
  }

  private code(ix: number, iy: number) {
    return this.data[iy * this.meta.width + ix];
  }

  statusOf(code: number): { status: SampleStatus; reason: string | null; iceFraction?: number } {
    const e = this.meta.encoding;
    if (code >= VALID_MIN) return { status: 'valid', reason: null };
    if (code === e.land) return { status: 'masked', reason: 'land' };
    if (code === e.lake) return { status: 'masked', reason: 'lake' };
    if (code >= e.iceBase - 100 && code <= e.iceBase - 1) return { status: 'masked', reason: 'sea_ice', iceFraction: (e.iceBase - code) / 100 };
    return { status: 'missing', reason: null };
  }

  sample(lat: number, lon: number): GridSample {
    const { width: W, height: H, lon0, dLon, lat0, dLat } = this.meta;
    const fx = (lon - lon0) / dLon;
    const fy = (lat - lat0) / dLat;
    const ix = mod(Math.floor(fx + 0.5), W);
    const iy = Math.min(Math.max(Math.floor(fy + 0.5), 0), H - 1);
    const st = this.statusOf(this.code(ix, iy));
    if (st.status !== 'valid') return { ...st, value: null, cell: [ix, iy] };
    const x0 = Math.floor(fx);
    const y0 = Math.min(Math.max(Math.floor(fy), 0), H - 2);
    const tx = fx - x0;
    const ty = Math.min(Math.max(fy - y0, 0), 1);
    let acc = 0, wsum = 0, used = 0;
    const nb: [number, number, number][] = [
      [0, 0, (1 - tx) * (1 - ty)], [1, 0, tx * (1 - ty)], [0, 1, (1 - tx) * ty], [1, 1, tx * ty],
    ];
    for (const [dx, dy, w] of nb) {
      const c = this.code(mod(x0 + dx, W), y0 + dy);
      if (c >= VALID_MIN) {
        acc += (w * c) / 100;
        wsum += w;
        used++;
      }
    }
    const value = wsum > 0 ? acc / wsum : this.code(ix, iy) / 100;
    return { status: 'valid', reason: null, value: Math.round(value * 1e4) / 1e4, cell: [ix, iy], neighboursUsed: used };
  }

  /** Geographic centre of a grid cell. */
  cellCentre(ix: number, iy: number): GeoPosition {
    return { lat: this.meta.lat0 + iy * this.meta.dLat, lon: this.meta.lon0 + ix * this.meta.dLon };
  }
}

const cache = new Map<string, Promise<OceanGrid>>();
let metaPromise: Promise<OceanGridMeta> | null = null;

export function loadOceanMeta(base = import.meta.env.BASE_URL): Promise<OceanGridMeta> {
  metaPromise ??= fetch(`${base}data/ocean/grid.json`).then((r) => {
    if (!r.ok) throw new Error(`Could not load ocean grid description (${r.status})`);
    return r.json();
  });
  return metaPromise;
}

export function loadOceanGrid(dateKey: string, base = import.meta.env.BASE_URL): Promise<OceanGrid> {
  if (!cache.has(dateKey)) {
    cache.set(
      dateKey,
      loadOceanMeta(base).then(async (meta) => {
        const d = meta.dates[dateKey];
        if (!d) throw new Error(`Unknown ocean date ${dateKey}`);
        const r = await fetch(`${base}${d.file}`);
        if (!r.ok) throw new Error(`Could not load the sea-surface temperature grid (${r.status})`);
        return new OceanGrid(meta, new Int16Array(await r.arrayBuffer()));
      }),
    );
    cache.get(dateKey)!.catch(() => cache.delete(dateKey));
  }
  return cache.get(dateKey)!;
}

/** Sample a route into provenance-bearing observations. */
export function sampleRoute(grid: OceanGrid, dateKey: string, points: GeoPosition[], sourceId: string): ObservationSample[] {
  const d = grid.meta.dates[dateKey];
  const day = d.date;
  return points.map((p, i) => {
    const s = grid.sample(p.lat, p.lon);
    const centre = grid.cellCentre(s.cell[0], s.cell[1]);
    return {
      id: `ocean-${dateKey}-${i + 1}`,
      sequenceIndex: i,
      position: { lat: Math.round(p.lat * 1e5) / 1e5, lon: Math.round(p.lon * 1e5) / 1e5 },
      timeStart: `${day}T00:00:00Z`,
      timeEnd: `${day}T23:59:59Z`,
      status: s.status,
      reason: s.reason ?? undefined,
      numericValue: s.value,
      sourceId,
      qualityCode: s.status === 'valid' ? (s.neighboursUsed === 4 ? 'bilinear-4' : `bilinear-${s.neighboursUsed}-valid-neighbours`) : s.reason ?? 'missing',
      detail: {
        'Nearest grid cell': `column ${s.cell[0]}, row ${s.cell[1]}`,
        'Cell centre': `${centre.lat.toFixed(2)}°, ${centre.lon.toFixed(2)}°`,
        'Grid spacing': `${grid.meta.resolutionDeg}°`,
        'Analysis time (nominal)': d.nominalTimeUTC,
        ...(s.iceFraction !== undefined ? { 'Sea-ice fraction': `${Math.round(s.iceFraction * 100)} %` } : {}),
      },
    };
  });
}
