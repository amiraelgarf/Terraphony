/**
 * JukeboxProvider — wires state + derived data + effects + actions together
 * and exposes them through one hook: useJukebox().
 */
import { createContext, useContext, useMemo, useReducer, useRef, type ReactNode } from 'react';
import type { Registry } from '../domain/sourceRegistry';
import { createActions, type Actions } from './actions';
import { useDerived, type Derived } from './derive';
import { useChapterDirector, useEngineMix, useEngineProgram, useHashSync, useReducedMotionPreference, useVisibilityPause } from './effects';
import { parseHash } from './hashRoute';
import { initialState, reducer, type AppState } from './state';

type Ctx = { state: AppState; derived: Derived; actions: Actions; registry: Registry };
const JukeboxContext = createContext<Ctx | null>(null);

export function JukeboxProvider({ registry, children }: { registry: Registry; children: ReactNode }) {
  const prefersReduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  // Start from the URL so deep links are honoured before the first hash sync runs.
  const [state, dispatch] = useReducer(reducer, prefersReduced, (r: boolean) => {
    const parsed = parseHash(typeof window !== 'undefined' ? window.location.hash : '');
    return { ...initialState(r), route: parsed.route, chapter: parsed.chapter ?? 'threshold' };
  });
  const derived = useDerived(registry, state);

  // Actions read the latest state through refs, so they stay stable across renders.
  const stateRef = useRef(state);
  stateRef.current = state;
  const derivedRef = useRef(derived);
  derivedRef.current = derived;
  const actions = useMemo(() => createActions(dispatch, () => stateRef.current, () => derivedRef.current, registry), [registry]);

  useHashSync(state, dispatch);
  useEngineProgram(state, derived, dispatch);
  useEngineMix(state);
  useChapterDirector(state, derived, dispatch);
  useVisibilityPause(dispatch);
  useReducedMotionPreference(dispatch);

  const value = useMemo(() => ({ state, derived, actions, registry }), [state, derived, actions, registry]);
  return <JukeboxContext.Provider value={value}>{children}</JukeboxContext.Provider>;
}

export function useJukebox(): Ctx {
  const c = useContext(JukeboxContext);
  if (!c) throw new Error('useJukebox must be used inside <JukeboxProvider>');
  return c;
}
