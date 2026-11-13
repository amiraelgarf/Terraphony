/**
 * App-wide state provider + the side-effect hooks that observe it:
 *   - drafts and shelf persisted locally
 *   - URL hash <-> scene (deep links, back/forward)
 *   - system reduced-motion preference
 *   - transport program / mix / palette kept in sync with the state
 */
import { createContext, useContext, useEffect, useMemo, useReducer, useRef, type Dispatch, type ReactNode } from 'react';
import { transport } from '../audio/transport';
import type { EarthRecord } from '../data/types';
import { loadDrafts, loadShelf, saveDrafts, saveShelf } from './persistence';
import { initialLand, initialOcean, initialState, parseHash, reducer, toHash, type Action, type State } from './recordMachine';
import { useStudioRecord, type StudioData } from './useStudioRecord';

type Ctx = { state: State; dispatch: Dispatch<Action>; studio: StudioData; activeRecord: EarthRecord | null };
const RecordCtx = createContext<Ctx | null>(null);

/** Set when a #/record/<id> link pointed at a record that isn't on this browser's shelf; the library explains it once. */
export const missingRecordLink = { current: false };

function boot(): State {
  const drafts = loadDrafts();
  const shelf = loadShelf();
  const route = parseHash(window.location.hash);
  const current = route.recordId ? shelf.find((r) => r.recordId === route.recordId) ?? null : null;
  if (route.scene === 'reveal' && !current) missingRecordLink.current = true;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  return initialState({
    scene: route.scene === 'reveal' && !current ? 'library' : route.scene,
    story: route.story ?? 'ocean',
    ocean: { ...initialOcean, ...(drafts?.ocean ?? {}) },
    land: { ...initialLand, ...(drafts?.land ?? {}) },
    shelf,
    current,
    revealSource: 'shelf',
    reducedMotion: reduced,
  });
}

export function RecordProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, boot);
  const studio = useStudioRecord(state);
  const activeRecord = state.scene === 'reveal' || state.scene === 'press' ? state.current : studio.record;

  // persistence
  useEffect(() => {
    saveDrafts(state.ocean, state.land);
  }, [state.ocean, state.land]);
  useEffect(() => {
    saveShelf(state.shelf);
  }, [state.shelf]);

  // state -> URL
  useEffect(() => {
    const h = toHash(state);
    if (window.location.hash !== h) window.history.pushState(null, '', h);
  }, [state.scene, state.story, state.current?.recordId]); // eslint-disable-line react-hooks/exhaustive-deps

  // URL -> state (back / forward)
  const shelfRef = useRef(state.shelf);
  shelfRef.current = state.shelf;
  useEffect(() => {
    const onPop = () => {
      const r = parseHash(window.location.hash);
      if (r.scene === 'reveal') {
        const rec = shelfRef.current.find((x) => x.recordId === r.recordId);
        if (rec) dispatch({ type: 'openRecord', record: rec, source: 'shelf' });
        else {
          missingRecordLink.current = true;
          dispatch({ type: 'go', scene: 'library' });
        }
      } else dispatch({ type: 'go', scene: r.scene, story: r.story });
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // reduced motion follows the system unless the visitor changes it
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const on = () => dispatch({ type: 'reducedMotion', on: mq.matches });
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);

  // mix + palette
  useEffect(() => transport.setLayers(state.layers), [state.layers]);
  useEffect(() => transport.setVolume(state.volume), [state.volume]);
  useEffect(() => {
    if (activeRecord) transport.setPalette(activeRecord.instrumentPaletteId);
  }, [activeRecord?.instrumentPaletteId]); // eslint-disable-line react-hooks/exhaustive-deps

  // program: whatever record is on screen; the transport clock drives playhead
  const programId = activeRecord ? `${state.scene}:${activeRecord.recordId}` : null;
  useEffect(() => {
    if (!activeRecord || state.scene === 'press') {
      transport.stop();
      return;
    }
    transport.load(
      { id: programId!, events: activeRecord.events, beatSeconds: activeRecord.musicalRule.beatSeconds },
      {
        onStep: (k) => dispatch({ type: 'playhead', index: k }),
        onEnd: () => {
          dispatch({ type: 'playing', on: false });
          dispatch({ type: 'playhead', index: null });
        },
      },
      0,
      false,
    );
    dispatch({ type: 'playing', on: false });
  }, [programId]); // eslint-disable-line react-hooks/exhaustive-deps

  // pause when the tab is hidden (timers throttle; never let picture and sound drift)
  useEffect(() => {
    const vis = () => {
      if (document.hidden && transport.isPlaying()) {
        transport.pause();
        dispatch({ type: 'playing', on: false });
      }
    };
    document.addEventListener('visibilitychange', vis);
    return () => document.removeEventListener('visibilitychange', vis);
  }, []);

  const value = useMemo(() => ({ state, dispatch, studio, activeRecord }), [state, studio, activeRecord]);
  return <RecordCtx.Provider value={value}>{children}</RecordCtx.Provider>;
}

export function useRecord() {
  const c = useContext(RecordCtx);
  if (!c) throw new Error('useRecord must be used inside RecordProvider');
  return c;
}
