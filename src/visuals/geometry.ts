/**
 * Record geometry — the ONE line that travels through the experience:
 *
 *   route on Earth / year dial  ->  score  ->  spiral groove  ->  sleeve art
 *
 * Every shape is built from the record's own ordered samples and has the same
 * number of points in the same order, so the press can interpolate between
 * them and the sleeve is reproducible from the recipe (pure functions only).
 */
import { normalize } from '../audio/normalize';
import { unwrapLongitudes } from '../data/geodesicPath';
import type { EarthRecord, GeoPosition, MusicEvent, ObservationSample } from '../data/types';

export type Pt = { x: number; y: number };
export type Box = { x: number; y: number; w: number; h: number };

/** Points per event in morphable shapes. */
export const PER_EVENT = 10;

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const lerpPts = (a: Pt[], b: Pt[], t: number): Pt[] => a.map((p, i) => ({ x: lerp(p.x, b[i].x, t), y: lerp(p.y, b[i].y, t) }));

export function pathD(pts: Pt[], close = false) {
  if (!pts.length) return '';
  return `M${pts.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('L')}${close ? 'Z' : ''}`;
}

/** Centripetal-ish Catmull–Rom through control points; `per` points per span. */
export function smooth(ctrl: Pt[], per: number, closed = false): Pt[] {
  const n = ctrl.length;
  if (n < 2) return ctrl.slice();
  const at = (i: number) => (closed ? ctrl[(i + n) % n] : ctrl[Math.max(0, Math.min(n - 1, i))]);
  const out: Pt[] = [];
  const spans = closed ? n : n - 1;
  for (let i = 0; i < spans; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    for (let s = 0; s < per; s++) {
      const t = s / per, t2 = t * t, t3 = t2 * t;
      out.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  if (!closed) out.push(ctrl[n - 1]);
  return out;
}

/** Resample a polyline to exactly m points by arc length. */
export function resampleTo(pts: Pt[], m: number): Pt[] {
  if (pts.length === 0) return [];
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  const total = cum[cum.length - 1] || 1;
  const out: Pt[] = [];
  let j = 1;
  for (let k = 0; k < m; k++) {
    const target = (total * k) / (m - 1);
    while (j < cum.length - 1 && cum[j] < target) j++;
    const seg = cum[j] - cum[j - 1] || 1;
    const t = Math.max(0, Math.min(1, (target - cum[j - 1]) / seg));
    out.push({ x: lerp(pts[j - 1].x, pts[j].x, t), y: lerp(pts[j - 1].y, pts[j].y, t) });
  }
  return out;
}

/** Fit route stops into a box, keeping shape (local equirectangular, cos(lat) corrected). */
export function routeShape(points: GeoPosition[], box: Box): Pt[] {
  const u = unwrapLongitudes(points.map((p) => [p.lat, p.lon]));
  const meanLat = u.reduce((a, p) => a + p[0], 0) / Math.max(1, u.length);
  const k = Math.cos((meanLat * Math.PI) / 180);
  const raw = u.map(([lat, lon]) => ({ x: lon * k, y: -lat }));
  const xs = raw.map((p) => p.x), ys = raw.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const s = Math.min(box.w / Math.max(1e-6, maxX - minX), box.h / Math.max(1e-6, maxY - minY));
  const ox = box.x + (box.w - (maxX - minX) * s) / 2, oy = box.y + (box.h - (maxY - minY) * s) / 2;
  return raw.map((p) => ({ x: ox + (p.x - minX) * s, y: oy + (p.y - minY) * s }));
}

/** u in [0,1] per event; rests carry the previous valid u (for drawing only), plus a rest flag. */
export function eventLevels(record: Pick<EarthRecord, 'observations' | 'musicalRule'>) {
  const { domainMin: lo, domainMax: hi } = record.musicalRule;
  let last = 0.5;
  return record.observations.map((o: ObservationSample) => {
    if (o.status === 'valid' && o.numericValue !== null) {
      last = normalize(o.numericValue, lo, hi).u;
      return { u: last, rest: false };
    }
    return { u: last, rest: true };
  });
}

/** Year dial: one spoke per window, starting at 12 o'clock, clockwise. */
export function dialAngle(i: number, n: number) {
  return -Math.PI / 2 + (i / n) * Math.PI * 2;
}

export function dialShape(levels: { u: number }[], c: Pt, r: number, amp: number): Pt[] {
  const ctrl = levels.map((l, i) => {
    const a = dialAngle(i, levels.length);
    const rr = r + amp * (l.u - 0.5);
    return { x: c.x + Math.cos(a) * rr, y: c.y + Math.sin(a) * rr };
  });
  return smooth(ctrl, PER_EVENT, true);
}

/** Score: notes left -> right, pitch up. Same count as other morph shapes. */
export function scoreShape(events: MusicEvent[], levels: { u: number }[], box: Box, pitches: number[]): Pt[] {
  const n = events.length;
  const lo = pitches[0], hi = pitches[pitches.length - 1];
  const ctrl = events.map((e, i) => {
    const m = e.midiNote ?? null;
    const v = m === null ? levels[i].u : (m - lo) / (hi - lo);
    return { x: box.x + ((i + 0.5) / n) * box.w, y: box.y + box.h * (1 - v) };
  });
  return resampleTo(smooth(ctrl, PER_EVENT, false), n * PER_EVENT);
}

/**
 * Spiral groove from outside (lead-in) to inside. Each event owns an equal arc;
 * its value pushes the groove slightly outward, so the record literally carries
 * the data in its spacing. Returns m = n * PER_EVENT points.
 */
export function spiralShape(levels: { u: number; rest: boolean }[], c: Pt, rOuter: number, rInner: number, turns: number, amp: number): Pt[] {
  const n = levels.length;
  const m = n * PER_EVENT;
  const ctrlU = levels.map((l) => l.u);
  const out: Pt[] = [];
  for (let k = 0; k < m; k++) {
    const t = k / (m - 1);
    const f = t * n - 0.5;
    const i0 = Math.max(0, Math.min(n - 1, Math.floor(f)));
    const i1 = Math.min(n - 1, i0 + 1);
    const w = Math.max(0, Math.min(1, f - i0));
    const ease = w * w * (3 - 2 * w);
    const u = lerp(ctrlU[i0], ctrlU[i1], ease);
    const a = -Math.PI / 2 + t * turns * Math.PI * 2;
    const r = lerp(rOuter, rInner, t) + amp * (u - 0.5);
    out.push({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r });
  }
  return out;
}

/** Morph source for the press: the record's own route or year dial, m points. */
export function originShape(record: EarthRecord, box: Box): Pt[] {
  const n = record.events.length;
  const levels = eventLevels(record);
  if (record.geometry.kind === 'route' && record.geometry.points) {
    return resampleTo(smooth(routeShape(record.geometry.points, box), 6), n * PER_EVENT);
  }
  const c = { x: box.x + box.w / 2, y: box.y + box.h / 2 };
  return resampleTo(dialShape(levels, c, Math.min(box.w, box.h) * 0.36, Math.min(box.w, box.h) * 0.18), n * PER_EVENT);
}

/* ------------------------------------------------------------------ */
/* Sleeve art                                                          */
/* ------------------------------------------------------------------ */

export type Stroke = { d: string; stroke: string; width: number; opacity: number; dash?: string };
export type SleeveArt = {
  size: number;
  background: [string, string];
  ink: string;
  accent: string;
  strokes: Stroke[];
  marks: { x: number; y: number; r: number; rest: boolean }[];
};

export const SLEEVE_PALETTE = {
  ocean: { background: ['#163f43', '#081b1f'] as [string, string], ink: '#f2ede3', accent: '#e7b276' },
  vegetation: { background: ['#3a4a33', '#141f19'] as [string, string], ink: '#f2ede3', accent: '#e7b276' },
};

/** Offset copies of a polyline along its normals; local spacing follows the data. */
function offsetLines(base: Pt[], us: number[], count: number, gap: number): Pt[][] {
  const normals = base.map((_p, i) => {
    const a = base[Math.max(0, i - 1)], b = base[Math.min(base.length - 1, i + 1)];
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    return { x: -dy / len, y: dx / len };
  });
  const lines: Pt[][] = [];
  for (let k = 1; k <= count; k++) {
    for (const side of [-1, 1]) {
      lines.push(base.map((p, i) => {
        const d = side * k * gap * (0.55 + 0.9 * us[i]);
        return { x: p.x + normals[i].x * d, y: p.y + normals[i].y * d };
      }));
    }
  }
  return lines;
}

export function sleeveArt(record: EarthRecord, size = 1000): SleeveArt {
  const levels = eventLevels(record);
  const n = levels.length;
  const strokes: Stroke[] = [];
  const marks: SleeveArt['marks'] = [];

  if (record.story === 'ocean' && record.geometry.points) {
    const pal = SLEEVE_PALETTE.ocean;
    const box = { x: size * 0.16, y: size * 0.16, w: size * 0.68, h: size * 0.5 };
    const stops = routeShape(record.geometry.points, box);
    const base = smooth(stops, PER_EVENT);
    const us = base.map((_, k) => {
      const f = Math.min(n - 1, k / PER_EVENT);
      const i0 = Math.floor(f), i1 = Math.min(n - 1, i0 + 1);
      return lerp(levels[i0].u, levels[i1].u, f - i0);
    });
    offsetLines(base, us, 16, size * 0.0085).forEach((line, j) =>
      strokes.push({ d: pathD(line), stroke: pal.ink, width: size * 0.0014, opacity: 0.1 + 0.32 * (1 - Math.floor(j / 2) / 16) }),
    );
    strokes.push({ d: pathD(base), stroke: pal.accent, width: size * 0.0042, opacity: 0.95 });
    stops.forEach((p, i) => marks.push({ x: p.x, y: p.y, r: size * (levels[i].rest ? 0.006 : 0.004 + 0.008 * levels[i].u), rest: levels[i].rest }));
    return { size, background: pal.background, ink: pal.ink, accent: pal.accent, strokes, marks };
  }

  // vegetation: growth rings — closed curves whose radius follows NDVI through the year
  const pal = SLEEVE_PALETTE.vegetation;
  const c = { x: size * 0.5, y: size * 0.42 };
  for (let k = 0; k < 18; k++) {
    const r = size * (0.08 + k * 0.0165);
    const amp = size * (0.01 + k * 0.0052);
    const ring = dialShape(levels, c, r, amp);
    strokes.push({ d: pathD(ring, true), stroke: k === 13 ? pal.accent : pal.ink, width: size * (k === 13 ? 0.004 : 0.0014), opacity: k === 13 ? 0.95 : 0.14 + 0.02 * k });
  }
  levels.forEach((l, i) => {
    const a = dialAngle(i, n);
    const r0 = size * 0.4, r1 = r0 + size * (0.015 + 0.05 * l.u);
    strokes.push({
      d: pathD([{ x: c.x + Math.cos(a) * r0, y: c.y + Math.sin(a) * r0 }, { x: c.x + Math.cos(a) * r1, y: c.y + Math.sin(a) * r1 }]),
      stroke: l.rest ? pal.ink : pal.accent, width: size * 0.003, opacity: l.rest ? 0.35 : 0.85, dash: l.rest ? '3 5' : undefined,
    });
  });
  return { size, background: pal.background, ink: pal.ink, accent: pal.accent, strokes, marks };
}
