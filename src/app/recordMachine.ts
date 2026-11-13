/**
 * The experience as a typed state machine (brief section 9):
 *
 *   ARRIVAL -> LIBRARY -> STUDIO (ready / listening / paused / inspecting / composing)
 *           -> PRESSING -> REVEAL -> (play / inspect / export / library)
 *
 * Scene changes and data choices go through this reducer; side effects
 * (audio, persistence, URL) live in hooks that observe the state.
 */
import { ALL_LAYERS_ON, LAYERS, type Layer } from '../audio/instruments';
import type { EarthRecord, GeoPosition, InstrumentId } from '../data/types';
import type { OceanDateKey } from '../stories/ocean.config';
import { LAND_COPY } from '../stories/vegetation.config';
import { OCEAN_COPY } from '../stories/ocean.config';

export type Scene = 'arrival' | 'library' | 'studio' | 'press' | 'reveal' | 'method';
export type StudioStory = 'ocean' | 'vegetation';
export type SoundState = 'unset' | 'on' | 'off' | 'unavailable';
export type OceanTool = 'preset' | 'draw';

export type OceanDraft = {
  title: string;
  instrument: InstrumentId;
  presetId: string | null;
  waypoints: GeoPosition[];
  dateKey: OceanDateKey;
  layer: 'picture' | 'data';
  tool: OceanTool;
};
export type LandDraft = { title: string; instrument: InstrumentId; placeId: string };

export type State = {
  scene: Scene;
  story: StudioStory;
  ocean: OceanDraft;
  land: LandDraft;
  selected: number | null;
  playhead: number | null;
  playing: boolean;
  sound: SoundState;
  layers: Record<Layer, boolean>;
  volume: number;
  current: EarthRecord | null;
  shelf: EarthRecord[];
  reducedMotion: boolean;
  revealSource: 'press' | 'shelf';
};

export const initialOcean: OceanDraft = {
  title: OCEAN_COPY.defaultTitle,
  instrument: 'glass',
  presetId: 'gulf-stream',
  waypoints: [],
  dateKey: 'A',
  layer: 'picture',
  tool: 'preset',
};
export const initialLand: LandDraft = { title: LAND_COPY.defaultTitle, instrument: 'wood', placeId: 'nile-delta' };

export function initialState(partial: Partial<State> = {}): State {
  return {
    scene: 'arrival',
    story: 'ocean',
    ocean: initialOcean,
    land: initialLand,
    selected: null,
    playhead: null,
    playing: false,
    sound: 'unset',
    layers: { ...ALL_LAYERS_ON },
    volume: 0.7,
    current: null,
    shelf: [],
    reducedMotion: false,
    revealSource: 'press',
    ...partial,
  };
}

export type Action =
  | { type: 'go'; scene: Scene; story?: StudioStory }
  | { type: 'openRecord'; record: EarthRecord; source: 'press' | 'shelf' }
  | { type: 'ocean'; patch: Partial<OceanDraft> }
  | { type: 'land'; patch: Partial<LandDraft> }
  | { type: 'select'; index: number | null }
  | { type: 'playhead'; index: number | null }
  | { type: 'playing'; on: boolean }
  | { type: 'sound'; value: SoundState }
  | { type: 'layer'; layer: Layer; on: boolean }
  | { type: 'solo'; layer: Layer | null }
  | { type: 'volume'; value: number }
  | { type: 'shelf'; records: EarthRecord[] }
  | { type: 'reducedMotion'; on: boolean };

export function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'go': {
      const story = a.story ?? s.story;
      const changed = a.scene !== s.scene || story !== s.story;
      return changed ? { ...s, scene: a.scene, story, playing: false, playhead: null, selected: a.scene === 'studio' && story === s.story ? s.selected : null } : s;
    }
    case 'openRecord':
      return { ...s, current: a.record, scene: a.source === 'press' ? 'press' : 'reveal', revealSource: a.source, playing: false, playhead: null, selected: null };
    case 'ocean': {
      const routeChanged = 'waypoints' in a.patch || 'presetId' in a.patch || 'dateKey' in a.patch;
      return { ...s, ocean: { ...s.ocean, ...a.patch }, ...(routeChanged ? { playing: false, playhead: null } : {}) };
    }
    case 'land': {
      const placeChanged = 'placeId' in a.patch && a.patch.placeId !== s.land.placeId;
      return { ...s, land: { ...s.land, ...a.patch }, ...(placeChanged ? { playing: false, playhead: null, selected: null } : {}) };
    }
    case 'select':
      return { ...s, selected: a.index };
    case 'playhead':
      return { ...s, playhead: a.index };
    case 'playing':
      return { ...s, playing: a.on };
    case 'sound':
      return { ...s, sound: a.value };
    case 'layer':
      return { ...s, layers: { ...s.layers, [a.layer]: a.on } };
    case 'solo':
      return {
        ...s,
        layers: a.layer === null ? { ...ALL_LAYERS_ON } : (Object.fromEntries(LAYERS.map((l) => [l, l === a.layer])) as Record<Layer, boolean>),
      };
    case 'volume':
      return { ...s, volume: a.value };
    case 'shelf':
      return { ...s, shelf: a.records };
    case 'reducedMotion':
      return { ...s, reducedMotion: a.on };
    default:
      return s;
  }
}

/* ------------------------------------------------------------------ */
/* Hash routes — deep links, browser back/forward, refresh-safe        */
/* ------------------------------------------------------------------ */

export type Route = { scene: Scene; story?: StudioStory; recordId?: string };

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  switch (parts[0]) {
    case 'library':
      return { scene: 'library' };
    case 'studio':
      return { scene: 'studio', story: parts[1] === 'land' ? 'vegetation' : 'ocean' };
    case 'record':
      return { scene: 'reveal', recordId: parts[1] };
    case 'method':
      return { scene: 'method' };
    default:
      return { scene: 'arrival' };
  }
}

export function toHash(s: Pick<State, 'scene' | 'story' | 'current'>): string {
  switch (s.scene) {
    case 'library':
      return '#/library';
    case 'studio':
      return s.story === 'vegetation' ? '#/studio/land' : '#/studio/ocean';
    case 'press':
    case 'reveal':
      return s.current ? `#/record/${s.current.recordId}` : '#/library';
    case 'method':
      return '#/method';
    default:
      return '#/';
  }
}
