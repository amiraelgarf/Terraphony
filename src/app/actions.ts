/**
 * Actions — every user intent, as one named function. Components call these;
 * they never talk to the engine directly. Functions that may start sound are
 * called from click/key handlers, so audio unlock happens inside the gesture.
 */
import type { Dispatch } from 'react';
import { engine } from '../audio/AudioEngine';
import { nextChapter, previousChapter, type ChapterId } from '../content/story.en';
import { isDegenerateRoute, thinGeoTrace } from '../domain/routeGeometry';
import { valueToNote, bassOf, type Layer } from '../domain/sonification';
import type { GeoPoint } from '../domain/sourceTypes';
import type { Derived } from './derive';
import type { Action, AppState, ExploreTool, FrameKey } from './state';
import type { Registry } from '../domain/sourceRegistry';

export type Actions = ReturnType<typeof createActions>;

export function createActions(dispatch: Dispatch<Action>, get: () => AppState, getDerived: () => Derived, registry: Registry) {
  /** Unlock audio inside the current gesture. Resolves to whether sound is available. */
  async function ensureAudio(): Promise<boolean> {
    const s = get();
    if (s.audio === 'ready') return true;
    if (s.audio === 'off') return false;
    const ok = await engine.unlock();
    dispatch({ type: 'audio', status: ok ? 'ready' : 'failed' });
    if (!ok) dispatch({ type: 'notice', text: 'audio-failed' });
    return ok;
  }

  const goStory = (chapter: ChapterId) => dispatch({ type: 'navigate', route: 'story', chapter });

  const actions = {
    ensureAudio,

    async begin(withSound: boolean) {
      if (withSound) await ensureAudio();
      else dispatch({ type: 'audio', status: 'off' });
      goStory('language');
    },

    exploreDirectly() {
      dispatch({ type: 'tool', tool: 'probe' });
      dispatch({ type: 'navigate', route: 'explore' });
    },

    navigate(route: AppState['route']) {
      if (route === 'story') goStory(get().chapter === 'threshold' ? 'language' : get().chapter);
      else dispatch({ type: 'navigate', route });
    },

    goChapter: goStory,
    nextChapter() {
      const n = nextChapter(get().chapter);
      if (n) goStory(n);
    },
    previousChapter() {
      const p = previousChapter(get().chapter);
      if (p && p !== 'threshold') goStory(p);
      else dispatch({ type: 'navigate', route: 'entry', chapter: 'threshold' });
    },

    async enableSound() {
      if (get().audio === 'off') dispatch({ type: 'audio', status: 'locked' });
      const ok = await engine.unlock();
      dispatch({ type: 'audio', status: ok ? 'ready' : 'failed' });
    },
    disableSound() {
      engine.pause();
      dispatch({ type: 'playback', state: 'paused' });
      dispatch({ type: 'audio', status: 'off' });
    },

    async play() {
      await ensureAudio();
      const s = get();
      if (!s.program) dispatch({ type: 'program', spec: { kind: 'route', frameKey: s.frameKey, staged: false }, autoplay: true });
      else {
        engine.play();
        dispatch({ type: 'playback', state: 'playing' });
      }
    },
    pause() {
      engine.pause();
      dispatch({ type: 'playback', state: 'paused' });
    },
    async togglePlay() {
      if (engine.isPlaying()) actions.pause();
      else await actions.play();
    },
    stop() {
      engine.pause();
      engine.seek(0);
      dispatch({ type: 'playback', state: 'ready' });
    },
    seek(step: number) {
      engine.seek(step);
    },

    /** Timeline / list selection: pause, select, open the inspector ("Why this note?"). */
    inspectStep(step: number) {
      if (engine.isPlaying()) actions.pause();
      engine.seek(step);
      dispatch({ type: 'inspector', open: true });
    },
    /** Inspect a route point by sample index, loading the plain route program if needed. */
    inspectSample(frameKey: FrameKey, index: number) {
      const s = get();
      if (s.program?.spec.kind === 'route' && s.program.spec.frameKey === frameKey && !s.program.spec.staged) return actions.inspectStep(index);
      if (engine.isPlaying()) actions.pause();
      dispatch({ type: 'frame', frameKey });
      dispatch({ type: 'program', spec: { kind: 'route', frameKey, staged: false }, startStep: index });
      dispatch({ type: 'select', selection: { kind: 'step', index }, openInspector: true });
    },
    whyThisNote() {
      if (engine.isPlaying()) actions.pause();
      dispatch({ type: 'inspector', open: true });
    },
    closeInspector() {
      dispatch({ type: 'inspector', open: false });
    },

    /** Audition one sample's note (keyboard list, "Play this point"). */
    async auditionSample(frameKey: FrameKey, index: number) {
      if (!(await ensureAudio())) return;
      const e = getDerived().scans[frameKey].events[index];
      if (e?.note) engine.audition(e.note, { bass: e.bassNote });
    },

    /** Probe: one point, one note, full explanation. */
    async probeAt(point: GeoPoint) {
      if (engine.isPlaying()) actions.pause();
      dispatch({ type: 'select', selection: { kind: 'probe', point }, openInspector: true });
      const s = get();
      const grid = registry.grids.get(getDerived().frames[s.frameKey].id)!;
      const r = grid.lookupGeo(point.lat, point.lon);
      if (r.status === 'ok' && (await ensureAudio())) {
        const note = valueToNote(r.quantity.value, 0, 1);
        if (note) engine.audition(note);
      }
    },

    /** "Explore here": carry frame + location + mapping into Probe; stop the transport. */
    exploreHere() {
      const s = get();
      const d = getDerived();
      let point: GeoPoint | null = null;
      if (s.selection?.kind === 'step') {
        const p = d.scans[s.frameKey].samples[s.selection.index]?.position;
        if (p?.lat !== undefined && p.lon !== undefined) point = { lat: p.lat, lon: p.lon };
      } else if (s.selection?.kind === 'probe') point = s.selection.point;
      engine.pause();
      if (s.route === 'story') dispatch({ type: 'storyReturn', value: { chapter: s.chapter, step: s.step } });
      dispatch({ type: 'tool', tool: 'probe' });
      dispatch({ type: 'navigate', route: 'explore' });
      if (point) dispatch({ type: 'select', selection: { kind: 'probe', point }, openInspector: true });
    },
    backToStory() {
      const r = get().storyReturn;
      dispatch({ type: 'storyReturn', value: null });
      goStory(r?.chapter ?? 'language');
    },

    setTool(tool: ExploreTool) {
      dispatch({ type: 'tool', tool });
    },
    startExploring(tool: ExploreTool) {
      dispatch({ type: 'tool', tool });
      dispatch({ type: 'navigate', route: 'explore' });
    },

    /** Draw finished: thin, validate, resample (in derive), but do not autoplay. */
    drawComplete(trace: GeoPoint[]) {
      const pts = thinGeoTrace(trace);
      if (isDegenerateRoute(pts)) {
        void actions.probeAt(trace[0]);
        return;
      }
      if (engine.isPlaying()) actions.pause();
      dispatch({ type: 'drawn', points: pts });
      dispatch({ type: 'program', spec: { kind: 'route', frameKey: get().frameKey, staged: false } });
      dispatch({ type: 'select', selection: { kind: 'step', index: 0 } });
    },
    async playRoute() {
      await ensureAudio();
      dispatch({ type: 'program', spec: { kind: 'route', frameKey: get().frameKey, staged: false }, autoplay: true });
    },
    reverseRoute() {
      if (engine.isPlaying()) actions.pause();
      dispatch({ type: 'reverse' });
    },
    clearDrawn() {
      if (engine.isPlaying()) actions.pause();
      dispatch({ type: 'drawn', points: null });
    },
    useStoryRoute() {
      dispatch({ type: 'routeSource', source: 'story' });
    },
    useDrawnRoute() {
      if (get().drawnRoute) dispatch({ type: 'routeSource', source: 'drawn' });
    },

    /** A/B toggle keeps the sample index; old events are cancelled by load(). */
    setFrame(frameKey: FrameKey) {
      const s = get();
      if (frameKey === s.frameKey && s.program?.spec.kind === 'route') return;
      const wasPlaying = engine.isPlaying();
      const sample = s.selection?.kind === 'step' ? s.selection.index : 0;
      dispatch({ type: 'frame', frameKey });
      if (s.program?.spec.kind === 'route' || s.program?.spec.kind === 'ab' || !s.program) {
        dispatch({ type: 'program', spec: { kind: 'route', frameKey, staged: false }, autoplay: wasPlaying, startStep: sample });
      }
    },

    /** Sequential A then B excerpt (16 steps) around the selected sample. */
    async playAB() {
      await ensureAudio();
      const s = get();
      const center = s.selection?.kind === 'step' ? s.selection.index : getDerived().storyNotable;
      const start = Math.max(0, Math.min(center - 8, getDerived().routePoints.length - 16));
      dispatch({ type: 'program', spec: { kind: 'ab', start, length: 16 }, autoplay: true });
    },

    async replayEvent(frameKey: FrameKey, center: number) {
      await ensureAudio();
      dispatch({ type: 'program', spec: { kind: 'excerpt', frameKey, center }, autoplay: true });
    },

    /** "Hear the rule": three illustrative inputs, clearly labelled as such in the UI. */
    async hearRule() {
      if (!(await ensureAudio())) return;
      [0, 0.5, 1].forEach((v, i) => window.setTimeout(() => engine.audition(valueToNote(v, 0, 1)!), i * 650));
    },
    async hearValue(v: number) {
      if (!(await ensureAudio())) return;
      const n = valueToNote(v, 0, 1);
      if (n) engine.audition(n, { bass: bassOf(n) });
    },

    setCompareMode(mode: 'temporal' | 'spatial') {
      if (mode === 'temporal' && !getDerived().comparability.ok) return;
      dispatch({ type: 'compareMode', mode });
    },
    placeSpatial(point: GeoPoint) {
      dispatch({ type: 'spatialPoint', which: get().spatial.placing, point });
      dispatch({ type: 'inspector', open: true });
    },
    setPlacing(which: FrameKey) {
      dispatch({ type: 'placing', which });
    },
    async playSpatial() {
      if (!(await ensureAudio())) return;
      const s = get();
      const grid = registry.grids.get(getDerived().frames[s.frameKey].id)!;
      (['A', 'B'] as const).forEach((k, i) => {
        const p = s.spatial[k];
        if (!p) return;
        const r = grid.lookupGeo(p.lat, p.lon);
        const note = r.status === 'ok' ? valueToNote(r.quantity.value, 0, 1) : null;
        if (note) window.setTimeout(() => engine.audition(note), i * 900);
      });
    },

    toggleMute: (layer: Layer) => dispatch({ type: 'mute', layer }),
    setSolo: (layer: Layer | null) => dispatch({ type: 'solo', layer }),
    setVolume: (volume: number) => dispatch({ type: 'volume', volume }),
    setReducedMotion: (value: boolean) => dispatch({ type: 'reducedMotion', value }),
    dismissNotice: () => dispatch({ type: 'notice', text: null }),
  };
  return actions;
}
