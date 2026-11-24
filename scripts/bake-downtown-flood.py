"""Bake the Downtown Dubai cloudburst into flood-depth overlays for the DM demo space.

Runs Map 3D's shallow-water solver (a NumPy port of `floodSimCpuStep` in
llumen3Viz `src/lib/floodSim.ts`) on its Downtown Dubai grid, with the recorded
16 April 2024 storm time-lapsed 240x, as Map 3D's "Cloudburst" source does.
Each scenario adds drainage the source model leaves out (pumps, drains, a
storage tunnel), so the after views are the same storm with that fix.

    python3 scripts/bake-downtown-flood.py analyze   # hotspots of the unmitigated storm
    python3 scripts/bake-downtown-flood.py bake      # PNG overlays + flood stats JSON
"""

import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image

MAP3D = Path.home() / "Cursor" / "Map 3D" / "public" / "data" / "flood"
OUT = Path(__file__).resolve().parent.parent / "public" / "llumen-assets" / "flood"
STATS = Path(__file__).resolve().parent.parent / "src" / "llumen-assistant" / "municipality" / "floodBake.ts"

SIM_SECONDS = 240.0
TIME_LAPSE = 240.0
DAMPING = 0.999
G = 9.81
DRY_M = 0.02
FLOODED_M = 0.10
DEEP_M = 0.30
# Pits FABDEM puts below sea level (Burj Lake, a Business Bay basin): standing water, not flooding.
POND_GROUND_M = -0.5

header = json.loads((MAP3D / "downtown-dubai.json").read_text())
COLS, ROWS, CELL = header["cols"], header["rows"], header["cellMeters"]
B = header["bounds"]
raw = np.frombuffer((MAP3D / "downtown-dubai.bin").read_bytes(), dtype="<f2").astype(np.float32)
raw = raw.reshape(ROWS, COLS, 4)
ground = raw[..., 0]
walls = raw[..., 2] > 0.5
harbor = (np.floor(raw[..., 3] + 0.5).astype(np.int32) % 2) == 1
ponds = (ground < POND_GROUND_M) & ~harbor & ~walls
land = ~walls & ~harbor & ~ponds
HARBOR_LEVEL = header["datums"]["MHHW"]
RAIN = header["rain"]["mmPerHour"]


def merc_y(lat):
    return math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))


Y0, Y1 = merc_y(B["south"]), merc_y(B["north"])


def lnglat(col, row):
    lng = B["west"] + (col + 0.5) / COLS * (B["east"] - B["west"])
    y = Y0 + (row + 0.5) / ROWS * (Y1 - Y0)
    return lng, math.degrees(2 * math.atan(math.exp(y)) - math.pi / 2)


def cell_of(lng, lat):
    col = (lng - B["west"]) / (B["east"] - B["west"]) * COLS - 0.5
    row = (merc_y(lat) - Y0) / (Y1 - Y0) * ROWS - 0.5
    return int(round(col)), int(round(row))


def disk(lng, lat, radius_cells):
    c0, r0 = cell_of(lng, lat)
    rr, cc = np.ogrid[:ROWS, :COLS]
    return ((cc - c0) ** 2 + (rr - r0) ** 2 <= radius_cells**2) & land


