/** Curated suggested ocean routes (public/data/ocean/presets.json). */
import type { GeoPosition } from '../types';

export type OceanPreset = {
  id: string;
  name: string;
  note: string;
  waypoints: [number, number][];
  lengthKm: number;
  reference: Record<string, { lat: number; lon: number; status: string; reason: string | null; value: number | null; cell: [number, number]; midi: number | null }[]>;
};
export type PresetFile = { stops: number; domainC: [number, number]; accentC: number; presets: OceanPreset[] };

let p: Promise<PresetFile> | null = null;
export function loadPresets(base = import.meta.env.BASE_URL): Promise<PresetFile> {
  p ??= fetch(`${base}data/ocean/presets.json`).then((r) => {
    if (!r.ok) throw new Error(`Could not load suggested routes (${r.status})`);
    return r.json();
  });
  return p;
}

export const presetWaypoints = (pr: OceanPreset): GeoPosition[] => pr.waypoints.map(([lat, lon]) => ({ lat, lon }));
