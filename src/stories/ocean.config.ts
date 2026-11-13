/** Side A — Ocean in Motion: a path through SPACE at one chosen day. */
import { NORMALIZER_VERSION, PITCHES_MIDI, SCALE_LABEL } from '../audio/normalize';
import type { MusicalRule, ScientificSource } from '../data/types';

export const OCEAN_SOURCE: ScientificSource = {
  sourceId: 'mur-sst-v4.1',
  provider: 'NASA/JPL',
  datasetName: 'GHRSST Level 4 MUR Global Foundation Sea Surface Temperature Analysis',
  productVersion: 'v4.1',
  canonicalUrl: 'https://podaac.jpl.nasa.gov/dataset/MUR-JPL-L4-GLOB-v4.1',
  doi: '10.5067/GHGMR-4FJ04',
  sourceVisualizationUrl: 'https://svs.gsfc.nasa.gov/3912/',
  accessedVia: 'NOAA CoastWatch ERDDAP, dataset jplMURSST41 (public mirror of the PO.DAAC product)',
  variable: 'analysed_sst (sea surface foundation temperature)',
  units: '°C',
  temporalResolution: 'daily analysis (nominal 09:00 UTC)',
  spatialResolution: '0.01° analysis, sub-sampled every 25th point (0.25°) for the web',
  transformNotes: [
    'Absolute temperature, not an anomaly.',
    'Route stops are equal great-circle distances apart.',
    'Nearest grid cell decides validity; land, lakes and sea ice (fraction ≥ 15 %) are masked and become rests.',
    'Valid stops use bilinear interpolation over valid neighbouring grid points.',
  ],
  credit: 'JPL MUR MEaSUREs Project. 2015. GHRSST Level 4 MUR Global Foundation SST Analysis. Ver. 4.1. PO.DAAC, CA, USA.',
};

export const OCEAN_RULE: MusicalRule = {
  variable: 'Sea surface temperature',
  units: '°C',
  noteCollectionMidi: [...PITCHES_MIDI],
  domainMin: -2,
  domainMax: 31,
  clampingPolicy: 'clamp_and_disclose',
  normalizerVersion: NORMALIZER_VERSION,
  scaleLabel: SCALE_LABEL,
  accentThreshold: 1.0,
  bassRule: 'Mean of the valid temperatures in each block of 4 stops, one octave lower',
  accentRule: 'Change of at least 1.0 °C from the previous valid stop',
  tempoBpm: 120,
  beatSeconds: 0.5,
};

/** Dates offered (same calendar day for the NASA picture and the numbers). */
export const OCEAN_DATES = [
  { key: 'A', label: '18 August 2007', short: 'Aug 2007', season: 'late northern summer' },
  { key: 'B', label: '6 February 2008', short: 'Feb 2008', season: 'northern winter' },
] as const;
export type OceanDateKey = (typeof OCEAN_DATES)[number]['key'];

export const OCEAN_COPY = {
  side: 'A',
  name: 'Ocean in Motion',
  eyebrow: 'Side A / A path through space',
  heading: ['A line', 'through water.'],
  invitation: 'Trace a path. The ocean will answer with a sequence of notes.',
  defaultTitle: 'Somewhere, the ocean moves',
  libraryLine: 'Choose a path through the sea. Hear its changes unfold one location at a time.',
  question: 'What changes as you travel?',
  narration: 'You chose a line across the sea. Every point along it adds another note.',
};
