/**
 * The listening atlas for Side A.
 *
 * Coordinates: one SVG user unit = one degree (x = lon + 180, y = 90 − lat),
 * the registration of NASA's SVS 3912 frames (verified by the pipeline).
 * The picture repeats left and right so routes may cross the antimeridian.
 *
 * Pointer input is converted with the SVG's own screen matrix (getScreenCTM)
 * and then the inverse projection — never by pixel arithmetic — so zoom,
 * pan and screen size cannot change which samples are taken.
 */
import { useSmoothPlayhead } from '../accessibility/usePlayhead';
import { useEffect, useMemo, useRef, useState, type PointerEvent as RPE } from 'react';
import { isDegenerateRoute, thinTrace, unwrapLongitudes } from '../data/geodesicPath';
import { formatGeo, mapToGeo } from '../data/projections';
import type { EarthRecord, GeoPosition } from '../data/types';
import type { OceanDraft } from '../app/recordMachine';
import { announce } from '../accessibility/announcements';

const BASE = import.meta.env.BASE_URL;
const FRAME: Record<string, string> = { A: 'nasa-svs/svs3912-frame-26400.jpg', B: 'nasa-svs/svs3912-frame-30400.jpg' };
const DATAMAP: Record<string, string> = { A: 'data/ocean/mur-sst-20070818.png', B: 'data/ocean/mur-sst-20080206.png' };

type View = { x: number; y: number; w: number };
type Props = {
  draft: OceanDraft;
  record: EarthRecord | null;
  waypoints: GeoPosition[];
  playhead: number | null;
  /** Playing: the trail and beacon follow the transport clock on their own (no full-map redraws). */
  playing: boolean;
  selected: number | null;
  reducedMotion: boolean;
  onSelect: (i: number) => void;
  onRoute: (waypoints: GeoPosition[]) => void;
  /** reports the screen position (relative to the stage) of the selected stop, for the anchored inspector */
  onAnchor: (p: { x: number; y: number } | null) => void;
  busy: boolean;
};

/** unwrapped map x for a sequence of positions (continuous across ±180°) */
function toUnwrapped(points: GeoPosition[]) {
  return unwrapLongitudes(points.map((p) => [p.lat, p.lon])).map(([lat, lon]) => ({ x: lon + 180, y: 90 - lat }));
}

function fitView(pts: { x: number; y: number }[], aspect: number): View {
  if (!pts.length) return { x: 0, y: 0, w: 360 };
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const pad = Math.max(8, Math.max(x1 - x0, (y1 - y0) * aspect) * 0.18);
  x0 -= pad; x1 += pad; y0 -= pad / aspect; y1 += pad / aspect;
  let w = Math.max(x1 - x0, (y1 - y0) * aspect, 36);
  w = Math.min(w, 360);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  return clampView({ x: cx - w / 2, y: cy - w / aspect / 2, w }, aspect);
}

function clampView(v: View, aspect: number): View {
  const w = Math.max(18, Math.min(360, v.w));
  const h = w / aspect;
  const y = h >= 180 ? (180 - h) / 2 : Math.max(0, Math.min(180 - h, v.y));
  return { x: v.x, y, w };
}

