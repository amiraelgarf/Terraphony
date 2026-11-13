"""Step 1 — download the official NASA SVS 3912 assets used by the app.

Downloads (into data-raw/):
  * flat_ecco2_dates.txt  – NASA's frame-number -> UTC timestamp table
  * sst_ecco2_cbar.png    – NASA's published SST colour legend
  * one TIFF frame per entry in pipeline_config.FRAMES

Writes data-raw/acquisition.json with URLs, byte sizes and SHA-256 checksums.
Re-running is safe: files already present with a recorded checksum are kept.

Usage:  python scripts/acquire_svs3912_frames.py
"""
import hashlib
import json
import ssl
import time
import urllib.request

from pipeline_config import (COLORBAR_FILE, DATES_FILE, FRAME_DIR, FRAME_NAME,
                             FRAMES, RAW_DIR, SVS_BASE)

USER_AGENT = "earth-information-jukebox-data-pipeline/1.0"


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def download(url, dest, attempts=5):
    """Download with retries (the SVS server occasionally resets connections)."""
    if dest.exists() and dest.stat().st_size > 0:
        print(f"  cached  {dest.name}")
        return
    ctx = ssl.create_default_context()
    for i in range(1, attempts + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=120, context=ctx) as r:
                data = r.read()
            tmp = dest.with_suffix(dest.suffix + ".part")
            tmp.write_bytes(data)
            tmp.replace(dest)
            print(f"  fetched {dest.name} ({len(data)/1e6:.1f} MB)")
            return
        except Exception as exc:  # network errors: retry with backoff
            print(f"  attempt {i} failed for {url}: {exc}")
            time.sleep(2 * i)
    raise SystemExit(f"Could not download {url}. Check your connection and retry.")


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
