/**
 * MODIS NDVI adapter — the land seasons story.
 *
 * One JSON per curated place (public/data/land/<id>.json, built by
 * scripts/build_land_series.py) holds every 16-day MOD13Q1 v061 composite
 * window of the year with its QA decision and the raw 9 x 9 pixels.
 * One window = one observation = one note. Windows rejected by QA become
 * rests and are never interpolated.
 */
import type { GeoPosition, ObservationSample, SampleStatus } from '../types';

export type LandWindow = {
  index: number;
  modisDate: string;
  start: string;
  end: string;
  status: SampleStatus;
  reason: string | null;
  ndvi: number | null;
  std: number | null;
  acceptedPixels: number;
  totalPixels: number;
  observedDays: [string, string] | null;
  tile: string;
  processed: string;
  pixels: (number | null)[];
  reliability: number[];
};

export type LandPlace = {
  id: string;
  name: string;
  region: string;
  lat: number;
  lon: number;
  landscape: string;
  year: number;
  windowKm: number;
  gridSize: [number, number];
  cellSizeM: number;
  domain: [number, number];
  accent: number;
  minValidFraction: number;
  summary: { valid: number; total: number; min: number | null; max: number | null };
  windows: LandWindow[];
};

export type PlaceIndexEntry = Pick<LandPlace, 'id' | 'name' | 'region' | 'lat' | 'lon' | 'landscape' | 'summary'> & { file: string };

const RELIABILITY: Record<number, string> = { [-1]: 'no data', 0: 'good', 1: 'marginal', 2: 'snow / ice', 3: 'cloudy' };
export const reliabilityLabel = (r: number) => RELIABILITY[r] ?? `code ${r}`;

const cache = new Map<string, Promise<LandPlace>>();
let indexPromise: Promise<{ year: number; places: PlaceIndexEntry[] }> | null = null;

export function loadPlaceIndex(base = import.meta.env.BASE_URL) {
  indexPromise ??= fetch(`${base}data/land/places.json`).then((r) => {
    if (!r.ok) throw new Error(`Could not load the list of places (${r.status})`);
    return r.json();
  });
  return indexPromise;
}

export function loadPlace(id: string, base = import.meta.env.BASE_URL): Promise<LandPlace> {
  if (!cache.has(id)) {
    const p = fetch(`${base}data/land/${id}.json`).then((r) => {
      if (!r.ok) throw new Error(`Could not load vegetation data for ${id} (${r.status})`);
      return r.json() as Promise<LandPlace>;
    });
    p.catch(() => cache.delete(id));
    cache.set(id, p);
  }
  return cache.get(id)!;
}

const fmtDay = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** "1–16 May" or "19 Dec – 3 Jan" */
export function windowLabel(w: Pick<LandWindow, 'start' | 'end'>) {
  const a = new Date(`${w.start}T00:00:00Z`), b = new Date(`${w.end}T00:00:00Z`);
  if (a.getUTCMonth() === b.getUTCMonth()) return `${a.getUTCDate()}–${fmtDay(w.end)}`;
  return `${fmtDay(w.start)} – ${fmtDay(w.end)}`;
}

export function placeSamples(place: LandPlace, sourceId: string): ObservationSample[] {
  const position: GeoPosition = { lat: place.lat, lon: place.lon };
  return place.windows.map((w) => ({
    id: `land-${place.id}-${w.modisDate}`,
    sequenceIndex: w.index,
    position,
    areaId: place.id,
    timeStart: `${w.start}T00:00:00Z`,
    timeEnd: `${w.end}T23:59:59Z`,
    status: w.status,
    reason: w.reason ?? undefined,
    numericValue: w.ndvi,
    sourceId,
    qualityCode: `${w.acceptedPixels}/${w.totalPixels} pixels passed QA`,
    uncertainty: w.std ?? undefined,
    detail: {
      'Composite window': `${w.start} to ${w.end} (MODIS ${w.modisDate})`,
      'Pixels used': `${w.acceptedPixels} of ${w.totalPixels} (250 m, ±${place.windowKm} km)`,
      'Days actually observed': w.observedDays ? `${w.observedDays[0]} to ${w.observedDays[1]}` : null,
      'Spread of accepted pixels (std)': w.std,
      'Sinusoidal tile': w.tile,
    },
  }));
}
