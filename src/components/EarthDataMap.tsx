/**
 * EarthDataMap — the NASA frame plus a source-space SVG overlay.
 *
 * The image and the overlay share one transformed container and the SVG's
 * viewBox is the frame's own pixel grid (2048x1024). Overlays therefore stay
 * aligned at every size, zoom and pan by construction, and pointer positions
 * are converted back to source pixels with the SVG's inverse screen matrix.
 */
import { Minus, Plus, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { engine } from '../audio/AudioEngine';
import { useJukebox } from '../app/JukeboxContext';
import type { FrameKey } from '../app/state';
import { clampViewport, formatLat, formatLon, geoToPixel, pixelToGeo, zoomAbout, type Viewport } from '../domain/projection';
import type { GeoPoint } from '../domain/sourceTypes';

type Pt = { x: number; y: number };
const W = 2048;
const H = 1024;
const toPx = (p: GeoPoint): Pt => geoToPixel(p.lat, p.lon, W, H);

/** Split a polyline wherever it jumps across the antimeridian. */
function polylineSegments(pts: Pt[]): string[] {
  const segs: string[] = [];
  let cur: Pt[] = [];
  pts.forEach((p, i) => {
    if (i > 0 && Math.abs(p.x - pts[i - 1].x) > W / 2) {
      segs.push(cur.map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' '));
      cur = [];
    }
    cur.push(p);
  });
  if (cur.length) segs.push(cur.map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' '));
  return segs;
}

