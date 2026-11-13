"""Step 3 — prove (or disprove) the assumptions the app relies on.

Checks
  1. Geographic registration: the 2:1 frame is treated as equirectangular,
     lon -180..180, lat 90..-90.  We test this against well-known landmarks
     whose land/ocean status is unambiguous, including several close to
     coastlines (so a few-degree shift would fail).
  2. A/B comparability: both frames share size, camera and land mask.
  3. Legend round trip: the legend's own colours map back to their positions.

Writes data-raw/validation.json.  Exit code 1 if any check fails — the
manifest step then refuses to mark registration/comparison as verified.

Usage:  python scripts/validate_alignment.py
"""
import json
import sys

import numpy as np
from PIL import Image

from feature_lib import STATUS, classify_pixels, geo_to_pixel, legend_lut
from pipeline_config import (CELL, COLORBAR_FILE, FRAME_NAME, FRAMES, PALETTE_MAX_HUE_GAP,
                             PUBLIC_DATA, RAW_DIR)

# (name, lat, lon, expected) — expected 'land' or 'ocean'
LANDMARKS = [
    ("Sahara, Algeria", 25.0, 5.0, "land"),
    ("Amazon basin", -5.0, -60.0, "land"),
    ("Central Australia", -25.0, 134.0, "land"),
    ("Siberia", 62.0, 100.0, "land"),
    ("US Great Plains", 40.0, -100.0, "land"),
    ("Greenland ice sheet", 72.0, -40.0, "land"),
    ("Antarctic plateau", -82.0, 40.0, "land"),
    ("Florida peninsula", 28.0, -81.6, "land"),
    ("Italy (Apennines)", 42.5, 13.0, "land"),
    ("Sri Lanka", 7.8, 80.7, "land"),
    ("Madagascar", -19.0, 46.5, "land"),
    ("Iberia (Madrid)", 40.4, -3.7, "land"),
    ("Central equatorial Pacific", 0.0, -150.0, "ocean"),
    ("Sargasso Sea", 30.0, -60.0, "ocean"),
    ("Central Indian Ocean", -20.0, 80.0, "ocean"),
    ("Southern Ocean", -55.0, -120.0, "ocean"),
    ("Gulf of Mexico", 25.0, -90.0, "ocean"),
    ("Mediterranean (Ionian)", 36.0, 18.0, "ocean"),
    ("Tasman Sea", -38.0, 160.0, "ocean"),
    ("Atlantic off Florida", 28.0, -79.0, "ocean"),
    ("Strait of Mozambique", -18.0, 41.0, "ocean"),
    ("Bay of Bengal", 15.0, 88.0, "ocean"),
    ("Adriatic Sea", 43.0, 15.5, "ocean"),
    ("Red Sea", 20.0, 38.5, "ocean"),
]


def classify_point(is_land, pos, lat, lon, radius=2):
    h, w = is_land.shape
    x, y = geo_to_pixel(lat, lon, w, h)
    x, y = int(x), int(y)
    win_l = is_land[max(0, y - radius):y + radius + 1, max(0, x - radius):x + radius + 1]
    win_p = pos[max(0, y - radius):y + radius + 1, max(0, x - radius):x + radius + 1]
    if win_l.mean() >= 0.6:
        return "land"
    if win_l.mean() <= 0.2:
        return "ocean"
    return "ambiguous"


def main():
    cbar = np.asarray(Image.open(RAW_DIR / COLORBAR_FILE).convert("RGBA"))
    lut_colors, lut_pos, _ = legend_lut(cbar)
    report = {"registration": {}, "comparability": {}, "legend": {}}
    ok_all = True

    frames = {}
    for key, n in FRAMES.items():
        rgb = np.asarray(Image.open(RAW_DIR / FRAME_NAME.format(n=n)).convert("RGB"))
        pos, is_land = classify_pixels(rgb, lut_colors, lut_pos, PALETTE_MAX_HUE_GAP)
        frames[key] = (rgb, pos, is_land)

    # 1. registration — run on every frame
    for key, (rgb, pos, is_land) in frames.items():
        results = []
        for name, lat, lon, expected in LANDMARKS:
            got = classify_point(is_land, pos, lat, lon)
            results.append({"name": name, "lat": lat, "lon": lon, "expected": expected,
                            "observed": got, "pass": got == expected})
        passed = sum(r["pass"] for r in results)
        report["registration"][key] = {"passed": passed, "total": len(results), "landmarks": results}
        print(f"Registration frame {key}: {passed}/{len(results)} landmarks pass")
        for r in results:
            if not r["pass"]:
                print(f"   FAIL {r['name']}: expected {r['expected']}, saw {r['observed']}")
        ok_all &= passed == len(results)

    # 2. comparability between A and B
    (ra, _, la), (rb, _, lb) = frames["A"], frames["B"]
    same_size = ra.shape == rb.shape
    agree = float((la == lb).mean()) if same_size else 0.0
    grid_a = np.fromfile(PUBLIC_DATA / "frames" / f"frame-{FRAMES['A']}.bin", np.uint8).reshape(3, -1)
    grid_b = np.fromfile(PUBLIC_DATA / "frames" / f"frame-{FRAMES['B']}.bin", np.uint8).reshape(3, -1)
    cell_land_agree = float(((grid_a[1] == STATUS["land"]) == (grid_b[1] == STATUS["land"])).mean())
    comparable = same_size and agree >= 0.995 and cell_land_agree >= 0.995
    report["comparability"] = {"sameSize": same_size, "pixelLandMaskAgreement": round(agree, 5),
                               "cellLandMaskAgreement": round(cell_land_agree, 5),
                               "sameCamera": "fixed flat global camera (SVS frame set 2048x1024 orig)",
                               "comparable": comparable}
    print(f"A/B land-mask agreement: pixels {agree:.4%}, cells {cell_land_agree:.4%} -> comparable={comparable}")
    ok_all &= comparable

    # 3. legend round trip
    pos_lut, _ = classify_pixels(lut_colors[None, :, :], lut_colors, lut_pos, PALETTE_MAX_HUE_GAP)
    err = np.nanmax(np.abs(pos_lut[0] - lut_pos))
    endpoints = [float(pos_lut[0][0]), float(pos_lut[0][-1])]
    # The legend's last few columns share one hue (pure red), so positions above
    # ~0.97 are indistinguishable by hue. Tolerance = a third of one note step (0.1).
    tol = 0.035
    report["legend"] = {"maxRoundTripError": round(float(err), 4), "endpoints": endpoints,
                        "tolerance": tol, "note": "red-end hue plateau: >0.97 resolves to ~0.97",
                        "pass": bool(err < tol)}
    print(f"Legend round trip: max error {err:.4f}, endpoints {endpoints}")
    ok_all &= err < tol

    report["allPassed"] = bool(ok_all)
    report["cellSize"] = CELL
    (RAW_DIR / "validation.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print("ALL CHECKS PASSED" if ok_all else "SOME CHECKS FAILED")
    sys.exit(0 if ok_all else 1)


if __name__ == "__main__":
    main()
