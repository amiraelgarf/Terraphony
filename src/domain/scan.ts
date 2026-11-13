/**
 * Scan — sample a resampled route on one frame's feature grid.
 * Each route point becomes exactly one ScanSample (value or explicit rest).
 */
import type { FeatureGrid } from './dataSampler';
import type { GeoPoint, ScanSample } from './sourceTypes';

export function sampleRoute(points: GeoPoint[], grid: FeatureGrid): ScanSample[] {
  return points.map((p, index) => {
    const r = grid.lookupGeo(p.lat, p.lon);
    const base = {
      index,
      frameId: grid.frame.id,
      timeUTC: grid.frame.captureOrModelTimeUTC,
      position: r.position,
      cell: r.cell,
    };
    return r.status === 'ok'
      ? { ...base, quantity: r.quantity }
      : { ...base, quantity: null, invalidReason: r.reason };
  });
}

export function restShare(samples: ScanSample[]): number {
  return samples.length ? samples.filter((s) => !s.quantity).length / samples.length : 1;
}

/** Above this share of rests, the UI warns and invites a redraw. */
export const HIGH_REST_SHARE = 0.4;
