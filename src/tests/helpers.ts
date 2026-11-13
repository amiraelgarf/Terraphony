/** Test helpers: load the real exported data from public/ via the file system. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FeatureGrid } from '../domain/dataSampler';
import type { FrameRecord, Manifest, StoryRouteFile } from '../domain/sourceTypes';

const PUBLIC = resolve(__dirname, '../../public');

export const readJson = <T,>(p: string): T => JSON.parse(readFileSync(resolve(PUBLIC, p), 'utf8')) as T;
export const manifest = readJson<Manifest>('data/manifest.json');
export const storyRoute = readJson<StoryRouteFile>('data/story-route.json');

export function loadGrid(frame: FrameRecord): FeatureGrid {
  return new FeatureGrid(new Uint8Array(readFileSync(resolve(PUBLIC, frame.featurePath))), manifest.grid, frame);
}

export const frameA = manifest.availableFrames.find((f) => f.label === 'A')!;
export const frameB = manifest.availableFrames.find((f) => f.label === 'B')!;
