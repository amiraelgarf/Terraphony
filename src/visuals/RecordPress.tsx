/**
 * Screen 03 — The Record Press. "A place becomes a record."
 *
 * One line, four beats (2.7 s, skippable). The line has the same number of
 * points in the same order throughout, so what you watch IS your data:
 *
 *   I   Collect    0–550 ms     your route / year dial detaches; the world recedes
 *   II  Translate  550–1100 ms  it straightens into the score (notches = your notes)
 *   III Engrave    1100–1900 ms the score winds into a spiral groove whose spacing
 *                               follows your values; the needle touches the lead-in
 *   IV  Sleeve     1900–2700 ms the disc slides into your sleeve; the title resolves
 *
 * Sound (only if on): beat II plays your notes as a quick phrase, III a stylus
 * touch, IV a closing chord (artistic). Reduced motion: direct reveal.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRecord } from '../app/RecordContext';
import { transport } from '../audio/transport';
import { CADENCE_MIDI } from '../audio/musicMapper';
import { announce } from '../accessibility/announcements';
import { eventLevels, lerpPts, originShape, pathD, PER_EVENT, scoreShape, spiralShape, type Pt } from './geometry';
import { Masthead } from './Masthead';
import { RecordSleeve } from './RecordSleeve';
import { catalogueNumber } from '../export/recordRecipe';

const BEATS = [
  { at: 0, label: 'Following your chosen path' },
  { at: 550, label: 'Turning observations into notes' },
  { at: 1100, label: 'Cutting the groove' },
  { at: 1900, label: 'Finishing your sleeve' },
];
const TOTAL = 2700;
const HOLD = 500;

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const seg = (t: number, a: number, b: number) => Math.max(0, Math.min(1, (t - a) / (b - a)));

export function RecordPress() {
  const { state, dispatch } = useRecord();
  const record = state.current!;
  const [t, setT] = useState(state.reducedMotion ? TOTAL : 0);
  const raf = useRef(0);
  const fired = useRef<Set<string>>(new Set());

  const shapes = useMemo(() => {
    const levels = eventLevels(record);
    const origin = originShape(record, { x: 170, y: 150, w: 660, h: 430 });
    const score = scoreShape(record.events, levels, { x: 110, y: 290, w: 780, h: 200 }, record.musicalRule.noteCollectionMidi);
    const spiral = spiralShape(levels, { x: 500, y: 400 }, 300, 118, 6, 34);
    return { origin, score, spiral, levels };
  }, [record]);

  const finish = () => {
    cancelAnimationFrame(raf.current);
    dispatch({ type: 'go', scene: 'reveal' });
  };

  useEffect(() => {
    announce('Pressing your record.');
    if (state.reducedMotion) {
      const id = window.setTimeout(finish, 600);
      return () => window.clearTimeout(id);
    }
    const start = performance.now();
    const tick = (now: number) => {
      const el = now - start;
      setT(Math.min(el, TOTAL));
      const once = (k: string, f: () => void) => {
        if (!fired.current.has(k)) {
          fired.current.add(k);
          f();
        }
      };
      if (el >= 560) once('phrase', () => transport.phrase(record.events.map((e) => e.midiNote), 0.022));
      if (el >= 1700) once('stylus', () => transport.stylus());
      if (el >= 2300) once('chord', () => transport.chord(CADENCE_MIDI));
      if (el >= TOTAL + HOLD) return finish();
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // the morphing line
  const m1 = ease(seg(t, 550, 1100));
  const m2 = ease(seg(t, 1100, 1800));
  let line: Pt[] = shapes.origin;
  if (t >= 550) line = lerpPts(shapes.origin, shapes.score, m1);
  if (t >= 1100) line = lerpPts(shapes.score, shapes.spiral, m2);
  const draw = seg(t, 0, 520); // beat I: the line is drawn in
  const recede = 1 - seg(t, 0, 550);
  const notches = seg(t, 650, 1050);
  const disc = seg(t, 1150, 1700);
  const needle = seg(t, 1550, 1760);
  const slide = ease(seg(t, 1900, 2600));
  const title = seg(t, 2200, 2700);
  const beat = [...BEATS].reverse().find((b) => t >= b.at) ?? BEATS[0];
  const n = record.events.length;

  return (
    <section className="scene scene--press" aria-labelledby="press-title">
      <Masthead />
      <div className="press__grid" style={{ opacity: 0.35 * recede + 0.12 }} aria-hidden="true" />
      <div className="press__head">
        <span className="eyebrow eyebrow--gold">The Earth Record Press</span>
        <h1 id="press-title" className="display">A place becomes <i>a record.</i></h1>
        <p>This is your path, pressed into a record.</p>
      </div>
      <div className="press__stage" aria-hidden="true">
        <svg viewBox="0 0 1000 800" className="press__svg" style={{ transform: `translateX(${-16 * slide}%) scale(${1 - 0.18 * slide})` }}>
          <defs>
            <radialGradient id="press-disc" cx="45%" cy="40%" r="70%">
              <stop offset="0" stopColor="#2b4243" />
              <stop offset="0.7" stopColor="#0b1a1c" />
              <stop offset="1" stopColor="#050d0f" />
            </radialGradient>
          </defs>
          <g style={{ opacity: disc, transform: `scale(${0.86 + 0.14 * disc})`, transformOrigin: '500px 400px' }}>
            <circle cx="500" cy="400" r="345" fill="url(#press-disc)" />
            <circle cx="500" cy="400" r="345" fill="none" stroke="#a47a53" strokeOpacity="0.45" strokeWidth="3" />
            <circle cx="500" cy="400" r="92" fill="#efe6d4" stroke="#b55d47" strokeWidth="7" />
            <text x="500" y="396" textAnchor="middle" className="press__label">Earth Records</text>
            <text x="500" y="420" textAnchor="middle" className="press__label-small">{catalogueNumber(record)} · 1 of 1</text>
          </g>
          {/* the one line */}
          <path d={pathD(line)} pathLength={1} fill="none" stroke="#f0cf95" strokeWidth={t >= 1100 ? 1.6 + 0.8 * (1 - m2) : 2.6} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1" strokeDashoffset={1 - draw} />
          {/* notches: same count and order as your notes */}
          {t >= 550 && t < 1500 &&
            record.events.map((e, i) => {
              const p = line[Math.min(line.length - 1, i * PER_EVENT + Math.floor(PER_EVENT / 2))];
              const vis = seg(notches, i / n, i / n + 0.15) * (1 - seg(t, 1100, 1500));
              return e.midiNote === null ? (
                <circle key={i} cx={p.x} cy={p.y} r={6} fill="none" stroke="#efe6d4" strokeOpacity={0.7 * vis} />
              ) : (
                <line key={i} x1={p.x} x2={p.x} y1={p.y - 14} y2={p.y + 14} stroke="#b55d47" strokeWidth={3} strokeOpacity={vis} />
              );
            })}
          {/* tonearm */}
          <g style={{ transform: `rotate(${-28 + 18 * needle}deg)`, transformOrigin: '930px 70px', opacity: disc }}>
            <line x1="930" y1="70" x2="790" y2="135" stroke="#d8bf96" strokeWidth="7" strokeLinecap="round" />
            <circle cx="930" cy="70" r="18" fill="#19373a" stroke="#d9ba8e" strokeWidth="5" />
            <rect x="770" y="125" width="30" height="14" fill="#f0deb5" transform="rotate(-15 785 132)" />
          </g>
        </svg>
        <div className="press__sleeve" style={{ opacity: Math.min(1, slide * 2), transform: `translate(${(1 - slide) * 70}%, -50%) rotate(${(1 - slide) * 9 - 2}deg)` }}>
          <div style={{ ['--title-in' as string]: title }} className="press__sleeve-inner">
            <RecordSleeve record={record} />
          </div>
        </div>
      </div>
      <div className="press__status" role="status">
        <span>{beat.label}</span>
        <div className="press__bar"><div style={{ width: `${(t / TOTAL) * 100}%` }} /></div>
        <span className="press__count">{n} notes · {record.events.filter((e) => e.midiNote === null).length} rests · {record.geometry.label}</span>
      </div>
      <button className="link-btn press__skip" onClick={finish}>Reveal the record now</button>
    </section>
  );
}
