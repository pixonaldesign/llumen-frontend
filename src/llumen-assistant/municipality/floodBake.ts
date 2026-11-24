/** Written by scripts/bake-downtown-flood.py from Map 3D's Downtown Dubai grid. Depths in m, areas in ha. */
export const FLOOD_BAKE = {
  "simSeconds": 240.0,
  "rainMm": 75.6,
  "bounds": {
    "west": 55.25,
    "east": 55.292012,
    "south": 25.177,
    "north": 25.2030152
  },
  "hotspots": {
    "financialCentre": [
      55.28516,
      25.19818
    ],
    "burjKhalifaMetro": [
      55.26916,
      25.20027
    ],
    "alKhail": [
      55.2904,
      25.17846
    ],
    "boulevard": [
      55.27202,
      25.19599
    ],
    "alWasl": [
      55.25542,
      25.19315
    ]
  },
  "pumps": [
    [
      55.28516,
      25.19818
    ],
    [
      55.26916,
      25.20027
    ],
    [
      55.2904,
      25.17846
    ],
    [
      55.27202,
      25.19599
    ]
  ],
  "scenarios": {
    "before": {
      "floodedHa": 182.9,
      "deepHa": 21.6,
      "maxStreetM": 0.77,
      "hotspots": {
        "financialCentre": 0.91,
        "burjKhalifaMetro": 0.29,
        "alKhail": 0.51,
        "boulevard": 1.92,
        "alWasl": 0.37
      }
    },
    "pumps": {
      "floodedHa": 165.4,
      "deepHa": 15.9,
      "maxStreetM": 0.74,
      "hotspots": {
        "financialCentre": 0.08,
        "burjKhalifaMetro": 0.0,
        "alKhail": 0.02,
        "boulevard": 0.0,
        "alWasl": 0.37
      }
    },
    "drains": {
      "floodedHa": 14.3,
      "deepHa": 1.9,
      "maxStreetM": 0.44,
      "hotspots": {
        "financialCentre": 0.63,
        "burjKhalifaMetro": 0.11,
        "alKhail": 0.26,
        "boulevard": 0.81,
        "alWasl": 0.13
      }
    },
    "tunnel": {
      "floodedHa": 4.0,
      "deepHa": 1.4,
      "maxStreetM": 0.41,
      "hotspots": {
        "financialCentre": 0.0,
        "burjKhalifaMetro": 0.0,
        "alKhail": 0.0,
        "boulevard": 0.0,
        "alWasl": 0.0
      }
    }
  }
} as const
