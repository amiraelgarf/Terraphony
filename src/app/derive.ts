/**
 * Derived data — everything computed from (registry, state). Pure and memoised:
 * the active route, its 64 samples on both frames, the note events, the
 * playable program and the comparability verdict.
 */
import { useMemo } from 'react';
import { checkTemporalComparable, type Comparability } from '../domain/compare';
import { resampleGeographic, routeLengthKm } from '../domain/routeGeometry';
import { restShare, sampleRoute } from '../domain/scan';
import {
  VISUAL_FEATURE_PROFILE, abProgram, buildEvents, excerptProgram, routeProgram, type MappingProfile, type Program,
} from '../domain/sonification';
import type { Registry } from '../domain/sourceRegistry';
import type { FrameRecord, GeoPoint, NoteEvent, ScanSample } from '../domain/sourceTypes';
import { findNotableEvent } from '../domain/storyHighlights';
import type { AppState, FrameKey, ProgramSpec } from './state';

export type Scan = { samples: ScanSample[]; events: NoteEvent[]; notable: { index: number; delta: number } | null; restShare: number };

export type Derived = {
  profile: MappingProfile;
  frames: Record<FrameKey, FrameRecord>;
  frameKeyOf: (frameId: string | null) => FrameKey | null;
  routeLabel: string;
  routePoints: GeoPoint[];
  routeKm: number;
  scans: Record<FrameKey, Scan>;
  storyNotable: number;
  comparability: Comparability;
  buildProgram: (spec: ProgramSpec) => Program;
};

export function useDerived(registry: Registry, state: AppState): Derived {
  const frames = useMemo(() => {
    const A = registry.frames.find((f) => f.label === 'A')!;
    const B = registry.frames.find((f) => f.label === 'B') ?? A;
    return { A, B };
  }, [registry]);

  const storyPoints = useMemo(() => resampleGeographic(registry.route.waypoints, registry.route.sampleCount).points, [registry]);

  const useDrawn = state.route !== 'story' && state.routeSource === 'drawn' && state.drawnRoute !== null;
  const reversed = state.route !== 'story' && state.reversed;

  const routePoints = useMemo(() => {
    const base = useDrawn ? resampleGeographic(state.drawnRoute!.map((p) => [p.lat, p.lon] as [number, number]), registry.route.sampleCount).points : storyPoints;
    return reversed ? [...base].reverse() : base;
  }, [useDrawn, state.drawnRoute, storyPoints, reversed, registry]);

  const scans = useMemo(() => {
    const cfg = { profile: VISUAL_FEATURE_PROFILE, accentThreshold: registry.route.accentThreshold };
    const make = (f: FrameRecord): Scan => {
      const samples = sampleRoute(routePoints, registry.grids.get(f.id)!);
      return { samples, events: buildEvents(samples, cfg), notable: findNotableEvent(samples), restShare: restShare(samples) };
    };
    return { A: make(frames.A), B: make(frames.B) };
  }, [routePoints, frames, registry]);

  // The story's notable event always comes from the curated route on frame A.
  const storyNotable = useMemo(() => {
    const samples = sampleRoute(storyPoints, registry.grids.get(frames.A.id)!);
    return findNotableEvent(samples)?.index ?? Math.floor(storyPoints.length / 2);
  }, [storyPoints, frames, registry]);

  const comparability = useMemo(() => checkTemporalComparable(registry.manifest, frames.A, frames.B), [registry, frames]);

  return useMemo(() => {
    const frameKeyOf = (id: string | null): FrameKey | null => (id === frames.A.id ? 'A' : id === frames.B.id ? 'B' : null);
    const buildProgram = (spec: ProgramSpec): Program => {
      switch (spec.kind) {
        case 'route':
          return routeProgram(`route-${spec.frameKey}${spec.staged ? '-staged' : ''}`, scans[spec.frameKey].events, frames[spec.frameKey].id, spec.staged);
        case 'ab':
          return abProgram('ab', scans.A.events, frames.A.id, scans.B.events, frames.B.id, spec.start, spec.length);
        case 'excerpt':
          return excerptProgram(`excerpt-${spec.center}`, scans[spec.frameKey].events, frames[spec.frameKey].id, spec.center);
      }
    };
    return {
      profile: VISUAL_FEATURE_PROFILE,
      frames,
      frameKeyOf,
      routeLabel: useDrawn ? (reversed ? 'Your route (reversed)' : 'Your route') : reversed ? `${registry.route.title} (reversed)` : registry.route.title,
      routePoints,
      routeKm: useDrawn ? routeLengthKm(state.drawnRoute!) : registry.route.lengthKm,
      scans,
      storyNotable,
      comparability,
      buildProgram,
    };
  }, [frames, scans, routePoints, storyNotable, comparability, useDrawn, reversed, registry, state.drawnRoute]);
}
