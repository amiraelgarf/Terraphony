/**
 * The sleeve, drawn from the record recipe (same geometry as the PNG export).
 * `size` only changes typography scale; the art is resolution independent.
 */
import { useMemo } from 'react';
import type { EarthRecord } from '../data/types';
import { catalogueNumber } from '../export/recordRecipe';
import { sleeveArt } from './geometry';
import { sleeveLines } from './sleeveText';

export function RecordSleeve({ record, size = 'large', highlight }: { record: EarthRecord; size?: 'large' | 'small'; highlight?: number | null }) {
  const art = useMemo(() => sleeveArt(record, 1000), [record]);
  const L = sleeveLines(record);
  const id = `sl-${record.recordId.slice(-10)}-${size}`;
  return (
    <div className={`sleeve sleeve--${size} sleeve--${record.story}`} role="img" aria-label={`Sleeve for “${record.title}”: ${L.sideLine}, ${L.detailLine}. Artwork drawn from the record's own ${record.story === 'ocean' ? 'route and temperatures' : 'year of greenness values'}.`}>
      <svg viewBox="0 0 1000 1000" className="sleeve__art" aria-hidden="true">
        <defs>
          <radialGradient id={id} cx="38%" cy="30%" r="80%">
            <stop offset="0" stopColor={art.background[0]} />
            <stop offset="1" stopColor={art.background[1]} />
          </radialGradient>
        </defs>
        <rect width="1000" height="1000" fill={`url(#${id})`} />
        <g strokeLinecap="round" strokeLinejoin="round" fill="none">
          {art.strokes.map((s, i) => (
            <path key={i} d={s.d} stroke={s.stroke} strokeWidth={s.width} strokeOpacity={s.opacity} strokeDasharray={s.dash} />
          ))}
        </g>
        {art.marks.map((m, i) =>
          m.rest ? (
            <circle key={i} cx={m.x} cy={m.y} r={m.r} fill="none" stroke={art.ink} strokeOpacity={0.7} strokeWidth={1.2} />
          ) : (
            <circle key={i} cx={m.x} cy={m.y} r={highlight === i ? m.r * 2.2 : m.r} fill={art.accent} />
          ),
        )}
      </svg>
      <div className="sleeve__foil" aria-hidden="true" />
      <div className="sleeve__top" aria-hidden="true">
        <span>Earth / Records</span>
        <span>{catalogueNumber(record)}</span>
      </div>
      <div className="sleeve__title" aria-hidden="true">{record.title}</div>
      <div className="sleeve__bottom" aria-hidden="true">
        <span>{L.sideLine}</span>
        <span>{L.detailLine}</span>
      </div>
    </div>
  );
}
