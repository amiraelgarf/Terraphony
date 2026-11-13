/**
 * Any place on Earth, live: MODIS MOD13Q1 v061 NDVI for a clicked point, fetched
 * in the browser from NASA's ORNL DAAC "MODIS/VIIRS Land Product Subsets"
 * service (no login, CORS enabled) — the same service and the same rules as
 * the offline pipeline (scripts/acquire_modis_ndvi.py + build_land_series.py):
 *
 *   9 x 9 pixels of 250 m (±1 km) around the point, every 16-day composite of 2023
 *   accepted pixel  = pixel_reliability 0 (good) or 1 (marginal) and NDVI not fill
 *   valid window    = >= 50 % of pixels accepted -> mean NDVI (std reported)
 *   otherwise       = a rest: 'snow_ice' (mostly snow), 'cloud', or 'fill' (no land data: water)
 *
 * buildLandPlace() is pure and is tested against the Python output for the curated places.
 */
import type { LandPlace, LandWindow } from './modisNdviAdapter';
import { formatGeo } from '../projections';

export const MODIS_API = 'https://modis.ornl.gov/rst/api/v1/MOD13Q1';
export const LIVE_YEAR = 2023;
const KM = 1;
const MIN_VALID = 0.5;
const FILL = -3000;
const SCALE = 0.0001;
const CHUNK = 10; // the service returns at most 10 composites per request

type SubsetRow = { modis_date: string; data: number[]; tile?: string; proc_date?: string };
export type RawBands = {
  dates: string[];
  ndvi: SubsetRow[];
  reliability: SubsetRow[];
  doy?: SubsetRow[];
  meta: { nrows: number; ncols: number; cellsize: number };
};

/** All 23 MOD13Q1 composite start dates of a year (A2023001, A2023017, …). */
export function compositeDates(year = LIVE_YEAR): string[] {
  return Array.from({ length: 23 }, (_, k) => `A${year}${String(1 + 16 * k).padStart(3, '0')}`);
}

const r4 = (x: number) => Math.round(x * 1e4) / 1e4;
const doyToDate = (year: number, doy: number) => new Date(Date.UTC(year, 0, doy)).toISOString().slice(0, 10);

/** Point ids encode the coordinate, so drafts and records stay self-describing. */
export const pointId = (lat: number, lon: number) => `pt:${lat.toFixed(2)},${lon.toFixed(2)}`;
export function parsePointId(id: string): { lat: number; lon: number } | null {
  const m = /^pt:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(id);
  return m ? { lat: Number(m[1]), lon: Number(m[2]) } : null;
}

export function buildLandPlace(raw: RawBands, where: { id: string; name: string; region: string; lat: number; lon: number; landscape: string }, year = LIVE_YEAR): LandPlace {
  const ndviRows = new Map(raw.ndvi.map((r) => [r.modis_date, r]));
  const relRows = new Map(raw.reliability.map((r) => [r.modis_date, r]));
  const doyRows = new Map((raw.doy ?? []).map((r) => [r.modis_date, r]));
  const windows: LandWindow[] = raw.dates.map((md, i) => {
    const y = Number(md.slice(1, 5)), doy = Number(md.slice(5));
    const start = doyToDate(y, doy);
    const end = doyToDate(y, doy + 15);
    const nd = ndviRows.get(md)?.data ?? [];
    const rel = relRows.get(md)?.data ?? [];
    const total = raw.meta.nrows * raw.meta.ncols;
    const ok = nd.map((v, k) => (rel[k] === 0 || rel[k] === 1) && v !== FILL);
    const accepted = ok.filter(Boolean).length;
    const base = {
      index: i,
      modisDate: md,
      start,
      end,
      acceptedPixels: accepted,
      totalPixels: nd.length || total,
      tile: ndviRows.get(md)?.tile ?? '',
      processed: ndviRows.get(md)?.proc_date ?? '',
      pixels: nd.map((v) => (v === FILL ? null : r4(v * SCALE))),
      reliability: rel,
    };
    if (nd.length && accepted / nd.length >= MIN_VALID) {
      const vals = nd.filter((_, k) => ok[k]).map((v) => v * SCALE);
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const std = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length);
      const obs = (doyRows.get(md)?.data ?? []).filter((d, k) => ok[k] && d > 0);
      return {
        ...base,
        status: 'valid',
        reason: null,
        ndvi: r4(mean),
        std: r4(std),
        observedDays: obs.length ? [doyToDate(y, Math.min(...obs)), doyToDate(y, Math.max(...obs))] : null,
      } as LandWindow;
    }
    const rejected = rel.filter((_, k) => !ok[k]);
    const snow = rejected.filter((r) => r === 2).length;
    const cloud = rejected.filter((r) => r === 3).length;
    const masked = snow >= cloud && snow > 0;
    return {
      ...base,
      status: masked ? 'masked' : nd.length ? 'quality_rejected' : 'missing',
      reason: masked ? 'snow_ice' : cloud > 0 ? 'cloud' : 'fill',
      ndvi: null,
      std: null,
      observedDays: null,
    } as LandWindow;
  });
  const valid = windows.flatMap((w) => (w.ndvi === null ? [] : [w.ndvi]));
  return {
    ...where,
    year,
    windowKm: KM,
    gridSize: [raw.meta.nrows, raw.meta.ncols],
    cellSizeM: Math.round(raw.meta.cellsize * 100) / 100,
    domain: [0, 0.9],
    accent: 0.08,
    minValidFraction: MIN_VALID,
    summary: { valid: valid.length, total: windows.length, min: valid.length ? Math.min(...valid) : null, max: valid.length ? Math.max(...valid) : null },
    windows,
  };
}

