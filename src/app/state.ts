/**
 * App state — orthogonal pieces (route, tool, playback, audio, selection…)
 * held in one reducer. No audio objects live here; only plain data.
 */
import type { ChapterId } from '../content/story.en';
import type { Layer } from '../domain/sonification';
import type { GeoPoint } from '../domain/sourceTypes';

export type AppRoute = 'entry' | 'story' | 'explore' | 'compare' | 'method';
export type ExploreTool = 'probe' | 'draw' | 'navigate';
export type PlaybackState = 'ready' | 'playing' | 'paused' | 'finished';
export type AudioStatus = 'locked' | 'ready' | 'failed' | 'off';
export type FrameKey = 'A' | 'B';

export type ProgramSpec =
  | { kind: 'route'; frameKey: FrameKey; staged: boolean }
  | { kind: 'ab'; start: number; length: number }
  | { kind: 'excerpt'; frameKey: FrameKey; center: number };

export type ProgramRequest = { spec: ProgramSpec; nonce: number; autoplay: boolean; startStep: number };

export type Selection = { kind: 'step'; index: number } | { kind: 'probe'; point: GeoPoint } | null;

export type AppState = {
  route: AppRoute;
  chapter: ChapterId;
  tool: ExploreTool;
  audio: AudioStatus;
  playback: PlaybackState;
  frameKey: FrameKey;
  routeSource: 'story' | 'drawn';
  drawnRoute: GeoPoint[] | null;
  reversed: boolean;
  program: ProgramRequest | null;
  step: number | null;
  selection: Selection;
  inspectorOpen: boolean;
  compareMode: 'temporal' | 'spatial';
  spatial: { A: GeoPoint | null; B: GeoPoint | null; placing: FrameKey };
  mutes: Record<Layer, boolean>;
  solo: Layer | null;
  volume: number;
  reducedMotion: boolean;
  storyReturn: { chapter: ChapterId; step: number | null } | null;
  notice: string | null;
};

export const initialState = (reducedMotion: boolean): AppState => ({
  route: 'entry',
  chapter: 'threshold',
  tool: 'probe',
  audio: 'locked',
  playback: 'ready',
  frameKey: 'A',
  routeSource: 'story',
  drawnRoute: null,
  reversed: false,
  program: null,
  step: null,
  selection: null,
  inspectorOpen: false,
  compareMode: 'temporal',
  spatial: { A: null, B: null, placing: 'A' },
  mutes: { melody: false, bass: false, rhythm: false, atmosphere: false },
  solo: null,
  volume: 0.8,
  reducedMotion,
  storyReturn: null,
  notice: null,
});

export type Action =
  | { type: 'navigate'; route: AppRoute; chapter?: ChapterId }
  | { type: 'audio'; status: AudioStatus }
  | { type: 'tool'; tool: ExploreTool }
  | { type: 'program'; spec: ProgramSpec | null; autoplay?: boolean; startStep?: number }
  | { type: 'step'; step: number; sampleIndex: number | null; frameKey: FrameKey | null }
  | { type: 'playback'; state: PlaybackState }
  | { type: 'select'; selection: Selection; openInspector?: boolean }
  | { type: 'inspector'; open: boolean }
  | { type: 'frame'; frameKey: FrameKey }
  | { type: 'drawn'; points: GeoPoint[] | null }
  | { type: 'reverse' }
  | { type: 'routeSource'; source: 'story' | 'drawn' }
  | { type: 'compareMode'; mode: 'temporal' | 'spatial' }
  | { type: 'spatialPoint'; which: FrameKey; point: GeoPoint }
  | { type: 'placing'; which: FrameKey }
  | { type: 'mute'; layer: Layer }
  | { type: 'solo'; layer: Layer | null }
  | { type: 'volume'; volume: number }
  | { type: 'reducedMotion'; value: boolean }
  | { type: 'storyReturn'; value: AppState['storyReturn'] }
  | { type: 'notice'; text: string | null };

let nonce = 0;

export function reducer(s: AppState, a: Action): AppState {
  switch (a.type) {
    case 'navigate':
      return { ...s, route: a.route, chapter: a.chapter ?? s.chapter, notice: null };
    case 'audio':
      return { ...s, audio: a.status };
    case 'tool':
      return { ...s, tool: a.tool };
    case 'program':
      return {
        ...s,
        program: a.spec ? { spec: a.spec, nonce: ++nonce, autoplay: !!a.autoplay, startStep: a.startStep ?? 0 } : null,
        playback: a.autoplay ? 'playing' : 'ready',
      };
    case 'step':
      return {
        ...s,
        step: a.step,
        frameKey: a.frameKey ?? s.frameKey,
        selection: a.sampleIndex !== null ? { kind: 'step', index: a.sampleIndex } : s.selection,
      };
    case 'playback':
      return { ...s, playback: a.state };
    case 'select':
      return { ...s, selection: a.selection, inspectorOpen: a.openInspector ?? s.inspectorOpen };
    case 'inspector':
      return { ...s, inspectorOpen: a.open };
    case 'frame':
      return { ...s, frameKey: a.frameKey };
    case 'drawn':
      return { ...s, drawnRoute: a.points, routeSource: a.points ? 'drawn' : 'story', reversed: false };
    case 'reverse':
      return { ...s, reversed: !s.reversed };
    case 'routeSource':
      return { ...s, routeSource: a.source, reversed: false };
    case 'compareMode':
      return { ...s, compareMode: a.mode };
    case 'spatialPoint': {
      const spatial = { ...s.spatial, [a.which]: a.point, placing: a.which === 'A' ? 'B' : 'A' } as AppState['spatial'];
      return { ...s, spatial };
    }
    case 'placing':
      return { ...s, spatial: { ...s.spatial, placing: a.which } };
    case 'mute':
      return { ...s, mutes: { ...s.mutes, [a.layer]: !s.mutes[a.layer] } };
    case 'solo':
      return { ...s, solo: a.layer };
    case 'volume':
      return { ...s, volume: a.volume };
    case 'reducedMotion':
      return { ...s, reducedMotion: a.value };
    case 'storyReturn':
      return { ...s, storyReturn: a.value };
    case 'notice':
      return { ...s, notice: a.text };
  }
}

/** Solo/mute -> which layers actually sound. Never changes any mapping. */
export function effectiveLayers(s: Pick<AppState, 'mutes' | 'solo'>): Record<Layer, boolean> {
  const on = (l: Layer) => (s.solo ? s.solo === l : !s.mutes[l]);
  return { melody: on('melody'), bass: on('bass'), rhythm: on('rhythm'), atmosphere: on('atmosphere') };
}
