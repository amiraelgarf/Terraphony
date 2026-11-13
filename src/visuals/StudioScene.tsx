/**
 * Screen 02 — The Listening Atlas.
 * Dominant atlas left; a three-step panel right (① Listen · ② Make it yours · ③ Press);
 * the living score beneath. The same transport clock drives the map cursor / year-dial
 * hand, the score and the caption line. Only the atlas and the score subscribe to that
 * per-frame clock, so the panel does not re-render while a record plays.
 */
import { ArrowUpRight, Pause, Play } from 'lucide-react';
import { lazy, Suspense, useEffect, useState, type ComponentProps } from 'react';
import { useRecord } from '../app/RecordContext';
import { useActions } from '../app/useActions';
import { useSmoothPlayhead } from '../accessibility/usePlayhead';
import { announce } from '../accessibility/announcements';
import { transport } from '../audio/transport';
import { midiToName } from '../audio/normalize';
import { loadPlaceIndex, type PlaceIndexEntry } from '../data/adapters/modisNdviAdapter';
import { OCEAN_COPY, OCEAN_DATES } from '../stories/ocean.config';
import { LAND_COPY } from '../stories/vegetation.config';
import { Masthead } from './Masthead';
import { OceanAtlas } from './OceanAtlas';
import { ScientificInspector } from './ScientificInspector';
import { SonicScore } from './SonicScore';
import { DateControl, InstrumentControl, LayerMixer, MapLayerControl, PlaceControl, RouteControls } from './StudioControls';
import { TourCoach } from './TourCoach';
import { formatValue, interpretation } from './sampleText';
import { ScienceDialog } from './ScienceDialog';

const LandAtlas = lazy(() => import('./LandAtlas').then((m) => ({ default: m.LandAtlas })));

/* Clock-driven pieces: each reads the transport every frame on its own. */
type WithClock<P> = Omit<P, 'smooth'> & { playing: boolean };
function ClockedOcean({ playing, ...p }: WithClock<ComponentProps<typeof OceanAtlas>>) {
  return <OceanAtlas {...p} smooth={useSmoothPlayhead(playing, p.playhead)} />;
}
function ClockedLand({ playing, ...p }: WithClock<ComponentProps<typeof import('./LandAtlas').LandAtlas>>) {
  return <LandAtlas {...p} smooth={useSmoothPlayhead(playing, p.playhead)} />;
}
function ClockedScore({ playing, ...p }: WithClock<ComponentProps<typeof SonicScore>>) {
  return <SonicScore {...p} smooth={useSmoothPlayhead(playing, p.playhead)} />;
}

