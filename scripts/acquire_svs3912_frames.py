"""Step 1 — download the official NASA SVS 3912 assets used by the app.

Downloads (into data-raw/):
  * flat_ecco2_dates.txt  – NASA's frame-number -> UTC timestamp table
  * sst_ecco2_cbar.png    – NASA's published SST colour legend
  * one TIFF frame per entry in pipeline_config.FRAMES

Writes data-raw/acquisition.json with URLs, byte sizes and SHA-256 checksums.
Re-running is safe: files already present with a recorded checksum are kept.

Usage:  python scripts/acquire_svs3912_frames.py
"""
import json
import time

from net import download, sha256
from pipeline_config import (COLORBAR_FILE, DATES_FILE, FRAME_DIR, FRAME_NAME,
                             FRAMES, RAW_DIR, SVS_BASE)



def main():
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    records = []
    jobs = [(SVS_BASE + DATES_FILE, RAW_DIR / DATES_FILE, "frame-timestamps"),
            (SVS_BASE + COLORBAR_FILE, RAW_DIR / COLORBAR_FILE, "sst-legend")]
    for key, n in FRAMES.items():
        name = FRAME_NAME.format(n=n)
        jobs.append((FRAME_DIR + name, RAW_DIR / name, f"frame-{key}"))

    print("Downloading NASA SVS 3912 assets ...")
    for url, dest, role in jobs:
        download(url, dest)
        records.append({"role": role, "url": url, "file": dest.name,
                        "bytes": dest.stat().st_size, "sha256": sha256(dest)})

    out = RAW_DIR / "acquisition.json"
    out.write_text(json.dumps({"acquiredUTC": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                               "files": records}, indent=2), encoding="utf-8")
    print(f"Wrote {out}")


if __name__ == "__main__":
    main()
