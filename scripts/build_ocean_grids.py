"""Ocean step 2 — numeric MUR SST -> compact web grids, picture assets and a data map.

Inputs  (data-raw/):  mur/mur-<date>.nc, the SVS 3912 TIFF frames, sst_ecco2_cbar.png
Outputs (public/):
  data/ocean/mur-sst-<YYYYMMDD>.bin   int16 little-endian, 1440 x 720, row 0 = north.
        value >= -3000           SST in hundredths of a degree C (valid ocean)
        -30000 - p (p = 15..100) sea ice, p = ice fraction in percent  -> masked
        -32766                   no analysed value                    -> missing
        -32767                   lake / inland water                   -> masked
        -32768                   land                                  -> masked
  data/ocean/mur-sst-<YYYYMMDD>.png   the same numbers drawn with NASA's SVS 3912
                                      legend ramp (0..32 C), for the "data" map layer
  data/ocean/grid.json                grid geometry + encoding + statistics
  nasa-svs/svs3912-frame-<n>.jpg      web copy of the NASA picture for the same day
  nasa-svs/sst_ecco2_cbar.png         NASA's legend (unaltered copy)
  data/legend.json                    the legend ramp (for drawing in the app)

Usage:  python scripts/build_ocean_grids.py
"""
import json
import shutil

import numpy as np
from PIL import Image
from scipy.io import netcdf_file

from pipeline_config import (COLORBAR_FILE, FRAME_NAME, FRAMES, ICE_MASK_FRACTION, MUR_STRIDE,
                             OCEAN_DATES, PUBLIC_DATA, PUBLIC_FRAMES, RAW_DIR)
from svs_lib import legend_lut

CODE_LAND, CODE_LAKE, CODE_MISSING, CODE_ICE_BASE = -32768, -32767, -32766, -30000
LEGEND_RANGE_C = (0.0, 32.0)   # labelled ends of NASA's sst_ecco2_cbar.png


def load_mur(date_iso):
    """Return (sst[deg C], ice[0..1], mask flags, lats, lons) with row 0 = north."""
    path = RAW_DIR / "mur" / f"mur-{date_iso.replace('-', '')}.nc"
    with netcdf_file(path, "r", mmap=False) as f:
        v = f.variables
        sst = v["analysed_sst"][0].astype(np.float64)
        sst_fill = float(v["analysed_sst"]._FillValue)
        ice = v["sea_ice_fraction"][0].astype(np.float64)
        ice_fill = float(v["sea_ice_fraction"]._FillValue)
        mask = v["mask"][0].astype(np.int16)
        lats = v["latitude"][:].astype(np.float64)
        lons = v["longitude"][:].astype(np.float64)
    sst[np.isclose(sst, sst_fill)] = np.nan
    ice[np.isclose(ice, ice_fill)] = np.nan
    order = np.argsort(-lats)                       # north first
    return sst[order], ice[order], mask[order], lats[order], lons


def encode(sst, ice, mask):
    out = np.full(sst.shape, CODE_MISSING, dtype=np.int16)
    land = (mask & 2) > 0
    lake = ((mask & 4) > 0) & ~land
    iced = ~land & ~lake & (np.nan_to_num(ice) >= ICE_MASK_FRACTION)
    valid = ~land & ~lake & ~iced & np.isfinite(sst)
    out[valid] = np.round(sst[valid] * 100).astype(np.int16)
    out[iced] = (CODE_ICE_BASE - np.round(np.clip(ice[iced], 0, 1) * 100)).astype(np.int16)
    out[lake] = CODE_LAKE
    out[land] = CODE_LAND
    return out, valid, iced, land, lake


def render_data_map(sst, valid, iced, lut_colors):
    """Draw numeric SST with NASA's legend ramp. Land transparent, ice pale gray."""
    h, w = sst.shape
    rgba = np.zeros((h, w, 4), np.uint8)
    lo, hi = LEGEND_RANGE_C
    t = np.clip((np.nan_to_num(sst) - lo) / (hi - lo), 0, 1)
    idx = np.round(t * (len(lut_colors) - 1)).astype(int)
    rgba[valid, :3] = np.round(lut_colors[idx[valid]]).astype(np.uint8)
    rgba[valid, 3] = 255
    rgba[iced] = (214, 222, 224, 255)
    return Image.fromarray(rgba, "RGBA")


