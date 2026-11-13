/**
 * The living score: one mark per observation, in listening order.
 * Height = note; hollow ring = rest (no valid measurement); small tick = a
 * declared change (accent). Marks are buttons (roving tabindex, arrow keys),
 * so the score is also the accessible note list. A caption line below always
 * states what is playing or selected — sound is never required.
 */
import { useRef, type KeyboardEvent } from 'react';
import { midiToName } from '../audio/normalize';
import { sectionBounds } from '../audio/musicMapper';
import type { EarthRecord } from '../data/types';
import { sampleCaption } from './sampleText';

type Props = {
  record: EarthRecord;
  playhead: number | null;
  smooth: number | null;
  selected: number | null;
  onSelect: (i: number) => void;
  tone?: 'paper' | 'dark';
};

export function SonicScore({ record, playhead, smooth, selected, onSelect, tone = 'paper' }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const n = record.events.length;
  const pitches = record.musicalRule.noteCollectionMidi;
  const focusIndex = selected ?? playhead ?? 0;
  const b = sectionBounds(n);
  const active = playhead ?? selected;

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
  return (
    <div className={`score score--${tone}`}>
      <div className="score__lane" ref={ref} role="toolbar" aria-label={`Score: ${n} notes. Use arrow keys to move between notes.`} onKeyDown={onKey} style={{ ['--n' as string]: n }}>
        {[b.bassFrom, b.accentFrom, b.resolveFrom].map((x, i) => (
          <span key={i} className="score__section" style={{ left: `${(x / n) * 100}%` }} aria-hidden="true">
            {['+ bass', '+ accents', 'resolve'][i]}
          </span>
        ))}
        {record.events.map((e, i) => {
          const idx = e.midiNote === null ? -1 : pitches.indexOf(e.midiNote);
          const h = idx < 0 ? 0 : (idx + 1) / pitches.length;
          const cls = ['score__mark', e.midiNote === null ? 'is-rest' : '', i === active ? 'is-active' : '', i === selected ? 'is-selected' : '', e.changeMarked ? 'has-change' : '', playhead !== null && i < playhead ? 'is-played' : '']
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={i}
              className={cls}
              style={{ ['--h' as string]: h, animationDelay: `${i * 22}ms` }}
              tabIndex={i === focusIndex ? 0 : -1}
              aria-label={`${unit} ${i + 1} of ${n}: ${sampleCaption(record, i)}`}
              aria-pressed={i === selected}
              onClick={() => onSelect(i)}
            >
              <span className="score__stem" />
              <span className="score__head">{e.midiNote !== null ? midiToName(e.midiNote) : ''}</span>
            </button>
          );
        })}
        {smooth !== null && <span className="score__cursor" style={{ left: `${(Math.min(smooth, n) / n) * 100}%` }} aria-hidden="true" />}
      </div>
      <p className="score__caption" aria-live={playhead !== null ? 'off' : 'polite'}>
        {active !== null ? (
          <>
            <strong>{unit} {active + 1}/{n}</strong> {sampleCaption(record, active)}
          </>
        ) : (
          <>Select any mark to see where its note came from. Rings are rests: no valid measurement there.</>
        )}
      </p>
    </div>
  );
}
