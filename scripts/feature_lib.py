"""Pure helpers shared by the pipeline steps (no file-system side effects).

Feature definition (Pipeline B, visual-frame sonification)
---------------------------------------------------------
For every ocean pixel drawn by NASA's renderer we ask: *where on NASA's own
published colour legend does this colour sit?*  The answer is a number in
[0, 1] — 0 is the legend's left end (labelled 0 °C) and 1 its right end
(labelled 32 °C).  We call it the **normalized palette position**.

It is a property of the image, not a temperature measurement: streaks are
drawn with varying brightness and blending, and the dark gaps between them
carry no colour at all.  So:

* colour *direction* (chromaticity) is matched, brightness is ignored;
* gray, unsaturated pixels are treated as land (GTOPO30 shaded relief);
* dark/unsaturated ocean pixels are treated as "no colour" (occluded);
* each 4x4-pixel cell reports the median palette position of its matched
  pixels plus a confidence score; low-confidence cells become rests.
"""
import numpy as np

STATUS = {"ok": 0, "land": 1, "occluded": 2}
NO_VALUE = 255           # stored in the value plane when there is no usable value
VALUE_SCALE = 250        # value plane stores round(position * 250)


def legend_lut(cbar_rgba):
    """Extract the ordered colour ramp from NASA's sst_ecco2_cbar.png.

    Returns (colors[N,3] float, positions[N] in 0..1, (x0, x1, row)).
    The bar is located as the widest run of strongly saturated pixels.
    """
    rgb = cbar_rgba[..., :3].astype(float)
    alpha = cbar_rgba[..., 3] if cbar_rgba.shape[-1] == 4 else np.full(rgb.shape[:2], 255)
    mx, mn = rgb.max(-1), rgb.min(-1)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0)
    colorful = (sat > 0.5) & (mx > 120) & (alpha > 200)
    counts = colorful.sum(1)
    rows = np.where(counts >= counts.max() * 0.95)[0]
    row = int(np.median(rows))
    cols = np.where(colorful[row])[0]
    x0, x1 = int(cols.min()), int(cols.max())
    band = rgb[rows.min():rows.max() + 1, x0:x1 + 1].mean(0)   # average the bar's rows
    positions = np.linspace(0.0, 1.0, band.shape[0])
    return band, positions, (x0, x1, row)


def hue_degrees(rgb):
    """HSV hue in degrees, unwrapped so the legend's red end is slightly
    negative (legend runs ~228 deg blue -> ~-6 deg red, strictly decreasing)."""
    rgb = rgb.astype(float)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx, mn = rgb.max(-1), rgb.min(-1)
    d = np.maximum(mx - mn, 1e-6)
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    return np.where(h > 300, h - 360, h)


def legend_hue_curve(lut_colors, lut_pos):
    """Return (hues ascending, positions) for np.interp. Verifies monotonicity."""
    hues = hue_degrees(lut_colors)
    if np.diff(hues).max() > 0.5:
        raise ValueError("Legend hue is not monotonic; palette-position feature is ill-defined")
    hues = np.minimum.accumulate(hues)       # remove sub-degree jitter
    return hues[::-1], lut_pos[::-1]


def classify_pixels(rgb, lut_colors, lut_pos, max_hue_gap):
    """Per-pixel classification.

    Pixels are matched to the legend by HUE only.  Hue is invariant to the
    brightness of a streak and to the lighter rendering of the legend PNG,
    and the legend's hue is strictly monotonic, so hue -> legend position is a
    well-defined inverse.  Pixels whose hue falls outside the legend's hue
    range (by more than max_hue_gap degrees) are left unmatched.

    Returns (position[H,W] float with NaN where unmatched, is_land[H,W] bool).
    """
    rgb = rgb.astype(float)
    mx, mn = rgb.max(-1), rgb.min(-1)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0)

    is_land = (sat < 0.18) & (mx >= 28) & (mx <= 150)
    candidate = (mx >= 40) & (sat >= 0.45)

    hues_asc, pos_asc = legend_hue_curve(lut_colors, lut_pos)
    h = hue_degrees(rgb)
    in_range = (h >= hues_asc[0] - max_hue_gap) & (h <= hues_asc[-1] + max_hue_gap)
    matched = candidate & in_range

    pos = np.full(rgb.shape[:2], np.nan)
    pos[matched] = np.interp(h[matched], hues_asc, pos_asc)   # clamps at the ends
    return pos, is_land


