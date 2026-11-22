"""The llumen-branding mesh renderer (src/mesh/render.py there): the same maths and constants, so these covers
match the brand's meshes. Keep it in step with that file; only the palette set and the output differ here.
"""
import numpy as np
from PIL import Image


# shared constants (js/mesh.js uses the same numbers)
WARP1, FREQ1 = 0.13, 2.2
WARP2, FREQ2 = 0.045, 4.6
ORBIT = 0.05
SHARP = 6.0          # higher = crisper edges between colours
GRAIN = 0.085        # film grain, sRGB amplitude
DRIFT = 0.03          # how far each stroke slides along its path
LAV = (0.93, 0.91, 1.0)  # highlight colour (sRGB), mixed with the local mesh colour


def hex_rgb(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])


def srgb_to_lin(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def lin_to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055)


M1 = np.array([[0.4122214708, 0.5363325363, 0.0514459929],
               [0.2119034982, 0.6806995451, 0.1073969566],
               [0.0883024619, 0.2817188376, 0.6299787005]])
M2 = np.array([[0.2104542553, 0.7936177850, -0.0040720468],
               [1.9779984951, -2.4285922050, 0.4505937099],
               [0.0259040371, 0.7827717662, -0.8086757660]])


def to_oklab(rgb):
    lms = M1 @ srgb_to_lin(rgb)
    return M2 @ np.cbrt(lms)


def from_oklab(lab):  # lab: (..., 3)
    l_ = lab[..., 0] + 0.3963377774 * lab[..., 1] + 0.2158037573 * lab[..., 2]
    m_ = lab[..., 0] - 0.1055613458 * lab[..., 1] - 0.0638541728 * lab[..., 2]
    s_ = lab[..., 0] - 0.0894841775 * lab[..., 1] - 1.2914855480 * lab[..., 2]
    l, m, s = l_ ** 3, m_ ** 3, s_ ** 3
    r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
    g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
    b = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    return lin_to_srgb(np.stack([r, g, b], -1))


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def seg(qx, qy, ax, ay, bx, by, raw=False):
    """Distance to segment AB and position t (0..1) along it (raw: unclamped t too)."""
    vx, vy = bx - ax, by - ay
    tr = ((qx - ax) * vx + (qy - ay) * vy) / (vx * vx + vy * vy)
    t = np.clip(tr, 0, 1)
    d = np.hypot(qx - ax - t * vx, qy - ay - t * vy)
    return (d, t, tr) if raw else (d, t)


