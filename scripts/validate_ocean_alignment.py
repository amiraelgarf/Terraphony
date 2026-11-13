"""Ocean step 3 — verify that the NASA picture and the numeric grid line up.

The app draws the SVS 3912 frame underneath a route and samples MUR numbers
at the route's latitude/longitude.  That is only honest if both use the same
equirectangular registration (lon -180..180 left->right, lat 90..-90 top->bottom).

Checks (both dates):
  1. Landmarks: 24 known land/sea points (several within ~1 deg of a coast) must
     be land/sea in BOTH the MUR mask and the SVS frame's gray relief.
  2. Mask agreement: share of 0.25 deg cells where MUR land == SVS land
     (excluding sea ice and the polar rows where SVS draws no ocean colour).

Writes data-raw/validation.json and exits non-zero if a check fails.
Usage:  python scripts/validate_ocean_alignment.py
"""
import json
import sys

import numpy as np
from PIL import Image

from build_ocean_grids import CODE_LAND
from pipeline_config import FRAME_NAME, FRAMES, OCEAN_DATES, PUBLIC_DATA, RAW_DIR
from svs_lib import svs_land_mask

LANDMARKS = [  # name, lat, lon, expected ("land" | "sea")
    ("Sahara (Algeria)", 25.0, 5.0, "land"), ("Amazon basin", -5.0, -62.0, "land"),
    ("Siberia", 62.0, 100.0, "land"), ("Central Australia", -24.0, 134.0, "land"),
    ("Great Plains", 40.0, -100.0, "land"), ("Florida peninsula", 28.0, -81.5, "land"),
    ("Italy (Apennines)", 42.5, 13.0, "land"), ("Sri Lanka", 7.7, 80.7, "land"),
    ("Madagascar", -19.5, 46.5, "land"), ("Arabian Peninsula", 23.0, 46.0, "land"),
    ("Patagonia", -44.0, -69.5, "land"), ("Borneo", 0.5, 114.0, "land"),
    ("North Pacific", 30.0, -150.0, "sea"), ("South Atlantic", -30.0, -15.0, "sea"),
    ("Indian Ocean", -20.0, 80.0, "sea"), ("Gulf of Mexico", 25.0, -90.0, "sea"),
    ("Adriatic Sea", 43.0, 15.5, "sea"), ("Red Sea", 20.0, 38.5, "sea"),
    ("Mozambique Channel", -18.0, 41.5, "sea"), ("Bay of Bengal", 15.0, 88.0, "sea"),
    ("Tasman Sea", -38.0, 160.0, "sea"), ("Caribbean Sea", 15.0, -75.0, "sea"),
    ("Arabian Sea", 15.0, 64.0, "sea"), ("Gulf Stream off Hatteras", 35.0, -74.0, "sea"),
]


def main():
    grid = json.loads((PUBLIC_DATA / "ocean" / "grid.json").read_text(encoding="utf-8"))
    W, H = grid["width"], grid["height"]
    report, ok_all = {"dates": {}}, True
    for key, date_iso in OCEAN_DATES.items():
        enc = np.frombuffer((PUBLIC_DATA / "ocean" / f"mur-sst-{date_iso.replace('-', '')}.bin").read_bytes(),
                            dtype="<i2").reshape(H, W)
        mur_land = enc == CODE_LAND
        frame = np.asarray(Image.open(RAW_DIR / FRAME_NAME.format(n=FRAMES[key])).convert("RGB")
                           .resize((W, H), Image.BOX))
        svs_land = svs_land_mask(frame)

        lm = []
        for name, lat, lon, expect in LANDMARKS:
            gx = int(round((lon - grid["lon0"]) / grid["dLon"])) % W
            gy = int(round((grid["lat0"] - lat) / -grid["dLat"])) if grid["dLat"] < 0 else \
                int(round((lat - grid["lat0"]) / grid["dLat"]))
            gy = min(max(gy, 0), H - 1)
            mur = "land" if mur_land[gy, gx] else "sea"
            win = svs_land[max(gy - 1, 0):gy + 2, max(gx - 1, 0):gx + 2]
            svs = "land" if win.mean() >= 0.5 else "sea"
            lm.append({"name": name, "lat": lat, "lon": lon, "expected": expect, "mur": mur, "svs": svs,
                       "pass": mur == expect and svs == expect})
        passed = sum(r["pass"] for r in lm)

        # agreement away from the poles and away from sea ice
        rows = np.abs(np.linspace(grid["lat0"], grid["lat0"] + grid["dLat"] * (H - 1), H)) <= 70
        ice = (enc <= -30015) & (enc >= -30100)
        sel = rows[:, None] & ~ice
        agree = float((mur_land[sel] == svs_land[sel]).mean())
        report["dates"][key] = {"date": date_iso, "frame": FRAMES[key], "landmarksPassed": passed,
                                "landmarksTotal": len(lm), "maskAgreement": round(agree, 4), "landmarks": lm}
        print(f"{key} {date_iso}: landmarks {passed}/{len(lm)}, land-mask agreement {agree:.2%}")
        for r in lm:
            if not r["pass"]:
                print(f"   FAIL {r['name']}: expected {r['expected']}, MUR {r['mur']}, SVS {r['svs']}")
        ok_all &= passed == len(lm) and agree >= 0.95

    report["registrationVerified"] = bool(ok_all)
    (RAW_DIR / "validation.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print("Registration verified." if ok_all else "Registration NOT verified.")
    sys.exit(0 if ok_all else 1)


if __name__ == "__main__":
    main()
