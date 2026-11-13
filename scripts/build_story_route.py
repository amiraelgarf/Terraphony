"""Step 4 — build the curated story route and record its reference samples.

The route is authored as a handful of geographic waypoints (the *only*
hand-chosen input).  Everything else is computed:

  * 64 equal great-circle-distance samples along the path as drawn on the map
  * the feature value / status / confidence of each sample in frames A and B
  * the accent (rhythm) threshold, from the distribution of spatial differences
  * the notable event for Scene 03, by a reproducible rule

The TypeScript app recomputes the same samples at run time; the unit test
`sourceIntegrity.test.ts` asserts both implementations agree exactly.

Usage:  python scripts/build_story_route.py
"""
import json

import numpy as np

from feature_lib import NO_VALUE, STATUS, VALUE_SCALE, geo_to_pixel, resample_geographic
from pipeline_config import CELL, FRAMES, PUBLIC_DATA, ROUTE_SAMPLES

WIDTH, HEIGHT = 2048, 1024
GW, GH = WIDTH // CELL, HEIGHT // CELL

# North through the Atlantic: Southern Ocean -> South Atlantic -> equator ->
# Sargasso Sea -> across the Gulf Stream -> Grand Banks -> Labrador Sea.
ROUTE = {
    "id": "atlantic-meridian",
    "title": "A line through the Atlantic",
    "description": "From the Southern Ocean north through the South Atlantic, across the equator, "
                   "through the Sargasso Sea and over the Gulf Stream towards the Labrador Sea.",
    "waypoints": [[-56.0, -32.0], [-30.0, -24.0], [0.0, -28.0], [26.0, -52.0],
                  [37.0, -64.0], [44.0, -51.0], [56.0, -46.0]],
}
MIN_EDGE_SEPARATION = 6   # notable event must be at least this many beats from either end


def load_grid(n):
    raw = np.fromfile(PUBLIC_DATA / "frames" / f"frame-{n}.bin", np.uint8).reshape(3, GH, GW)
    return raw[0], raw[1], raw[2]


def sample(grid, lat, lon):
    value, status, conf = grid
    x, y = geo_to_pixel(lat, lon, WIDTH, HEIGHT)
    gx = min(GW - 1, max(0, int(x // CELL)))
    gy = min(GH - 1, max(0, int(y // CELL)))
    st = int(status[gy, gx])
    v = None if st != STATUS["ok"] or value[gy, gx] == NO_VALUE else int(value[gy, gx]) / VALUE_SCALE
    return {"cell": [gx, gy], "status": [k for k, c in STATUS.items() if c == st][0],
            "value": v, "confidence": round(int(conf[gy, gx]) / 255, 3)}


def accent_threshold(grid, step_cells=3, pct=90):
    """Global, documented rhythm threshold: the 90th percentile of absolute
    feature differences between valid cells `step_cells` apart (roughly one
    route step).  Computed on frame A, applied to every route and frame."""
    value, status, _ = grid
    v = np.where(status == STATUS["ok"], value / VALUE_SCALE, np.nan)
    diffs = np.concatenate([np.abs(v[:, step_cells:] - v[:, :-step_cells]).ravel(),
                            np.abs(v[step_cells:, :] - v[:-step_cells, :]).ravel()])
    diffs = diffs[~np.isnan(diffs)]
    return float(np.percentile(diffs, pct)), int(diffs.size)


def notable_event(samples):
    """Largest finite adjacent change, away from the route ends.
    Ties resolve to the earliest index. Mirrors storyHighlights.ts."""
    best, best_i = -1.0, None
    for i in range(MIN_EDGE_SEPARATION, len(samples) - MIN_EDGE_SEPARATION):
        a, b = samples[i - 1]["value"], samples[i]["value"]
        if a is None or b is None:
            continue
        d = abs(b - a)
        if d > best + 1e-12:
            best, best_i = d, i
    return best_i, best


def main():
    points, length_km = resample_geographic(ROUTE["waypoints"], ROUTE_SAMPLES)
    grids = {k: load_grid(n) for k, n in FRAMES.items()}
    threshold, n_pairs = accent_threshold(grids["A"])

    out = {**ROUTE, "sampleCount": ROUTE_SAMPLES, "lengthKm": round(length_km, 1),
           "accentThreshold": round(threshold, 4),
           "accentThresholdMethod": f"90th percentile of |feature difference| between valid cells "
                                    f"3 cells apart in frame A ({n_pairs} pairs)",
           "reference": {}}
    for key, n in FRAMES.items():
        samples = [{"index": i, "lat": round(lat, 5), "lon": round(lon, 5), **sample(grids[key], lat, lon)}
                   for i, (lat, lon) in enumerate(points)]
        rests = sum(s["value"] is None for s in samples)
        idx, delta = notable_event(samples)
        out["reference"][key] = {"frame": n, "rests": rests, "notableIndex": idx,
                                 "notableDelta": None if idx is None else round(delta, 4),
                                 "samples": samples}
        print(f"Frame {key}: {rests} rests of {ROUTE_SAMPLES}; notable event at step {idx} (|delta|={delta:.3f})")
    print(f"Route length {length_km:.0f} km, accent threshold {threshold:.4f}")
    (PUBLIC_DATA / "story-route.json").write_text(json.dumps(out, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