export function StudioScene() {
  const { state, dispatch, studio } = useRecord();
  const a = useActions();
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const [places, setPlaces] = useState<PlaceIndexEntry[]>([]);
  const [science, setScience] = useState(false);
  const ocean = state.story === 'ocean';
  const copy = ocean ? OCEAN_COPY : LAND_COPY;
  const record = studio.record;
  const draft = ocean ? state.ocean : state.land;

  useEffect(() => {
    loadPlaceIndex().then((x) => setPlaces(x.places)).catch(() => setPlaces([]));
  }, []);

  // Inspector: say what was selected; Esc closes it and returns focus to the note in the score.
  useEffect(() => {
    if (state.selected === null || !record) return;
    const index = state.selected;
    if (!state.playing) announce(interpretation(record, index));
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.querySelector('.dialog')) return;
      e.preventDefault();
      a.inspect(null);
      document.querySelectorAll<HTMLButtonElement>('.score__mark')[index]?.focus();
    };
    document.addEventListener('keydown', onKey);
    // on narrow screens the inspector sits over the map: bring it into view
    if (window.matchMedia('(max-width: 980px)').matches) {
      document.querySelector('.inspector')?.scrollIntoView({ block: 'nearest', behavior: state.reducedMotion ? 'auto' : 'smooth' });
    }
    return () => document.removeEventListener('keydown', onKey);
  }, [state.selected, record]); // eslint-disable-line react-hooks/exhaustive-deps

  const current = state.selected ?? state.playhead;
  const ev = current !== null && record ? record.events[current] : null;
  const ob = current !== null && record ? record.observations[current] : null;
  const valid = record ? record.events.filter((e) => e.midiNote !== null).length : 0;
  const unit = ocean ? 'Stop' : 'Window';
  const dateLabel = OCEAN_DATES.find((d) => d.key === state.ocean.dateKey)?.label ?? '';
  const routeName = state.ocean.presetId ? studio.presets.find((p) => p.id === state.ocean.presetId)?.name ?? 'Suggested route' : 'Your own line';
  const summary = ocean ? `${routeName} · ${dateLabel}` : studio.place ? `${studio.place.name} · ${studio.place.year}` : '';
  const playLabel = state.playing ? 'Pause' : state.playhead !== null ? 'Resume' : 'Hear this journey';

  const inspector = record && state.selected !== null && (
    <ScientificInspector
      record={record}
      index={state.selected}
      place={studio.place}
      onClose={() => {
        const i = state.selected;
        a.inspect(null);
        if (i !== null) document.querySelectorAll<HTMLButtonElement>('.score__mark')[i]?.focus();
      }}
      onHear={() => transport.audition(record.events[state.selected!].midiNote)}
      onPlayFrom={() => {
        transport.seek(state.selected!);
        a.togglePlay();
      }}
      className="inspector--anchored"
      style={anchor ? ({ ['--ax' as string]: `${anchor.x}px`, ['--ay' as string]: `${anchor.y}px` } as React.CSSProperties) : undefined}
    />
  );

  const credit = ocean
    ? state.ocean.layer === 'picture'
      ? `Picture: NASA ocean model for ${dateLabel} · Notes: NASA satellite measurements of water temperature, same day.`
      : `Map and notes: NASA satellite measurements of water temperature, ${dateLabel}.`
    : `Notes: NASA satellite measurements of plant greenness, ${studio.place?.year ?? 2023} · Coastlines: Natural Earth.`;

  return (
    <section className={`scene scene--studio studio--${state.story}`} aria-labelledby="studio-title">
      <Masthead />
      <div className="studio">
        <div className="studio__stage">
          <div className="studio__title">
            <h1 id="studio-title" className="display" tabIndex={-1} data-scene-heading>{copy.heading[0]}<br />{copy.heading[1]}</h1>
            <p className="studio__side">{ocean ? 'Side A · a path through space' : 'Side B · a journey through time'}</p>
          </div>
          {ocean ? (
            <ClockedOcean
              playing={state.playing}
              draft={state.ocean}
              record={record}
              waypoints={studio.routeWaypoints}
              playhead={state.playhead}
              selected={state.selected}
              reducedMotion={state.reducedMotion}
              busy={studio.status === 'loading'}
              onSelect={(i) => a.inspect(i)}
              onRoute={(w) => dispatch({ type: 'ocean', patch: { waypoints: w, presetId: null } })}
              onAnchor={setAnchor}
            />
          ) : (
            <Suspense fallback={<div className="atlas atlas--land"><div className="atlas__loading">Loading the map…</div></div>}>
              <ClockedLand
                playing={state.playing}
                places={places}
                place={studio.place}
                record={record}
                playhead={state.playhead}
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
            {credit} <button className="inline-btn" onClick={() => setScience(true)}>Full credits</button>
          </p>
          {state.tour !== null && <TourCoach record={record} />}
        </div>

        <aside className="studio__panel" aria-label="Your record">
          <p className="studio__invite">{copy.invitation}</p>

          <section className="panel-step panel-step--listen" aria-labelledby="step-listen">
            <h2 id="step-listen" className="panel-step__title"><span className="panel-step__num" aria-hidden="true">1</span>Listen</h2>
            {summary && <p className="panel-step__summary">{summary}</p>}
            <div className="readout" aria-live="off">
              <div>
                <span className="readout__label">{current !== null ? `${unit} ${current + 1} · note` : 'Notes with data'}</span>
                <strong>{ev ? (ev.midiNote !== null ? midiToName(ev.midiNote) : 'Rest') : record ? `${valid} of ${record.events.length}` : '—'}</strong>
              </div>
              <div>
                <span className="readout__label">{current !== null ? (ocean ? 'Water temperature' : 'Plant greenness') : ocean ? 'Day' : 'Year'}</span>
                <strong>{ob && record ? (ob.numericValue !== null ? formatValue(record, ob.numericValue) : 'No measurement') : ocean ? dateLabel : studio.place ? String(studio.place.year) : ''}</strong>
              </div>
            </div>
            {studio.status === 'error' && (
              <div className="error-note" role="alert">
                <p>The measurements couldn&apos;t be loaded. Check your connection and try again; nothing you chose has been lost.</p>
                <button className="mini-btn" onClick={() => window.location.reload()}>Try again</button>
                {studio.error && <details><summary>Technical details</summary><p>{studio.error}</p></details>}
              </div>
            )}
            {studio.status === 'empty' && ocean && <p className="field__note">Draw a line across the sea, or pick a suggested route below.</p>}
            {record && valid === 0 && <p className="error-note">Every stop on this line is on land or ice, so there is nothing to play yet. Try a line through open water.</p>}
            <button className="cta cta--paper" onClick={() => a.togglePlay()} disabled={!record || valid === 0}>
              {playLabel}
              {state.playing ? <Pause className="cta__arrow" aria-hidden="true" /> : <Play className="cta__arrow" aria-hidden="true" />}
            </button>
            {state.playhead !== null && !state.playing && <button className="link-btn" onClick={() => a.stopPlayback()}>Start again from the beginning</button>}
          </section>

          <section className="panel-step" aria-labelledby="step-shape">
            <h2 id="step-shape" className="panel-step__title"><span className="panel-step__num" aria-hidden="true">2</span>Make it yours</h2>
            {ocean ? (
              <>
                <RouteControls draft={state.ocean} presets={studio.presets} waypoints={studio.routeWaypoints} onPatch={(p) => dispatch({ type: 'ocean', patch: p })} />
                <DateControl value={state.ocean.dateKey} onChange={(k) => dispatch({ type: 'ocean', patch: { dateKey: k } })} />
              </>
            ) : (
              <PlaceControl places={places} value={state.land.placeId} onChange={(id) => dispatch({ type: 'land', patch: { placeId: id } })} />
            )}
            <div className="field">
              <label htmlFor="record-name">Name your record</label>
              <input id="record-name" maxLength={46} autoComplete="off" value={draft.title} onChange={(e) => dispatch({ type: ocean ? 'ocean' : 'land', patch: { title: e.target.value } } as never)} />
            </div>
            <InstrumentControl value={draft.instrument} onChange={(v) => dispatch({ type: ocean ? 'ocean' : 'land', patch: { instrument: v } } as never)} />
          </section>

          <section className="panel-step" aria-labelledby="step-press">
            <h2 id="step-press" className="panel-step__title"><span className="panel-step__num" aria-hidden="true">3</span>Press your record</h2>
            <p className="field__note">Turns this journey into a record you can keep, play again and share.</p>
            <button className="cta cta--gold" onClick={() => a.press()} disabled={!record || valid === 0 || studio.status !== 'ready'}>
              Press my Earth Record <ArrowUpRight className="cta__arrow" aria-hidden="true" />
            </button>
            <button className="link-btn" onClick={() => setScience(true)}>What&apos;s behind these notes?</button>
          </section>

          <details className="more-options">
            <summary>More options</summary>
            <div className="more-options__body">
              {ocean && <MapLayerControl layer={state.ocean.layer} onLayer={(l) => dispatch({ type: 'ocean', patch: { layer: l } })} />}
              <LayerMixer layers={state.layers} volume={state.volume} onLayer={(l, on) => dispatch({ type: 'layer', layer: l, on })} onSolo={(l) => dispatch({ type: 'solo', layer: l })} onVolume={(v) => dispatch({ type: 'volume', value: v })} />
            </div>
          </details>
        </aside>
      </div>

      <footer className="studio__score">
        <div className="studio__score-head">
          <h2 className="studio__score-title">The living score</h2>
          <button className="score-play" onClick={() => a.togglePlay()} disabled={!record || valid === 0} aria-label={state.playing ? 'Score playback: pause' : 'Score playback: play'}>
            {state.playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
            <span aria-hidden="true">{state.playing ? 'Pause' : state.playhead !== null ? 'Resume' : 'Hear it'}</span>
          </button>
          <p className="studio__score-meta">
            {ocean ? 'Each mark is one stop on your line. A higher mark means warmer water.' : 'Each mark is 16 days in this place. A higher mark means greener plants.'}
          </p>
          <ul className="score-legend" aria-label="How to read the score">
            <li><i className="score-legend__note" aria-hidden="true" />Note</li>
            <li><i className="score-legend__change" aria-hidden="true" />Big change from the one before</li>
            <li><i className="score-legend__rest" aria-hidden="true" />{ocean ? 'Rest: no measurement here (land or ice)' : 'Rest: clouds or snow hid the ground'}</li>
          </ul>
        </div>
        {record ? (
          <ClockedScore playing={state.playing} record={record} playhead={state.playhead} selected={state.selected} onSelect={(i) => a.inspect(i)} />
        ) : (
          <div className="score score--paper score--empty">{studio.status === 'error' ? 'No score: the measurements could not be loaded.' : 'Preparing the score…'}</div>
        )}
      </footer>
      <ScienceDialog open={science} onClose={() => setScience(false)} story={state.story} record={record} />
    </section>
  );
}