def render(spec, W, H, T=0.0, seed=7):
    points = spec['points']
    ar = W / H
    y, x = np.mgrid[0:H, 0:W].astype(np.float64)
    u, v = (x + 0.5) / W, (y + 0.5) / H
    px, py = (u - 0.5) * ar, (v - 0.5)          # unwarped: light sits on straight lines
    qx, qy = (px + WARP1 * np.sin(FREQ1 * py + T * 0.8 + 0.5),
              py + WARP1 * np.sin(FREQ1 * px - T * 0.6 + 2.1))
    qx, qy = (qx + WARP2 * np.sin(FREQ2 * qy - T * 1.1 + 4.0),
              qy + WARP2 * np.sin(FREQ2 * qx + T * 0.9 + 1.0))
    acc = np.zeros((H, W, 3)); wsum = np.zeros((H, W))
    for i, (col, cx0, cy0, reach) in enumerate(points):
        cx = (cx0 - 0.5) * ar + ORBIT * np.sin(T * 0.7 + i * 1.9)
        cy = (cy0 - 0.5) + ORBIT * np.cos(T * 0.6 + i * 2.7)
        d2 = ((qx - cx) ** 2 + (qy - cy) ** 2) / (reach * reach)
        w = np.exp(-SHARP * d2) + 1e-30
        acc += w[..., None] * to_oklab(hex_rgb(col))
        wsum += w
    base = srgb_to_lin(from_oklab(acc / wsum[..., None]))
    tint = 0.6 * srgb_to_lin(np.array(LAV)) + 0.4 * np.clip(base * 2.5, 0, 1)
    light = np.zeros((H, W, 3))
    A = lambda X, Y: ((X - 0.5) * ar, Y - 0.5)
    for i, (sx, sy, ang, ln, r, bend, a) in enumerate(spec.get('streaks', [])):
        mx, my = A(sx, sy)
        th = np.radians(ang); dx, dy = np.cos(th), np.sin(th); nx, ny = -dy, dx
        if abs(bend) < 1e-3:                                           # straight stroke
            off = DRIFT * np.sin(T * 0.5 + i * 2.1)
            mx2, my2 = mx + dx * off, my + dy * off
            a2 = a * (0.75 + 0.25 * np.sin(T * 0.9 + i * 1.3))
            ch = []
            for f in (0.18, 0.0, -0.18):                               # R, G, B offset across the stroke
                ox, oy = mx2 + nx * r * f, my2 + ny * r * f
                d, t = seg(px, py, ox - dx * ln / 2, oy - dy * ln / 2, ox + dx * ln / 2, oy + dy * ln / 2)
                body = 1 - smooth(r * 0.35, r * 1.05, d)
                rim = np.exp(-((d - r * 0.82) / (r * 0.18)) ** 2)
                glow = 0.35 * np.exp(-(d / (r * 2.4)) ** 2)
                ramp = smooth(0.0, 0.45, t) * smooth(1.0, 0.75, t) * (0.4 + 0.6 * t)
                ch.append((0.38 * body + 0.4 * rim + glow) * ramp)
            light += np.stack(ch, -1) * tint * a2
            continue
        Rc = 1.0 / max(abs(bend), 1e-3) * np.sign(bend or 1)         # radius of the path; sign = which way it bends
        cx, cy = mx + nx * Rc, my + ny * Rc                            # centre of the path's circle
        phi0 = np.arctan2(my - cy, mx - cx)
        half = ln / 2 / abs(Rc)                                        # half the path, as an angle
        sgn = -np.sign(Rc)                                             # travel direction around the circle
        phi0 += sgn * DRIFT / abs(Rc) * np.sin(T * 0.5 + i * 2.1)
        a = a * (0.75 + 0.25 * np.sin(T * 0.9 + i * 1.3))
        ang_p = np.arctan2(py - cy, px - cx)
        dl = sgn * ((ang_p - phi0 + np.pi) % (2 * np.pi) - np.pi)      # position along the path, as an angle
        dc = np.clip(dl, -half, half)
        t = (dc + half) / (2 * half)                                   # 0 at the tail, 1 at the leading end
        ch = []
        for f in (0.18, 0.0, -0.18):                                   # R, G, B offset across the stroke
            Rf = abs(Rc) + f * r
            qx = cx + Rf * np.cos(phi0 + sgn * dc); qy = cy + Rf * np.sin(phi0 + sgn * dc)
            d = np.hypot(px - qx, py - qy)
            body = 1 - smooth(r * 0.35, r * 1.05, d)
            rim = np.exp(-((d - r * 0.82) / (r * 0.18)) ** 2)              # the rails that make it read as a line
            glow = 0.35 * np.exp(-(d / (r * 2.4)) ** 2)
            ramp = smooth(0.0, 0.45, t) * smooth(1.0, 0.75, t) * (0.4 + 0.6 * t)   # smeared ends, bright leading end
            ch.append((0.38 * body + 0.4 * rim + glow) * ramp)
        light += np.stack(ch, -1) * tint * a
    lin = base + light
    lin = np.where(lin < 0.75, lin, 0.75 + (lin - 0.75) / (1 + (lin - 0.75) / 0.25))   # soft shoulder
    rgb = lin_to_srgb(lin)
    rng = np.random.default_rng(seed)
    rgb = rgb + (rng.random((H, W, 1)) - 0.5) * GRAIN
    return Image.fromarray((np.clip(rgb, 0, 1) * 255 + 0.5).astype(np.uint8))
