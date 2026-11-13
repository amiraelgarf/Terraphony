"""Small network/file helpers shared by every acquisition script."""
import hashlib
import ssl
import time
import urllib.request

USER_AGENT = "earth-records-data-pipeline/2.0"


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def fetch(url, timeout=120, attempts=5, accept="*/*"):
    """GET a URL with retries and backoff; returns bytes or raises SystemExit."""
    ctx = ssl.create_default_context()
    for i in range(1, attempts + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": accept})
            with urllib.request.urlopen(req, timeout=timeout, context=ctx) as r:
                return r.read()
        except Exception as exc:  # network errors: retry with backoff
            print(f"  attempt {i} failed for {url[:120]}...: {exc}")
            time.sleep(3 * i)
    raise SystemExit(f"Could not download {url}. Check your connection and retry.")


def download(url, dest, timeout=120, attempts=5):
    """Download to `dest` unless it already exists (re-runs are cheap)."""
    if dest.exists() and dest.stat().st_size > 0:
        print(f"  cached  {dest.name}")
        return
    data = fetch(url, timeout=timeout, attempts=attempts)
    tmp = dest.with_suffix(dest.suffix + ".part")
    tmp.write_bytes(data)
    tmp.replace(dest)
    print(f"  fetched {dest.name} ({len(data)/1e6:.2f} MB)")