export function OceanAtlas({ draft, record, waypoints, playhead, playing, selected, reducedMotion, onSelect, onRoute, onAnchor, busy }: Props) {
  const stage = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 900, h: 520 });
  const aspect = size.w / Math.max(1, size.h);
  const [view, setView] = useState<View>({ x: 60, y: 10, w: 160 });
  const [trace, setTrace] = useState<{ x: number; y: number }[] | null>(null);
  const drag = useRef<{ mode: 'pan' | 'draw'; sx: number; sy: number; view: View } | null>(null);
  const [revealKey, setRevealKey] = useState(0);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const route = useMemo(() => toUnwrapped(waypoints), [waypoints]);
  const stops = useMemo(() => (record?.geometry.points ? toUnwrapped(record.geometry.points) : []), [record]);
  // keep stops on the same "copy" of the world as the route
  const stopsAligned = useMemo(() => {
    if (!stops.length || !route.length) return stops;
    const shift = Math.round((route[0].x - stops[0].x) / 360) * 360;
    return stops.map((p) => ({ x: p.x + shift, y: p.y }));
  }, [stops, route]);

  // frame the route when it changes (not while the visitor is drawing)
  const routeKey = waypoints.map((p) => `${p.lat.toFixed(2)},${p.lon.toFixed(2)}`).join(';');
  useEffect(() => {
    if (route.length >= 2) setView(fitView(route, aspect));
    setRevealKey((k) => k + 1);
  }, [routeKey, aspect > 1.2]); // eslint-disable-line react-hooks/exhaustive-deps

  const vh = view.w / aspect;
  const toScreen = (p: { x: number; y: number }) => ({ x: ((p.x - view.x) / view.w) * size.w, y: ((p.y - view.y) / vh) * size.h });

  // anchor for the inspector card
  useEffect(() => {
    if (selected === null || !stopsAligned[selected]) return onAnchor(null);
    onAnchor(toScreen(stopsAligned[selected]));
  }, [selected, stopsAligned, view, size]); // eslint-disable-line react-hooks/exhaustive-deps

  function svgPoint(e: { clientX: number; clientY: number }) {
    const s = svg.current;
    const m = s?.getScreenCTM();
    if (!s || !m) return null;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: pt.x, y: pt.y };
  }

  function onDown(e: RPE<SVGSVGElement>) {
    if (busy) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = svgPoint(e);
    if (!p) return;
    if (draft.tool === 'draw') {
      drag.current = { mode: 'draw', sx: p.x, sy: p.y, view };
      setTrace([p]);
    } else drag.current = { mode: 'pan', sx: e.clientX, sy: e.clientY, view };
  }

  function onMove(e: RPE<SVGSVGElement>) {
    const d = drag.current;
    if (!d) return;
    if (d.mode === 'pan') {
      const dx = ((e.clientX - d.sx) / size.w) * d.view.w;
      const dy = ((e.clientY - d.sy) / size.h) * (d.view.w / aspect);
      setView(clampView({ x: d.view.x - dx, y: d.view.y - dy, w: d.view.w }, aspect));
      return;
    }
    const p = svgPoint(e);
    if (!p) return;
    setTrace((t) => {
      if (!t) return [p];
      const last = t[t.length - 1];
      return Math.hypot(p.x - last.x, p.y - last.y) > view.w / 400 ? [...t, p] : t;
    });
  }

  function onUp() {
    const d = drag.current;
    drag.current = null;
    if (!d || d.mode !== 'draw' || !trace) return;
    const geo = trace.map((p) => mapToGeo(p.x, Math.max(0.5, Math.min(179.5, p.y))));
    setTrace(null);
    const thinned = thinTrace(geo, 60);
    if (isDegenerateRoute(thinned)) {
      announce('That line is too short to become a record. Draw a longer path across the sea.');
      return;
    }
    onRoute(thinned);
    announce(`New route from ${formatGeo(thinned[0])} to ${formatGeo(thinned[thinned.length - 1])}. ${24} stops sampled.`);
  }

  function zoom(f: number, cx = view.x + view.w / 2, cy = view.y + vh / 2) {
    const w = Math.max(18, Math.min(360, view.w * f));
    const k = w / view.w;
    setView(clampView({ x: cx - (cx - view.x) * k, y: cy - (cy - view.y) * k, w }, aspect));
  }

  function onWheel(e: React.WheelEvent<SVGSVGElement>) {
    const p = svgPoint(e);
    if (!p) return;
    zoom(e.deltaY > 0 ? 1.15 : 1 / 1.15, p.x, p.y);
  }

  const copies = [-360, 0, 360];
  const img = draft.layer === 'picture' ? FRAME[draft.dateKey] : DATAMAP[draft.dateKey];
  const sw = view.w / size.w; // one screen pixel in map units

  return (
    <div className={`atlas atlas--ocean tool-${draft.tool}`} ref={stage}>
      <svg
        ref={svg}
        className="atlas__svg"
        viewBox={`${view.x} ${view.y} ${view.w} ${vh}`}
        preserveAspectRatio="none"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onWheel={onWheel}
        role="img"
        aria-label={`Map of ${draft.layer === 'picture' ? 'the NASA SVS 3912 visualization' : 'MUR sea surface temperature'} for ${draft.dateKey === 'A' ? '18 August 2007' : '6 February 2008'}${record ? `, with a route of ${stopsAligned.length} stops` : ''}. ${draft.tool === 'draw' ? 'Drag to draw a route.' : 'Drag to pan.'} The note list below is the accessible equivalent.`}
      >
        {copies.map((dx) => (
          <image key={`${img}${dx}`} href={`${BASE}${img}`} x={dx} y={0} width={360} height={180} preserveAspectRatio="none" className="atlas__image" />
        ))}
        <g className="atlas__graticule" strokeWidth={sw}>
          {Array.from({ length: 73 }, (_, i) => -360 + i * 15).map((x) => <line key={`x${x}`} x1={x} x2={x} y1={0} y2={180} />)}
          {Array.from({ length: 11 }, (_, i) => 15 + i * 15).map((y) => <line key={`y${y}`} x1={-360} x2={720} y1={y} y2={y} className={y === 90 ? 'is-equator' : ''} />)}
        </g>
        {route.length > 1 && <polyline className="atlas__guide" points={route.map((p) => `${p.x},${p.y}`).join(' ')} strokeWidth={sw * 1.4} strokeDasharray={`${sw * 5} ${sw * 6}`} />}
        {stopsAligned.length > 1 && (
          <polyline key={`line-${revealKey}`} className={`atlas__route${reducedMotion ? '' : ' is-revealing'}`} points={stopsAligned.map((p) => `${p.x},${p.y}`).join(' ')} strokeWidth={sw * 2.6} pathLength={1} />
        )}
        {stopsAligned.length > 1 && <PlayedTrail stops={stopsAligned} sw={sw} playing={playing} playhead={playhead} part="line" />}
        <g key={`stops-${revealKey}`}>
          {stopsAligned.map((p, i) => {
            const o = record!.observations[i];
            const rest = o.status !== 'valid';
            const r = sw * (i === selected ? 9 : i === playhead ? 7.5 : 5);
            return (
              <g key={i} className={`atlas__stop${rest ? ' is-rest' : ''}${i === selected ? ' is-selected' : ''}${i === playhead ? ' is-playing' : ''}`} style={{ animationDelay: reducedMotion ? '0ms' : `${120 + i * 22}ms` }}>
                <circle cx={p.x} cy={p.y} r={sw * 14} className="atlas__hit" onClick={(ev) => { ev.stopPropagation(); onSelect(i); }} onPointerDown={(ev) => ev.stopPropagation()} />
                <circle cx={p.x} cy={p.y} r={r} strokeWidth={sw * 1.6} />
                {rest && <path d={`M${p.x - r * 0.6} ${p.y - r * 0.6}L${p.x + r * 0.6} ${p.y + r * 0.6}`} strokeWidth={sw * 1.4} />}
              </g>
            );
          })}
        </g>
        {stopsAligned.length > 1 && <PlayedTrail stops={stopsAligned} sw={sw} playing={playing} playhead={playhead} part="beacon" />}
        {trace && trace.length > 1 && <polyline className="atlas__trace" points={trace.map((p) => `${p.x},${p.y}`).join(' ')} strokeWidth={sw * 2.4} />}
      </svg>
      <div className="atlas__zoom" role="group" aria-label="Map zoom">
        <button onClick={() => zoom(1 / 1.4)} aria-label="Zoom in">+</button>
        <button onClick={() => zoom(1.4)} aria-label="Zoom out">−</button>
        <button onClick={() => route.length > 1 && setView(fitView(route, aspect))} className="atlas__fit">Fit route</button>
      </div>
      {busy && <div className="atlas__loading" role="status">Loading measurements…</div>}
    </div>
  );
}

/** The played part of the route and the moving beacon: the only parts that move every frame. */
function PlayedTrail({ stops, sw, playing, playhead, part }: { stops: { x: number; y: number }[]; sw: number; playing: boolean; playhead: number | null; part: 'line' | 'beacon' }) {
  const smooth = useSmoothPlayhead(playing, playhead);
  if (smooth === null) return null;
  const f = Math.max(0, Math.min(stops.length - 1, smooth));
  const i = Math.floor(f), t = f - i, a = stops[i], b = stops[Math.min(stops.length - 1, i + 1)];
  const cursor = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  if (part === 'beacon') return <circle className="atlas__beacon" cx={cursor.x} cy={cursor.y} r={sw * 8} strokeWidth={sw * 2} />;
  return <polyline className="atlas__played" points={stops.slice(0, i + 1).map((p) => `${p.x},${p.y}`).concat([`${cursor.x},${cursor.y}`]).join(' ')} strokeWidth={sw * 3.4} />;
}
