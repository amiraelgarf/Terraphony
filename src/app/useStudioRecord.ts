/**
 * Derives the studio's live draft record from the visitor's choices:
 * ocean = route + date -> geodesic stops -> MUR samples;
 * land  = place -> MODIS 16-day windows.
 * Loading is async (data files are fetched once and cached).
 */
import { useEffect, useMemo, useState } from 'react';
import { loadOceanGrid, sampleRoute, type OceanGrid } from '../data/adapters/murSstAdapter';
import { loadPlace, placeSamples, type LandPlace } from '../data/adapters/modisNdviAdapter';
import { fetchLandPoint, parsePointId } from '../data/adapters/modisLiveAdapter';
import { loadPresets, presetWaypoints, type OceanPreset } from '../data/adapters/oceanPresets';
import { resampleGeographic, ROUTE_STOPS } from '../data/geodesicPath';
import { formatGeo } from '../data/projections';
import type { EarthRecord, GeoPosition } from '../data/types';
import { buildRecord } from '../export/recordRecipe';
import { OCEAN_COPY, OCEAN_DATES, OCEAN_RULE, OCEAN_SOURCE } from '../stories/ocean.config';
import { LAND_COPY, LAND_RULE, LAND_SOURCE } from '../stories/vegetation.config';
import type { State } from './recordMachine';

export type StudioData = {
  status: 'loading' | 'ready' | 'error' | 'empty';
  error?: string;
  /** Live MODIS fetch for a point chosen on the map: requests done / total. */
  landProgress: { done: number; total: number } | null;
  /** A chosen point could not be loaded (the curated story still works). */
  landError: string | null;
  record: EarthRecord | null;
  presets: OceanPreset[];
  routeWaypoints: GeoPosition[];
  place: LandPlace | null;
};

const DRAFT_TIME = '2000-01-01T00:00:00.000Z';

export const SVS_CREDIT = 'Picture: NASA/Goddard Space Flight Center Scientific Visualization Studio, SVS 3912 (ECCO2 model, MIT/JPL).';

export function useStudioRecord(state: State): StudioData {
  const [presets, setPresets] = useState<OceanPreset[]>([]);
  const [grid, setGrid] = useState<{ key: string; grid: OceanGrid } | null>(null);
  const [place, setPlace] = useState<LandPlace | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [landProgress, setLandProgress] = useState<{ done: number; total: number } | null>(null);
  const [landError, setLandError] = useState<string | null>(null);
  const inStudio = state.scene === 'studio' || state.scene === 'library';

  useEffect(() => {
    if (!inStudio) return;
    loadPresets().then((f) => setPresets(f.presets)).catch((e) => setError(String(e.message ?? e)));
  }, [inStudio]);

  const dateKey = state.ocean.dateKey;
  useEffect(() => {
    if (state.scene !== 'studio' || state.story !== 'ocean') return;
    let live = true;
    loadOceanGrid(dateKey).then((g) => live && setGrid({ key: dateKey, grid: g })).catch((e) => live && setError(String(e.message ?? e)));
    return () => {
      live = false;
    };
  }, [state.scene, state.story, dateKey]);

  const placeId = state.land.placeId;
  useEffect(() => {
    if (state.scene !== 'studio' || state.story !== 'vegetation') return;
    let live = true;
    setLandError(null);
    const pt = parsePointId(placeId);
    const load = pt ? fetchLandPoint(pt.lat, pt.lon, (done, total) => live && setLandProgress({ done, total })) : loadPlace(placeId);
    load
      .then((p) => {
        if (!live) return;
        setPlace(p);
        setLandProgress(null);
      })
      .catch((e) => {
        if (!live) return;
        setLandProgress(null);
        if (pt) setLandError(String(e.message ?? e));
        else setError(String(e.message ?? e));
      });
    return () => {
      live = false;
    };
  }, [state.scene, state.story, placeId]);

  const o = state.ocean;
  const preset = presets.find((p) => p.id === o.presetId) ?? null;
  const routeWaypoints = useMemo(() => (preset ? presetWaypoints(preset) : o.waypoints), [preset, o.waypoints]);

  const record = useMemo<EarthRecord | null>(() => {
    if (state.story === 'ocean') {
      if (!grid || grid.key !== o.dateKey || routeWaypoints.length < 2) return null;
      const { points, lengthKm } = resampleGeographic(routeWaypoints, ROUTE_STOPS);
      const date = OCEAN_DATES.find((d) => d.key === o.dateKey)!;
      const day = grid.grid.meta.dates[o.dateKey].date;
      return buildRecord({
        title: o.title,
        story: 'ocean',
        source: OCEAN_SOURCE,
        visualContext: { label: 'NASA SVS 3912 — Global Sea Surface Currents and Temperature', url: 'https://svs.gsfc.nasa.gov/3912/', note: 'The picture is the ECCO2 model visualization of the same day; the notes come from MUR observations-based analysis, a different product.' },
        geometry: {
          kind: 'route',
          points,
          waypoints: routeWaypoints,
          lengthKm: Math.round(lengthKm),
          label: preset ? preset.name : `Drawn route, ${formatGeo(points[0], 0)} to ${formatGeo(points[points.length - 1], 0)}`,
        },
        timeWindow: { label: date.label, start: `${day}T00:00:00Z`, end: `${day}T23:59:59Z` },
        observations: sampleRoute(grid.grid, o.dateKey, points, OCEAN_SOURCE.sourceId),
        rule: OCEAN_RULE,
        instrument: o.instrument,
        narrativeText: [OCEAN_COPY.narration, `A line of ${Math.round(lengthKm).toLocaleString('en-GB')} km across the sea became ${ROUTE_STOPS} notes.`],
        createdAt: DRAFT_TIME,
        credits: [OCEAN_SOURCE.credit, SVS_CREDIT],
      });
    }
    if (!place || place.id !== state.land.placeId) return null;
    const first = place.windows[0], last = place.windows[place.windows.length - 1];
    return buildRecord({
      title: state.land.title,
      story: 'vegetation',
      source: LAND_SOURCE,
      geometry: { kind: 'location', points: [{ lat: place.lat, lon: place.lon }], areaId: place.id, label: `${place.name}, ${place.region}` },
      timeWindow: { label: String(place.year), start: `${first.start}T00:00:00Z`, end: `${last.end}T23:59:59Z` },
      observations: placeSamples(place, LAND_SOURCE.sourceId),
      rule: LAND_RULE,
      instrument: state.land.instrument,
      narrativeText: [LAND_COPY.narration, `You stayed with one landscape through ${place.windows.length} vegetation-composite windows.`],
      createdAt: DRAFT_TIME,
      credits: [LAND_SOURCE.credit],
    });
  }, [state.story, grid, o.dateKey, o.title, o.instrument, routeWaypoints, preset, place, state.land.placeId, state.land.title, state.land.instrument]);

  const loading = state.story === 'ocean' ? !grid || grid.key !== o.dateKey || (o.presetId !== null && !preset) : !place || place.id !== state.land.placeId;
  const status: StudioData['status'] = error ? 'error' : state.story === 'ocean' && routeWaypoints.length < 2 && !loading ? 'empty' : loading ? 'loading' : record ? 'ready' : 'empty';
  return { status: landError && state.story === 'vegetation' ? 'error' : status, error: error ?? (state.story === 'vegetation' ? landError ?? undefined : undefined), landProgress, landError, record, presets, routeWaypoints, place };
}
