/**
 * Screen 02 — The Listening Atlas / "Give this place a voice."
 * Dominant atlas left, narrow personal controls right, living score beneath.
 * The same transport clock drives the map cursor / year-dial hand, the score
 * and the caption line.
 */
import { lazy, Suspense, useEffect, useState } from 'react';
import { useRecord } from '../app/RecordContext';
import { useActions } from '../app/useActions';
import { useSmoothPlayhead } from '../accessibility/usePlayhead';
import { transport } from '../audio/transport';
import { midiToName } from '../audio/normalize';
import { loadPlaceIndex, type PlaceIndexEntry } from '../data/adapters/modisNdviAdapter';
import { OCEAN_COPY, OCEAN_DATES } from '../stories/ocean.config';
import { LAND_COPY } from '../stories/vegetation.config';
import { Masthead } from './Masthead';
import { OceanAtlas } from './OceanAtlas';
import { ScientificInspector } from './ScientificInspector';
import { SonicScore } from './SonicScore';
import { DateControl, InstrumentControl, LayerMixer, PlaceControl, RouteControls } from './StudioControls';
import { TourCoach } from './TourCoach';
import { formatValue } from './sampleText';
import { ScienceDialog } from './ScienceDialog';

const LandAtlas = lazy(() => import('./LandAtlas').then((m) => ({ default: m.LandAtlas })));