def main():
    out_dir = PUBLIC_DATA / "ocean"
    out_dir.mkdir(parents=True, exist_ok=True)
    PUBLIC_FRAMES.mkdir(parents=True, exist_ok=True)

    # NASA legend ramp (used for drawing only, never for reading values)
    cbar = np.asarray(Image.open(RAW_DIR / COLORBAR_FILE).convert("RGBA"))
    lut_colors, lut_pos, (x0, x1, row) = legend_lut(cbar)
    shutil.copy(RAW_DIR / COLORBAR_FILE, PUBLIC_FRAMES / COLORBAR_FILE)
    step = max(1, len(lut_pos) // 48)
    (PUBLIC_DATA / "legend.json").write_text(json.dumps({
        "source": COLORBAR_FILE, "barPixelSpan": [x0, x1], "sampledRow": row,
        "rangeC": list(LEGEND_RANGE_C),
        "stops": [{"position": round(float(p), 4), "rgb": [int(round(c)) for c in col]}
                  for p, col in zip(lut_pos[::step], lut_colors[::step])],
    }, indent=1), encoding="utf-8")

    pooled, dates_meta, grid_geom = [], {}, None
    for key, date_iso in OCEAN_DATES.items():
        sst, ice, mask, lats, lons = load_mur(date_iso)
        enc, valid, iced, land, lake = encode(sst, ice, mask)
        tag = date_iso.replace("-", "")
        (out_dir / f"mur-sst-{tag}.bin").write_bytes(enc.astype("<i2").tobytes())
        render_data_map(sst, valid, iced, lut_colors).save(out_dir / f"mur-sst-{tag}.png", optimize=True)
        pooled.append(sst[valid])
        n = enc.size
        dates_meta[key] = {
            "date": date_iso, "nominalTimeUTC": f"{date_iso}T09:00:00Z",
            "file": f"data/ocean/mur-sst-{tag}.bin", "dataMap": f"data/ocean/mur-sst-{tag}.png",
            "shares": {"validOcean": round(valid.sum() / n, 4), "seaIce": round(iced.sum() / n, 4),
                       "land": round(land.sum() / n, 4), "lake": round(lake.sum() / n, 4)},
            "minC": round(float(np.nanmin(sst[valid])), 3), "maxC": round(float(np.nanmax(sst[valid])), 3),
        }
        grid_geom = {"width": int(sst.shape[1]), "height": int(sst.shape[0]),
                     "lat0": round(float(lats[0]), 4), "dLat": round(float(lats[1] - lats[0]), 4),
                     "lon0": round(float(lons[0]), 4), "dLon": round(float(lons[1] - lons[0]), 4)}
        print(f"MUR {key} {date_iso}: {dates_meta[key]['shares']}  range {dates_meta[key]['minC']}..{dates_meta[key]['maxC']} C")

        # NASA picture of the same day
        frame = FRAMES[key]
        rgb = Image.open(RAW_DIR / FRAME_NAME.format(n=frame)).convert("RGB")
        rgb.save(PUBLIC_FRAMES / f"svs3912-frame-{frame}.jpg", quality=88, optimize=True)

    allv = np.concatenate(pooled)
    pct = {str(p): round(float(np.percentile(allv, p)), 3) for p in (0.1, 0.5, 1, 50, 99, 99.5, 99.9)}
    print("Pooled valid SST percentiles:", pct)

    grid = {
        "product": "GHRSST L4 MUR SST v4.1 (analysed_sst), sub-sampled",
        "stride": MUR_STRIDE, "resolutionDeg": 0.01 * MUR_STRIDE,
        "rowOrder": "north-to-south", "dtype": "int16-le",
        **grid_geom,
        "encoding": {"scale": 0.01, "units": "degree_C", "land": CODE_LAND, "lake": CODE_LAKE,
                     "missing": CODE_MISSING, "iceBase": CODE_ICE_BASE,
                     "iceThreshold": ICE_MASK_FRACTION},
        "dates": dates_meta,
        "pooledPercentilesC": pct,
    }
    (out_dir / "grid.json").write_text(json.dumps(grid, indent=2), encoding="utf-8")
    print(f"Wrote {out_dir / 'grid.json'}")


if __name__ == "__main__":
    main()