def cell_features(pos, is_land, cell, min_pixels, min_conf):
    """Aggregate per-pixel results into a (H/cell, W/cell) feature grid."""
    h, w = pos.shape
    gh, gw = h // cell, w // cell
    p = pos[:gh * cell, :gw * cell].reshape(gh, cell, gw, cell).transpose(0, 2, 1, 3).reshape(gh, gw, -1)
    l = is_land[:gh * cell, :gw * cell].reshape(gh, cell, gw, cell).transpose(0, 2, 1, 3).reshape(gh, gw, -1)

    n = np.sum(~np.isnan(p), -1)
    land_frac = l.mean(-1)
    with np.errstate(all="ignore"):
        import warnings
        warnings.simplefilter("ignore", RuntimeWarning)
        med = np.nanmedian(p, -1)
        mad = np.nanmedian(np.abs(p - med[..., None]), -1)
    coverage = np.minimum(1.0, n / 8.0)
    agreement = np.clip(1.0 - np.nan_to_num(mad, nan=1.0) / 0.08, 0.0, 1.0)
    conf = coverage * agreement

    status = np.full((gh, gw), STATUS["occluded"], dtype=np.uint8)
    status[land_frac >= 0.5] = STATUS["land"]
    ok = (land_frac < 0.5) & (n >= min_pixels) & (conf >= min_conf)
    status[ok] = STATUS["ok"]

    value = np.full((gh, gw), NO_VALUE, dtype=np.uint8)
    value[ok] = np.round(med[ok] * VALUE_SCALE).astype(np.uint8)
    confidence = np.round(np.nan_to_num(conf) * 255).astype(np.uint8)
    return value, status, confidence


# --- Geometry (mirrors src/domain/projection.ts and routeGeometry.ts) -------

EARTH_RADIUS_KM = 6371.0088
DENSIFY_DEG = 0.25


def geo_to_pixel(lat, lon, width, height):
    """Equirectangular, lon -180..180 left->right, lat 90..-90 top->bottom."""
    lon = ((lon + 180.0) % 360.0) - 180.0
    return (lon + 180.0) / 360.0 * width, (90.0 - lat) / 180.0 * height


def haversine_km(a, b):
    la1, lo1, la2, lo2 = map(np.radians, (a[0], a[1], b[0], b[1]))
    h = np.sin((la2 - la1) / 2) ** 2 + np.cos(la1) * np.cos(la2) * np.sin((lo2 - lo1) / 2) ** 2
    return 2 * EARTH_RADIUS_KM * np.arcsin(np.sqrt(h))


def resample_geographic(points, n):
    """Equal great-circle-distance resampling (linear interpolation in lat/lon
    between dense sub-steps). Mirrors resampleGeographic() in TypeScript."""
    pts = [(float(a), float(b)) for a, b in points]
    # unwrap longitudes across the antimeridian
    unwrapped = [pts[0]]
    for lat, lon in pts[1:]:
        prev = unwrapped[-1][1]
        while lon - prev > 180:
            lon -= 360
        while lon - prev < -180:
            lon += 360
        unwrapped.append((lat, lon))
    # densify so cumulative haversine distance follows the path as drawn on the map
    dense = [unwrapped[0]]
    for i in range(1, len(unwrapped)):
        (la0, lo0), (la1, lo1) = unwrapped[i - 1], unwrapped[i]
        steps = max(1, int(np.ceil(max(abs(la1 - la0), abs(lo1 - lo0)) / DENSIFY_DEG)))
        for s in range(1, steps + 1):
            t = s / steps
            dense.append((la0 + t * (la1 - la0), lo0 + t * (lo1 - lo0)))
    unwrapped = dense
    cum = [0.0]
    for i in range(1, len(unwrapped)):
        cum.append(cum[-1] + haversine_km(unwrapped[i - 1], unwrapped[i]))
    total = cum[-1]
    out = []
    for k in range(n):
        target = total * k / (n - 1)
        j = 1
        while j < len(cum) - 1 and cum[j] < target:
            j += 1
        seg = cum[j] - cum[j - 1]
        t = 0.0 if seg == 0 else (target - cum[j - 1]) / seg
        lat = unwrapped[j - 1][0] + t * (unwrapped[j][0] - unwrapped[j - 1][0])
        lon = unwrapped[j - 1][1] + t * (unwrapped[j][1] - unwrapped[j - 1][1])
        out.append((lat, ((lon + 180.0) % 360.0) - 180.0))
    return out, total
