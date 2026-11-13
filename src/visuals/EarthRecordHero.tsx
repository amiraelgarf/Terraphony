/**
 * The Earth-record sculpture on the invitation screen.
 *
 * A pressed disc with real Natural Earth coastlines engraved on its label
 * (orthographic globe, slowly turning), fine grooves, an atlas scale of
 * bearings around the rim and a tonearm. Purely artistic: it shows no data.
 *
 * Motion (all skipped with reduced motion):
 *   idle     globe turns 4°/s, disc breathes (28 s)
 *   nudge    hover/focus on the primary action lifts the needle toward the groove (250 ms)
 *   leaving  needle descends (400 ms) -> the gold ring unrolls into a line (700 ms) -> iris opens (600 ms)
 */
import { geoGraticule10, geoOrthographic, geoPath } from 'd3-geo';
import { useEffect, useMemo, useRef, useState } from 'react';
import { feature } from 'topojson-client';
import type { FeatureCollection } from 'geojson';
import type { Topology } from 'topojson-specification';
import landTopo from 'world-atlas/land-110m.json';

const LAND = feature(landTopo as unknown as Topology, (landTopo as unknown as Topology).objects.land) as unknown as FeatureCollection;
const GRATICULE = geoGraticule10();

const C = 300;
const R_GLOBE = 132;
const R_RING = 168;

export function EarthRecordHero({ leaving, nudge, reducedMotion }: { leaving: boolean; nudge: boolean; reducedMotion: boolean }) {
  const [rot, setRot] = useState(-20);
  const raf = useRef(0);

  useEffect(() => {
    if (reducedMotion) return;
    let last = performance.now();
    const tick = (t: number) => {
      if (t - last >= 33) {
        setRot((r) => r + ((t - last) / 1000) * 4);
        last = t;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [reducedMotion]);

  const { land, grat, sphere } = useMemo(() => {
    const proj = geoOrthographic().scale(R_GLOBE).translate([C, C]).rotate([rot, -18, 0]).clipAngle(90);
    const path = geoPath(proj);
    return { land: path(LAND) ?? '', grat: path(GRATICULE) ?? '', sphere: path({ type: 'Sphere' }) ?? '' };
  }, [rot]);

  const grooves = useMemo(() => Array.from({ length: 46 }, (_, i) => ({ r: 190 + i * 2.25, o: 0.05 + ((i * 37) % 11) / 90 })), []);
  const ticks = useMemo(() => Array.from({ length: 72 }, (_, i) => i * 5), []);

  return (
    <div className={`hero-object${leaving ? ' is-leaving' : ''}${nudge ? ' is-nudged' : ''}`} aria-hidden="true">
      <div className="hero-object__orbit" />
      <div className="hero-object__orbit hero-object__orbit--2" />
      <svg viewBox="0 0 600 600" className="hero-object__disc">
        <defs>
          <radialGradient id="hero-vinyl" cx="45%" cy="40%" r="70%">
            <stop offset="0" stopColor="#24413f" />
            <stop offset="0.65" stopColor="#0b1b1e" />
            <stop offset="1" stopColor="#061215" />
          </radialGradient>
          <radialGradient id="hero-sea" cx="38%" cy="34%" r="75%">
            <stop offset="0" stopColor="#3f6c68" />
            <stop offset="0.75" stopColor="#163639" />
            <stop offset="1" stopColor="#0d2427" />
          </radialGradient>
          <linearGradient id="hero-sheen" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0.3" stopColor="#f6e2bb" stopOpacity="0" />
            <stop offset="0.5" stopColor="#f6e2bb" stopOpacity="0.16" />
            <stop offset="0.7" stopColor="#f6e2bb" stopOpacity="0" />
          </linearGradient>
        </defs>
        <circle cx={C} cy={C} r={296} fill="url(#hero-vinyl)" />
        {grooves.map((g, i) => (
          <circle key={i} cx={C} cy={C} r={g.r} fill="none" stroke="#e8d2a8" strokeOpacity={g.o} strokeWidth={0.6} />
        ))}
        <circle cx={C} cy={C} r={296} fill="url(#hero-sheen)" className="hero-object__sheen" />
        <g className="hero-object__ticks">
          {ticks.map((d) => {
            const a = (d * Math.PI) / 180;
            const long = d % 30 === 0;
            const r0 = 286, r1 = long ? 274 : 280;
            return <line key={d} x1={C + Math.cos(a) * r0} y1={C + Math.sin(a) * r0} x2={C + Math.cos(a) * r1} y2={C + Math.sin(a) * r1} stroke="#e7cfa4" strokeOpacity={long ? 0.6 : 0.3} strokeWidth={long ? 1.1 : 0.7} />;
          })}
        </g>
        {/* the gold line that becomes every route */}
        <circle className="hero-object__ring" cx={C} cy={C} r={R_RING} fill="none" stroke="#e7b276" strokeWidth={2} strokeDasharray={`${2 * Math.PI * R_RING}`} />
        <line className="hero-object__line" x1={C - R_RING} y1={C} x2={C + R_RING} y2={C} stroke="#e7b276" strokeWidth={2} />
        <g className="hero-object__globe">
          <path d={sphere} fill="url(#hero-sea)" />
          <path d={grat} fill="none" stroke="#e9dcc0" strokeOpacity={0.14} strokeWidth={0.6} />
          <path d={land} fill="#c9ad7d" fillOpacity={0.92} stroke="#f2e2bf" strokeOpacity={0.5} strokeWidth={0.5} />
          <path d={sphere} fill="none" stroke="#e7cfa4" strokeOpacity={0.55} strokeWidth={1} />
          <circle cx={C} cy={C} r={5} fill="#0b1b1e" stroke="#e7cfa4" strokeWidth={1.2} />
        </g>
      </svg>
      <div className="hero-object__arm">
        <span className="hero-object__pivot" />
        <span className="hero-object__head" />
      </div>
      <div className="hero-object__iris" />
    </div>
  );
}
