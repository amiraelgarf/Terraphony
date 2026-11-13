/**
 * Route geometry — equal-distance resampling in source coordinates.
 *
 * Geographic routes: cumulative great-circle (haversine) length along the
 * path as drawn on the equirectangular map, antimeridian-safe.
 * Image routes: aspect-corrected normalized image distance — never km.
 *
 * resampleGeographic() mirrors scripts/feature_lib.py:resample_geographic
 * operation-for-operation; a unit test checks they agree.
 */
import { wrapLon } from './projection';
import type { GeoPoint } from './sourceTypes';

export const EARTH_RADIUS_KM = 6371.0088;
export const DENSIFY_DEG = 0.25;
export const ROUTE_SAMPLES = 64;

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

/** [lat, lon] waypoints -> n equal-distance points + total length in km. */
export function resampleGeographic(waypoints: [number, number][], n = ROUTE_SAMPLES) {
  const pts = densify(unwrapLongitudes(waypoints));
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + haversineKm(pts[i - 1], pts[i]));
  const total = cum[cum.length - 1];
  const out: GeoPoint[] = [];
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

/** Image-space resampling: distances in normalized units scaled by aspect (width/height). */
export function resampleImage(points: { u: number; v: number }[], aspect: number, n = ROUTE_SAMPLES) {
  const cum = [0];
  for (let i = 1; i < points.length; i++) {
    const du = (points[i].u - points[i - 1].u) * aspect;
    const dv = points[i].v - points[i - 1].v;
    cum.push(cum[i - 1] + Math.hypot(du, dv));
  }
  const total = cum[cum.length - 1];
  const out: { u: number; v: number }[] = [];
  for (let k = 0; k < n; k++) {
    const target = (total * k) / (n - 1);
    let j = 1;
    while (j < cum.length - 1 && cum[j] < target) j++;
    const seg = cum[j] - cum[j - 1];
    const t = seg === 0 ? 0 : (target - cum[j - 1]) / seg;
    out.push({ u: points[j - 1].u + t * (points[j].u - points[j - 1].u), v: points[j - 1].v + t * (points[j].v - points[j - 1].v) });
  }
  return { points: out, lengthImageUnits: total };
}

/**
 * Thin a raw pointer trace: keep a point only if it is at least `minKm` from
 * the last kept one. Pointer events are therefore not 1:1 with route points.
 */
export function thinGeoTrace(trace: GeoPoint[], minKm = 40): GeoPoint[] {
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

/** A tap or a scribble shorter than this is a probe, not a route. */
export const MIN_ROUTE_KM = 150;

export function routeLengthKm(points: GeoPoint[]): number {
  const u = unwrapLongitudes(points.map((p) => [p.lat, p.lon]));
  let total = 0;
  for (let i = 1; i < u.length; i++) total += haversineKm(u[i - 1], u[i]);
  return total;
}

export function isDegenerateRoute(points: GeoPoint[]): boolean {
  return points.length < 2 || routeLengthKm(points) < MIN_ROUTE_KM;
}
