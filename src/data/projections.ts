/**
 * Equirectangular projection used by every map in the app and by the NASA
 * SVS 3912 frames: lon -180..180 left->right, lat 90..-90 top->bottom.
 * Map coordinates are expressed in a fixed 360 x 180 "map unit" space
 * (1 unit = 1 degree), so pan/zoom never changes the geography.
 */
import type { GeoPosition } from './types';

export const MAP_W = 360;
export const MAP_H = 180;

export const mod = (a: number, n: number) => ((a % n) + n) % n;

/** Wrap any longitude into [-180, 180). */
export const wrapLon = (lon: number) => mod(lon + 180, 360) - 180;

export const clampLat = (lat: number) => Math.max(-90, Math.min(90, lat));

export function geoToMap(p: GeoPosition): { x: number; y: number } {
  return { x: wrapLon(p.lon) + 180, y: 90 - p.lat };
}

/** Inverse projection. Longitude is wrapped, latitude clamped. */
export function mapToGeo(x: number, y: number): GeoPosition {
  return { lat: clampLat(90 - y), lon: wrapLon(x - 180) };
}

export function formatLat(lat: number, digits = 1) {
  return `${Math.abs(lat).toFixed(digits)}°${lat >= 0 ? 'N' : 'S'}`;
}
export function formatLon(lon: number, digits = 1) {
  return `${Math.abs(lon).toFixed(digits)}°${lon >= 0 ? 'E' : 'W'}`;
}
export const formatGeo = (p: GeoPosition, digits = 1) => `${formatLat(p.lat, digits)} ${formatLon(p.lon, digits)}`;
