/** Side B — A Year in One Place: stay still, let TIME move. */
import { NORMALIZER_VERSION, PITCHES_MIDI, SCALE_LABEL } from '../audio/normalize';
import type { MusicalRule, ScientificSource } from '../data/types';

export const LAND_SOURCE: ScientificSource = {
  sourceId: 'modis-mod13q1-v061',
  provider: 'NASA/LP DAAC',
  datasetName: 'MODIS/Terra Vegetation Indices 16-Day L3 Global 250 m SIN Grid (MOD13Q1)',
  productVersion: 'Collection 6.1 (v061)',
  canonicalUrl: 'https://modis.gsfc.nasa.gov/data/dataprod/mod13.php',
  doi: '10.5067/MODIS/MOD13Q1.061',
  accessedVia: 'ORNL DAAC MODIS/VIIRS Land Product Subsets web service',
  variable: 'NDVI (250m_16_days_NDVI, scale 0.0001)',
  units: 'NDVI (unitless)',
  temporalResolution: '16-day composites (23 windows start in a calendar year)',
  spatialResolution: '250 m pixels; mean of a 9 × 9 pixel window (±1 km) around the site',
  transformNotes: [
    'Pixels accepted only with pixel reliability 0 (good) or 1 (marginal).',
    'A window counts only if at least half of its 81 pixels pass; otherwise it is a rest (cloud) or masked (snow/ice).',
    'Rejected windows are never interpolated.',
    'NDVI indicates relative greenness, not plant health on its own.',
  ],
  credit: 'Didan, K. (2021). MOD13Q1 MODIS/Terra Vegetation Indices 16-Day L3 Global 250m SIN Grid V061. NASA EOSDIS LP DAAC. Subset via ORNL DAAC.',
};

export const LAND_RULE: MusicalRule = {
  variable: 'Vegetation greenness (NDVI)',
  units: 'NDVI',
  noteCollectionMidi: [...PITCHES_MIDI],
  domainMin: 0,
  domainMax: 0.9,
  clampingPolicy: 'clamp_and_disclose',
  normalizerVersion: NORMALIZER_VERSION,
  scaleLabel: SCALE_LABEL,
  accentThreshold: 0.08,
  bassRule: 'Mean of the valid NDVI values in each block of 4 windows (about two months), one octave lower',
  accentRule: 'Change of at least 0.08 NDVI from the previous valid window',
  tempoBpm: 120,
  beatSeconds: 0.5,
};

export const LAND_COPY = {
  side: 'B',
  name: 'A Year in One Place',
  eyebrow: 'Side B / A journey through time',
  heading: ['A year', 'in one place.'],
  invitation: 'Stay still. Let the year move. What does this landscape sound like over time?',
  defaultTitle: 'Twelve months, one place',
  libraryLine: 'Stay with one landscape through the seasons. Follow its changing greenness.',
  question: 'What changes as time passes?',
  narration: 'Now stay in one place. Let the months move around you.',
};
