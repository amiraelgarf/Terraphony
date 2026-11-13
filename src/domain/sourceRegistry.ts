/**
 * Source registry — loads the manifest and every asset it names, validates
 * them, and exposes one immutable bundle to the app.
 */
import { FeatureGrid } from './dataSampler';
import type { FrameRecord, LegendFile, Manifest, OfficialResource, StoryRouteFile } from './sourceTypes';

export type Registry = {
  manifest: Manifest;
  frames: FrameRecord[];
  grids: Map<string, FeatureGrid>;
  route: StoryRouteFile;
  legend: LegendFile;
  sources: OfficialResource[];
  imageUrl: (frame: FrameRecord) => string;
};

export class SourceError extends Error {}

/** Structural checks on the manifest; throws SourceError with a human-readable reason. */
export function validateManifest(m: Manifest): void {
  if (m.schemaVersion !== '2.0') throw new SourceError(`Unsupported manifest schema ${m.schemaVersion}`);
  if (m.primaryOfficialResourceId !== 3912) throw new SourceError('Manifest is not for NASA SVS 3912');
  if (!m.availableFrames?.length) throw new SourceError('Manifest lists no frames');
  for (const f of m.availableFrames) {
    if (f.variable !== m.variable) throw new SourceError(`Frame ${f.id} quantity differs from the manifest`);
    if (m.fidelity === 'verified-visual-frame' && f.variable !== 'image_feature_normalized') {
      throw new SourceError('Visual-frame fidelity must carry an image feature, never a temperature');
    }
  }
  if (m.variable === 'image_feature_normalized' && m.units !== 'normalized_0_1') throw new SourceError('Image features must be normalized_0_1');
  if (m.dataIntegrity.fixture && m.fidelity !== 'synthetic-fixture') throw new SourceError('Fixture data must be labelled synthetic-fixture');
}

export async function loadRegistry(base: string = import.meta.env.BASE_URL): Promise<Registry> {
  const url = (p: string) => `${base.replace(/\/?$/, '/')}${p}`;
  const json = async <T,>(p: string): Promise<T> => {
    const r = await fetch(url(p));
    if (!r.ok) throw new SourceError(`Could not load ${p} (HTTP ${r.status})`);
    return r.json() as Promise<T>;
  };
  const [manifest, route, legend, sources] = await Promise.all([
    json<Manifest>('data/manifest.json'),
    json<StoryRouteFile>('data/story-route.json'),
    json<LegendFile>('data/legend.json'),
    json<OfficialResource[]>('data/sources.json'),
  ]);
  validateManifest(manifest);

  const grids = new Map<string, FeatureGrid>();
  await Promise.all(
    manifest.availableFrames.map(async (f) => {
      const r = await fetch(url(f.featurePath));
      if (!r.ok) throw new SourceError(`Feature grid for frame ${f.frameNumber} is missing`);
      grids.set(f.id, new FeatureGrid(await r.arrayBuffer(), manifest.grid, f));
    }),
  );
  return { manifest, frames: manifest.availableFrames, grids, route, legend, sources, imageUrl: (f) => url(f.imagePath) };
}

export function formatUTC(iso: string | null): string {
  if (!iso) return 'timestamp not verified';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}
