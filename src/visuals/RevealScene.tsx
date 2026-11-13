/** Screen 04 — The Reveal. "It's yours." */
import { ArrowLeft, ChevronDown, ChevronUp, Download, Pause, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useRecord } from '../app/RecordContext';
import { useActions } from '../app/useActions';
import { useSmoothPlayhead } from '../accessibility/usePlayhead';
import { announce } from '../accessibility/announcements';
import { paletteName } from '../audio/instruments';
import { transport } from '../audio/transport';
import { formatGeo } from '../data/projections';
import { renderSleevePng } from '../export/coverRenderer';
import { catalogueNumber, recipeFileName, toRecipeJson } from '../export/recordRecipe';
import { renderRecordWav } from '../export/wavRenderer';
import { RecordDisc } from './RecordDisc';
import { RecordSleeve } from './RecordSleeve';
import { Masthead } from './Masthead';
import { ScientificInspector } from './ScientificInspector';
import { SonicScore } from './SonicScore';

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function RevealScene() {
  const { state } = useRecord();
  const a = useActions();
  const r = state.current!;
  const smooth = useSmoothPlayhead(state.playing, state.playhead);
  const [explore, setExplore] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const n = r.events.length;
  const rests = r.events.filter((e) => e.midiNote === null).length;
  const ocean = r.story === 'ocean';

  useEffect(() => {
    heading.current?.focus();
  }, [r.recordId]);

  // Opening the notes brings them into view and moves focus to their heading.
  const notesHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!explore) return;
    notesHeading.current?.scrollIntoView({ block: 'start', behavior: state.reducedMotion ? 'auto' : 'smooth' });
    notesHeading.current?.focus({ preventScroll: true });
  }, [explore]); // eslint-disable-line react-hooks/exhaustive-deps

  async function run(kind: 'png' | 'json' | 'wav') {
    setBusy(kind);
    setMsg(null);
    try {
      if (kind === 'json') download(new Blob([toRecipeJson(r)], { type: 'application/json' }), recipeFileName(r, 'json'));
      if (kind === 'png') download(await renderSleevePng(r), recipeFileName(r, 'png'));
      if (kind === 'wav') download(await renderRecordWav(r), recipeFileName(r, 'wav'));
      const m = kind === 'png'
        ? 'Sleeve image saved (2400 × 2400 PNG).'
        : kind === 'json'
          ? 'Record file saved. Open it from “Your records” on any computer to bring this record back.'
          : 'Audio saved (WAV).';
      setMsg(m);
      announce(m);
    } catch (e) {
      console.error(e);
      const m = 'We couldn’t make that file in this browser. Try again, or use a recent Chrome, Edge or Firefox.';
      setMsg(m);
      announce(m);
    } finally {
      setBusy(null);
    }
  }

  const progress = smooth !== null ? Math.min(1, smooth / n) : null;
  const pts = r.geometry.points ?? [];

  return (
    <section className="scene scene--reveal" aria-labelledby="reveal-title">
      <Masthead tone="paper" />
      <div className="reveal__head">
        <div>
          <h1 id="reveal-title" className="display" tabIndex={-1} ref={heading}>It&apos;s <em>yours.</em></h1>
        </div>
        <p>A piece of Earth, shaped by your choices. No other record has this {ocean ? 'path, this day' : 'place, this year'} and this sound.</p>
      </div>

      <div className="reveal__layout">
        <div className={`reveal__object${state.playing ? ' is-playing' : ''}`}>
          <div className="reveal__disc"><RecordDisc record={r} progress={progress} spinning={state.playing && !state.reducedMotion} /></div>
          <div className="reveal__sleeve"><RecordSleeve record={r} highlight={state.playhead} /></div>
        </div>

        <div className="liner">
          <h2 className="liner__title">{r.title}</h2>
          <p className="liner__meta">{ocean ? 'Side A · Ocean in Motion' : 'Side B · A Year in One Place'} · {r.timeWindow.label} · no. {catalogueNumber(r)}</p>
          <p className="liner__story">{r.narrativeText[1]}</p>
          <p className="liner__kept">Kept on your shelf in this browser. Save a copy below to keep it anywhere else.</p>
          <div className="liner__actions">
            <button className="cta cta--ink-solid" onClick={() => a.togglePlay()}>
              {state.playing ? 'Pause' : 'Play my record'}
              {state.playing ? <Pause className="cta__arrow" aria-hidden="true" /> : <Play className="cta__arrow" aria-hidden="true" />}
            </button>
            <button className="link-btn link-btn--ink" aria-expanded={explore} aria-controls="reveal-notes" onClick={() => setExplore((v) => !v)}>
              {explore ? 'Hide what each note means' : 'See what each note means'}
              {explore ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
            </button>
          </div>
          <div className="liner__keep" role="group" aria-labelledby="keep-title">
            <h3 id="keep-title" className="liner__keep-title">Keep a copy</h3>
            <div className="liner__keep-row">
              <button className="mini-btn mini-btn--ink" disabled={busy !== null} onClick={() => run('png')}><Download size={16} aria-hidden="true" />{busy === 'png' ? 'Making the image…' : 'Sleeve image'}</button>
              <button className="mini-btn mini-btn--ink" disabled={busy !== null} onClick={() => run('wav')}><Download size={16} aria-hidden="true" />{busy === 'wav' ? 'Making the audio…' : 'Audio'}</button>
              <button className="mini-btn mini-btn--ink" disabled={busy !== null} onClick={() => run('json')}><Download size={16} aria-hidden="true" />Save record file</button>
            </div>
            <p className="liner__keep-note">The record file lets you open this record again on another computer.</p>
          </div>
          {msg && <p className="liner__msg">{msg}</p>}
          <details className="liner__details">
            <summary>Record details</summary>
            <dl className="liner__facts">
              <div><dt>Measured</dt><dd>{ocean ? 'Sea surface temperature (°C)' : 'Plant greenness (NDVI, 0 to 1)'}</dd></div>
              <div><dt>{ocean ? 'Day' : 'Year'}</dt><dd>{r.timeWindow.label}</dd></div>
              <div><dt>{ocean ? 'Route' : 'Place'}</dt><dd>{ocean && pts.length ? `${formatGeo(pts[0], 0)} → ${formatGeo(pts[pts.length - 1], 0)} · ${r.geometry.lengthKm?.toLocaleString('en-GB')} km` : r.geometry.label}</dd></div>
              <div><dt>Notes</dt><dd>{n} notes{rests ? `, ${rests} silent (no data)` : ', no gaps'}</dd></div>
              <div><dt>Sound</dt><dd>{paletteName(r.instrumentPaletteId)}</dd></div>
              <div><dt>Source</dt><dd>{ocean ? 'NASA satellite sea temperature' : 'NASA satellite greenness'} ({r.source.datasetName.replace('GHRSST Level 4 ', '')} {r.source.productVersion})</dd></div>
            </dl>
          </details>
          <p className="liner__fact-vs-art">
            <strong>Fact:</strong> every note is a {ocean ? 'temperature at a real place' : 'greenness value for a real 16-day window'}, or a rest where none was valid.{' '}
            <strong>Interpretation:</strong> the scale, instruments, closing chord and sleeve are artistic choices.
          </p>
        </div>
      </div>

      <div className="reveal__next">
        <button className="link-btn link-btn--ink" onClick={() => a.go('library')}><ArrowLeft size={18} aria-hidden="true" />Make another record</button>
      </div>

      {explore && (
        <div className="reveal__notes" id="reveal-notes">
          <h2 className="reveal__notes-title" tabIndex={-1} ref={notesHeading}>What each note means</h2>
          <p className="reveal__notes-lead">{ocean ? 'Each mark is one stop on your line. A higher mark means warmer water.' : 'Each mark is 16 days in this place. A higher mark means greener plants.'} Select a mark to see the measurement behind it.</p>
          <SonicScore record={r} playhead={state.playhead} smooth={smooth} selected={state.selected} onSelect={(i) => a.inspect(i)} />
          {state.selected !== null && (
            <ScientificInspector
              record={r}
              index={state.selected}
              onClose={() => a.inspect(null)}
              onHear={() => transport.audition(r.events[state.selected!].midiNote)}
              onPlayFrom={() => { transport.seek(state.selected!); a.togglePlay(); }}
              className="inspector--inline"
            />
          )}
        </div>
      )}

      <footer className="reveal__credits">
        <span>Earth / Records · make what you discover</span>
        <span>{r.credits.join(' ')}</span>
      </footer>
    </section>
  );
}
