/**
 * Data sampler — reads the per-frame feature grid exported by the pipeline.
 *
 * Grid file: three uint8 planes [value | status | confidence], row-major.
 * value = round(position * valueScale) or noValue; status 0 ok, 1 land, 2 occluded.
 */
import { geoToPixel, isGeoRegistered, pixelToGeo } from './projection';
import type { DataLookupResult, FrameRecord, GridMeta, SourcePosition } from './sourceTypes';

export const FEATURE_NAME = 'Normalized palette position';

export class FeatureGrid {
  readonly value: Uint8Array;
  readonly status: Uint8Array;
  readonly confidence: Uint8Array;

  constructor(
    buffer: ArrayBuffer | Uint8Array,
    readonly meta: GridMeta,
    readonly frame: FrameRecord,
  ) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const n = meta.width * meta.height;
    if (bytes.length !== n * 3) {
      throw new Error(`Feature grid for ${frame.id} has ${bytes.length} bytes; expected ${n * 3}`);
    }
    this.value = bytes.subarray(0, n);
    this.status = bytes.subarray(n, 2 * n);
    this.confidence = bytes.subarray(2 * n, 3 * n);
  }

  /** Look up by source-image pixel coordinates. */
  lookupPixel(pixelX: number, pixelY: number): DataLookupResult {
    const { frame, meta } = this;
    const position: SourcePosition = { pixelX, pixelY };
    if (isGeoRegistered(frame)) Object.assign(position, pixelToGeo(pixelX, pixelY, frame.width, frame.height));

    if (!(pixelX >= 0 && pixelY >= 0 && pixelX <= frame.width && pixelY <= frame.height)) {
      return { status: 'no-data', reason: 'out-of-bounds', position, cell: null, frameId: frame.id };
    }
    const gx = Math.min(meta.width - 1, Math.max(0, Math.floor(pixelX / meta.cellSize)));
    const gy = Math.min(meta.height - 1, Math.max(0, Math.floor(pixelY / meta.cellSize)));
    const i = gy * meta.width + gx;
    const st = this.status[i];
    const conf = this.confidence[i] / 255;
    const cell: [number, number] = [gx, gy];

    if (st === meta.statusCodes.land) return { status: 'no-data', reason: 'land', position, cell, frameId: frame.id };
    if (st !== meta.statusCodes.ok || this.value[i] === meta.noValue) {
      return { status: 'no-data', reason: 'occluded', position, cell, frameId: frame.id, confidence: conf };
    }
    return {
      status: 'ok',
      position,
      cell,
      frameId: frame.id,
      quantity: {
        kind: 'visual-feature',
        value: this.value[i] / meta.valueScale,
        units: 'normalized_0_1',
        featureName: FEATURE_NAME,
        confidence: conf,
        provenanceId: `${frame.id}/cell-${gx}-${gy}`,
      },
    };
  }

  /** Look up by geography — only allowed on a registered frame. */
  lookupGeo(lat: number, lon: number): DataLookupResult {
    const { frame } = this;
    if (!isGeoRegistered(frame)) {
      return { status: 'no-data', reason: 'unregistered', position: { pixelX: NaN, pixelY: NaN }, cell: null, frameId: frame.id };
    }
    const { x, y } = geoToPixel(lat, lon, frame.width, frame.height);
    const r = this.lookupPixel(x, y);
    // keep the caller's exact coordinates rather than the round-tripped ones
    r.position.lat = lat;
    r.position.lon = lon;
    return r;
  }
}
