/**
 * StoryPanel — the editorial layer of the guided story: chapter progress,
 * caption, narration and each scene's actions. Copy comes from content/;
 * every number shown here is read from the computed events.
 */
import { ArrowLeft, ArrowRight, Hand, Map as MapIcon, MousePointer2, Pencil } from 'lucide-react';
import { fmtDelta, fmtPosition, fmtValue } from '../app/format';
import { useJukebox } from '../app/JukeboxContext';
import { COPY } from '../content/microcopy.en';
import { CHAPTERS, CLOSING_LINE, chapterById } from '../content/story.en';
import { formatUTC } from '../domain/sourceRegistry';

function ChapterProgress() {
  const { state, actions } = useJukebox();
  return (
    <nav className="chapters" aria-label="Story chapters">
      <ol>
        {CHAPTERS.filter((c) => c.id !== 'threshold').map((c) => (
          <li key={c.id}>
            <button type="button" className={c.id === state.chapter ? 'is-current' : ''} aria-current={c.id === state.chapter ? 'step' : undefined} onClick={() => actions.goChapter(c.id)} title={c.title}>
              <span className="num">{c.number}</span>
              <span className="chapter-name">{c.eyebrow}</span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function SceneActions() {
  const { state, derived, actions } = useJukebox();
  const n = derived.storyNotable;
  const samples = derived.scans.A.samples;

  switch (state.chapter) {
    case 'language':
      return (
        <div className="scene-actions">
          <button type="button" className="btn btn-quiet" onClick={() => void actions.hearRule()}>Hear the rule</button>
          <button type="button" className="btn btn-primary" onClick={actions.nextChapter}>Continue <ArrowRight size={15} strokeWidth={1.6} aria-hidden="true" /></button>
          <p className="muted small">“Hear the rule” plays three illustrative inputs — 0, 0.5 and 1 — in the same voice, so pitch is the only thing that changes.</p>
        </div>
      );
    case 'passage':
      return (
        <div className="scene-actions">
          {state.playback !== 'playing' && (
            <button type="button" className="btn btn-primary" onClick={() => void actions.play()}>{state.step ? 'Resume' : 'Play the passage'}</button>
          )}
          <button type="button" className="btn btn-quiet" onClick={actions.nextChapter}>Skip to the microscope</button>
          <p className="muted small num">
            {derived.scans.A.samples.length} points along {Math.round(derived.routeKm).toLocaleString('en')} km · one note per beat · {derived.scans.A.samples.filter((s) => !s.quantity).length} rests where the source has no readable colour
          </p>
        </div>
      );
    case 'microscope': {
      const a = samples[n - 1]?.quantity?.value;
      const b = samples[n]?.quantity?.value;
      return (
        <div className="scene-actions">
          {a !== undefined && b !== undefined && (
            <p className="finding num">
              The largest step on this route lies between points {n} and {n + 1}, near {fmtPosition(samples[n].position)}: the palette position moves from {fmtValue(a)} to {fmtValue(b)} ({fmtDelta(b - a)}).
              Found by a fixed rule — the biggest change between neighbouring points — not chosen by hand.
            </p>
          )}
          <button type="button" className="btn btn-primary" onClick={actions.nextChapter}>Continue the story <ArrowRight size={15} strokeWidth={1.6} aria-hidden="true" /></button>
        </div>
      );
    }
    case 'contrast':
      if (!derived.comparability.ok) {
        return (
          <div className="scene-actions">
            <p className="finding">{COPY.spatialFallback}</p>
            <button type="button" className="btn btn-primary" onClick={() => actions.navigate('compare')}>Compare two places</button>
          </div>
        );
      }
      return (
        <div className="scene-actions">
          <p className="finding num">
            <span className="key-a">A</span> {formatUTC(derived.frames.A.captureOrModelTimeUTC)} · <span className="key-b">B</span> {formatUTC(derived.frames.B.captureOrModelTimeUTC)}
          </p>
          <button type="button" className="btn btn-primary" onClick={() => void actions.playAB()}>Play A, then B</button>
          <button type="button" className="btn btn-quiet" onClick={() => actions.setFrame(state.frameKey === 'A' ? 'B' : 'A')}>Show frame {state.frameKey === 'A' ? 'B' : 'A'}</button>
          <button type="button" className="btn btn-quiet" onClick={() => actions.navigate('compare')}>Full routes A / B</button>
          <p className="muted small">{COPY.compareCaveat} {COPY.compareVisualCaveat}</p>
        </div>
      );
    case 'handover':
      return (
        <div className="scene-actions">
          <div className="tool-row" role="group" aria-label="Choose a tool">
            <button type="button" className="btn btn-quiet" onClick={() => actions.startExploring('probe')}><MousePointer2 size={15} strokeWidth={1.6} aria-hidden="true" /> Probe</button>
            <button type="button" className="btn btn-quiet" onClick={() => actions.startExploring('draw')}><Pencil size={15} strokeWidth={1.6} aria-hidden="true" /> Draw</button>
            <button type="button" className="btn btn-quiet" onClick={() => actions.startExploring('navigate')}><Hand size={15} strokeWidth={1.6} aria-hidden="true" /> Navigate</button>
          </div>
          <button type="button" className="btn btn-primary" onClick={actions.nextChapter}>Finish the story</button>
        </div>
      );
    case 'coda':
      return (
        <div className="scene-actions">
          <p className="closing">{CLOSING_LINE}</p>
          <button type="button" className="btn btn-primary" onClick={() => actions.startExploring('draw')}><MapIcon size={15} strokeWidth={1.6} aria-hidden="true" /> Explore another route</button>
          <button type="button" className="btn btn-quiet" onClick={() => actions.navigate('compare')}>Compare moments</button>
          <button type="button" className="btn btn-quiet" onClick={() => actions.navigate('method')}>How was this made?</button>
          <p className="muted small">Source: NASA SVS 3912, ECCO2 model visualization, {derived.frames.A.captureOrModelTimeUTC?.slice(0, 4)}–{derived.frames.B.captureOrModelTimeUTC?.slice(0, 4)}. {COPY.historicalNote}</p>
        </div>
      );
    default:
      return null;
  }
}

export function StoryPanel() {
  const { state, actions } = useJukebox();
  const c = chapterById(state.chapter);
  return (
    <section className="story-panel" aria-labelledby="chapter-title">
      <ChapterProgress />
      <div className="story-copy" key={c.id}>
        <p className="eyebrow">
          <span className="num">Scene {c.number}</span> · {c.eyebrow}
        </p>
        <h1 id="chapter-title" className="chapter-title">{c.title}</h1>
        <p className="caption">{c.caption}</p>
        {c.narration && (
          <p className="narration">
            <span className="sr-only">Narration: </span>“{c.narration.visual}”
          </p>
        )}
      </div>
      <div aria-live="polite" className="sr-only">{`Scene ${c.number}: ${c.title}`}</div>
      <SceneActions />
      <div className="chapter-nav">
        <button type="button" className="btn btn-text" onClick={actions.previousChapter}><ArrowLeft size={14} strokeWidth={1.6} aria-hidden="true" /> Back</button>
        {c.id !== 'coda' && (
          <button type="button" className="btn btn-text" onClick={actions.nextChapter}>Next scene <ArrowRight size={14} strokeWidth={1.6} aria-hidden="true" /></button>
        )}
      </div>
    </section>
  );
}
