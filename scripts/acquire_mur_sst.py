"""Ocean step 1 — download numeric sea-surface temperature for the SVS 3912 dates.

Source: GHRSST Level 4 MUR Global Foundation SST Analysis v4.1 (NASA JPL,
distributed by PO.DAAC; served without login by NOAA CoastWatch ERDDAP as
dataset `jplMURSST41`).  MUR is an observation-based analysis (satellite
radiometers + in-situ), daily, 0.01 deg.  It is a DIFFERENT product from the
ECCO2 model shown in the SVS 3912 visualization: the app shows the NASA
visualization as the picture and plays MUR numbers for the very same day.

We request a regular sub-sample (every 25th grid point = 0.25 deg) of three
variables for each date in pipeline_config.OCEAN_DATES:
  analysed_sst      (deg C)
  sea_ice_fraction  (0..1)
  mask              (MUR land/water/ice mask: 1 water, 2 land, 5 lake, 9 sea ice ...)

Output: data-raw/mur/mur-<YYYYMMDD>.nc (NetCDF-3) + data-raw/mur/acquisition.json

Usage:  python scripts/acquire_mur_sst.py
"""
import json
import time

from net import download, sha256
from pipeline_config import MUR_DATASET, MUR_ERDDAP, MUR_STRIDE, OCEAN_DATES, RAW_DIR


def query_url(date_iso):
    t = f"({date_iso}T09:00:00Z)"
    box = f"[(-89.99):{MUR_STRIDE}:(89.99)][(-179.99):{MUR_STRIDE}:(180.0)]"
    parts = [f"{v}[{t}]{box}" for v in ("analysed_sst", "sea_ice_fraction", "mask")]
    return f"{MUR_ERDDAP}/griddap/{MUR_DATASET}.nc?" + ",".join(parts)


def main():
    out_dir = RAW_DIR / "mur"
    out_dir.mkdir(parents=True, exist_ok=True)
    records = []
    for key, date_iso in OCEAN_DATES.items():
        dest = out_dir / f"mur-{date_iso.replace('-', '')}.nc"
        url = query_url(date_iso)
        download(url, dest, timeout=900)
        records.append({"role": f"mur-sst-{key}", "date": date_iso, "url": url,
                        "file": dest.name, "bytes": dest.stat().st_size, "sha256": sha256(dest)})
    (out_dir / "acquisition.json").write_text(json.dumps(
        {"acquiredUTC": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "files": records},
        indent=2), encoding="utf-8")
    print("MUR SST acquisition complete.")


if __name__ == "__main__":
    main()
