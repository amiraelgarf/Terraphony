/**
 * Effects — the only place where React state meets the audio engine,
 * the URL hash and the browser. Each hook does one job.
 */
import { useEffect, useRef, type Dispatch } from 'react';
import { engine } from '../audio/AudioEngine';
import type { Derived } from './derive';
import { parseHash, toHash } from './hashRoute';
import { effectiveLayers, type Action, type AppState } from './state';

/** Load the requested program into the engine; forward step/end events to state. */
export function useEngineProgram(state: AppState, derived: Derived, dispatch: Dispatch<Action>) {
  const loaded = useRef<{ nonce: number; scans: Derived['scans'] } | null>(null);
  useEffect(() => {
    const req = state.program;
    if (!req) {
      engine.stop();
      loaded.current = null;
      return;
    }
    const sameRequest = loaded.current?.nonce === req.nonce;
    if (sameRequest && loaded.current?.scans === derived.scans) return;
    const program = derived.buildProgram(req.spec);
    const resumeStep = sameRequest ? 0 : req.startStep;
    engine.load(
      program,
      {
        onStep: (k) => {
          const step = program.steps[k];
          dispatch({ type: 'step', step: k, sampleIndex: step?.sampleIndex ?? null, frameKey: derived.frameKeyOf(step?.frameId ?? null) });
        },
        onEnd: () => dispatch({ type: 'playback', state: 'finished' }),
      },
      resumeStep,
    );
    loaded.current = { nonce: req.nonce, scans: derived.scans };
    if (req.autoplay && !sameRequest) engine.play();
    else dispatch({ type: 'playback', state: 'ready' });
  }, [state.program, derived, dispatch]);

  // Unmount: never leave voices or scheduled events behind.
  useEffect(() => () => engine.stop(), []);
}

/** Mixer + volume + clock mode. Changing these never changes a mapping. */
export function useEngineMix(state: AppState) {
  useEffect(() => {
    engine.setMode(state.audio === 'ready' ? 'audio' : 'silent');
  }, [state.audio]);
  useEffect(() => {
    engine.setLayers(effectiveLayers(state));
  }, [state.mutes, state.solo, state.audio]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    engine.setVolume(state.volume);
  }, [state.volume, state.audio]);
}

/** Keep the URL hash and the route/chapter in sync (both directions). */
export function useHashSync(state: AppState, dispatch: Dispatch<Action>) {
  useEffect(() => {
    const apply = () => {
      const r = parseHash(window.location.hash);
      dispatch({ type: 'navigate', route: r.route, chapter: r.chapter });
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, [dispatch]);

  useEffect(() => {
    const want = toHash(state.route, state.chapter);
    if (window.location.hash !== want && !(want === '#/' && window.location.hash === '')) window.location.hash = want;
  }, [state.route, state.chapter]);
}

/**
 * Backgrounded tab: we pause rather than let browser timer throttling drift
 * the visuals away from the audio. Returning shows the paused, synced state.
 */
export function useVisibilityPause(dispatch: Dispatch<Action>) {
  useEffect(() => {
    const onVis = () => {
      if (document.hidden && engine.isPlaying()) {
        engine.pause();
        dispatch({ type: 'playback', state: 'paused' });
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [dispatch]);
}

/** Follow the OS reduced-motion preference unless the visitor overrides it. */
export function useReducedMotionPreference(dispatch: Dispatch<Action>) {
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => dispatch({ type: 'reducedMotion', value: mq.matches });
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [dispatch]);
}

/**
 * Chapter director — what each story scene sets up on entry. Keeps the map,
 * frame and route mounted; only the program, selection and inspector change.
 */
export function useChapterDirector(state: AppState, derived: Derived, dispatch: Dispatch<Action>) {
  const prev = useRef<string>('');
  useEffect(() => {
    const key = `${state.route}/${state.chapter}`;
    if (key === prev.current) return;
    prev.current = key;
    const n = derived.storyNotable;
    const canAutoplay = state.audio === 'ready' || state.audio === 'off';

    if (state.route === 'entry') {
      dispatch({ type: 'program', spec: null });
      return;
    }
    if (state.route === 'method') {
      if (engine.isPlaying()) engine.pause();
      dispatch({ type: 'playback', state: 'paused' });
      return;
    }
    if (state.route === 'explore' || state.route === 'compare') {
      const spec = state.program?.spec;
      if (!spec || spec.kind !== 'route' || spec.staged) {
        dispatch({ type: 'program', spec: { kind: 'route', frameKey: state.frameKey, staged: false }, startStep: 0 });
      }
      if (state.route === 'compare' && !derived.comparability.ok) dispatch({ type: 'compareMode', mode: 'spatial' });
      return;
    }
    // story chapters
    switch (state.chapter) {
      case 'language':
        dispatch({ type: 'program', spec: null });
        dispatch({ type: 'select', selection: null, openInspector: false });
        break;
      case 'passage':
        dispatch({ type: 'frame', frameKey: 'A' });
        dispatch({ type: 'program', spec: { kind: 'route', frameKey: 'A', staged: true }, autoplay: canAutoplay });
        dispatch({ type: 'inspector', open: false });
        break;
      case 'microscope':
        dispatch({ type: 'frame', frameKey: 'A' });
        dispatch({ type: 'program', spec: { kind: 'route', frameKey: 'A', staged: false }, startStep: n });
        dispatch({ type: 'select', selection: { kind: 'step', index: n }, openInspector: true });
        break;
      case 'contrast': {
        // same clamping as abProgram(), so the notable point stays selected
        const start = Math.max(0, Math.min(n - 8, derived.routePoints.length - 16));
        dispatch({ type: 'program', spec: { kind: 'ab', start, length: 16 }, startStep: n - start });
        dispatch({ type: 'select', selection: { kind: 'step', index: n }, openInspector: true });
        break;
      }
      case 'handover':
      case 'coda':
        if (engine.isPlaying()) engine.pause();
        dispatch({ type: 'playback', state: 'paused' });
        dispatch({ type: 'inspector', open: false });
        break;
    }
  }, [state.route, state.chapter, state.audio, state.frameKey, state.program, derived, dispatch]);

  // Passage finished -> the microscope (Scene 03).
  useEffect(() => {
    if (state.route === 'story' && state.chapter === 'passage' && state.playback === 'finished') {
      dispatch({ type: 'navigate', route: 'story', chapter: 'microscope' });
    }
  }, [state.route, state.chapter, state.playback, dispatch]);
}