export function EarthDataMap() {
  const { state, derived, actions, registry } = useJukebox();
  const stageRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const cursorRef = useRef<SVGGElement>(null);
  const [stageW, setStageW] = useState(1000);
  const [view, setView] = useState<Viewport>({ baseScale: 1000 / W, zoom: 1, panX: 0, panY: 0 });
  const [drawing, setDrawing] = useState<GeoPoint[] | null>(null);
  const [kbCursor, setKbCursor] = useState<GeoPoint | null>(null);
  const drag = useRef<{ x: number; y: number; panX: number; panY: number; moved: boolean } | null>(null);

  const exploring = state.route === 'explore';
  const comparing = state.route === 'compare';
  const tool = exploring || comparing ? state.tool : 'probe';
  const spatial = comparing && state.compareMode === 'spatial';

  // Track stage size; keep the base fit in sync.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const w = e.contentRect.width;
      setStageW(w);
      setView((v) => clampViewport({ ...v, baseScale: w / W, panX: (v.panX * w) / (v.baseScale * W), panY: (v.panY * w) / (v.baseScale * W) }, w, w / 2, W, H));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const unit = W / (stageW * view.zoom); // source pixels per screen pixel
  const routePx = useMemo(() => derived.routePoints.map(toPx), [derived.routePoints]);
  const scan = derived.scans[state.frameKey];

  // Source point for every program step (null for silences), for the cursor.
  const cursorPath = useMemo<(Pt | null)[]>(() => {
    if (!state.program) return [];
    const p = derived.buildProgram(state.program.spec);
    return p.steps.map((s) => (s.sampleIndex === null ? null : routePx[s.sampleIndex] ?? null));
  }, [state.program, derived, routePx]);

  // Cursor: one rAF loop reading the engine clock. Never triggers sound.
  const stepRef = useRef(state.step);
  stepRef.current = state.step;
  const reduced = state.reducedMotion;
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const g = cursorRef.current;
      if (g) {
        const playing = engine.isPlaying();
        const pos = playing ? engine.position() : stepRef.current ?? -1;
        const k = Math.floor(pos);
        const a = cursorPath[k];
        const b = cursorPath[k + 1];
        let p: Pt | null = a ?? null;
        if (a && b && playing && !reduced) {
          const f = Math.min(1, Math.max(0, pos - k));
          p = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
        }
        if (p && pos >= 0) {
          g.setAttribute('transform', `translate(${p.x} ${p.y})`);
          g.style.opacity = '1';
        } else g.style.opacity = '0';
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cursorPath, reduced]);

  const toSource = useCallback((clientX: number, clientY: number): Pt | null => {
    const svg = svgRef.current;
    const m = svg?.getScreenCTM();
    if (!svg || !m) return null;
    const pt = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
    return { x: pt.x, y: pt.y };
  }, []);

  const nearestStep = (p: Pt): number | null => {
    let best = -1;
    let bestD = Infinity;
    routePx.forEach((q, i) => {
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return bestD <= 9 * unit ? best : null;
  };

  const select = (p: Pt) => {
    const geo = pixelToGeo(p.x, p.y, W, H);
    if (spatial) return actions.placeSpatial(geo);
    const step = state.program?.spec.kind === 'route' ? nearestStep(p) : null;
    if (step !== null) return actions.inspectStep(step);
    if (exploring || comparing) void actions.probeAt(geo);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (exploring && tool === 'draw') {
      const p = toSource(e.clientX, e.clientY);
      if (p) setDrawing([pixelToGeo(p.x, p.y, W, H)]);
      return;
    }
    drag.current = { x: e.clientX, y: e.clientY, panX: view.panX, panY: view.panY, moved: false };
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (drawing) {
      const p = toSource(e.clientX, e.clientY);
      if (!p) return;
      const last = toPx(drawing[drawing.length - 1]);
      if (Math.hypot(p.x - last.x, p.y - last.y) >= 4 * unit) setDrawing([...drawing, pixelToGeo(p.x, p.y, W, H)]);
      return;
    }
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.hypot(dx, dy) > 4) d.moved = true;
    if (tool === 'navigate' && d.moved) setView((v) => clampViewport({ ...v, panX: d.panX + dx, panY: d.panY + dy }, stageW, stageW / 2, W, H));
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (drawing) {
      const trace = drawing;
      setDrawing(null);
      actions.drawComplete(trace);
      return;
    }
    const d = drag.current;
    drag.current = null;
    if (!d || d.moved) return;
    if (tool === 'navigate' && !spatial) return; // navigate never makes sound
    const p = toSource(e.clientX, e.clientY);
    if (p) select(p);
  };

  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (tool !== 'navigate' && !e.ctrlKey) return;
    e.preventDefault();
    const rect = stageRef.current!.getBoundingClientRect();
    setView((v) => clampViewport(zoomAbout(v, e.deltaY < 0 ? 1.2 : 1 / 1.2, { x: e.clientX - rect.left, y: e.clientY - rect.top }), stageW, stageW / 2, W, H));
  };

  const zoomBy = (f: number) => setView((v) => clampViewport(zoomAbout(v, f, { x: stageW / 2, y: stageW / 4 }), stageW, stageW / 2, W, H));
  const resetView = () => setView({ baseScale: stageW / W, zoom: 1, panX: 0, panY: 0 });

  // Keyboard: arrows move a crosshair over the map, Enter selects there.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 5 : 1;
    const c = kbCursor ?? (state.selection?.kind === 'probe' ? state.selection.point : { lat: 20, lon: -40 });
    const moves: Record<string, [number, number]> = { ArrowUp: [step, 0], ArrowDown: [-step, 0], ArrowLeft: [0, -step], ArrowRight: [0, step] };
    if (moves[e.key]) {
      e.preventDefault();
      const [dl, dn] = moves[e.key];
      setKbCursor({ lat: Math.max(-89.5, Math.min(89.5, c.lat + dl)), lon: ((c.lon + dn + 540) % 360) - 180 });
    } else if (e.key === 'Enter' && kbCursor) {
      e.preventDefault();
      if (spatial) actions.placeSpatial(kbCursor);
      else void actions.probeAt(kbCursor);
    } else if (e.key === '+' || e.key === '=') zoomBy(1.25);
    else if (e.key === '-') zoomBy(1 / 1.25);
    else if (e.key === 'Escape') {
      setDrawing(null);
      setKbCursor(null);
    }
  };

  // Rings on each new audible step.
  const ringPt = state.step !== null ? cursorPath[state.step] : null;
  const progStep = state.program && state.step !== null ? derived.buildProgram(state.program.spec).steps[state.step] : null;
  const ringAudible = !!progStep?.event?.note && state.playback === 'playing';

  const sel = state.selection;
  const selPt = sel?.kind === 'step' ? routePx[sel.index] : sel?.kind === 'probe' ? toPx(sel.point) : null;
  const frameImg = (k: FrameKey) => registry.imageUrl(derived.frames[k]);
  const ghost = state.route === 'story' && (state.chapter === 'handover' || state.chapter === 'coda');
  const showRoute = state.route !== 'entry' && !(state.route === 'story' && state.chapter === 'language');

  const kbLabel = kbCursor ? `Map cursor at ${formatLat(kbCursor.lat)}, ${formatLon(kbCursor.lon)}. Press Enter to ${spatial ? `place marker ${state.spatial.placing}` : 'hear this point'}.` : '';

  return (
    <div className={`map ${state.reducedMotion ? 'is-reduced' : ''}`}>
      <div
        ref={stageRef}
        className={`map-stage tool-${tool} ${drawing ? 'is-drawing' : ''}`}
        tabIndex={0}
        role="group"
        aria-label="NASA SVS 3912 ocean visualization map"
        aria-describedby="map-help"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          setDrawing(null);
          drag.current = null;
        }}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
        onBlur={() => setKbCursor(null)}
      >
        <div className="map-canvas" style={{ transform: `translate(${view.panX}px, ${view.panY}px) scale(${view.zoom})` }}>
          {(['A', 'B'] as const).map((k) =>
            k === 'B' && derived.frames.B.id === derived.frames.A.id ? null : (
              <img
                key={k}
                src={frameImg(k)}
                alt={k === state.frameKey ? `NASA SVS 3912 frame ${derived.frames[k].frameNumber}: global ocean surface currents colored by modeled sea-surface temperature` : ''}
                aria-hidden={k !== state.frameKey}
                className={`map-frame ${k === state.frameKey ? 'is-active' : ''}`}
                draggable={false}
              />
            ),
          )}
          <svg ref={svgRef} className="map-overlay" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
            {showRoute && (
              <g className={`route ${ghost ? 'is-ghost' : ''}`}>
                {polylineSegments(routePx).map((s, i) => (
                  <polyline key={i} points={s} className="route-line" vectorEffect="non-scaling-stroke" />
                ))}
                {routePx.map((p, i) =>
                  scan.samples[i]?.quantity ? (
                    <circle key={i} cx={p.x} cy={p.y} r={1.6 * unit} className="route-dot" />
                  ) : (
                    <circle key={i} cx={p.x} cy={p.y} r={2.2 * unit} className="route-rest" vectorEffect="non-scaling-stroke" />
                  ),
                )}
                <circle cx={routePx[0].x} cy={routePx[0].y} r={4 * unit} className="route-end" vectorEffect="non-scaling-stroke" />
                <rect x={routePx[routePx.length - 1].x - 3.5 * unit} y={routePx[routePx.length - 1].y - 3.5 * unit} width={7 * unit} height={7 * unit} className="route-end" vectorEffect="non-scaling-stroke" />
              </g>
            )}

            {drawing && drawing.length > 1 && <polyline points={drawing.map(toPx).map((q) => `${q.x},${q.y}`).join(' ')} className="draw-line" vectorEffect="non-scaling-stroke" />}

            {selPt && !spatial && (
              <g transform={`translate(${selPt.x} ${selPt.y})`} className="selection">
                <circle r={9 * unit} vectorEffect="non-scaling-stroke" />
                <line x1={-15 * unit} x2={-10 * unit} vectorEffect="non-scaling-stroke" />
                <line x1={10 * unit} x2={15 * unit} vectorEffect="non-scaling-stroke" />
                <line y1={-15 * unit} y2={-10 * unit} vectorEffect="non-scaling-stroke" />
                <line y1={10 * unit} y2={15 * unit} vectorEffect="non-scaling-stroke" />
              </g>
            )}

            {spatial &&
              (['A', 'B'] as const).map((k) => {
                const p = state.spatial[k];
                if (!p) return null;
                const q = toPx(p);
                return (
                  <g key={k} transform={`translate(${q.x} ${q.y})`} className={`spatial-marker marker-${k}`}>
                    <circle r={8 * unit} vectorEffect="non-scaling-stroke" />
                    <text x={11 * unit} y={-9 * unit} fontSize={13 * unit}>{k}</text>
                  </g>
                );
              })}

            {ringPt && ringAudible && !state.reducedMotion && (
              <circle key={`${state.program?.nonce}-${state.step}`} cx={ringPt.x} cy={ringPt.y} r={14 * unit} className="note-ring" vectorEffect="non-scaling-stroke" />
            )}

            <g ref={cursorRef} className="scan-cursor" style={{ opacity: 0 }}>
              <circle r={5 * unit} />
              <circle r={10 * unit} className="scan-cursor-halo" vectorEffect="non-scaling-stroke" />
            </g>

            {kbCursor && (
              <g transform={`translate(${toPx(kbCursor).x} ${toPx(kbCursor).y})`} className="kb-cursor">
                <line x1={-18 * unit} x2={18 * unit} vectorEffect="non-scaling-stroke" />
                <line y1={-18 * unit} y2={18 * unit} vectorEffect="non-scaling-stroke" />
              </g>
            )}
          </svg>
        </div>

        <div className="map-source-label" aria-hidden="true">
          NASA SVS 3912 · frame {derived.frames[state.frameKey].frameNumber}
        </div>
      </div>

      <div className="map-controls" role="toolbar" aria-label="Map view">
        <button type="button" className="icon-btn" onClick={() => zoomBy(1.25)} aria-label="Zoom in" title="Zoom in">
          <Plus size={16} strokeWidth={1.6} />
        </button>
        <button type="button" className="icon-btn" onClick={() => zoomBy(1 / 1.25)} aria-label="Zoom out" title="Zoom out" disabled={view.zoom <= 1}>
          <Minus size={16} strokeWidth={1.6} />
        </button>
        <button type="button" className="icon-btn" onClick={resetView} aria-label="Reset view" title="Reset view" disabled={view.zoom === 1}>
          <RotateCcw size={15} strokeWidth={1.6} />
        </button>
      </div>

      <p id="map-help" className="sr-only">
        Focus the map and use the arrow keys to move a crosshair one degree at a time, with Shift for five degrees. Press Enter to hear and inspect that point. Plus and minus zoom.
        A list of every route step is available below the transport.
      </p>
      <div className="sr-only" aria-live="polite">{kbLabel}</div>
    </div>
  );
}
