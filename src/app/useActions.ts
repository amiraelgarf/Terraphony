/**
 * Every user intent in one place. Components call these; they dispatch state
 * changes and drive the transport. Sound is only ever unlocked here, inside
 * a user gesture.
 */
import { useMemo } from 'react';
import { transport } from '../audio/transport';
import type { EarthRecord } from '../data/types';
import { buildRecord } from '../export/recordRecipe';
import { SHELF_LIMIT } from './persistence';
import { useRecord } from './RecordContext';
import { announce } from '../accessibility/announcements';
import type { Scene, StudioStory } from './recordMachine';
import { isDriving, tourDirector } from '../tour';

/** Tell the guided journey what the visitor did (never what the director did). */
const intent = (kind: 'play' | 'pause' | 'inspect' | 'press', index?: number | null) => {
  if (!isDriving()) tourDirector.userIntent(kind, index);
};

export function useActions() {
  const { state, dispatch, activeRecord } = useRecord();

  return useMemo(() => {
    /** Ask for sound on the first gesture that needs it. Never at page load. */
    async function ensureSound(): Promise<boolean> {
      if (state.sound === 'off' || state.sound === 'unavailable') return false;
      if (transport.audioReady && transport.clockMode === 'audio') return true;
      const ok = await transport.unlock();
      dispatch({ type: 'sound', value: ok ? 'on' : 'unavailable' });
      transport.setMode(ok ? 'audio' : 'silent');
      if (!ok) announce('Sound is not available in this browser. Everything still works visually.');
      return ok;
    }

    async function setSound(on: boolean) {
      if (on) {
        dispatch({ type: 'sound', value: 'unset' });
        const ok = await transport.unlock();
        dispatch({ type: 'sound', value: ok ? 'on' : 'unavailable' });
        transport.setMode(ok ? 'audio' : 'silent');
      } else {
        transport.setMode('silent');
        dispatch({ type: 'sound', value: 'off' });
      }
      dispatch({ type: 'playing', on: false });
    }

    async function togglePlay() {
      if (!activeRecord) return;
      intent(transport.isPlaying() ? 'pause' : 'play');
      if (transport.isPlaying()) {
        transport.pause();
        dispatch({ type: 'playing', on: false });
        return;
      }
      await ensureSound();
      if (state.selected !== null && state.playhead === null) transport.seek(state.selected);
      transport.play();
      dispatch({ type: 'playing', on: true });
      dispatch({ type: 'select', index: null });
    }

    function stopPlayback() {
      transport.pause();
      transport.seek(0);
      dispatch({ type: 'playing', on: false });
      dispatch({ type: 'playhead', index: null });
    }

    /** Select a note: pause, move the playhead there, play just that note. */
    async function inspect(index: number | null, opts: { audition?: boolean } = {}) {
      intent('inspect', index);
      if (index === null) return dispatch({ type: 'select', index: null });
      if (transport.isPlaying()) {
        transport.pause();
        dispatch({ type: 'playing', on: false });
      }
      transport.seek(index);
      dispatch({ type: 'select', index });
      if (opts.audition !== false && activeRecord && (await ensureSound())) transport.audition(activeRecord.events[index]?.midiNote ?? null);
    }

    function go(scene: Scene, story?: StudioStory) {
      transport.pause();
      dispatch({ type: 'go', scene, story });
    }

    async function press() {
      const draft = activeRecord;
      if (!draft || state.scene !== 'studio') return;
      const valid = draft.events.filter((e) => e.midiNote !== null).length;
      if (valid === 0) return announce('This journey has no valid measurements yet, so there is nothing to press. Try another route or place.');
      intent('press');
      await ensureSound();
      const record = buildRecord({
        title: draft.title,
        story: draft.story,
        source: draft.source,
        visualContext: draft.visualContext,
        geometry: draft.geometry,
        timeWindow: draft.timeWindow,
        observations: draft.observations,
        rule: draft.musicalRule,
        instrument: draft.instrumentPaletteId,
        narrativeText: draft.narrativeText,
        credits: draft.credits,
      });
      dispatch({ type: 'shelf', records: [record, ...state.shelf.filter((r) => r.recordId !== record.recordId)].slice(0, SHELF_LIMIT) });
      dispatch({ type: 'openRecord', record, source: 'press' });
    }

    function openShelf(record: EarthRecord) {
      transport.pause();
      dispatch({ type: 'openRecord', record, source: 'shelf' });
    }

    function importRecord(record: EarthRecord) {
      dispatch({ type: 'shelf', records: [record, ...state.shelf.filter((r) => r.recordId !== record.recordId)].slice(0, SHELF_LIMIT) });
      openShelf(record);
    }

    function removeFromShelf(id: string) {
      dispatch({ type: 'shelf', records: state.shelf.filter((r) => r.recordId !== id) });
    }

    return { ensureSound, setSound, togglePlay, stopPlayback, inspect, go, press, openShelf, importRecord, removeFromShelf };
  }, [state, dispatch, activeRecord]);
}
