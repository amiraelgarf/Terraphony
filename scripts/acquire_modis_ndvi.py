"""Land step 1 — download MODIS MOD13Q1 v061 NDVI time series for the curated places.

Source: ORNL DAAC "MODIS/VIIRS Land Product Subsets" REST service
(https://modis.ornl.gov/data/modis_webservice.html), which serves the original
MOD13Q1 250 m pixels around a coordinate without login.

For every place in pipeline_config.LAND_PLACES and every 16-day composite that
STARTS in LAND_YEAR we fetch a (2*LAND_KM*4+1)^2 pixel window of three bands:
  250m_16_days_NDVI                       scaled integer (x 0.0001), fill -3000
  250m_16_days_pixel_reliability          -1 fill, 0 good, 1 marginal, 2 snow/ice, 3 cloudy
  250m_16_days_composite_day_of_the_year  day each pixel was actually observed

The service returns at most 10 composites per request, so requests are chunked.
Output: data-raw/modis/<place>.json (raw service responses, merged per band)
        data-raw/modis/acquisition.json

Usage:  python scripts/acquire_modis_ndvi.py
"""
import hashlib
import json
import time

from net import fetch
from pipeline_config import LAND_KM, LAND_PLACES, LAND_YEAR, MODIS_API, MODIS_PRODUCT, RAW_DIR

BANDS = ["250m_16_days_NDVI", "250m_16_days_pixel_reliability",
         "250m_16_days_composite_day_of_the_year"]


def get_json(url):
    return json.loads(fetch(url, timeout=180, accept="application/json").decode("utf-8"))


def composite_dates(place):
    url = f"{MODIS_API}/{MODIS_PRODUCT}/dates?latitude={place['lat']}&longitude={place['lon']}"
    dates = [d["modis_date"] for d in get_json(url)["dates"]]
    return [d for d in dates if d.startswith(f"A{LAND_YEAR}")]


def main():
    out_dir = RAW_DIR / "modis"
    out_dir.mkdir(parents=True, exist_ok=True)
    records = []
    for place in LAND_PLACES:
        dest = out_dir / f"{place['id']}.json"
        if dest.exists():
            print(f"  cached  {dest.name}")
        else:
            dates = composite_dates(place)
            print(f"  {place['id']}: {len(dates)} composites in {LAND_YEAR}")
            merged = {"place": place, "dates": dates, "bands": {}}
            for band in BANDS:
                rows, meta = [], None
                for i in range(0, len(dates), 10):
                    chunk = dates[i:i + 10]
                    url = (f"{MODIS_API}/{MODIS_PRODUCT}/subset?latitude={place['lat']}"
                           f"&longitude={place['lon']}&band={band}&startDate={chunk[0]}"
                           f"&endDate={chunk[-1]}&kmAboveBelow={LAND_KM}&kmLeftRight={LAND_KM}")
                    resp = get_json(url)
                    rows.extend(resp["subset"])
                    meta = {k: v for k, v in resp.items() if k != "subset"}
                    print(f"    {band} {chunk[0]}..{chunk[-1]}: {len(resp['subset'])} rows")
                merged["bands"][band] = {"meta": meta, "subset": rows}
            dest.write_text(json.dumps(merged), encoding="utf-8")
        digest = hashlib.sha256(dest.read_bytes()).hexdigest()
        records.append({"place": place["id"], "file": dest.name,
                        "bytes": dest.stat().st_size, "sha256": digest})
    (out_dir / "acquisition.json").write_text(json.dumps(
        {"acquiredUTC": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
         "service": MODIS_API, "product": MODIS_PRODUCT, "files": records}, indent=2), encoding="utf-8")
    print("MODIS acquisition complete.")


if __name__ == "__main__":
    main()