/* ------------------------------------------------------------------ */

const STORE = 'earth-records:modis:v1:';
const memory = new Map<string, Promise<LandPlace>>();

export type Progress = (done: number, total: number) => void;

async function getJson(url: string, tries = 2): Promise<{ subset: SubsetRow[]; nrows: number; ncols: number; cellsize: number }> {
  for (let k = 0; ; k++) {
    try {
      const r = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!r.ok) throw new Error(`MODIS service answered ${r.status}`);
      return await r.json();
    } catch (e) {
      if (k + 1 >= tries) throw e;
      await new Promise((res) => setTimeout(res, 1500));
    }
  }
}

/** Fetch (or reuse) one year of MOD13Q1 windows around a point. */
export function fetchLandPoint(lat: number, lon: number, onProgress?: Progress): Promise<LandPlace> {
  const id = pointId(lat, lon);
  if (memory.has(id)) return memory.get(id)!;
  const p = (async () => {
    try {
      const cached = window.localStorage.getItem(STORE + id);
      if (cached) return JSON.parse(cached) as LandPlace;
    } catch {
      /* storage blocked */
    }
    const dates = compositeDates();
    const chunks: string[][] = [];
    for (let i = 0; i < dates.length; i += CHUNK) chunks.push(dates.slice(i, i + CHUNK));
    const bands = ['250m_16_days_NDVI', '250m_16_days_pixel_reliability'];
    const total = bands.length * chunks.length;
    let done = 0;
    onProgress?.(0, total);
    const la = Number(lat.toFixed(4)), lo = Number(lon.toFixed(4));
    const results = await Promise.all(
      bands.map((band) =>
        Promise.all(
          chunks.map(async (c) => {
            const url = `${MODIS_API}/subset?latitude=${la}&longitude=${lo}&band=${band}&startDate=${c[0]}&endDate=${c[c.length - 1]}&kmAboveBelow=${KM}&kmLeftRight=${KM}`;
            const j = await getJson(url);
            onProgress?.(++done, total);
            return j;
          }),
        ),
      ),
    );
    const [ndviParts, relParts] = results;
    const first = ndviParts[0];
    const raw: RawBands = {
      dates,
      ndvi: ndviParts.flatMap((x) => x.subset),
      reliability: relParts.flatMap((x) => x.subset),
      meta: { nrows: Number(first.nrows), ncols: Number(first.ncols), cellsize: Number(first.cellsize) },
    };
    const place = buildLandPlace(raw, {
      id,
      name: 'Your chosen place',
      region: formatGeo({ lat, lon }, 2),
      lat,
      lon,
      landscape: 'Chosen on the map',
    });
    try {
      window.localStorage.setItem(STORE + id, JSON.stringify(place));
    } catch {
      /* not remembered */
    }
    return place;
  })();
  p.catch(() => memory.delete(id));
  memory.set(id, p);
  return p;
}
