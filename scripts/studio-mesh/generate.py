#!/usr/bin/env python3
"""Renders the Studio cover meshes: the visual for an asset that has no chart, table, map or thumbnail.

Each cover is a brand mesh (see mesh.py) from one of the brand's families, built from a seed so the set is
reproducible. Brand rules it keeps: Void / Night grounds, spectrum blue and red only as light, plum and lavender
as tints, no greens or yellows, one to three streaks varying between covers, always with grain. The card's title
sits bottom-left, so every cover keeps that corner dark.

Usage: python scripts/studio-mesh/generate.py [count]   (default 16)
Writes public/llumen-assets/studio/mesh/cover-NN.jpg and palettes.json beside them. Needs numpy and Pillow.
"""
import json, os, random, sys

from mesh import render

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'public', 'llumen-assets', 'studio', 'mesh')
W, H = 760, 368  # 2x the card's image area (379.5 x 183.76)

GROUNDS = ['#06070D', '#0C0E22', '#0A0B16']
FAMILIES = {
    'tide': {'light': ['#95C0DE', '#7FA6C8', '#5E8FC8', '#5A8CC4'], 'mid': ['#354B71', '#2C4A78', '#466FA3'],
             'tint': ['#22305A', '#1A2448']},
    'ember': {'light': ['#E68392', '#D88A8E', '#C9585E', '#C3555A'], 'mid': ['#A33E43', '#7E2C3C', '#A8434B'],
              'tint': ['#5C2852', '#2A0F1E', '#6A2F5E']},
    'dusk': {'light': ['#466FA3', '#5E8FC8', '#A8434B', '#C3555A'], 'mid': ['#6B3F86', '#5A3A78', '#22305A'],
             'tint': ['#5C2852', '#0C0E22']},
    'spectrum': {'light': ['#5E8FC8', '#CF5D63', '#95C0DE', '#E68392'], 'mid': ['#C9B6D8', '#354B71', '#A33E43'],
                 'tint': ['#5C2852', '#1A2448', '#150A12']},
    'halo': {'light': ['#9DBFE4', '#C9B6D8', '#E08A9C'], 'mid': ['#5D66B8', '#4A5596', '#9AA3F0'],
             'tint': ['#120F26', '#22305A']},
}
ORDER = ['tide', 'ember', 'dusk', 'spectrum', 'halo']


def r2(x):
    return round(x, 3)


def palette(index, rng):
    fam = FAMILIES[ORDER[index % len(ORDER)]]
    cx = rng.uniform(0.5, 0.85)
    points = []
    for col in rng.sample(fam['light'], 2):
        points.append([col, r2(cx + rng.uniform(-0.18, 0.18)), r2(rng.uniform(0.0, 0.42)), r2(rng.uniform(0.5, 0.7))])
    points.append([rng.choice(fam['mid']), r2(cx + rng.uniform(-0.3, 0.2)), r2(rng.uniform(0.4, 0.7)), r2(rng.uniform(0.55, 0.75))])
    points.append([rng.choice(fam['tint']), r2(rng.uniform(0.6, 1.02)), r2(rng.uniform(0.75, 1.0)), r2(rng.uniform(0.55, 0.75))])
    points.append([GROUNDS[0], r2(rng.uniform(-0.04, 0.06)), r2(rng.uniform(0.95, 1.06)), r2(rng.uniform(1.1, 1.3))])
    points.append([GROUNDS[1], r2(rng.uniform(0.3, 0.5)), r2(rng.uniform(1.0, 1.08)), r2(rng.uniform(0.75, 0.9))])
    points.append([rng.choice(GROUNDS), r2(rng.uniform(-0.04, 0.18)), r2(rng.uniform(0.2, 0.5)), r2(rng.uniform(0.75, 0.95))])
    points.append([rng.choice(GROUNDS), r2(rng.uniform(0.0, 1.0)), r2(rng.uniform(-0.08, 0.0)), r2(rng.uniform(0.45, 0.6))])
    angle = rng.choice([-1, 1]) * rng.uniform(14, 78)
    streaks = []
    for s in range(index % 3 + 1):
        streaks.append([
            r2(cx + rng.uniform(-0.25, 0.15)), r2(rng.uniform(0.15, 0.5)), round(angle + rng.uniform(-8, 8)),
            r2(rng.uniform(1.1, 1.4) if s == 0 else rng.uniform(0.6, 0.95)),
            r2(rng.uniform(0.13, 0.17) if s == 0 else rng.uniform(0.08, 0.13)), 0,
            r2(rng.uniform(0.42, 0.54) if s == 0 else rng.uniform(0.26, 0.4)),
        ])
    return {'family': ORDER[index % len(ORDER)], 'points': points, 'streaks': streaks}


def main(count):
    os.makedirs(OUT, exist_ok=True)
    specs = {}
    for i in range(count):
        name = f'cover-{i + 1:02d}'
        spec = palette(i, random.Random(f'llumen-studio-{i}'))
        render(spec, W, H, seed=i + 7).save(os.path.join(OUT, f'{name}.jpg'), quality=86, subsampling=0)
        specs[name] = spec
        print('mesh', name, spec['family'], len(spec['streaks']), 'streaks')
    with open(os.path.join(OUT, 'palettes.json'), 'w') as f:
        json.dump(specs, f, indent=1)


if __name__ == '__main__':
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 16)
