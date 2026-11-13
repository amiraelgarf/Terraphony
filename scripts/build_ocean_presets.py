"""Ocean step 4 — curated suggested routes + reference samples.

Each preset is a list of [lat, lon] waypoints (the only hand-authored input).
For every preset and date we resample to N equal great-circle-distance stops and
sample the MUR grid with the SAME rule the browser uses (src/data/adapters/murSstAdapter.ts):

  * nearest grid cell decides status: land / lake / sea ice -> masked, no value -> missing
  * otherwise bilinear interpolation over the valid neighbours of the 2x2 cell,
    weights renormalised if some neighbours are invalid

The results are written as reference values so a unit test can prove that
the TypeScript sampler reproduces Python exactly.

Output: public/data/ocean/presets.json
Usage:  python scripts/build_ocean_presets.py
"""
import json
import math

import numpy as np

from geo_lib import resample_geographic
from pipeline_config import (OCEAN_ACCENT_C, OCEAN_DATES, OCEAN_DOMAIN_C, PITCHES_MIDI, PUBLIC_DATA)

N_STOPS = 24
VALID_MIN = -3000

PRESETS = [
    {"id": "gulf-stream", "name": "Florida Strait to the Norwegian Sea",
     "note": "Roughly follows where the Gulf Stream and North Atlantic Current are usually mapped.",
     "waypoints": [[25.2, -79.9], [31.0, -79.2], [35.2, -74.6], [38.6, -66.0], [41.4, -52.0],
                   [46.0, -38.0], [51.5, -24.0], [57.5, -11.5], [63.0, 2.0]]},
    {"id": "equatorial-pacific", "name": "Across the equatorial Pacific",
     "note": "From off the Galapagos westward to the western Pacific near New Guinea.",
     "waypoints": [[-0.5, -92.0], [-0.5, -120.0], [0.0, -150.0], [0.0, 180.0], [0.0, 160.0], [-1.0, 148.0]]},
    {"id": "agulhas", "name": "Around the Cape of Good Hope",
     "note": "From the Mozambique Channel down the African coast and into the South Atlantic.",
     "waypoints": [[-20.0, 41.0], [-27.0, 34.5], [-33.0, 29.0], [-36.5, 22.0], [-36.0, 16.0],
                   [-32.0, 13.0], [-24.0, 9.0]]},
]


def load_grid():
    meta = json.loads((PUBLIC_DATA / "ocean" / "grid.json").read_text(encoding="utf-8"))
    grids = {}
    for key, d in meta["dates"].items():
        raw = (PUBLIC_DATA.parent / d["file"]).read_bytes()
        grids[key] = np.frombuffer(raw, dtype="<i2").reshape(meta["height"], meta["width"])
    return meta, grids


def status_of(code, enc):
    if code >= VALID_MIN:
        return "valid", None
    if code == enc["land"]:
        return "masked", "land"
    if code == enc["lake"]:
        return "masked", "lake"
    if enc["iceBase"] - 100 <= code <= enc["iceBase"] - 1:
        return "masked", "sea_ice"
    return "missing", None


def sample(meta, g, lat, lon):
    W, H, enc = meta["width"], meta["height"], meta["encoding"]
    fx = (lon - meta["lon0"]) / meta["dLon"]
    fy = (lat - meta["lat0"]) / meta["dLat"]
    ix = int(math.floor(fx + 0.5)) % W
    iy = min(max(int(math.floor(fy + 0.5)), 0), H - 1)
    status, reason = status_of(int(g[iy, ix]), enc)
    if status != "valid":
        return {"status": status, "reason": reason, "value": None, "cell": [ix, iy]}
    x0 = int(math.floor(fx))
    y0 = min(max(int(math.floor(fy)), 0), H - 2)
    tx = fx - x0
    ty = min(max(fy - y0, 0.0), 1.0)
    acc = wsum = 0.0
    used = 0
    for dx, dy, w in ((0, 0, (1 - tx) * (1 - ty)), (1, 0, tx * (1 - ty)),
                      (0, 1, (1 - tx) * ty), (1, 1, tx * ty)):
        code = int(g[y0 + dy, (x0 + dx) % W])
        if code >= VALID_MIN:
            acc += w * code / 100.0
            wsum += w
            used += 1
    value = acc / wsum if wsum > 0 else int(g[iy, ix]) / 100.0
    return {"status": "valid", "reason": None, "value": round(value, 4), "cell": [ix, iy],
            "neighboursUsed": used}


def note_index(v, lo, hi, n):
    u = min(1.0, max(0.0, (v - lo) / (hi - lo)))
    return int(math.floor(u * (n - 1) + 0.5))


def main():
    meta, grids = load_grid()
    lo, hi = OCEAN_DOMAIN_C
    out = {"stops": N_STOPS, "domainC": [lo, hi], "accentC": OCEAN_ACCENT_C, "presets": []}
    for p in PRESETS:
        pts, km = resample_geographic(p["waypoints"], N_STOPS)
        ref = {}
        for key, g in grids.items():
            rows = []
            for lat, lon in pts:
                s = sample(meta, g, lat, lon)
                s["lat"], s["lon"] = round(lat, 5), round(lon, 5)
                s["midi"] = PITCHES_MIDI[note_index(s["value"], lo, hi, len(PITCHES_MIDI))] \
                    if s["value"] is not None else None
                rows.append(s)
            ref[key] = rows
            vals = [r["value"] for r in rows if r["value"] is not None]
            print(f"{p['id']} {key}: {km:.0f} km, {len(vals)}/{N_STOPS} valid, "
                  f"{min(vals):.2f}..{max(vals):.2f} C, notes {[r['midi'] for r in rows]}")
        out["presets"].append({**p, "lengthKm": round(km, 1), "reference": ref})
    (PUBLIC_DATA / "ocean" / "presets.json").write_text(json.dumps(out, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
