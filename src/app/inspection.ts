/**
 * Inspection model — what "Behind the sound" shows for the current selection.
 * Pure derivation: the inspector component only renders this.
 */
import { comparePoint, type PointComparison } from '../domain/compare';
import { explainMapping, type MappingExplanation } from '../domain/sonification';
import type { Registry } from '../domain/sourceRegistry';
import type { FrameRecord, GeoPoint, InvalidReason, NoteEvent, Quantity, SourcePosition } from '../domain/sourceTypes';
import type { Derived } from './derive';
import type { AppState, FrameKey } from './state';

export type Reading = {
  frameKey: FrameKey;
  frame: FrameRecord;
  position: SourcePosition;
  cell: [number, number] | null;
  quantity: Quantity | null;
  reason?: InvalidReason;
  mapping: MappingExplanation | null;
  event?: NoteEvent;
};

export type Inspection =
  | { kind: 'none' }
  | { kind: 'step'; index: number; total: number; reading: Reading; other: Reading | null; comparison: PointComparison | null }
  | { kind: 'probe'; reading: Reading; other: Reading | null; comparison: PointComparison | null }
  | { kind: 'spatial'; a: Reading | null; b: Reading | null; comparison: PointComparison | null };

function readPoint(registry: Registry, derived: Derived, key: FrameKey, p: GeoPoint): Reading {
  const frame = derived.frames[key];
  const r = registry.grids.get(frame.id)!.lookupGeo(p.lat, p.lon);
  const quantity = r.status === 'ok' ? r.quantity : null;
  return {
    frameKey: key, frame, position: r.position, cell: r.cell, quantity,
    reason: r.status === 'no-data' ? r.reason : undefined,
    mapping: quantity ? explainMapping(quantity.value, derived.profile) : null,
  };
}

function readStep(derived: Derived, key: FrameKey, index: number): Reading | null {
  const scan = derived.scans[key];
  const s = scan.samples[index];
  if (!s) return null;
  return {
    frameKey: key, frame: derived.frames[key], position: s.position, cell: s.cell, quantity: s.quantity,
    reason: s.invalidReason, mapping: s.quantity ? explainMapping(s.quantity.value, derived.profile) : null, event: scan.events[index],
  };
}

export function inspect(state: AppState, derived: Derived, registry: Registry): Inspection {
  const other: FrameKey = state.frameKey === 'A' ? 'B' : 'A';
  const temporal = derived.comparability.ok && ((state.route === 'compare' && state.compareMode === 'temporal') || (state.route === 'story' && state.chapter === 'contrast'));

  if (state.route === 'compare' && state.compareMode === 'spatial') {
    const a = state.spatial.A ? readPoint(registry, derived, state.frameKey, state.spatial.A) : null;
    const b = state.spatial.B ? readPoint(registry, derived, state.frameKey, state.spatial.B) : null;
    return { kind: 'spatial', a, b, comparison: a && b ? comparePoint(a.quantity, b.quantity, derived.profile) : null };
  }
  const sel = state.selection;
  if (!sel) return { kind: 'none' };

  const pair = (reading: Reading, otherReading: Reading | null) => {
    if (!temporal || !otherReading) return { other: null, comparison: null };
    const [a, b] = reading.frameKey === 'A' ? [reading, otherReading] : [otherReading, reading];
    return { other: otherReading, comparison: comparePoint(a.quantity, b.quantity, derived.profile) };
  };

  if (sel.kind === 'probe') {
    const reading = readPoint(registry, derived, state.frameKey, sel.point);
    return { kind: 'probe', reading, ...pair(reading, temporal ? readPoint(registry, derived, other, sel.point) : null) };
  }
  const reading = readStep(derived, state.frameKey, sel.index);
  if (!reading) return { kind: 'none' };
  return { kind: 'step', index: sel.index, total: derived.routePoints.length, reading, ...pair(reading, temporal ? readStep(derived, other, sel.index) : null) };
}
