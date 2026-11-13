"""Step 2 — turn each downloaded NASA frame into a feature grid + web image.

Inputs  (data-raw/):  the TIFF frames, sst_ecco2_cbar.png, flat_ecco2_dates.txt
Outputs (public/):
  nasa-svs/svs3912-frame-<n>.jpg     web copy of the exact frame that is sampled
  nasa-svs/sst_ecco2_cbar.png        NASA's legend (unaltered copy)
  data/frames/frame-<n>.bin          3 planes of uint8, each 512x256, row-major:
                                       [value | status | confidence]
  data/legend.json                   the extracted legend ramp (for drawing)
  data-raw/qa/*.png                  overlays for manual inspection

Usage:  python scripts/extract_visual_features.py
"""
import json
import shutil

import numpy as np
from PIL import Image

from feature_lib import STATUS, cell_features, classify_pixels, legend_lut
from pipeline_config import (CELL, COLORBAR_FILE, FRAME_NAME, FRAMES, MIN_CONFIDENCE,
                             MIN_PALETTE_PIXELS, PALETTE_MAX_HUE_GAP, PUBLIC_DATA,
                             PUBLIC_FRAMES, RAW_DIR)


def main():
    (PUBLIC_DATA / "frames").mkdir(parents=True, exist_ok=True)
    PUBLIC_FRAMES.mkdir(parents=True, exist_ok=True)
    qa = RAW_DIR / "qa"
    qa.mkdir(exist_ok=True)

    cbar = np.asarray(Image.open(RAW_DIR / COLORBAR_FILE).convert("RGBA"))
    lut_colors, lut_pos, (x0, x1, row) = legend_lut(cbar)
    shutil.copy(RAW_DIR / COLORBAR_FILE, PUBLIC_FRAMES / COLORBAR_FILE)
    step = max(1, len(lut_pos) // 64)
    legend = {
        "source": COLORBAR_FILE,
        "barPixelSpan": [x0, x1], "sampledRow": row,
        "labelledEndpoints": {"0": "0 °C", "1": "32 °C"},
        "stops": [{"position": round(float(p), 4), "rgb": [int(round(c)) for c in col]}
                  for p, col in zip(lut_pos[::step], lut_colors[::step])],
    }
    (PUBLIC_DATA / "legend.json").write_text(json.dumps(legend, indent=1), encoding="utf-8")
    print(f"Legend: {len(lut_pos)} colours extracted from x={x0}..{x1}")

    stats = {}
    for key, n in FRAMES.items():
        src = RAW_DIR / FRAME_NAME.format(n=n)
        rgb = np.asarray(Image.open(src).convert("RGB"))
        pos, is_land = classify_pixels(rgb, lut_colors, lut_pos, PALETTE_MAX_HUE_GAP)
        value, status, conf = cell_features(pos, is_land, CELL, MIN_PALETTE_PIXELS, MIN_CONFIDENCE)

        out = PUBLIC_DATA / "frames" / f"frame-{n}.bin"
        out.write_bytes(np.stack([value, status, conf]).tobytes())
        Image.fromarray(rgb).save(PUBLIC_FRAMES / f"svs3912-frame-{n}.jpg", quality=90, optimize=True)

        total = status.size
        s = {name: int((status == code).sum()) for name, code in STATUS.items()}
        ocean = s["ok"] + s["occluded"]
        stats[key] = {"frame": n, "cells": total, **s,
                      "oceanCellsUsable": round(s["ok"] / max(ocean, 1), 4),
                      "matchedPixelShare": round(float(np.mean(~np.isnan(pos))), 4)}
        print(f"Frame {key} ({n}): {s}  usable ocean share={stats[key]['oceanCellsUsable']:.1%}")

        # QA overlay: feature value as gray, land brown, occluded magenta
        vis = np.zeros(value.shape + (3,), np.uint8)
        okm = status == STATUS["ok"]
        vis[okm] = np.repeat(value[okm, None], 3, 1)
        vis[status == STATUS["land"]] = (90, 70, 50)
        vis[status == STATUS["occluded"]] = (200, 0, 200)
        Image.fromarray(vis).resize((1024, 512), Image.NEAREST).save(qa / f"features-{n}.png")

    (RAW_DIR / "feature_stats.json").write_text(json.dumps(stats, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