export function StudioScene() {
  const { state, dispatch, studio } = useRecord();
  const a = useActions();
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const [places, setPlaces] = useState<PlaceIndexEntry[]>([]);
  const [science, setScience] = useState(false);
  const ocean = state.story === 'ocean';
  const copy = ocean ? OCEAN_COPY : LAND_COPY;
  const record = studio.record;
  const smooth = useSmoothPlayhead(state.playing, state.playhead);
  const draft = ocean ? state.ocean : state.land;

  useEffect(() => {
    loadPlaceIndex().then((x) => setPlaces(x.places)).catch(() => setPlaces([]));
  }, []);

  const current = state.selected ?? state.playhead;
  const ev = current !== null && record ? record.events[current] : null;
  const ob = current !== null && record ? record.observations[current] : null;
  const valid = record ? record.events.filter((e) => e.midiNote !== null).length : 0;

  const inspector = record && state.selected !== null && (
    <ScientificInspector
      record={record}
      index={state.selected}
      place={studio.place}
      onClose={() => a.inspect(null)}
      onHear={() => transport.audition(record.events[state.selected!].midiNote)}
      onPlayFrom={() => {
        transport.seek(state.selected!);
        a.togglePlay();
      }}
      className="inspector--anchored"
      style={anchor ? ({ ['--ax' as string]: `${anchor.x}px`, ['--ay' as string]: `${anchor.y}px` } as React.CSSProperties) : undefined}
    />
  );

  return (
    <section className={`scene scene--studio studio--${state.story}`} aria-labelledby="studio-title">
      <Masthead />
      <div className="studio">
        <div className="studio__stage">
          <div className="studio__title">
            <span className="eyebrow eyebrow--gold">{copy.eyebrow}</span>
            <h2 className="display">{copy.heading[0]}<br />{copy.heading[1]}</h2>
          </div>
          {ocean ? (
            <OceanAtlas
              draft={state.ocean}
              record={record}
              waypoints={studio.routeWaypoints}
              playhead={state.playhead}
              smooth={smooth}
              selected={state.selected}
              reducedMotion={state.reducedMotion}
              busy={studio.status === 'loading'}
              onSelect={(i) => a.inspect(i)}
              onRoute={(w) => dispatch({ type: 'ocean', patch: { waypoints: w, presetId: null } })}
              onAnchor={setAnchor}
            />
          ) : (
            <Suspense fallback={<div className="atlas atlas--land"><div className="atlas__loading">Loading map…</div></div>}>
              <LandAtlas
                places={places}
                place={studio.place}
                record={record}
                playhead={state.playhead}
                smooth={smooth}
                selected={state.selected}
                onSelect={(i) => a.inspect(i)}
                onPlace={(id) => dispatch({ type: 'land', patch: { placeId: id } })}
                onAnchor={setAnchor}
                reducedMotion={state.reducedMotion}
              />
            </Suspense>
          )}
          {inspector}
          <p className="studio__credit">
            {ocean
              ? state.ocean.layer === 'picture'
                ? 'Picture: NASA SVS 3912, ECCO2 model, same day · Notes: MUR SST v4.1 observation-based analysis, same day'
                : 'Measured field: MUR SST v4.1 (NASA JPL), drawn with the NASA SVS 3912 colour legend, 0–32 °C'
              : 'Coastlines: Natural Earth · Values: MODIS MOD13Q1 v061 NDVI, 9 × 9 pixels of 250 m around each place'}
          </p>
          {state.tour !== null && <TourCoach record={record} />}
        </div>

        <aside className="studio__panel" aria-label="Your record">
          <h1 id="studio-title" className="display studio__heading">Give this place<br />a voice.</h1>
          <p className="studio__invite">{copy.invitation}</p>

          {ocean ? (
            <>
              <RouteControls draft={state.ocean} presets={studio.presets} waypoints={studio.routeWaypoints} onPatch={(p) => dispatch({ type: 'ocean', patch: p })} />
              <DateControl value={state.ocean.dateKey} onChange={(k) => dispatch({ type: 'ocean', patch: { dateKey: k } })} layer={state.ocean.layer} onLayer={(l) => dispatch({ type: 'ocean', patch: { layer: l } })} />
            </>
          ) : (
            <PlaceControl places={places} value={state.land.placeId} onChange={(id) => dispatch({ type: 'land', patch: { placeId: id } })} />
          )}

          <div className="field">
            <label htmlFor="record-name">Name your record</label>
            <input id="record-name" maxLength={46} autoComplete="off" value={draft.title} onChange={(e) => dispatch({ type: ocean ? 'ocean' : 'land', patch: { title: e.target.value } } as never)} />
          </div>
          <InstrumentControl value={draft.instrument} onChange={(v) => dispatch({ type: ocean ? 'ocean' : 'land', patch: { instrument: v } } as never)} />

          <div className="readout" aria-live="off">
            <div>
              <span className="eyebrow">{current !== null ? `${ocean ? 'Stop' : 'Window'} ${current + 1}` : 'Notes'}</span>
              <strong>{ev ? (ev.midiNote !== null ? midiToName(ev.midiNote) : 'Rest') : record ? `${valid}/${record.events.length}` : '—'}</strong>
            </div>
            <div>
              <span className="eyebrow">{ocean ? 'Sea surface temperature' : 'Greenness (NDVI)'}</span>
              <strong>{ob && record ? formatValue(record, ob.numericValue) : ocean ? (OCEAN_DATES.find((d) => d.key === state.ocean.dateKey)?.label ?? '') : (studio.place ? String(studio.place.year) : '')}</strong>
            </div>
          </div>

          {studio.status === 'error' && <p className="error-note" role="alert">The measurements could not be loaded ({studio.error}). Check your connection and reload; nothing you chose has been lost.</p>}
          {studio.status === 'empty' && ocean && <p className="field__note">Draw a line across the sea, or pick a suggested route.</p>}
          {record && valid === 0 && <p className="error-note">Every stop on this line is masked (land or ice), so there is nothing to play yet. Try a line through open water.</p>}

          <div className="panel-actions">
            <button className="cta cta--paper" onClick={() => a.togglePlay()} disabled={!record || valid === 0}>
              {state.playing ? 'Pause' : state.playhead !== null ? 'Resume' : 'Hear this journey'}
              <span className="cta__arrow" aria-hidden="true">{state.playing ? '❚❚' : '▶'}</span>
            </button>
            <button className="cta cta--gold" onClick={() => a.press()} disabled={!record || valid === 0 || studio.status !== 'ready'}>
              Press my Earth Record <span className="cta__arrow" aria-hidden="true">↗</span>
            </button>
            <div className="panel-actions__row">
              <button className="link-btn" onClick={() => setScience(true)}>What&apos;s behind these notes?</button>
              {state.playhead !== null && !state.playing && <button className="link-btn" onClick={() => a.stopPlayback()}>Back to the start</button>}
            </div>
          </div>
          <LayerMixer layers={state.layers} volume={state.volume} onLayer={(l, on) => dispatch({ type: 'layer', layer: l, on })} onSolo={(l) => dispatch({ type: 'solo', layer: l })} onVolume={(v) => dispatch({ type: 'volume', value: v })} />
        </aside>
      </div>

      <footer className="studio__score">
        <div className="studio__score-head">
          <span className="eyebrow">The living score</span>
          <span className="studio__score-meta">{record ? `${record.events.length} ${ocean ? 'stops' : 'windows'} · ${record.musicalRule.domainMin}–${record.musicalRule.domainMax} ${record.musicalRule.units} → C3–C5 · ${record.musicalRule.tempoBpm} bpm` : 'Loading…'}</span>
        </div>
        {record ? (
          <SonicScore record={record} playhead={state.playhead} smooth={smooth} selected={state.selected} onSelect={(i) => a.inspect(i)} />
        ) : (
          <div className="score score--paper score--empty">{studio.status === 'error' ? 'No score: data unavailable.' : 'Preparing the score…'}</div>
        )}
      </footer>
      <ScienceDialog open={science} onClose={() => setScience(false)} story={state.story} record={record} />
    </section>
  );
}
