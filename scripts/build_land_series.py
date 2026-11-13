"""Land step 2 — MODIS MOD13Q1 pixels -> one QA-filtered NDVI value per 16-day window.

For each place and composite window (true 16-day compositing interval):
  * pixels: the 9 x 9 window of 250 m pixels around the site (+/- 1 km)
  * accepted pixels: pixel_reliability 0 (good) or 1 (marginal) and NDVI not fill (-3000)
  * value: mean of accepted pixels' NDVI (scale 0.0001), uncertainty = their std dev
  * status:
      valid             >= LAND_MIN_VALID_FRACTION of pixels accepted
      masked (snow_ice) otherwise, if most rejected pixels are flagged snow/ice (2)
      quality_rejected  otherwise (cloudy (3) / fill) -> rest; never interpolated

Output: public/data/land/<place>.json   (+ the raw 9x9 pixels so the inspector can
        show exactly which pixels made each value)
        public/data/land/places.json    (index)
Usage:  python scripts/build_land_series.py
"""
import datetime as dt
import json

import numpy as np

from pipeline_config import (LAND_ACCENT_NDVI, LAND_DOMAIN_NDVI, LAND_KM, LAND_MIN_VALID_FRACTION,
                             LAND_PLACES, LAND_YEAR, PUBLIC_DATA, RAW_DIR)

NDVI_FILL = -3000
SCALE = 0.0001


def doy_to_date(year, doy):
    return dt.date(year, 1, 1) + dt.timedelta(days=doy - 1)


def main():
    out_dir = PUBLIC_DATA / "land"
    out_dir.mkdir(parents=True, exist_ok=True)
    index = []
    for place in LAND_PLACES:
        raw = json.loads((RAW_DIR / "modis" / f"{place['id']}.json").read_text(encoding="utf-8"))
        bands = raw["bands"]
        ndvi_rows = {r["modis_date"]: r for r in bands["250m_16_days_NDVI"]["subset"]}
        rel_rows = {r["modis_date"]: r for r in bands["250m_16_days_pixel_reliability"]["subset"]}
        doy_rows = {r["modis_date"]: r for r in bands["250m_16_days_composite_day_of_the_year"]["subset"]}
        meta = bands["250m_16_days_NDVI"]["meta"]
        windows = []
        for i, md in enumerate(raw["dates"]):
            year, doy = int(md[1:5]), int(md[5:])
            start = doy_to_date(year, doy)
            end = start + dt.timedelta(days=15)
            ndvi = np.array(ndvi_rows[md]["data"], dtype=float)
            rel = np.array(rel_rows[md]["data"], dtype=int)
            obs_doy = np.array(doy_rows[md]["data"], dtype=int)
            ok = ((rel == 0) | (rel == 1)) & (ndvi != NDVI_FILL)
            frac = float(ok.mean())
            if frac >= LAND_MIN_VALID_FRACTION:
                status, reason = "valid", None
                vals = ndvi[ok] * SCALE
                value = round(float(vals.mean()), 4)
                unc = round(float(vals.std()), 4)
                d = obs_doy[ok]
                d = d[d > 0]
                observed = [doy_to_date(year, int(d.min())).isoformat(), doy_to_date(year, int(d.max())).isoformat()] if d.size else None
            else:
                value, unc, observed = None, None, None
                rejected = rel[~ok]
                snow = int((rejected == 2).sum())
                cloud = int((rejected == 3).sum())
                if snow >= cloud and snow > 0:
                    status, reason = "masked", "snow_ice"
                else:
                    status, reason = "quality_rejected", "cloud" if cloud > 0 else "fill"
            windows.append({
                "index": i, "modisDate": md, "start": start.isoformat(), "end": end.isoformat(),
                "status": status, "reason": reason, "ndvi": value, "std": unc,
                "acceptedPixels": int(ok.sum()), "totalPixels": int(ok.size),
                "observedDays": observed,
                "tile": ndvi_rows[md].get("tile"), "processed": ndvi_rows[md].get("proc_date"),
                "pixels": [None if v == NDVI_FILL else round(v * SCALE, 4) for v in ndvi.tolist()],
                "reliability": rel.tolist(),
            })
        valid = [w["ndvi"] for w in windows if w["ndvi"] is not None]
        summary = {"valid": len(valid), "total": len(windows),
                   "min": min(valid) if valid else None, "max": max(valid) if valid else None}
        doc = {**place, "year": LAND_YEAR, "windowKm": LAND_KM, "gridSize": [meta["nrows"], meta["ncols"]],
               "cellSizeM": round(float(meta["cellsize"]), 2), "service": meta["header"].split("/subset")[0],
               "domain": list(LAND_DOMAIN_NDVI), "accent": LAND_ACCENT_NDVI,
               "minValidFraction": LAND_MIN_VALID_FRACTION, "summary": summary, "windows": windows}
        (out_dir / f"{place['id']}.json").write_text(json.dumps(doc), encoding="utf-8")
        index.append({**place, "file": f"data/land/{place['id']}.json", "summary": summary})
        statuses = "".join({"valid": ".", "masked": "S", "quality_rejected": "x"}[w["status"]] for w in windows)
        print(f"{place['id']}: {summary}  [{statuses}]")
        print("   ", [w["ndvi"] for w in windows])
    (out_dir / "places.json").write_text(json.dumps({"year": LAND_YEAR, "places": index}, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
