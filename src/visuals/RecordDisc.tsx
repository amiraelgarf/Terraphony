/**
 * The pressed disc: a multi-turn spiral groove whose spacing is pushed by the
 * record's own values (one equal arc per note, outside -> in), plus the label.
 * `progress` (0..1) highlights the groove up to the playing note.
 */
import { useMemo } from 'react';
import type { EarthRecord } from '../data/types';
import { eventLevels, pathD, PER_EVENT, spiralShape } from './geometry';

export function RecordDisc({ record, progress = null, spinning = false }: { record: EarthRecord; progress?: number | null; spinning?: boolean }) {
  const levels = useMemo(() => eventLevels(record), [record]);
  const spiral = useMemo(() => spiralShape(levels, { x: 250, y: 250 }, 232, 92, 7, 26), [levels]);
  const played = progress === null ? null : spiral.slice(0, Math.max(2, Math.round(progress * levels.length * PER_EVENT)));
  return (
    <div className={`disc${spinning ? ' is-spinning' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 500 500">
        <defs>
          <radialGradient id="disc-g" cx="44%" cy="38%" r="72%">
            <stop offset="0" stopColor="#2a3f40" />
            <stop offset="0.7" stopColor="#0c1a1c" />
            <stop offset="1" stopColor="#050d0f" />
          </radialGradient>
        </defs>
        <circle cx="250" cy="250" r="248" fill="url(#disc-g)" />
        <path d={pathD(spiral)} fill="none" stroke="#d9bb88" strokeOpacity={0.55} strokeWidth={1.1} />
        {played && <path d={pathD(played)} fill="none" stroke="#f3d49c" strokeWidth={2} />}
        <circle cx="250" cy="250" r="78" fill="#efe6d4" stroke="#b55d47" strokeWidth={6} />
        <text x="250" y="244" textAnchor="middle" className="disc__label-title">Earth Records</text>
        <text x="250" y="266" textAnchor="middle" className="disc__label-side">Side {record.story === 'ocean' ? 'A' : 'B'} · 1 of 1</text>
        <circle cx="250" cy="250" r="4" fill="#10292a" />
      </svg>
    </div>
  );
}
