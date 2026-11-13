/**
 * The listening atlas for Side B: a map you can move around, NASA's dated
 * MODIS greenness picture underneath, and the circular YEAR DIAL around the
 * chosen place.
 *
 * Any place: click anywhere on the map (a short click, not a drag) to choose
 * that point; its 2023 MODIS values are then fetched live. Drag to pan, +/− to zoom.
 *
 * The picture changes with the music: one NASA GIBS image of the MODIS Terra
 * 16-day NDVI composite for EACH window the dial plays (23 per year, the same
 * 16-day windows as the notes). It follows the transport clock, or the note you
 * select. All images of the current view are preloaded so playback never waits.
 *
 * Dial: one spoke per real 16-day MODIS composite window (not per month),
 * starting at 1 January at 12 o'clock, clockwise. Spoke length = NDVI.
 * Hollow, dashed spokes are rests (QA-rejected windows). Thin month ticks are
 * calendar guides only. The highlighted spoke follows the transport clock.
 */
import { geoEquirectangular, geoGraticule10, geoPath } from 'd3-geo';
import type { FeatureCollection } from 'geojson';
import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import landTopo from 'world-atlas/land-50m.json';
import { normalize } from '../audio/normalize';
import type { LandPlace, PlaceIndexEntry } from '../data/adapters/modisNdviAdapter';
import { windowLabel } from '../data/adapters/modisNdviAdapter';
import type { EarthRecord } from '../data/types';
import { dialAngle, dialShape, pathD } from './geometry';
import { useSmoothPlayhead } from '../accessibility/usePlayhead';

const LAND = feature(landTopo as unknown as Topology, (landTopo as unknown as Topology).objects.land) as unknown as FeatureCollection;
const GRAT = geoGraticule10();
const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const SPANS = [8, 14, 22, 34, 56, 90, 150];
export const GIBS_LAYER = 'MODIS_Terra_L3_NDVI_16Day';
export const GIBS_LEGEND = 'https://gibs.earthdata.nasa.gov/legends/MODIS_L3_NDVI_H.png';

/** A NASA GIBS WMS picture of one 16-day MODIS NDVI composite for a lon/lat box. */
export function gibsUrl(box: { w: number; s: number; e: number; n: number }, date: string, px: number) {
  const dLon = box.e - box.w, dLat = box.n - box.s;
  const width = Math.max(64, Math.round(Math.min(800, px)));
  const height = Math.max(64, Math.round((width * dLat) / dLon));
  const bbox = [box.s, box.w, box.n, box.e].map((v) => v.toFixed(3)).join(',');
  return `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=${GIBS_LAYER}&CRS=EPSG:4326&BBOX=${bbox}&WIDTH=${width}&HEIGHT=${height}&FORMAT=image/jpeg&BGCOLOR=0x0E2A2A&TIME=${date}`;
}

type Props = {
  places: PlaceIndexEntry[];
  place: LandPlace | null;
  record: EarthRecord | null;
  playhead: number | null;
  playing: boolean;
  selected: number | null;
  onSelect: (i: number) => void;
  onPlace: (id: string) => void;
  onPoint: (lat: number, lon: number) => void;
  onAnchor: (p: { x: number; y: number } | null) => void;
  reducedMotion: boolean;
  loading: { done: number; total: number } | null;
  pending: { lat: number; lon: number } | null;
};

