/** Screen 04 — The Reveal. "It's yours." */
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

  async function run(kind: 'png' | 'json' | 'wav') {
    setBusy(kind);
    setMsg(null);
    try {
      if (kind === 'json') download(new Blob([toRecipeJson(r)], { type: 'application/json' }), recipeFileName(r, 'json'));
      if (kind === 'png') download(await renderSleevePng(r), recipeFileName(r, 'png'));
      if (kind === 'wav') download(await renderRecordWav(r), recipeFileName(r, 'wav'));
      const m = kind === 'png' ? 'Sleeve saved as a 2400 × 2400 PNG.' : kind === 'json' ? 'Record recipe saved as JSON.' : 'Audio rendered and saved as WAV.';
      setMsg(m);
      announce(m);
    } catch (e) {
      setMsg(`That export did not work in this browser: ${(e as Error).message}`);
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
          <span className="eyebrow eyebrow--copper">{state.revealSource === 'press' ? 'Pressed from a place on Earth' : 'From your shelf'}</span>
          <h1 id="reveal-title" className="display" tabIndex={-1} ref={heading}>It&apos;s <em>yours.</em></h1>
        </div>
        <p>A piece of Earth, interpreted through your choices. There is only one record with this {ocean ? 'path, this day' : 'place, this year'} and this sound.</p>
      </div>

      <div className="reveal__layout">
        <div className={`reveal__object${state.playing ? ' is-playing' : ''}`}>
          <div className="reveal__disc"><RecordDisc record={r} progress={progress} spinning={state.playing && !state.reducedMotion} /></div>
          <div className="reveal__sleeve"><RecordSleeve record={r} highlight={state.playhead} /></div>
        </div>

        <div className="liner">
          <span className="eyebrow eyebrow--copper">Original pressing · 1 of 1 · {catalogueNumber(r)}</span>
          <h2 className="liner__title">{r.title}</h2>
          <p className="liner__story">{r.narrativeText[1]}</p>
          <div className="liner__actions">
            <button className="cta cta--ink" onClick={() => a.togglePlay()}>
              {state.playing ? 'Pause' : 'Play my record'} <span className="cta__arrow" aria-hidden="true">{state.playing ? '❚❚' : '▶'}</span>
            </button>
            <button className="cta cta--ink-outline" aria-expanded={explore} onClick={() => setExplore((v) => !v)}>
              {explore ? 'Hide its notes' : 'Explore its notes'} <span className="cta__arrow" aria-hidden="true">↓</span>
            </button>
          </div>
          <dl className="liner__facts">
            <div><dt>Measured</dt><dd>{r.musicalRule.variable} · {r.source.units}</dd></div>
            <div><dt>{ocean ? 'Day' : 'Year'}</dt><dd>{r.timeWindow.label}</dd></div>
            <div><dt>{ocean ? 'Route' : 'Place'}</dt><dd>{ocean && pts.length ? `${formatGeo(pts[0], 0)} → ${formatGeo(pts[pts.length - 1], 0)} · ${r.geometry.lengthKm?.toLocaleString('en-GB')} km` : r.geometry.label}</dd></div>
            <div><dt>Composition</dt><dd>{n} notes · {rests} rest{rests === 1 ? '' : 's'} · {r.musicalRule.tempoBpm} bpm</dd></div>
            <div><dt>Instrument</dt><dd>{paletteName(r.instrumentPaletteId)} <small>(timbre only)</small></dd></div>
            <div><dt>Source</dt><dd>{r.source.datasetName.replace('GHRSST Level 4 ', '')} {r.source.productVersion}</dd></div>
          </dl>
          <div className="liner__exports">
            <button className="link-btn link-btn--ink" disabled={busy !== null} onClick={() => run('png')}>{busy === 'png' ? 'Rendering sleeve…' : 'Save sleeve (PNG)'}</button>
            <button className="link-btn link-btn--ink" disabled={busy !== null} onClick={() => run('json')}>Export record recipe (JSON)</button>
            <button className="link-btn link-btn--ink" disabled={busy !== null} onClick={() => run('wav')}>{busy === 'wav' ? 'Rendering audio…' : 'Save audio (WAV)'}</button>
            <button className="link-btn link-btn--ink" onClick={() => a.go('library')}>Make another</button>
          </div>
          {msg && <p className="liner__msg" role="status">{msg}</p>}
          <p className="liner__fact-vs-art">
            <strong>Fact:</strong> every note is a {ocean ? 'temperature at a real place' : 'greenness value for a real 16-day window'}, or a rest where none was valid.{' '}
            <strong>Interpretation:</strong> the scale, instruments, closing chord and sleeve are artistic choices.
          </p>
        </div>
      </div>

      {explore && (
        <div className="reveal__notes">
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
