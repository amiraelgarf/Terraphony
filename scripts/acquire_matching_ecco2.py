"""Optional — Pipeline A probe: is matching ECCO2 numeric output reachable?

The spec asks us to *attempt* numeric ECCO2 access quickly and fail honestly.
SVS 3912 does not host the model fields. ECCO2 "cube92" output lives on JPL's
ECCO Drive, which requires an Earthdata login and is not guaranteed to match
the exact model run/time steps rendered by SVS in 2012.

This script only probes reachability and prints what it found; it never
downloads or substitutes another dataset. The app runs in visual-frame mode
regardless of the result until someone completes and validates Pipeline A.

Usage:  python scripts/acquire_matching_ecco2.py
"""
import urllib.error
import urllib.request

PROBE_URL = "https://ecco.jpl.nasa.gov/drive/files/ECCO2/cube92_latlon_quart_90S90N/"


def main():
    try:
        with urllib.request.urlopen(PROBE_URL, timeout=30) as r:
            print(f"Reachable (HTTP {r.status}). Next steps (manual): authenticate with Earthdata, "
                  "identify the SST (THETA level 1) files for the exact SVS 3912 timestamps, verify units (K vs degC) "
                  "and grid, then extend the pipeline. Until validated, keep visual-frame mode.")
    except urllib.error.HTTPError as e:
        print(f"ECCO Drive answered HTTP {e.code} — credentials required. Pipeline A not available; "
              "staying in visual-frame mode (Pipeline B).")
    except Exception as e:  # DNS / TLS / connection failures
        print(f"ECCO Drive not reachable ({e.__class__.__name__}: {e}). Pipeline A not available; "
              "staying in visual-frame mode (Pipeline B).")


if __name__ == "__main__":
    main()
