/** Display formatting shared by panels. Tabular, fixed precision, honest units. */
import { formatLat, formatLon } from '../domain/projection';
import type { SourcePosition } from '../domain/sourceTypes';
import { BEAT_SECONDS } from '../domain/sonification';

export const fmtValue = (v: number) => v.toFixed(3);
export const fmtDelta = (d: number) => `${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(3)}`;
export const fmtConfidence = (c: number) => `${Math.round(c * 100)}%`;

export function fmtPosition(p: SourcePosition): string {
  if (p.lat !== undefined && p.lon !== undefined) return `${formatLat(p.lat)}, ${formatLon(p.lon)}`;
  return `image x ${Math.round(p.pixelX)}, y ${Math.round(p.pixelY)} (not geographically registered)`;
}

export function fmtPixel(p: SourcePosition): string {
  return `x ${Math.round(p.pixelX)}, y ${Math.round(p.pixelY)}`;
}

export function fmtClock(steps: number): string {
  const s = Math.max(0, steps * BEAT_SECONDS);
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}