export function LandAtlas({ places, place, record, playhead, playing, selected, onSelect, onPlace, onPoint, onAnchor, reducedMotion, loading, pending }: Props) {
  const stage = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 900, h: 560 });
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // the view: centre + zoom level; follows the place unless the visitor moved it
  const [view, setView] = useState<{ lon: number; lat: number; z: number }>(() => ({ lon: place?.lon ?? 10, lat: place?.lat ?? 20, z: 3 }));
  const span = SPANS[view.z];
  const { land, grat, project, invert } = useMemo(() => {
    const proj = geoEquirectangular()
      .center([view.lon, view.lat])
      .translate([size.w * 0.5, size.h * 0.5])
      .scale(Math.min(size.w, size.h * 1.6) / ((span * Math.PI) / 180));
    const path = geoPath(proj);
    return {
      land: path(LAND) ?? '',
      grat: path(GRAT) ?? '',
      project: (lon: number, lat: number) => proj([lon, lat]) ?? [0, 0],
      invert: (x: number, y: number) => proj.invert?.([x, y]) ?? [0, 0],
    };
  }, [view.lon, view.lat, span, size.w, size.h]);

  // recentre when a different place arrives and it is outside the current view
  const placeKey = place?.id;
  useEffect(() => {
    if (!place) return;
    const [x, y] = project(place.lon, place.lat);
    if (x < size.w * 0.12 || x > size.w * 0.88 || y < size.h * 0.12 || y > size.h * 0.88) setView((v) => ({ ...v, lon: place.lon, lat: place.lat }));
  }, [placeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // drag to pan; a short click chooses a point
  const drag = useRef<{ x: number; y: number; lon: number; lat: number; moved: boolean; id: number } | null>(null);
  const toLocal = (e: PointerEvent) => {
    const r = svg.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * size.w, y: ((e.clientY - r.top) / r.height) * size.h };
  };
  function down(e: PointerEvent<SVGSVGElement>) {
    if ((e.target as Element).closest('.dial__spoke, .land__place')) return;
    const p = toLocal(e);
    drag.current = { ...p, lon: view.lon, lat: view.lat, moved: false, id: e.pointerId };
  }
  function move(e: PointerEvent<SVGSVGElement>) {
    const d = drag.current;
    if (!d) return;
    const p = toLocal(e);
    if (!d.moved && Math.hypot(p.x - d.x, p.y - d.y) < 6) return;
    if (!d.moved) svg.current?.setPointerCapture(d.id);
    d.moved = true;
    const degPerPx = span / Math.min(size.w, size.h * 1.6) * (180 / Math.PI) * (Math.PI / 180);
    setView((v) => ({ ...v, lon: d.lon - (p.x - d.x) * degPerPx, lat: Math.max(-80, Math.min(80, d.lat + (p.y - d.y) * degPerPx)) }));
  }
  function up(e: PointerEvent<SVGSVGElement>) {
    const d = drag.current;
    drag.current = null;
    if (!d || d.moved) return;
    const p = toLocal(e);
    const [lon, lat] = invert(p.x, p.y);
    if (Math.abs(lat) <= 85) onPoint(Math.round(lat * 100) / 100, Math.round((((lon + 540) % 360) - 180) * 100) / 100);
  }

  /* ----------------------------- dial ------------------------------ */

  const n = record?.events.length ?? 0;
  const [cx, cy] = place ? project(place.lon, place.lat) : [size.w / 2, size.h / 2];
  const R = Math.max(64, Math.min(size.w, size.h) * 0.16);
  const SPOKE = R * 0.62;
  const levels = useMemo(() => {
    if (!record) return [];
    const { domainMin: lo, domainMax: hi } = record.musicalRule;
    return record.observations.map((o) => (o.status === 'valid' && o.numericValue !== null ? normalize(o.numericValue, lo, hi).u : null));
  }, [record]);

  const ringPath = useMemo(() => {
    if (!levels.length) return '';
    let last = 0.5;
    const filled = levels.map((u) => ({ u: u === null ? last : (last = u) }));
    return pathD(dialShape(filled, { x: cx, y: cy }, R + SPOKE * 0.5, SPOKE * 0.9), true);
  }, [levels, cx, cy, R, SPOKE]);

  const spokeEnd = (i: number, len: number) => {
    const a = dialAngle(i, n);
    return { x1: cx + Math.cos(a) * R, y1: cy + Math.sin(a) * R, x2: cx + Math.cos(a) * (R + len), y2: cy + Math.sin(a) * (R + len) };
  };

  useEffect(() => {
    if (selected === null || !n) return onAnchor(null);
    const s = spokeEnd(selected, SPOKE + 14);
    onAnchor({ x: s.x2, y: s.y2 });
  }, [selected, n, cx, cy, R]); // eslint-disable-line react-hooks/exhaustive-deps

  const year = place?.year ?? 2023;
  const monthStart = (m: number) => {
    const doy = (Date.UTC(year, m, 1) - Date.UTC(year, 0, 1)) / 86400000;
    return -Math.PI / 2 + (doy / (16 * n || 368)) * Math.PI * 2;
  };

  /* --------------------- NASA picture per window -------------------- */

  const box = useMemo(() => {
    const [w0, n0] = invert(0, 0);
    const [e0, s0] = invert(size.w, size.h);
    return { w: Math.max(-180, w0), e: Math.min(180, e0), n: Math.min(90, n0), s: Math.max(-90, s0) };
  }, [invert, size.w, size.h]);
  const [settledBox, setSettledBox] = useState(box);
  useEffect(() => {
    const id = window.setTimeout(() => setSettledBox(box), 350);
    return () => window.clearTimeout(id);
  }, [box]);
  const windows = place?.windows ?? [];
  const shown = selected ?? playhead;
  const pictureIndex = windows.length ? Math.max(0, Math.min(windows.length - 1, shown ?? 0)) : null;
  const picW = ((settledBox.e - settledBox.w) / (box.e - box.w || 1)) * size.w;
  const urls = useMemo(
    () => (settledBox.e > settledBox.w && settledBox.n > settledBox.s ? windows.map((w) => gibsUrl(settledBox, w.start, picW)) : []),
    [settledBox, windows, picW],
  );
  const [loaded, setLoaded] = useState<Set<string>>(new Set());
  const [layers, setLayers] = useState<string[]>([]);
  // preload every window's picture, the one on screen first, then onwards in playing order;
  // a new view cancels the old downloads
  const firstRef = useRef(0);
  firstRef.current = pictureIndex ?? 0;
  // loads are collected quietly and published at most every 700 ms (or at once for the
  // picture on screen), so 23 downloads never mean 23 redraws of the map during playback
  const loadedRef = useRef<Set<string>>(new Set());
  const wantRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    let live = true;
    let flush: number | null = null;
    setLayers((l) => l.filter((u) => urls.includes(u)));
    const publish = () => {
      flush = null;
      if (live) setLoaded(new Set(loadedRef.current));
    };
    const order = urls.map((_, k) => (firstRef.current + k) % urls.length);
    const imgs = order.map((k) => {
      const u = urls[k];
      const im = new Image();
      im.decoding = 'async';
      im.onload = () => {
        if (!live) return;
        loadedRef.current.add(u);
        if (u === wantRef.current) publish();
        else if (flush === null) flush = window.setTimeout(publish, 700);
      };
      im.src = u;
      return im;
    });
    return () => {
      live = false;
      if (flush !== null) window.clearTimeout(flush);
      imgs.forEach((im) => {
        im.onload = null;
        if (!im.complete) im.src = '';
      });
    };
  }, [urls]);
  // newest loaded picture for the current window, over the previous one (crossfade)
  const want = pictureIndex !== null ? urls[pictureIndex] : undefined;
  wantRef.current = want;
  useEffect(() => {
    if (want && loadedRef.current.has(want) && !loaded.has(want)) setLoaded(new Set(loadedRef.current));
  }, [want, loaded]);
  useEffect(() => {
    if (!want || !loaded.has(want)) return;
    setLayers((l) => (l[l.length - 1] === want ? l : [...l.filter((x) => x !== want).slice(-1), want]));
  }, [want, loaded]);
  const [px0, py0] = project(settledBox.w, settledBox.n);
  const [px1, py1] = project(settledBox.e, settledBox.s);
  const pictureWindow = pictureIndex !== null ? windows[pictureIndex] : null;
  const ready = urls.filter((u) => loaded.has(u)).length;

  return (
    <div className="atlas atlas--land" ref={stage}>
      <svg
        ref={svg}
        className="atlas__svg land__svg"
        viewBox={`0 0 ${size.w} ${size.h}`}
        role="img"
        aria-label={place ? `Map around ${place.name}, ${place.region}, showing NASA's MODIS greenness picture for the window being played, and a year dial of ${n} vegetation windows. Click anywhere to choose another place. The note list below is the accessible equivalent.` : 'Map: click anywhere to choose a place'}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={() => (drag.current = null)}
      >
        <path d={grat} className="land__grat" />
        <path d={land} className="land__land" />
        {layers.map((u, i) => (
          <image
            key={u}
            href={u}
            x={px0}
            y={py0}
            width={Math.max(1, px1 - px0)}
            height={Math.max(1, py1 - py0)}
            preserveAspectRatio="none"
            className={`land__ndvi${i === layers.length - 1 ? ' is-top' : ''}${reducedMotion ? ' is-still' : ''}`}
          />
        ))}
        <path d={land} className="land__coast" />
        {places.map((p) => {
          const [x, y] = project(p.lon, p.lat);
          const on = p.id === place?.id;
          return (
            <g key={p.id} className={`land__place${on ? ' is-on' : ''}`} onClick={() => onPlace(p.id)}>
              <circle cx={x} cy={y} r={on ? 5 : 7} />
              {!on && <text x={x + 12} y={y + 4}>{p.name}</text>}
            </g>
          );
        })}
        {pending && (() => {
          const [x, y] = project(pending.lon, pending.lat);
          return (
            <g className="land__pending">
              <circle cx={x} cy={y} r={10} />
              <circle cx={x} cy={y} r={3} className="land__pending-dot" />
            </g>
          );
        })()}
        {place && record && (
          <g key={place.id} className={`dial${reducedMotion ? '' : ' is-entering'}`}>
            <path
              d={`M${cx - R - SPOKE - 32} ${cy} a${R + SPOKE + 32} ${R + SPOKE + 32} 0 1 0 ${2 * (R + SPOKE + 32)} 0 a${R + SPOKE + 32} ${R + SPOKE + 32} 0 1 0 ${-2 * (R + SPOKE + 32)} 0 Z M${cx - R + 1} ${cy} a${R - 1} ${R - 1} 0 1 1 ${2 * (R - 1)} 0 a${R - 1} ${R - 1} 0 1 1 ${-2 * (R - 1)} 0 Z`}
              className="dial__backdrop"
              fillRule="evenodd"
            />
            <circle cx={cx} cy={cy} r={R} className="dial__base" />
            <circle cx={cx} cy={cy} r={R + SPOKE + 8} className="dial__outer" />
            {MONTHS.map((m, i) => {
              const a = monthStart(i);
              const r0 = R + SPOKE + 4, r1 = R + SPOKE + 14, rt = R + SPOKE + 26;
              return (
                <g key={i} className="dial__month">
                  <line x1={cx + Math.cos(a) * r0} y1={cy + Math.sin(a) * r0} x2={cx + Math.cos(a) * r1} y2={cy + Math.sin(a) * r1} />
                  <text x={cx + Math.cos(a + 0.13) * rt} y={cy + Math.sin(a + 0.13) * rt + 4} textAnchor="middle">{m}</text>
                </g>
              );
            })}
            <path d={ringPath} className="dial__ring" />
            {levels.map((u, i) => {
              const len = u === null ? SPOKE * 0.35 : 6 + u * SPOKE;
              const s = spokeEnd(i, len);
              const cls = ['dial__spoke', u === null ? 'is-rest' : '', i === playhead ? 'is-playing' : '', i === selected ? 'is-selected' : '', playhead !== null && i < playhead ? 'is-played' : ''].filter(Boolean).join(' ');
              const w = place.windows[i];
              return (
                <g key={i} className={cls} style={{ animationDelay: reducedMotion ? '0ms' : `${i * 24}ms` }} onClick={() => onSelect(i)}>
                  <title>{`${windowLabel(w)}: ${w.ndvi === null ? 'rest' : `NDVI ${w.ndvi.toFixed(2)}`}`}</title>
                  <line {...s} />
                  <line {...spokeEnd(i, SPOKE + 10)} className="dial__hit" />
                </g>
              );
            })}
            <DialHand cx={cx} cy={cy} r={R + SPOKE + 8} n={n} playing={playing} playhead={playhead} />
            <circle cx={cx} cy={cy} r={4} className="dial__pin" />
            <text x={cx} y={cy + R * 0.42} textAnchor="middle" className="dial__label">{year}</text>
          </g>
        )}
      </svg>

      {loading && (
        <div className="land__loading" role="status">
          <span className="land__loading-ring" aria-hidden="true" />
          <span>
            Asking NASA&apos;s MODIS service for this point&apos;s year…
            <br />
            <small>{loading.done} of {loading.total} requests · usually 15–40 s, then it is remembered</small>
          </span>
        </div>
      )}

      <div className="land__picture" aria-live="off">
        {pictureWindow && (
          <>
            <span className="land__picture-date">{windowLabel(pictureWindow)} {year}</span>
            <span className="land__picture-src">
              NASA GIBS · MODIS Terra 16-day NDVI{urls.length > 0 && ready < urls.length ? ` · pictures ${ready}/${urls.length}` : ''}
            </span>
            <img className="land__picture-legend" src={GIBS_LEGEND} alt="Picture colour scale: brown low greenness to dark green high greenness (NASA)" />
          </>
        )}
      </div>
      <p className="land__hint">Click anywhere to hear that place’s year · drag to move</p>
      <div className="atlas__zoom" role="group" aria-label="Map zoom">
        <button onClick={() => setView((v) => ({ ...v, z: Math.max(0, v.z - 1) }))} aria-label="Zoom in">+</button>
        <button onClick={() => setView((v) => ({ ...v, z: Math.min(SPANS.length - 1, v.z + 1) }))} aria-label="Zoom out">−</button>
        {place && (
          <button className="atlas__fit" onClick={() => setView((v) => ({ ...v, lon: place.lon, lat: place.lat }))}>Centre place</button>
        )}
      </div>
      <div className="atlas__legend-land">
        <span><i className="sw sw--spoke" /> one spoke = one 16-day MODIS window</span>
        <span><i className="sw sw--rest" /> rest: rejected by quality checks</span>
        <span>J F M … calendar guides only</span>
      </div>
    </div>
  );
}

/** The year dial's clock hand: the only part that moves every frame. */
function DialHand({ cx, cy, r, n, playing, playhead }: { cx: number; cy: number; r: number; n: number; playing: boolean; playhead: number | null }) {
  const smooth = useSmoothPlayhead(playing, playhead);
  if (smooth === null || !n) return null;
  const a = dialAngle(Math.min(n, smooth), n);
  return <line x1={cx} y1={cy} x2={cx + Math.cos(a) * r} y2={cy + Math.sin(a) * r} className="dial__hand" />;
}
