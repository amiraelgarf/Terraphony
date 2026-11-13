/**
 * The only place the guided journey touches React: it lends the director a
 * TourHost made of the app's own actions, reports every state change back to
 * it. (Music is not ducked: the host speaks between musical phrases.)
 */
import { useEffect, useRef } from 'react';
import { useRecord } from '../app/RecordContext';
import { useActions } from '../app/useActions';
import { transport } from '../audio/transport';
import { announce } from '../accessibility/announcements';
import { drive, sceneHooks, tourDirector } from './index';
import type { TourHost } from './tourDirector';

export function TourBridge() {
  const { state, dispatch, studio } = useRecord();
  const a = useActions();
  const live = useRef({ a, dispatch });
  live.current = { a, dispatch };

  useEffect(() => {
    const host: TourHost = {
      ensureSound: () => drive(() => live.current.a.ensureSound()),
      leaveArrival: () => (sceneHooks.leaveArrival ? drive(() => sceneHooks.leaveArrival!()) : (drive(() => live.current.a.go('library')), Promise.resolve())),
      openStory: (story) => (sceneHooks.openStory ? drive(() => sceneHooks.openStory!(story)) : (drive(() => live.current.a.go('studio', story)), Promise.resolve())),
      go: (scene, story) => drive(() => live.current.a.go(scene, story)),
      featured: (story) =>
        story === 'ocean'
          ? live.current.dispatch({ type: 'ocean', patch: { presetId: 'gulf-stream', tool: 'preset', dateKey: 'A', layer: 'picture' } })
          : live.current.dispatch({ type: 'land', patch: { placeId: 'nile-delta' } }),
      play: (from) =>
        drive(() => {
          if (from !== undefined) transport.seek(from);
          transport.play();
          live.current.dispatch({ type: 'select', index: null });
          live.current.dispatch({ type: 'playing', on: transport.isPlaying() });
        }),
      pause: () =>
        drive(() => {
          transport.pause();
          live.current.dispatch({ type: 'playing', on: false });
        }),
      inspect: (i) => drive(() => void live.current.a.inspect(i, { audition: false })),
      chime: () => transport.chime(),
      announce,
    };
    tourDirector.setHost(host);
    return () => tourDirector.setHost(null);
  }, []);

  const record = state.scene === 'studio' ? studio.record : null;
  const featuredLoaded =
    state.story === 'ocean'
      ? state.ocean.presetId === 'gulf-stream' && state.ocean.dateKey === 'A' && record?.geometry.label === studio.presets.find((p) => p.id === 'gulf-stream')?.name
      : state.land.placeId === 'nile-delta' && record?.geometry.areaId === 'nile-delta';

  useEffect(() => {
    tourDirector.observe({
      scene: state.scene,
      story: state.story,
      playing: state.playing,
      playhead: state.playhead,
      selected: state.selected,
      record,
      studioReady: studio.status === 'ready',
      featuredLoaded: !!featuredLoaded,
      revealSource: state.revealSource,
    });
  });

  return null;
}
