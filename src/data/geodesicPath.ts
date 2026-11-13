/**
 * Geodesic route handling: equal great-circle-distance resampling.
 *
 * A route is drawn on an equirectangular map, so between two waypoints it is
 * the straight map segment. We densify each segment (<= 0.25 deg steps),
 * measure cumulative haversine distance along it, and place N stops at equal
 * distance (first and last waypoint included). Longitudes are unwrapped so a
 * route crossing the antimeridian stays continuous.
 *
 * resampleGeographic() mirrors scripts/geo_lib.py:resample_geographic
 * operation-for-operation; a unit test checks they agree.
 */
import { wrapLon } from './projections';
import type { GeoPosition } from './types';

export const EARTH_RADIUS_KM = 6371.0088;
export const DENSIFY_DEG = 0.25;
export const ROUTE_STOPS = 24;
/** A tap or a scribble shorter than this is not a route. */
export const MIN_ROUTE_KM = 300;

const rad = (d: number) => (d * Math.PI) / 180;

export function haversineKm(a: [number, number], b: [number, number]): number {
  const la1 = rad(a[0]), lo1 = rad(a[1]), la2 = rad(b[0]), lo2 = rad(b[1]);
  const h = Math.sin((la2 - la1) / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin((lo2 - lo1) / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Make consecutive longitudes continuous across ±180°. */
export function unwrapLongitudes(points: [number, number][]): [number, number][] {
  if (points.length === 0) return [];
  const out: [number, number][] = [[points[0][0], points[0][1]]];
  for (let i = 1; i < points.length; i++) {
    let lon = points[i][1];
    const prev = out[out.length - 1][1];
    while (lon - prev > 180) lon -= 360;
    while (lon - prev < -180) lon += 360;
    out.push([points[i][0], lon]);
  }
  return out;
}

function densify(points: [number, number][]): [number, number][] {
  const dense: [number, number][] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const [la0, lo0] = points[i - 1];
    const [la1, lo1] = points[i];
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(la1 - la0), Math.abs(lo1 - lo0)) / DENSIFY_DEG));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      dense.push([la0 + t * (la1 - la0), lo0 + t * (lo1 - lo0)]);
    }
  }
  return dense;
}

/** Waypoints -> n equal-distance stops + total length (km). */
export function resampleGeographic(waypoints: GeoPosition[], n = ROUTE_STOPS) {
  const pts = densify(unwrapLongitudes(waypoints.map((p) => [p.lat, p.lon])));
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + haversineKm(pts[i - 1], pts[i]));
  const total = cum[cum.length - 1];
  const out: GeoPosition[] = [];
  for (let k = 0; k < n; k++) {
    const target = (total * k) / (n - 1);
    let j = 1;
    while (j < cum.length - 1 && cum[j] < target) j++;
    const seg = cum[j] - cum[j - 1];
    const t = seg === 0 ? 0 : (target - cum[j - 1]) / seg;
    const lat = pts[j - 1][0] + t * (pts[j][0] - pts[j - 1][0]);
    const lon = pts[j - 1][1] + t * (pts[j][1] - pts[j - 1][1]);
    out.push({ lat, lon: wrapLon(lon) });
  }
  return { points: out, lengthKm: total };
}

export function routeLengthKm(points: GeoPosition[]): number {
  const u = unwrapLongitudes(points.map((p) => [p.lat, p.lon]));
  let total = 0;
  for (let i = 1; i < u.length; i++) total += haversineKm(u[i - 1], u[i]);
  return total;
}

/**
 * Thin a raw pointer trace: keep a point only if it is at least `minKm` from
 * the last kept one, so pointer events are not 1:1 with route stops.
 */
export function thinTrace(trace: GeoPosition[], minKm = 60): GeoPosition[] {
  if (trace.length === 0) return [];
  const out = [trace[0]];
  for (const p of trace.slice(1)) {
    const last = out[out.length - 1];
    if (haversineKm([last.lat, last.lon], [p.lat, p.lon]) >= minKm) out.push(p);
  }
  const end = trace[trace.length - 1];
  if (out[out.length - 1] !== end) out.push(end);
  return out;
}

export function isDegenerateRoute(points: GeoPosition[]): boolean {
  return points.length < 2 || routeLengthKm(points) < MIN_ROUTE_KM;
}
