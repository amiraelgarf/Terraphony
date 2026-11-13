/**
 * Projection — source pixel <-> geography, and source <-> screen.
 *
 * Geography is only ever derived when the frame's registration is verified
 * (FrameRecord.visualProjection === 'verified-equirectangular'). Otherwise the
 * app speaks in image coordinates.
 */
import type { FrameRecord, GeoPoint } from './sourceTypes';

/** Python-style modulo (always non-negative), so lon wrapping matches the pipeline. */
export function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

export function wrapLon(lon: number): number {
  return mod(lon + 180, 360) - 180;
}

export function isGeoRegistered(frame: Pick<FrameRecord, 'visualProjection'>): boolean {
  return frame.visualProjection === 'verified-equirectangular';
}

/** Equirectangular: lon -180..180 left→right, lat 90..-90 top→bottom. Mirrors feature_lib.geo_to_pixel. */
export function geoToPixel(lat: number, lon: number, width: number, height: number) {
  const l = wrapLon(lon);
  return { x: ((l + 180) / 360) * width, y: ((90 - lat) / 180) * height };
}

export function pixelToGeo(x: number, y: number, width: number, height: number): GeoPoint {
  return { lat: 90 - (y / height) * 180, lon: wrapLon((x / width) * 360 - 180) };
}

/** Viewport: how source pixels are drawn on screen (zoom + pan on top of a base fit). */
export type Viewport = { baseScale: number; zoom: number; panX: number; panY: number };

export function sourceToScreen(p: { x: number; y: number }, v: Viewport) {
  const s = v.baseScale * v.zoom;
  return { x: p.x * s + v.panX, y: p.y * s + v.panY };
}

export function screenToSource(p: { x: number; y: number }, v: Viewport) {
  const s = v.baseScale * v.zoom;
  return { x: (p.x - v.panX) / s, y: (p.y - v.panY) / s };
}

/** Keep the image covering the stage: no empty gutters when zoomed in. */
export function clampViewport(v: Viewport, stageW: number, stageH: number, srcW: number, srcH: number): Viewport {
  const zoom = Math.min(8, Math.max(1, v.zoom));
  const w = srcW * v.baseScale * zoom;
  const h = srcH * v.baseScale * zoom;
  const panX = Math.min(0, Math.max(stageW - w, v.panX));
  const panY = Math.min(0, Math.max(stageH - h, v.panY));
  return { ...v, zoom, panX, panY };
}

/** Zoom about a screen-space anchor so the point under the pointer stays put. */
export function zoomAbout(v: Viewport, factor: number, anchor: { x: number; y: number }): Viewport {
  const before = screenToSource(anchor, v);
  const zoom = Math.min(8, Math.max(1, v.zoom * factor));
  const s = v.baseScale * zoom;
  return { ...v, zoom, panX: anchor.x - before.x * s, panY: anchor.y - before.y * s };
}

export function formatLat(lat: number): string {
  return `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}`;
}
export function formatLon(lon: number): string {
  return `${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`;
}
