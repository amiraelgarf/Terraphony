/**
 * Data contracts shared by every story, the music mapper, the press and the
 * exports. Shapes follow section 9 of the Earth Records brief.
 */

export type StoryId = 'ocean' | 'vegetation' | 'fire' | 'gedi';
export type SampleStatus = 'valid' | 'missing' | 'masked' | 'quality_rejected';
export type InstrumentId = 'glass' | 'wood' | 'felt';

/** degrees, WGS84 */
export type GeoPosition = { lat: number; lon: number };

export type ScientificSource = {
  sourceId: string;
  provider: string;
  datasetName: string;
  productVersion: string;
  canonicalUrl: string;
  doi?: string;
  sourceVisualizationUrl?: string;
  accessedVia: string;
  variable: string;
  units: string;
  temporalResolution: string;
  spatialResolution: string;
  transformNotes: string[];
  credit: string;
};

export type ObservationSample = {
  id: string;
  sequenceIndex: number;
  position?: GeoPosition;
  areaId?: string;
  timeStart: string; // ISO 8601 UTC
  timeEnd: string;
  status: SampleStatus;
  /** why a sample is not valid: 'land' | 'lake' | 'sea_ice' | 'cloud' | 'snow_ice' | ... */
  reason?: string;
  numericValue: number | null;
  sourceId: string;
  qualityCode?: string | number;
  uncertainty?: number;
  /** free-form technical detail shown in the inspector's expanded view */
  detail?: Record<string, string | number | null>;
};

export type MusicalRule = {
  variable: string;
  units: string;
  noteCollectionMidi: number[];
  domainMin: number;
  domainMax: number;
  clampingPolicy: 'clamp_and_disclose';
  normalizerVersion: string;
  scaleLabel: string;
  accentThreshold: number;
  bassRule: string;
  accentRule: string;
  tempoBpm: number;
  beatSeconds: number;
};

export type SupportingEvent = {
  instrumentId: 'bass' | 'accent' | 'cadence';
  midiNote?: number;
  midiNotes?: number[];
  velocity?: number;
  /** true when this voice is artistic (not data-encoding) */
  artistic?: boolean;
};

export type MusicEvent = {
  sequenceIndex: number;
  atBeat: number;
  durationBeats: number;
  midiNote: number | null; // null => rest
  supportingEvents: SupportingEvent[];
  sampleId: string;
  /** arrangement section 1..4 (lead / +bass / +accents / resolve) */
  section: 1 | 2 | 3 | 4;
  /** true if |change| from the previous valid sample >= threshold (shown even when the accent voice is silent) */
  changeMarked: boolean;
  clamped: boolean;
};

export type RecordGeometry = {
  kind: 'route' | 'area' | 'location';
  points?: GeoPosition[];
  waypoints?: GeoPosition[];
  areaId?: string;
  lengthKm?: number;
  label: string;
};

export type EarthRecord = {
  schemaVersion: '1.0';
  recordId: string;
  title: string;
  story: StoryId;
  source: ScientificSource;
  visualContext?: { label: string; url: string; note: string };
  geometry: RecordGeometry;
  timeWindow: { label: string; start: string; end: string };
  observations: ObservationSample[];
  musicalRule: MusicalRule;
  instrumentPaletteId: InstrumentId;
  events: MusicEvent[];
  narrativeText: string[];
  visualStyleId: string;
  createdAt: string;
  sourceStatus: 'verified_observations' | 'synthetic_demo';
  credits: string[];
};
