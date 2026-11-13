/**
 * EarthRecord recipe — the portable, reproducible object behind every record.
 *
 * buildRecord()  observations + rule + choices -> EarthRecord (events derived here)
 * toRecipeJson() serialise (stable key order, pretty printed)
 * parseRecipe()  validate an imported recipe and RE-DERIVE its events from the
 *                stored observations + rule, refusing recipes whose stored
 *                events disagree (so a recipe cannot smuggle in invented notes).
 */
import { buildEvents, eventHash } from '../audio/musicMapper';
import type { EarthRecord, InstrumentId, MusicalRule, ObservationSample, RecordGeometry, ScientificSource, StoryId } from '../data/types';

export type RecordInput = {
  title: string;
  story: StoryId;
  source: ScientificSource;
  visualContext?: EarthRecord['visualContext'];
  geometry: RecordGeometry;
  timeWindow: EarthRecord['timeWindow'];
  observations: ObservationSample[];
  rule: MusicalRule;
  instrument: InstrumentId;
  narrativeText: string[];
  createdAt?: string;
  credits: string[];
};

export const VISUAL_STYLE: Record<StoryId, string> = {
  ocean: 'contour-route-v1',
  vegetation: 'growth-rings-v1',
  fire: 'document-v1',
  gedi: 'transect-v1',
};

export function buildRecord(input: RecordInput): EarthRecord {
  const events = buildEvents(input.observations, input.rule);
  const createdAt = input.createdAt ?? new Date().toISOString();
  const hash = eventHash(events);
  return {
    schemaVersion: '1.0',
    recordId: `er-${input.story}-${hash}-${createdAt.replace(/\D/g, '').slice(0, 14)}`,
    title: input.title.trim() || 'Untitled Earth Record',
    story: input.story,
    source: input.source,
    visualContext: input.visualContext,
    geometry: input.geometry,
    timeWindow: input.timeWindow,
    observations: input.observations,
    musicalRule: input.rule,
    instrumentPaletteId: input.instrument,
    events,
    narrativeText: input.narrativeText,
    visualStyleId: VISUAL_STYLE[input.story],
    createdAt,
    sourceStatus: 'verified_observations',
    credits: input.credits,
  };
}

/** Catalogue number printed on the sleeve, e.g. "ER-A-3F2C". Deterministic. */
export function catalogueNumber(r: EarthRecord) {
  const side = r.story === 'ocean' ? 'A' : r.story === 'vegetation' ? 'B' : 'C';
  return `ER-${side}-${eventHash(r.events).slice(0, 4).toUpperCase()}`;
}

export function toRecipeJson(r: EarthRecord): string {
  return JSON.stringify({ ...r, $schema: 'earth-records.recipe.v1' }, null, 2);
}

export class RecipeError extends Error {}

export function parseRecipe(text: string): EarthRecord {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new RecipeError('This file isn’t an Earth Records record file. Choose a .json file saved from a record page.');
  }
  const r = raw as Partial<EarthRecord>;
  if (!r || r.schemaVersion !== '1.0') throw new RecipeError('This file isn’t an Earth Records record file, or it was made by a different version.');
  if (r.story !== 'ocean' && r.story !== 'vegetation') throw new RecipeError('Only ocean and land records can be opened.');
  if (!Array.isArray(r.observations) || !r.musicalRule || !r.source || !r.geometry || !r.timeWindow) throw new RecipeError('This record file is incomplete, so it can’t be opened.');
  if (r.sourceStatus !== 'verified_observations') throw new RecipeError('This record file wasn’t made from verified NASA measurements, so it can’t be opened.');
  if (!['glass', 'wood', 'felt'].includes(r.instrumentPaletteId as string)) throw new RecipeError('This record file uses a sound this app doesn’t know.');
  for (const o of r.observations) {
    if (o.status === 'valid' && typeof o.numericValue !== 'number') throw new RecipeError('This record file has been changed, so its notes can’t be trusted. It wasn’t opened.');
    if (o.status !== 'valid' && o.numericValue !== null) throw new RecipeError('This record file has been changed, so its notes can’t be trusted. It wasn’t opened.');
  }
  const events = buildEvents(r.observations, r.musicalRule as MusicalRule);
  if (Array.isArray(r.events) && eventHash(r.events) !== eventHash(events)) {
    throw new RecipeError('This record file has been changed, so its notes can’t be trusted. It wasn’t opened.');
  }
  return { ...(r as EarthRecord), events };
}

export function recipeFileName(r: EarthRecord, ext: string) {
  const slug = r.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'earth-record';
  return `${slug}-${catalogueNumber(r).toLowerCase()}.${ext}`;
}
