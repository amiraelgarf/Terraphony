"""Geometry helpers shared by the pipeline (mirror src/data/geodesicPath.ts)."""
import numpy as np

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
