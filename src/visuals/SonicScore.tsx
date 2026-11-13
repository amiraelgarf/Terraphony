/**
 * The living score, drawn as a real staff: one note per observation, in listening
 * order. The 11 pitches of the collection sit on the 5 lines and 4 spaces (plus
 * one space above and below), so a higher value is a higher note head. Every 4
 * notes is one bar (the bass block). Hollow ring on the middle line = rest (no
 * valid measurement); a small accent mark above = a declared change. Marks are buttons (roving tabindex, arrow keys),
 * so the score is also the accessible note list. A caption line below always
 * states what is playing or selected — sound is never required.
 */
import { useEffect, useRef, type KeyboardEvent } from 'react';
import { midiToName } from '../audio/normalize';
import { sectionBounds } from '../audio/musicMapper';
import type { EarthRecord } from '../data/types';
import { sampleCaption } from './sampleText';
import { useSmoothPlayhead } from '../accessibility/usePlayhead';

type Props = {
  record: EarthRecord;
  playhead: number | null;
  playing: boolean;
  selected: number | null;
  onSelect: (i: number) => void;
  tone?: 'paper' | 'dark';
};

export function SonicScore({ record, playhead, playing, selected, onSelect, tone = 'paper' }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const n = record.events.length;
  const pitches = record.musicalRule.noteCollectionMidi;
  const focusIndex = selected ?? playhead ?? 0;
  const b = sectionBounds(n);
  const active = playhead ?? selected;

  // on narrow screens the staff scrolls sideways: keep the sounding / selected note in view
  useEffect(() => {
    const box = scroller.current;
    if (!box || active === null || box.scrollWidth <= box.clientWidth + 1) return;
    const col = box.scrollWidth / n;
    const x = (active + 0.5) * col;
    if (x < box.scrollLeft + col * 1.5 || x > box.scrollLeft + box.clientWidth - col * 1.5) box.scrollTo({ left: Math.max(0, x - box.clientWidth / 2), behavior: 'smooth' });
  }, [active, n]);

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    const map: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    let next: number | null = null;
    if (e.key in map) next = Math.max(0, Math.min(n - 1, focusIndex + map[e.key]));
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = n - 1;
    if (next === null) return;
    e.preventDefault();
    onSelect(next);
    ref.current?.querySelectorAll<HTMLButtonElement>('.score__mark')[next]?.focus();
  }

  const unit = record.story === 'ocean' ? 'Stop' : 'Window';
  const sections = [b.bassFrom, b.accentFrom, b.resolveFrom];
  return (
    <div className={`score score--${tone}`}>
      <div className="score__scroll" ref={scroller}>
      <div className="score__lane" ref={ref} role="toolbar" aria-label={`Score: ${n} notes. Use arrow keys to move between notes.`} onKeyDown={onKey} style={{ ['--n' as string]: n }}>
        <div className="score__staff" aria-hidden="true">
          {[1, 3, 5, 7, 9].map((l) => (
            <span key={l} className="score__line" style={{ ['--lvl' as string]: l }} />
          ))}
          {record.events.map((_, i) =>
            i > 0 && i % 4 === 0 ? <span key={i} className={`score__bar${sections.includes(i) ? ' is-section' : ''}`} style={{ left: `${(i / n) * 100}%` }} /> : null,
          )}
          {sections.map((x, i) => (
            <span key={`s${i}`} className="score__section" style={{ left: `${(x / n) * 100}%` }}>
              {['+ bass & strings', '+ bells', 'resolve'][i]}
            </span>
          ))}
        </div>
        {record.events.map((e, i) => {
          const idx = e.midiNote === null ? -1 : pitches.indexOf(e.midiNote);
          const lvl = idx < 0 ? 5 : idx;
          const cls = [
            'score__mark',
            e.midiNote === null ? 'is-rest' : '',
            i === active ? 'is-active' : '',
            i === selected ? 'is-selected' : '',
            e.changeMarked ? 'has-change' : '',
            playhead !== null && i < playhead ? 'is-played' : '',
            lvl > 5 ? 'stem-down' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={i}
              className={cls}
              style={{ ['--lvl' as string]: lvl, animationDelay: `${i * 18}ms` }}
              tabIndex={i === focusIndex ? 0 : -1}
              aria-label={`${unit} ${i + 1} of ${n}: ${sampleCaption(record, i)}`}
              aria-pressed={i === selected}
              onClick={() => onSelect(i)}
            >
              {e.changeMarked && <span className="score__accent" aria-hidden="true" />}
              <span className="score__head" aria-hidden="true">
                {e.midiNote !== null && <span className="score__stem" />}
              </span>
              <span className="score__name" aria-hidden="true">{e.midiNote !== null ? midiToName(e.midiNote) : 'rest'}</span>
            </button>
          );
        })}
        <ScoreCursor n={n} playing={playing} playhead={playhead} />
      </div>
      </div>
      <p className="score__caption" aria-live={playhead !== null ? 'off' : 'polite'}>
        {active !== null ? (
          <>
            <strong>{unit} {active + 1}/{n}</strong> {sampleCaption(record, active)}
          </>
        ) : (
          <>Select any note to see where it came from. Rings are rests: no valid measurement there.</>
        )}
      </p>
    </div>
  );
}

/** The cursor glides from note centre to note centre on the transport clock (only this redraws per frame). */
function ScoreCursor({ n, playing, playhead }: { n: number; playing: boolean; playhead: number | null }) {
  const smooth = useSmoothPlayhead(playing, playhead);
  if (smooth === null) return null;
  const c = Math.min(n - 0.5, Math.max(0, smooth) + 0.5);
  return <span className="score__cursor" style={{ left: `${(c / n) * 100}%` }} aria-hidden="true" />;
}
