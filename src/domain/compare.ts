/**
 * Compare — decides whether two sources may be compared, and how a single
 * point differs between them. Never computes a difference it cannot justify.
 */
import { explainMapping, type MappingProfile } from './sonification';
import type { FrameRecord, Manifest, Quantity } from './sourceTypes';

export type Comparability = { ok: true } | { ok: false; reason: string };

export function checkTemporalComparable(manifest: Manifest, a: FrameRecord | undefined, b: FrameRecord | undefined): Comparability {
  if (!a || !b) return { ok: false, reason: 'Two frames are required.' };
  if (a.id === b.id) return { ok: false, reason: 'Frame A and frame B are the same frame.' };
  if (a.variable !== b.variable) return { ok: false, reason: 'The two frames carry different quantities.' };
  if (a.fidelity !== b.fidelity) return { ok: false, reason: 'The two frames have different fidelity levels.' };
  if (a.fidelity === 'synthetic-fixture') return { ok: false, reason: 'Synthetic fixtures cannot support a comparison claim.' };
  if (a.width !== b.width || a.height !== b.height) return { ok: false, reason: 'The frames differ in size.' };
  if (a.visualProjection !== b.visualProjection || a.visualProjection === 'unregistered-image') {
    return { ok: false, reason: 'The frames are not registered to the same projection.' };
  }
  if (!a.captureOrModelTimeUTC || !b.captureOrModelTimeUTC) return { ok: false, reason: 'A frame lacks a verified timestamp.' };
  const listed = manifest.availableComparablePairs.some(([x, y]) => (x === a.id && y === b.id) || (x === b.id && y === a.id));
  if (!listed) return { ok: false, reason: 'This pair did not pass the alignment validation.' };
  return { ok: true };
}

export type PointComparison =
  | { comparable: false; reason: string }
  | {
      comparable: true;
      valueA: number;
      valueB: number;
      delta: number; // B − A, in the quantity's own units
      units: Quantity['units'];
      noteA: string;
      noteB: string;
      sameNote: boolean;
    };

export function comparePoint(qa: Quantity | null, qb: Quantity | null, profile: MappingProfile): PointComparison {
  if (!qa || !qb) return { comparable: false, reason: 'One side has no usable source data here, so no difference is computed.' };
  if (qa.kind !== qb.kind || qa.units !== qb.units) return { comparable: false, reason: 'The two values are different kinds of quantity.' };
  const ma = explainMapping(qa.value, profile);
  const mb = explainMapping(qb.value, profile);
  if (!ma || !mb) return { comparable: false, reason: 'A value could not be mapped.' };
  return { comparable: true, valueA: qa.value, valueB: qb.value, delta: qb.value - qa.value, units: qa.units, noteA: ma.note, noteB: mb.note, sameNote: ma.note === mb.note };
}
