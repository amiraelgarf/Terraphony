/**
 * Source types — the vocabulary every other module uses.
 *
 * The central rule: a modeled temperature and an image-derived feature are
 * different quantity *kinds*. They never share a field, a unit or a label.
 */

export type SourceFidelity = 'verified-model-grid' | 'verified-visual-frame' | 'synthetic-fixture';
export type SourceVariable = 'sst_absolute_degC' | 'image_feature_normalized';
export type Units = 'degC' | 'normalized_0_1';

export type FrameRecord = {
  id: string;
  label: 'A' | 'B';
  svsId: 3912;
  frameNumber: number;
  assetUrl: string;
  imagePath: string;
  featurePath: string;
  /** null when NASA's timestamp table did not resolve this frame. */
  captureOrModelTimeUTC: string | null;
  visualProjection: 'verified-equirectangular' | 'registered-crop' | 'unregistered-image';
  geographicBounds: [number, number, number, number];
  width: number;
  height: number;
  fidelity: SourceFidelity;
  variable: SourceVariable;
  sourceCredits: string;
  sha256?: string;
};

export type GridMeta = {
  cellSize: number;
  width: number;
  height: number;
  noValue: number;
  valueScale: number;
  statusCodes: { ok: number; land: number; occluded: number };
};

export type Manifest = {
  schemaVersion: string;
  storyId: 'ocean-in-motion';
  primaryOfficialResourceId: 3912;
  sourceGallery: string;
  sourceVisual: string;
  fidelity: SourceFidelity;
  variable: SourceVariable;
  units: Units;
  featureName: string;
  interpretation: string;
  timeRangeDocumentedUTC: [string, string];
  availableFrames: FrameRecord[];
  availableComparablePairs: [string, string][];
  mapRegistrationVerified: boolean;
  registrationEvidence: Record<string, string>;
  comparability: { sameSize: boolean; pixelLandMaskAgreement: number; cellLandMaskAgreement: number; sameCamera: string; comparable: boolean };
  grid: GridMeta;
  processing: Record<string, unknown>;
  dataIntegrity: { verifiedRealData: boolean; fixture: boolean; sampledFrom: string | null };
  sourceCredits: string;
  creditsPeople: string;
  sourceFilesAndChecksums: { role: string; url: string; file: string; bytes: number; sha256: string }[];
};

/** A sampled scalar. Model SST and visual features are separate kinds. */
export type Quantity =
  | { kind: 'model-sst'; value: number; units: 'degC'; provenanceId: string }
  | {
      kind: 'visual-feature';
      value: number;
      units: 'normalized_0_1';
      featureName: string;
      confidence: number;
      provenanceId: string;
    };

export type InvalidReason = 'land' | 'masked' | 'occluded' | 'unregistered' | 'out-of-bounds' | 'missing';

export type SourcePosition = { lat?: number; lon?: number; pixelX: number; pixelY: number };

export type DataLookupResult =
  | {
      status: 'ok';
      quantity: Quantity;
      position: SourcePosition;
      cell: [number, number];
      frameId: string;
    }
  | {
      status: 'no-data';
      reason: InvalidReason;
      position: SourcePosition;
      cell: [number, number] | null;
      frameId: string;
      confidence?: number;
    };

export type ScanSample = {
  index: number;
  frameId: string;
  timeUTC: string | null;
  position: SourcePosition;
  cell: [number, number] | null;
  quantity: Quantity | null;
  invalidReason?: InvalidReason;
};

export type NoteEvent = {
  index: number;
  beat: number;
  durationBeats: number;
  note: string | null;
  /** Spatial difference from the previous valid-in-order sample (listening order). */
  delta: number | null;
  accent: boolean;
  /** Bass note for this 8-step segment (articulated on segment beats 0 and 4). */
  bassNote: string | null;
  bassValue: number | null;
  bassOnset: boolean;
  source: ScanSample;
};

export type GeoPoint = { lat: number; lon: number };

export type RoutePoint =
  | { system: 'geographic'; latitude: number; longitude: number }
  | { system: 'image'; u: number; v: number };

export type StoryRouteFile = {
  id: string;
  title: string;
  description: string;
  waypoints: [number, number][];
  sampleCount: number;
  lengthKm: number;
  accentThreshold: number;
  accentThresholdMethod: string;
  reference: Record<
    'A' | 'B',
    {
      frame: number;
      rests: number;
      notableIndex: number | null;
      notableDelta: number | null;
      samples: {
        index: number;
        lat: number;
        lon: number;
        cell: [number, number];
        status: 'ok' | 'land' | 'occluded';
        value: number | null;
        confidence: number;
      }[];
    }
  >;
};

export type LegendFile = {
  source: string;
  labelledEndpoints: Record<string, string>;
  stops: { position: number; rgb: [number, number, number] }[];
};

export type OfficialResource = { n: number; title: string; url: string; role: string };
