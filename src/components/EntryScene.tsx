/**
 * EntryScene — Scene 00, the threshold. The real NASA frame is already
 * underneath; this overlay only invites. Silence until an explicit choice.
 */
import { useJukebox } from '../app/JukeboxContext';
import { COPY } from '../content/microcopy.en';
import { STORY_SUBTITLE, STORY_TITLE } from '../content/story.en';

export function EntryScene() {
  const { actions, registry } = useJukebox();
  const [start, end] = registry.manifest.timeRangeDocumentedUTC.map((t) => t.slice(0, 4));
  return (
    <section className="entry" aria-labelledby="entry-title">
      <div className="entry-inner">
        <p className="eyebrow">{COPY.appName}</p>
        <h1 id="entry-title" className="entry-title">{COPY.entryHeadline}</h1>
        <p className="entry-sub">{COPY.entrySubline}</p>
        <p className="entry-story">
          <span className="serif">{STORY_TITLE}</span> — {STORY_SUBTITLE}
        </p>
        <div className="entry-actions">
          <button type="button" className="btn btn-primary btn-lg" onClick={() => void actions.begin(true)}>{COPY.primaryAction}</button>
          <button type="button" className="btn btn-quiet btn-lg" onClick={actions.exploreDirectly}>{COPY.secondaryAction}</button>
        </div>
        <div className="entry-meta">
          <button type="button" className="btn btn-text" onClick={() => void actions.begin(false)}>{COPY.soundOffAction}</button>
          <span aria-hidden="true">·</span>
          <button type="button" className="btn btn-text" onClick={() => actions.navigate('method')}>How it works</button>
        </div>
        <p className="entry-source small">
          {COPY.sourceLabel} · model period {start}–{end} · {COPY.audioUnlock}
        </p>
      </div>
    </section>
  );
}
