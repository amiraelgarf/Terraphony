/**
 * The listening atlas for Side B: a quiet map (Natural Earth coastlines),
 * the curated places, and the circular YEAR DIAL drawn around the chosen place.
 *
 * Dial: one spoke per real 16-day MODIS composite window (not per month),
 * starting at 1 January at 12 o'clock, clockwise. Spoke length = NDVI.
 * Hollow, dashed spokes are rests (QA-rejected windows). Thin month ticks are
 * calendar guides only. The highlighted spoke follows the transport clock.
 */
import { geoEquirectangular, geoGraticule10, geoPath } from 'd3-geo';
import type { FeatureCollection } from 'geojson';
import { useEffect, useMemo, useRef, useState } from 'react';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import landTopo from 'world-atlas/land-50m.json';
import { normalize } from '../audio/normalize';
import type { LandPlace, PlaceIndexEntry } from '../data/adapters/modisNdviAdapter';
import { windowLabel } from '../data/adapters/modisNdviAdapter';
import type { EarthRecord } from '../data/types';
import { dialAngle, dialShape, pathD } from './geometry';

const LAND = feature(landTopo as unknown as Topology, (landTopo as unknown as Topology).objects.land) as unknown as FeatureCollection;
const GRAT = geoGraticule10();
const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

type Props = {
  places: PlaceIndexEntry[];
  place: LandPlace | null;
  record: EarthRecord | null;
  playhead: number | null;
  smooth: number | null;
  selected: number | null;
  onSelect: (i: number) => void;
  onPlace: (id: string) => void;
  onAnchor: (p: { x: number; y: number } | null) => void;
  reducedMotion: boolean;
};

export function LandAtlas({ places, place, record, playhead, smooth, selected, onSelect, onPlace, onAnchor, reducedMotion }: Props) {
  const stage = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 900, h: 560 });
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const centre = place ? [place.lon, place.lat] : [0, 20];
  const { land, grat, project } = useMemo(() => {
    const span = 34;
    const proj = geoEquirectangular()
      .center([centre[0], centre[1]] as [number, number])
      .translate([size.w * (size.w > 700 ? 0.5 : 0.5), size.h * 0.5])
      .scale(Math.min(size.w, size.h * 1.6) / ((span * Math.PI) / 180) / 1.0);
    const path = geoPath(proj);
    return { land: path(LAND) ?? '', grat: path(GRAT) ?? '', project: (lon: number, lat: number) => proj([lon, lat]) ?? [0, 0] };
  }, [centre[0], centre[1], size.w, size.h]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const cursorAngle = smooth !== null && n ? dialAngle(Math.min(n, smooth), n) : null;
  const year = place?.year ?? 2023;
  const monthStart = (m: number) => {
    const doy = (Date.UTC(year, m, 1) - Date.UTC(year, 0, 1)) / 86400000;
    return -Math.PI / 2 + (doy / (16 * n || 368)) * Math.PI * 2;
  };

  return (
    <div className="atlas atlas--land" ref={stage}>
      <svg className="atlas__svg" viewBox={`0 0 ${size.w} ${size.h}`} role="img" aria-label={place ? `Map around ${place.name}, ${place.region}, with a year dial of ${n} vegetation windows. The note list below is the accessible equivalent.` : 'Map of the curated places'}>
        <path d={grat} className="land__grat" />
        <path d={land} className="land__land" />
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
        {place && record && (
          <g key={place.id} className={`dial${reducedMotion ? '' : ' is-entering'}`}>
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
            {cursorAngle !== null && (
              <line x1={cx} y1={cy} x2={cx + Math.cos(cursorAngle) * (R + SPOKE + 8)} y2={cy + Math.sin(cursorAngle) * (R + SPOKE + 8)} className="dial__hand" />
            )}
            <circle cx={cx} cy={cy} r={4} className="dial__pin" />
            <text x={cx} y={cy + R * 0.42} textAnchor="middle" className="dial__label">{year}</text>
          </g>
        )}
      </svg>
      <div className="atlas__legend-land">
        <span><i className="sw sw--spoke" /> one spoke = one 16-day MODIS window</span>
        <span><i className="sw sw--rest" /> rest: rejected by quality checks</span>
        <span>J F M … calendar guides only</span>
      </div>
    </div>
  );
}