def rain_rate(sim_seconds):
    """Rain in m per sim second: the storm hour at this time-lapsed clock, sped up to match."""
    frame = int(sim_seconds * TIME_LAPSE // 3600)
    mm = RAIN[frame] if frame < len(RAIN) else 0.0
    return mm * TIME_LAPSE / 1000 / 3600


def rain_total_mm(sim_seconds):
    storm = sim_seconds * TIME_LAPSE
    return sum(rate * min(3600, max(0, storm - i * 3600)) / 3600 for i, rate in enumerate(RAIN))


def simulate(drain_mm_h=0.0, drain_mask=None, sinks=()):
    """Depth after SIM_SECONDS. `sinks` are (mask, m3/s) pumps or intakes, in real-time capacity."""
    dt = min(0.25, 0.5 * CELL / math.sqrt(G * max(0.1, HARBOR_LEVEL - float(ground.min()))))
    steps = int(math.ceil(SIM_SECONDS / dt))
    dt = SIM_SECONDS / steps
    depth = np.where(harbor, np.maximum(HARBOR_LEVEL - ground, 0), 0).astype(np.float32)
    flux = np.zeros((4, ROWS, COLS), np.float32)  # west, east, south, north
    open_ = ~walls
    nb = [np.zeros((ROWS, COLS), bool) for _ in range(4)]
    nb[0][:, 1:] = open_[:, :-1]
    nb[1][:, :-1] = open_[:, 1:]
    nb[2][1:, :] = open_[:-1, :]
    nb[3][:-1, :] = open_[1:, :]
    drain = np.zeros((ROWS, COLS), np.float32)
    if drain_mm_h:
        drain[drain_mask if drain_mask is not None else land] = drain_mm_h * TIME_LAPSE / 1000 / 3600
    sink_rate = np.zeros((ROWS, COLS), np.float32)
    for mask, m3s in sinks:
        sink_rate[mask] += m3s * TIME_LAPSE / (mask.sum() * CELL * CELL)
    removal = drain + sink_rate
    area = CELL * CELL
    k = dt * G * CELL
    for i in range(steps):
        head = ground + depth
        hn = np.empty((4, ROWS, COLS), np.float32)
        hn[0][:, 1:] = head[:, :-1]
        hn[1][:, :-1] = head[:, 1:]
        hn[2][1:, :] = head[:-1, :]
        hn[3][:-1, :] = head[1:, :]
        active = open_ & (depth > 0)
        f = np.maximum(0, flux * DAMPING + k * (head[None] - hn))
        for d in range(4):
            f[d] = np.where(nb[d] & active, f[d], 0)
        out = f.sum(0)
        vol = depth * area
        over = out * dt > vol
        scale = np.where(over, vol / np.maximum(out * dt, 1e-12), 1)
        f *= scale[None]
        flux = f
        inflow = np.zeros((ROWS, COLS), np.float32)
        inflow[:, 1:] += f[1][:, :-1]
        inflow[:, :-1] += f[0][:, 1:]
        inflow[1:, :] += f[3][:-1, :]
        inflow[:-1, :] += f[2][1:, :]
        depth = np.maximum(0, depth + dt * (inflow - f.sum(0)) / area)
        depth += rain_rate(i * dt) * dt
        if removal.any():
            depth = np.maximum(0, depth - removal * dt)
        depth = np.where(harbor, np.maximum(HARBOR_LEVEL - ground, 0), depth)
        depth[walls] = 0
    return depth


def clusters(depth, threshold=0.15, min_cells=150):
    from collections import deque

    wet = (depth > threshold) & land
    seen = np.zeros_like(wet)
    found = []
    for r0, c0 in zip(*np.nonzero(wet)):
        if seen[r0, c0]:
            continue
        queue, cells = deque([(r0, c0)]), []
        seen[r0, c0] = True
        while queue:
            r, c = queue.popleft()
            cells.append((r, c))
            for nr, nc in ((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)):
                if 0 <= nr < ROWS and 0 <= nc < COLS and wet[nr, nc] and not seen[nr, nc]:
                    seen[nr, nc] = True
                    queue.append((nr, nc))
        if len(cells) < min_cells:
            continue
        rs, cs = np.array(cells).T
        deepest = int(np.argmax(depth[rs, cs]))
        found.append(
            {
                "ha": round(len(cells) * CELL * CELL / 1e4, 1),
                "maxM": round(float(depth[rs, cs].max()), 2),
                "deepest": [round(v, 5) for v in lnglat(cs[deepest], rs[deepest])],
                "centre": [round(v, 5) for v in lnglat(cs.mean(), rs.mean())],
            }
        )
    return sorted(found, key=lambda c: -c["ha"])


def summary(depth):
    on_land = depth[land]
    return {
        "floodedHa": round(float((on_land > FLOODED_M).sum()) * CELL * CELL / 1e4, 1),
        "deepHa": round(float((on_land > DEEP_M).sum()) * CELL * CELL / 1e4, 1),
        "maxStreetM": round(float(np.percentile(on_land, 99.9)), 2),
    }


# Mapped from `analyze`: the unmitigated storm's deepest street sheets.
HOTSPOTS = {
    "financialCentre": (55.28516, 25.19818),
    "burjKhalifaMetro": (55.26916, 25.20027),
    "alKhail": (55.2904, 25.17846),
    "boulevard": (55.27202, 25.19599),
    "alWasl": (55.25542, 25.19315),
}
PUMPS = [HOTSPOTS[k] for k in ("financialCentre", "burjKhalifaMetro", "alKhail", "boulevard")]
SCENARIOS = {
    "pumps": {"sim": {"sinks": [(disk(*p, 10), 2.5) for p in PUMPS]}},
    "drains": {"sim": {"drain_mm_h": 12}},
    "tunnel": {
        "sim": {
            "drain_mm_h": 16,
            "sinks": [(disk(*p, 14), 8.0) for p in HOTSPOTS.values()],
        }
    },
}

RAMP = [(0.0, (124, 226, 255)), (0.3, (40, 160, 255)), (0.8, (40, 84, 230)), (1.5, (70, 40, 190))]


def color(depth):
    rgb = np.zeros((*depth.shape, 3), np.float32)
    for (d0, c0), (d1, c1) in zip(RAMP, RAMP[1:]):
        t = np.clip((depth - d0) / (d1 - d0), 0, 1)[..., None]
        band = (depth >= d0) & (depth < d1) if d1 != RAMP[-1][0] else depth >= d0
        rgb = np.where(band[..., None], np.array(c0) + t * (np.array(c1) - np.array(c0)), rgb)
    alpha = np.clip((depth - DRY_M) / (FLOODED_M - DRY_M), 0, 1) * 0.92
    alpha[~land] = 0
    rgba = np.dstack([rgb, alpha * 255]).astype(np.uint8)
    return Image.fromarray(rgba[::-1])  # row 0 is south; images run north-down


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "analyze"
    print(f"{SIM_SECONDS:.0f} sim s = {rain_total_mm(SIM_SECONDS):.1f} mm fallen", flush=True)
    if mode == "analyze":
        depth = simulate()
        np.save("/tmp/downtown-flood-before.npy", depth)
        print(json.dumps(summary(depth)))
        for c in clusters(depth)[:12]:
            print(json.dumps(c))
        return
    OUT.mkdir(parents=True, exist_ok=True)
    stats = {
        "simSeconds": SIM_SECONDS,
        "rainMm": round(rain_total_mm(SIM_SECONDS), 1),
        "bounds": B,
        "hotspots": {k: list(v) for k, v in HOTSPOTS.items()},
        "pumps": [list(p) for p in PUMPS],
        "scenarios": {},
    }
    for name, spec in {"before": {}, **SCENARIOS}.items():
        depth = simulate(**spec.get("sim", {}))
        color(depth).save(OUT / f"downtown-{name}.png", optimize=True)
        hot = {k: round(float(depth[disk(*v, 6)].max(initial=0)), 2) for k, v in HOTSPOTS.items()}
        stats["scenarios"][name] = {**summary(depth), "hotspots": hot}
        print(name, json.dumps(stats["scenarios"][name]), flush=True)
    STATS.write_text(
        "/** Written by scripts/bake-downtown-flood.py from Map 3D's Downtown Dubai grid. Depths in m, areas in ha. */\n"
        f"export const FLOOD_BAKE = {json.dumps(stats, indent=2)} as const\n"
    )


if __name__ == "__main__":
    main()
