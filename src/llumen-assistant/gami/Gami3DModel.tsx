/**
 * Procedural 3D models of the alert's cut-off parts (and the UAV and Abrams tank that carry them),
 * turning slowly in place. Built from three.js primitives so the demo needs no model files.
 */
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { loft, materials, mesh, sideExtrude, type Built, type Mats } from './gami3dKit'
import { isFacility, isProduct, isVehicle, type GamiModelId } from './gamiModelIds'
import { PRODUCT_MODELS, facility, type FacilityKind } from './gamiProductModels'
import type { LocalPartId } from './gamiTypes'

type Props = {
  model: GamiModelId
  /** The trim colour. */
  accent: string
  className?: string
  /** Radians per second. */
  spin?: number
  /** Drag to turn the model. */
  interactive?: boolean
  /** On the drone or tank: the part to light up. */
  highlight?: LocalPartId
  /** Camera distance, as a multiple of the model's fitted size. */
  distance?: number
}

/** An outrunner brushless motor: cross mount, copper stator, spinning bell and shaft. */
function motor(m: Mats): Built {
  const root = new THREE.Group()
  for (const angle of [0, Math.PI / 2]) {
    const arm = mesh(new RoundedBoxGeometry(2, 0.07, 0.3, 2, 0.03), m.dark, [0, -0.62, 0])
    arm.rotation.y = angle + Math.PI / 4
    root.add(arm)
    for (const side of [-1, 1]) {
      const hole = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.09, 16), m.black)
      hole.position.set(Math.cos(angle + Math.PI / 4) * 0.82 * side, -0.62, -Math.sin(angle + Math.PI / 4) * 0.82 * side)
      root.add(hole)
    }
  }
  root.add(mesh(new THREE.CylinderGeometry(0.5, 0.56, 0.16, 48), m.dark, [0, -0.52, 0]))
  for (let i = 0; i < 12; i += 1) {
    const angle = (i / 12) * Math.PI * 2
    const coil = mesh(new RoundedBoxGeometry(0.2, 0.36, 0.14, 2, 0.04), m.copper)
    coil.position.set(Math.cos(angle) * 0.56, -0.3, Math.sin(angle) * 0.56)
    coil.rotation.y = -angle
    root.add(coil)
  }
  const bell = new THREE.Group()
  bell.add(mesh(new THREE.CylinderGeometry(0.82, 0.82, 0.62, 64, 1, true), m.steel, [0, 0.06, 0]))
  bell.add(mesh(new THREE.CylinderGeometry(0.82, 0.82, 0.06, 64), m.dark, [0, 0.39, 0]))
  for (let i = 0; i < 6; i += 1) {
    const vent = mesh(new RoundedBoxGeometry(0.42, 0.02, 0.12, 2, 0.01), m.black, [0, 0.43, 0])
    vent.rotation.y = (i / 6) * Math.PI * 2
    vent.translateX(0.42)
    bell.add(vent)
  }
  const band = mesh(new THREE.TorusGeometry(0.83, 0.025, 12, 96), m.accent, [0, -0.18, 0])
  band.rotation.x = Math.PI / 2
  bell.add(band)
  bell.add(mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.14, 32), m.steel, [0, 0.49, 0]))
  bell.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.46, 24), m.steel, [0, 0.74, 0]))
  bell.add(mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.1, 6), m.dark, [0, 0.92, 0]))
  root.add(bell)
  return { root, tick: (t) => (bell.rotation.y = t * 2.2) }
}

/** An EO/IR ball turret on a yoke, its sensor window facing out. */
function gimbal(m: Mats): Built {
  const root = new THREE.Group()
  root.add(mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.08, 48), m.dark, [0, 0.98, 0]))
  root.add(mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.22, 32), m.dark, [0, 0.84, 0]))
  const yoke = new THREE.Group()
  yoke.add(mesh(new RoundedBoxGeometry(1.62, 0.12, 0.36, 2, 0.05), m.dark, [0, 0.7, 0]))
  for (const side of [-1, 1]) {
    yoke.add(mesh(new RoundedBoxGeometry(0.13, 0.82, 0.36, 2, 0.05), m.dark, [side * 0.75, 0.3, 0]))
    const axle = mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.14, 24), m.steel, [side * 0.67, 0, 0])
    axle.rotation.z = Math.PI / 2
    yoke.add(axle)
  }
  const ball = new THREE.Group()
  ball.add(mesh(new THREE.SphereGeometry(0.6, 64, 48), m.paint))
  const aperture = mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.1, 48), m.black, [0, 0, 0.55])
  aperture.rotation.x = Math.PI / 2
  ball.add(aperture)
  const lens = (r: number, x: number, y: number, material: THREE.Material) => {
    const item = mesh(new THREE.CylinderGeometry(r, r, 0.12, 40), material, [x, y, 0.6])
    item.rotation.x = Math.PI / 2
    ball.add(item)
    const ring = mesh(new THREE.TorusGeometry(r, 0.012, 8, 40), m.steel, [x, y, 0.665])
    ball.add(ring)
  }
  lens(0.16, -0.13, 0.04, m.glass)
  lens(0.09, 0.18, 0.1, m.glass)
  lens(0.045, 0.18, -0.14, m.laser)
  const band = mesh(new THREE.TorusGeometry(0.605, 0.018, 10, 96), m.accent)
  band.rotation.x = Math.PI / 2
  ball.add(band)
  yoke.add(ball)
  root.add(yoke)
  return {
    root,
    tick: (t) => {
      yoke.rotation.y = Math.sin(t * 0.6) * 0.5
      ball.rotation.x = Math.sin(t * 0.9) * 0.25
    },
  }
}

/** A sealed inertial navigation unit: finned housing, mounting flanges and round connectors. */
function inu(m: Mats): Built {
  const root = new THREE.Group()
  root.add(mesh(new RoundedBoxGeometry(1.4, 0.66, 1, 4, 0.08), m.dark))
  root.add(mesh(new RoundedBoxGeometry(1.22, 0.05, 0.84, 2, 0.02), m.steel, [0, 0.35, 0]))
  for (let i = 0; i < 9; i += 1) {
    root.add(mesh(new RoundedBoxGeometry(0.05, 0.16, 0.76, 2, 0.02), m.dark, [-0.52 + i * 0.13, 0.45, 0]))
  }
  for (const z of [-0.38, 0.38]) {
    root.add(mesh(new RoundedBoxGeometry(1.78, 0.05, 0.22, 2, 0.02), m.dark, [0, -0.32, z]))
    for (const x of [-0.8, 0.8]) root.add(mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.07, 16), m.black, [x, -0.32, z]))
  }
  for (const [x, r] of [
    [-0.36, 0.14],
    [0.3, 0.11],
  ] as const) {
    const shell = mesh(new THREE.CylinderGeometry(r, r, 0.16, 32), m.steel, [x, -0.02, 0.56])
    shell.rotation.x = Math.PI / 2
    root.add(shell)
    const pins = mesh(new THREE.CylinderGeometry(r * 0.72, r * 0.72, 0.17, 32), m.black, [x, -0.02, 0.57])
    pins.rotation.x = Math.PI / 2
    root.add(pins)
  }
  const led = mesh(new RoundedBoxGeometry(0.12, 0.05, 0.02, 1, 0.01), m.accent, [-0.02, 0.2, 0.505])
  root.add(led)
  root.add(mesh(new RoundedBoxGeometry(0.5, 0.012, 0.12, 1, 0.005), m.accent, [0.25, 0.378, 0.24]))
  return { root }
}

/** A MALE fixed-wing UAV with a pusher prop, a chin turret and a V-tail; `highlight` lights the part it carries. */
function drone(m: Mats, highlight?: LocalPartId): Built {
  const root = new THREE.Group()
  const hull = m.paint.clone()
  const profile = [
    [0, -1.7],
    [0.1, -1.62],
    [0.19, -1.42],
    [0.25, -1.05],
    [0.27, -0.4],
    [0.25, 0.5],
    [0.18, 1.2],
    [0.1, 1.55],
    [0.06, 1.68],
  ].map(([r, y]) => new THREE.Vector2(r, y))
  const body = mesh(new THREE.LatheGeometry(profile, 48), hull)
  body.rotation.x = Math.PI / 2
  root.add(body)

  const wingShape = new THREE.Shape()
  wingShape.moveTo(-2.5, 0.06)
  wingShape.lineTo(-2.45, 0.24)
  wingShape.lineTo(0, 0.36)
  wingShape.lineTo(2.45, 0.24)
  wingShape.lineTo(2.5, 0.06)
  wingShape.lineTo(0, -0.18)
  wingShape.closePath()
  const wing = mesh(new THREE.ExtrudeGeometry(wingShape, { depth: 0.05, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2 }), hull)
  wing.rotation.x = Math.PI / 2
  wing.position.set(0, 0.2, -0.15)
  root.add(wing)
  for (const side of [-1, 1]) {
    const tip = mesh(new RoundedBoxGeometry(0.03, 0.16, 0.22, 1, 0.01), hull, [side * 2.49, 0.27, 0.0])
    root.add(tip)
    const tail = mesh(new RoundedBoxGeometry(0.75, 0.03, 0.3, 2, 0.012), hull)
    tail.position.set(side * 0.3, 0.26, 1.28)
    tail.rotation.z = side * 0.62
    root.add(tail)
  }
  const fin = mesh(new RoundedBoxGeometry(0.02, 0.12, 0.28, 1, 0.008), hull, [0, 0.3, -0.6])
  root.add(fin)

  const hot = (part: LocalPartId) => (highlight === part ? m.missing : m.dark)
  const prop = new THREE.Group()
  prop.position.set(0, 0, 1.74)
  const hub = mesh(new THREE.ConeGeometry(0.08, 0.2, 24), hot('motor'))
  hub.rotation.x = Math.PI / 2
  prop.add(hub)
  for (const angle of [0, Math.PI]) {
    const blade = mesh(new RoundedBoxGeometry(0.5, 0.02, 0.08, 1, 0.01), m.black)
    blade.rotation.z = angle
    blade.translateX(0.25)
    prop.add(blade)
  }
  root.add(prop)
  root.add(mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.14, 24), hot('motor'), [0, 0, 1.62]).rotateX(Math.PI / 2))

  const turret = new THREE.Group()
  turret.position.set(0, -0.27, -1.05)
  turret.add(mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.08, 20), m.dark, [0, 0.06, 0]))
  turret.add(mesh(new THREE.SphereGeometry(0.15, 32, 24), highlight === 'gimbal' ? m.missing : m.paint))
  turret.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 24), m.glass, [0, -0.02, -0.13]).rotateX(Math.PI / 2))
  root.add(turret)

  if (highlight === 'inu') {
    hull.transparent = true
    hull.opacity = 0.32
    hull.depthWrite = false
    root.add(mesh(new RoundedBoxGeometry(0.26, 0.14, 0.2, 2, 0.02), m.missing, [0, 0.02, -0.35]))
  }

  return {
    root,
    tick: (t) => {
      prop.rotation.z = t * 28
    },
  }
}

/** Three linked Abrams track shoes, rubber pads up: the pads are what the Kingdom makes. */
function trackPad(m: Mats): Built {
  const root = new THREE.Group()
  const body = new RoundedBoxGeometry(1.7, 0.16, 0.46, 2, 0.04)
  const pad = new RoundedBoxGeometry(0.7, 0.12, 0.38, 3, 0.04)
  const tread = new RoundedBoxGeometry(0.66, 0.025, 0.05, 1, 0.01)
  const pin = new THREE.CylinderGeometry(0.075, 0.075, 1.9, 24).rotateZ(Math.PI / 2)
  const cap = new THREE.CylinderGeometry(0.11, 0.11, 0.1, 6).rotateZ(Math.PI / 2)
  const horn = new RoundedBoxGeometry(0.12, 0.2, 0.26, 2, 0.03)
  for (const [index, z] of [-0.56, 0, 0.56].entries()) {
    const shoe = new THREE.Group()
    shoe.position.set(0, Math.abs(z) * -0.12, z)
    shoe.rotation.x = z * 0.22
    shoe.add(mesh(body, m.steel))
    for (const x of [-0.42, 0.42]) {
      shoe.add(mesh(pad, m.rubber, [x, 0.13, 0]))
      for (const dz of [-0.11, 0, 0.11]) shoe.add(mesh(tread, m.black, [x, 0.195, dz]))
      shoe.add(mesh(new RoundedBoxGeometry(0.5, 0.012, 0.04, 1, 0.005), m.accent, [x, 0.08, 0.2]))
    }
    shoe.add(mesh(horn, m.dark, [0, -0.17, 0]))
    for (const dz of [-0.23, 0.23]) {
      shoe.add(mesh(pin, m.dark, [0, -0.02, dz]))
      for (const x of [-0.98, 0.98]) shoe.add(mesh(cap, m.black, [x, -0.02, dz]))
    }
    if (index === 1) shoe.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 6), m.black, [0, 0.09, 0]))
    root.add(shoe)
  }
  return { root }
}

/** A laminated armoured-glass vision block in its steel frame, layers fanned out a little. */
function visionBlock(m: Mats): Built {
  const root = new THREE.Group()
  const layers = new THREE.Group()
  const sheet = new RoundedBoxGeometry(1.2, 0.62, 0.06, 2, 0.015)
  for (let i = 0; i < 9; i += 1) {
    const material = i % 2 ? m.interlayer : m.armorGlass
    const item = mesh(i % 2 ? new RoundedBoxGeometry(1.18, 0.6, 0.012, 1, 0.004) : sheet, material, [0, 0, -0.32 + i * 0.08])
    layers.add(item)
  }
  layers.add(mesh(new RoundedBoxGeometry(1.2, 0.62, 0.04, 2, 0.012), m.glass, [0, 0, 0.36]))
  root.add(layers)
  const frame = new RoundedBoxGeometry(1.42, 0.1, 0.92, 2, 0.03)
  root.add(mesh(frame, m.dark, [0, 0.36, 0.02]))
  root.add(mesh(frame, m.dark, [0, -0.36, 0.02]))
  for (const x of [-0.66, 0.66]) root.add(mesh(new RoundedBoxGeometry(0.1, 0.82, 0.92, 2, 0.03), m.dark, [x, 0, 0.02]))
  root.add(mesh(new RoundedBoxGeometry(1.7, 0.06, 1.12, 2, 0.02), m.steel, [0, -0.44, 0.02]))
  const bolt = new THREE.CylinderGeometry(0.035, 0.035, 0.05, 6)
  for (const x of [-0.76, -0.25, 0.25, 0.76])
    for (const z of [-0.46, 0.5]) root.add(mesh(bolt, m.black, [x, -0.39, z]))
  const gasket = new RoundedBoxGeometry(1.24, 0.014, 0.014, 1, 0.006)
  for (const y of [0.31, -0.31]) root.add(mesh(gasket, m.accent, [0, y, 0.43]))
  return {
    root,
    tick: (t) => {
      const spread = 1 + (Math.sin(t * 0.8) * 0.5 + 0.5) * 0.35
      layers.children.forEach((item, i) => (item.position.z = (-0.32 + i * 0.08) * spread))
    },
  }
}

/** A hydraulic cylinder's rod and gland, its seal kit drifting off along the rod. */
function seal(m: Mats): Built {
  const root = new THREE.Group()
  root.add(mesh(new THREE.CylinderGeometry(0.11, 0.11, 2.6, 32).rotateZ(Math.PI / 2), m.steel, [0.1, 0, 0]))
  root.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.5, 48).rotateZ(Math.PI / 2), m.dark, [-0.75, 0, 0]))
  root.add(mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.1, 6).rotateZ(Math.PI / 2), m.dark, [-0.45, 0, 0]))
  root.add(mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.12, 48).rotateZ(Math.PI / 2), m.steel, [-1.06, 0, 0]))
  root.add(mesh(new THREE.TorusGeometry(0.2, 0.025, 12, 48).rotateY(Math.PI / 2), m.black, [-0.99, 0, 0]))
  const rings: { item: THREE.Mesh; x: number }[] = []
  for (const [x, radius, tube, material] of [
    [-0.15, 0.17, 0.06, m.rubber],
    [0.12, 0.16, 0.05, m.accent],
    [0.36, 0.165, 0.035, m.interlayer],
    [0.58, 0.16, 0.05, m.accent],
    [0.84, 0.15, 0.045, m.rubber],
  ] as const) {
    const item = mesh(new THREE.TorusGeometry(radius, tube, 16, 64).rotateY(Math.PI / 2), material, [x, 0, 0])
    rings.push({ item, x })
    root.add(item)
  }
  root.add(mesh(new THREE.SphereGeometry(0.14, 32, 16), m.steel, [1.42, 0, 0]))
  root.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.32, 24).rotateX(Math.PI / 2), m.dark, [1.42, 0, 0]))
  return {
    root,
    tick: (t) => rings.forEach(({ item, x }, i) => (item.position.x = x + Math.sin(t * 0.9 - i * 0.6) * 0.04 * (i + 1))),
  }
}

/** A road-wheel arm forging: splined boss for the torsion bar, tapered arm and wheel spindle. */
function forging(m: Mats): Built {
  const root = new THREE.Group()
  const arm = sideExtrude(
    [
      [-0.78, 0.32],
      [-0.5, 0.36],
      [0.68, 0.02],
      [0.82, -0.18],
      [0.68, -0.38],
      [0.42, -0.36],
      [-0.6, -0.18],
      [-0.86, 0.06],
    ],
    0.32,
    0.04,
  )
  root.add(mesh(arm, m.forged))
  root.add(mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.5, 48).rotateZ(Math.PI / 2), m.forged, [-0.05, 0.08, -0.62]))
  const spline = new THREE.Group()
  spline.position.set(-0.4, 0.08, -0.62)
  spline.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.3, 32).rotateZ(Math.PI / 2), m.dark))
  for (let i = 0; i < 14; i += 1) {
    const tooth = mesh(new RoundedBoxGeometry(0.3, 0.05, 0.05, 1, 0.01), m.steel)
    const angle = (i / 14) * Math.PI * 2
    tooth.position.set(0, Math.cos(angle) * 0.2, Math.sin(angle) * 0.2)
    tooth.rotation.x = -angle
    spline.add(tooth)
  }
  root.add(spline)
  root.add(mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.8, 40).rotateZ(Math.PI / 2), m.steel, [0.5, -0.16, 0.6]))
  root.add(mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.08, 48).rotateZ(Math.PI / 2), m.forged, [0.2, -0.16, 0.6]))
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2
    root.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.1, 6).rotateZ(Math.PI / 2), m.black, [0.26, -0.16 + Math.cos(angle) * 0.27, 0.6 + Math.sin(angle) * 0.27]))
  }
  root.add(mesh(new THREE.TorusGeometry(0.19, 0.014, 8, 48).rotateY(Math.PI / 2), m.accent, [0.72, -0.16, 0.6]))
  root.add(mesh(new RoundedBoxGeometry(0.02, 0.06, 0.4, 1, 0.008), m.accent, [0.17, 0.06, 0.02]))
  return { root }
}

const TRACK_X = 1.51
const WHEELS_Z = [-2.62, -1.8, -0.98, -0.16, 0.66, 1.48, 2.3]

/** One side's track: shoes, rubber pads, end connectors and centre guides, instanced along the loop. */
function track(m: Mats, padMaterial: THREE.Material) {
  const loop = new THREE.CatmullRomCurve3(
    [
      [-2.95, 0.045],
      [0, 0.045],
      [2.7, 0.045],
      [3.25, 0.2],
      [3.64, 0.45],
      [3.72, 0.68],
      [3.56, 0.93],
      [3.15, 1.0],
      [1.05, 1.03],
      [-1.35, 1.03],
      [-3.1, 0.99],
      [-3.55, 0.86],
      [-3.7, 0.56],
      [-3.52, 0.3],
      [-3.12, 0.1],
    ].map(([z, y]) => new THREE.Vector3(0, y, z)),
    true,
    'centripetal',
  )
  const count = Math.round(loop.getLength() / 0.19)
  const pieces: { geometry: THREE.BufferGeometry; material: THREE.Material; at: [number, number, number][] }[] = [
    { geometry: new THREE.BoxGeometry(0.56, 0.05, 0.16), material: m.iron, at: [[0, 0, 0]] },
    {
      geometry: new RoundedBoxGeometry(0.23, 0.08, 0.15, 1, 0.02),
      material: padMaterial,
      at: [
        [-0.15, -0.06, 0],
        [0.15, -0.06, 0],
      ],
    },
    {
      geometry: new THREE.BoxGeometry(0.05, 0.08, 0.1),
      material: m.iron,
      at: [
        [-0.31, 0, 0],
        [0.31, 0, 0],
      ],
    },
    { geometry: new THREE.BoxGeometry(0.07, 0.12, 0.08), material: m.iron, at: [[0, 0.08, 0]] },
  ]
  const group = new THREE.Group()
  const link = new THREE.Object3D()
  const offset = new THREE.Matrix4()
  for (const piece of pieces) {
    const instances = new THREE.InstancedMesh(piece.geometry, piece.material, count * 2 * piece.at.length)
    instances.frustumCulled = false
    let index = 0
    for (let i = 0; i < count; i += 1) {
      const at = loop.getPointAt(i / count)
      const tangent = loop.getTangentAt(i / count)
      for (const side of [-1, 1]) {
        link.position.set(side * TRACK_X, at.y, at.z)
        link.rotation.set(Math.atan2(-tangent.y, tangent.z), 0, 0)
        link.updateMatrix()
        for (const [x, y, z] of piece.at) instances.setMatrixAt(index++, offset.makeTranslation(x, y, z).premultiply(link.matrix))
      }
    }
    group.add(instances)
  }
  return group
}

/**
 * An M1A2-style main battle tank at true scale in metres, nose towards −z: faceted hull and turret,
 * side skirts, seven dual road wheels a side on torsion arms, a linked track, a 120 mm gun with its
 * thermal sleeve, sights, remote weapon station and bustle rack. `highlight` shows the part Poland
 * stopped sending in red.
 */
function tank(m: Mats, highlight?: LocalPartId): Built {
  const root = new THREE.Group()
  const hullArmor = m.armor.clone()
  const turretArmor = m.armor.clone()
  const skirtArmor = m.armor.clone()
  const mantletCloth = m.cloth.clone()
  const see = (material: THREE.Material) => {
    material.transparent = true
    material.opacity = 0.2
    material.depthWrite = false
  }
  if (highlight === 'seal') [turretArmor, mantletCloth].forEach(see)
  if (highlight === 'trackPad' || highlight === 'forging') see(skirtArmor)
  const hot = (part: LocalPartId, fallback: THREE.Material) => (highlight === part ? m.missing : fallback)
  const along = (geometry: THREE.CylinderGeometry) => geometry.rotateX(Math.PI / 2)
  const across = (geometry: THREE.CylinderGeometry) => geometry.rotateZ(Math.PI / 2)

  /* Hull: the lower tub between the tracks, then the sponsons and the long shallow glacis over them. */
  root.add(
    mesh(
      sideExtrude(
        [
          [-3.9, 1.0],
          [-3.9, 0.92],
          [-3.3, 0.5],
          [3.6, 0.5],
          [3.9, 0.74],
          [3.9, 1.05],
        ],
        2.36,
        0.02,
      ),
      m.grime,
    ),
  )
  root.add(
    mesh(
      sideExtrude(
        [
          [-3.97, 0.98],
          [-3.92, 1.07],
          [-2.2, 1.43],
          [3.55, 1.46],
          [3.93, 1.41],
          [3.93, 0.98],
        ],
        3.66,
        0.03,
      ),
      hullArmor,
    ),
  )
  for (let i = 0; i < 9; i += 1) root.add(mesh(new THREE.BoxGeometry(2.3, 0.025, 0.06), m.iron, [0, 1.47, 2.0 + i * 0.17]))
  for (const x of [-1.25, 1.25]) root.add(mesh(new THREE.BoxGeometry(0.9, 0.012, 1.4), m.grime, [x, 1.465, 2.65]))
  root.add(mesh(new THREE.BoxGeometry(1.7, 0.42, 0.05), m.iron, [0, 1.15, 3.95]))
  for (let i = 0; i < 6; i += 1) root.add(mesh(new THREE.BoxGeometry(1.62, 0.025, 0.04), m.black, [0, 0.98 + i * 0.065, 3.98]))
  for (const x of [-1.6, 1.6]) root.add(mesh(new RoundedBoxGeometry(0.16, 0.12, 0.08, 1, 0.02), m.black, [x, 1.3, 3.94]))
  root.add(mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.05, 32), hullArmor, [0, 1.47, -2.45]))
  for (const [x, z, turn] of [
    [-0.27, -2.76, 0.5],
    [0, -2.84, 0],
    [0.27, -2.76, -0.5],
  ] as const) {
    const scope = mesh(new RoundedBoxGeometry(0.17, 0.09, 0.07, 1, 0.012), hot('visionBlock', m.glass), [x, 1.5, z])
    scope.rotation.y = turn
    root.add(scope)
  }
  for (const side of [-1, 1]) {
    const lamp = new THREE.Group()
    lamp.position.set(side * 1.48, 1.14, -3.86)
    lamp.add(mesh(new RoundedBoxGeometry(0.3, 0.14, 0.14, 1, 0.02), m.grime))
    for (const dx of [-0.07, 0.07]) lamp.add(mesh(along(new THREE.CylinderGeometry(0.04, 0.04, 0.02, 16)), m.glass, [dx, 0, -0.075]))
    root.add(lamp)
    root.add(mesh(new THREE.TorusGeometry(0.07, 0.025, 8, 20).rotateY(Math.PI / 2), m.iron, [side * 0.85, 0.9, -3.98]))
  }

  /* Side skirts: two heavy front panels, then light ones, hung from the sponsons over the wheel tops. */
  const bolt = across(new THREE.CylinderGeometry(0.022, 0.022, 0.02, 8))
  const panels: [number, number, number][] = [
    [-3.8, -3.06, 0.1],
    [-3.06, -2.32, 0.1],
    [-2.32, -1.3, 0.045],
    [-1.3, -0.28, 0.045],
    [-0.28, 0.74, 0.045],
    [0.74, 1.76, 0.045],
    [1.76, 2.78, 0.045],
    [2.78, 3.42, 0.045],
  ]
  for (const side of [-1, 1]) {
    for (const [index, [z0, z1, thick]] of panels.entries()) {
      const outline: [number, number][] =
        index === 0
          ? [
              [z0 + 0.2, 0.62],
              [z1 - 0.01, 0.62],
              [z1 - 0.01, 1.17],
              [z0, 1.17],
              [z0, 0.9],
            ]
          : [
              [z0 + 0.01, 0.62],
              [z1 - 0.01, 0.62],
              [z1 - 0.01, 1.17],
              [z0 + 0.01, 1.17],
            ]
      root.add(mesh(sideExtrude(outline, thick, 0.008), skirtArmor, [side * (1.84 + thick / 2), 0, 0]))
      for (const z of [z0 + 0.12, (z0 + z1) / 2, z1 - 0.12]) root.add(mesh(bolt, m.iron, [side * (1.85 + thick), 1.1, z]))
    }
  }

  /* Running gear, per side: dual road wheels on forged arms, the front idler, the rear drive sprocket, support rollers and the track. */
  const tyre = across(new THREE.CylinderGeometry(0.32, 0.32, 0.2, 40))
  const disc = across(new THREE.CylinderGeometry(0.25, 0.25, 0.215, 32))
  const cap = across(new THREE.CylinderGeometry(0.1, 0.13, 0.08, 20))
  const arm = new RoundedBoxGeometry(0.08, 0.11, 0.6, 1, 0.025)
  const barEnd = across(new THREE.CylinderGeometry(0.08, 0.08, 0.14, 16))
  const tooth = new RoundedBoxGeometry(0.06, 0.1, 0.09, 1, 0.015)
  const armTilt = -Math.atan2(0.26, 0.48)
  for (const side of [-1, 1]) {
    const x = side * TRACK_X
    for (const z of WHEELS_Z) {
      for (const dx of [-0.17, 0.17]) {
        root.add(mesh(tyre, m.rubber, [x + dx, 0.4, z]))
        root.add(mesh(disc, m.grime, [x + dx, 0.4, z]))
      }
      root.add(mesh(cap, hot('forging', m.iron), [x + side * 0.3, 0.4, z]))
      const link = mesh(arm, hot('forging', m.forged), [side * 1.22, 0.53, z + 0.24])
      link.rotation.x = armTilt
      root.add(link)
      root.add(mesh(barEnd, m.iron, [side * 1.2, 0.66, z + 0.48]))
    }
    for (const dx of [-0.17, 0.17]) {
      root.add(mesh(across(new THREE.CylinderGeometry(0.29, 0.29, 0.2, 36)), m.iron, [x + dx, 0.55, -3.38]))
      root.add(mesh(disc, m.grime, [x + dx, 0.55, -3.38]))
    }
    root.add(mesh(cap, m.iron, [x + side * 0.3, 0.55, -3.38]))
    const sprocket = new THREE.Group()
    sprocket.position.set(x, 0.64, 3.52)
    sprocket.add(mesh(across(new THREE.CylinderGeometry(0.16, 0.16, 0.52, 24)), m.grime))
    for (const dx of [-0.2, 0.2]) {
      sprocket.add(mesh(across(new THREE.CylinderGeometry(0.27, 0.27, 0.06, 36)), m.iron, [dx, 0, 0]))
      for (let i = 0; i < 12; i += 1) {
        const angle = (i / 12) * Math.PI * 2
        const item = mesh(tooth, m.iron, [dx, Math.cos(angle) * 0.3, Math.sin(angle) * 0.3])
        item.rotation.x = -angle
        sprocket.add(item)
      }
    }
    sprocket.add(mesh(cap, m.iron, [side * 0.3, 0, 0]))
    root.add(sprocket)
    for (const z of [-1.38, 1.07]) root.add(mesh(across(new THREE.CylinderGeometry(0.1, 0.1, 0.5, 20)), m.grime, [x, 0.9, z]))
  }
  root.add(track(m, hot('trackPad', m.rubber)))

  /* Turret: a low faceted box with forward cheeks and a recessed mantlet, sitting on its ring. */
  const turret = new THREE.Group()
  turret.position.set(0, 1.46, 0.1)
  turret.add(mesh(new THREE.CylinderGeometry(1.12, 1.12, 0.08, 64), hot('seal', m.iron), [0, 0.03, 0]))
  const plan: [number, number][] = [
    [-0.55, -1.62],
    [0.55, -1.62],
    [0.62, -2.2],
    [1.15, -2.05],
    [1.78, -1.2],
    [1.78, 1.5],
    [1.62, 2.55],
    [-1.62, 2.55],
    [-1.78, 1.5],
    [-1.78, -1.2],
    [-1.15, -2.05],
    [-0.62, -2.2],
  ]
  const roof = plan.map(([x, z]): [number, number] => [x * 0.97, z < -1 ? z + 0.3 : z])
  turret.add(mesh(loft(plan, roof, 0.06, 0.84), turretArmor))
  turret.add(mesh(new RoundedBoxGeometry(1.0, 0.52, 0.5, 2, 0.08), mantletCloth, [0, 0.42, -1.6]))
  if (highlight === 'seal')
    for (const x of [-0.32, 0.32]) {
      turret.add(mesh(along(new THREE.CylinderGeometry(0.065, 0.065, 0.75, 20)), m.missing, [x, 0.3, -1.2]))
      turret.add(mesh(along(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 12)), m.missing, [x, 0.3, -1.7]))
    }

  const gun = new THREE.Group()
  gun.position.set(0, 0.44, -1.8)
  gun.add(mesh(along(new THREE.CylinderGeometry(0.115, 0.095, 4.4, 32)), m.tan, [0, 0, -2.2]))
  gun.add(mesh(along(new THREE.CylinderGeometry(0.16, 0.16, 0.65, 32)), m.tan, [0, 0, -1.5]))
  for (const z of [-0.6, -2.4, -3.3]) gun.add(mesh(along(new THREE.CylinderGeometry(0.122, 0.122, 0.06, 32)), m.grime, [0, 0, z]))
  gun.add(mesh(along(new THREE.CylinderGeometry(0.1, 0.1, 0.14, 32)), m.iron, [0, 0, -4.45]))
  gun.add(mesh(new RoundedBoxGeometry(0.09, 0.07, 0.14, 1, 0.015), m.iron, [0, 0.13, -4.3]))
  turret.add(gun)

  const top = 0.84
  turret.add(mesh(new RoundedBoxGeometry(0.55, 0.42, 0.7, 2, 0.04), turretArmor, [0.95, top + 0.21, -1.15]))
  turret.add(mesh(new THREE.BoxGeometry(0.4, 0.22, 0.02), m.glass, [0.95, top + 0.23, -1.51]))
  turret.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.32, 16), m.iron, [-0.95, top + 0.16, -0.3]))
  turret.add(mesh(new RoundedBoxGeometry(0.44, 0.3, 0.42, 2, 0.05), turretArmor, [-0.95, top + 0.46, -0.3]))
  turret.add(mesh(new THREE.BoxGeometry(0.26, 0.12, 0.02), m.glass, [-0.95, top + 0.47, -0.52]))

  const commander = new THREE.Group()
  commander.position.set(0.8, top, 0.2)
  commander.add(mesh(new THREE.CylinderGeometry(0.44, 0.46, 0.1, 40), turretArmor, [0, 0.05, 0]))
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2
    const block = mesh(new RoundedBoxGeometry(0.13, 0.07, 0.04, 1, 0.01), hot('visionBlock', m.glass))
    block.position.set(Math.sin(angle) * 0.45, 0.06, Math.cos(angle) * 0.45)
    block.rotation.y = angle
    commander.add(block)
  }
  commander.add(mesh(new RoundedBoxGeometry(0.36, 0.12, 0.36, 1, 0.02), m.iron, [0, 0.16, 0]))
  commander.add(mesh(new RoundedBoxGeometry(0.3, 0.3, 0.6, 2, 0.04), turretArmor, [0, 0.38, -0.05]))
  commander.add(mesh(new RoundedBoxGeometry(0.18, 0.2, 0.26, 1, 0.03), m.iron, [0.24, 0.4, -0.12]))
  commander.add(mesh(new THREE.BoxGeometry(0.12, 0.1, 0.02), m.glass, [0.24, 0.42, -0.26]))
  commander.add(mesh(along(new THREE.CylinderGeometry(0.045, 0.045, 0.32, 16)), m.iron, [0, 0.4, -0.5]))
  commander.add(mesh(along(new THREE.CylinderGeometry(0.026, 0.026, 1.2, 12)), m.black, [0, 0.4, -0.95]))
  turret.add(commander)

  turret.add(mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.06, 32), turretArmor, [-0.8, top + 0.03, 0.75]))
  turret.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 10), m.iron, [-0.8, top + 0.18, 0.42]))
  turret.add(mesh(new RoundedBoxGeometry(0.1, 0.12, 0.42, 1, 0.02), m.black, [-0.8, top + 0.36, 0.36]))
  turret.add(mesh(along(new THREE.CylinderGeometry(0.018, 0.018, 0.7, 10)), m.black, [-0.8, top + 0.37, -0.2]))

  const tube = new THREE.CylinderGeometry(0.035, 0.035, 0.22, 12)
  for (const side of [-1, 1]) {
    const launcher = new THREE.Group()
    launcher.position.set(side * 1.72, 0.66, -0.95)
    launcher.rotation.z = -side * 0.45
    launcher.add(mesh(new RoundedBoxGeometry(0.08, 0.06, 0.7, 1, 0.015), m.iron, [0, -0.1, 0]))
    for (let i = 0; i < 6; i += 1) for (const dy of [0, 0.09]) launcher.add(mesh(tube, m.iron, [dy - 0.045, 0, -0.25 + i * 0.1]))
    turret.add(launcher)
    turret.add(mesh(new RoundedBoxGeometry(0.2, 0.48, 1.7, 2, 0.03), turretArmor, [side * 1.88, 0.45, 1.05]))
    turret.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.14, 12), m.iron, [side * 1.4, top + 0.07, 2.25]))
    const whip = mesh(new THREE.CylinderGeometry(0.006, 0.008, 1.6, 6), m.black, [side * 1.4, top + 0.94, 2.35])
    whip.rotation.x = 0.12
    turret.add(whip)
  }

  const rack = new THREE.Group()
  rack.position.set(0, 0, 2.88)
  const post = new THREE.CylinderGeometry(0.018, 0.018, 0.45, 8)
  for (const x of [-1.55, -0.78, 0, 0.78, 1.55]) rack.add(mesh(post, m.iron, [x, 0.53, 0.32]))
  for (const x of [-1.55, 1.55]) for (const z of [-0.22, 0.05]) rack.add(mesh(post, m.iron, [x, 0.53, z]))
  for (const y of [0.5, 0.75]) {
    rack.add(mesh(across(new THREE.CylinderGeometry(0.018, 0.018, 3.1, 8)), m.iron, [0, y, 0.32]))
    for (const x of [-1.55, 1.55]) rack.add(mesh(along(new THREE.CylinderGeometry(0.018, 0.018, 0.6, 8)), m.iron, [x, y, 0.02]))
  }
  rack.add(mesh(new THREE.BoxGeometry(3.1, 0.03, 0.62), m.iron, [0, 0.3, 0.02]))
  rack.add(mesh(across(new THREE.CylinderGeometry(0.16, 0.16, 1.3, 20)), m.olive, [-0.75, 0.48, 0.05]))
  rack.add(mesh(new RoundedBoxGeometry(0.62, 0.34, 0.46, 2, 0.06), m.cloth, [0.5, 0.49, 0.02]))
  rack.add(mesh(new RoundedBoxGeometry(0.42, 0.28, 0.4, 1, 0.03), m.olive, [1.18, 0.46, 0.04]))
  turret.add(rack)
  turret.add(mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.5, 6), m.black, [0.1, top + 0.25, 2.3]))
  turret.add(mesh(across(new THREE.CylinderGeometry(0.01, 0.01, 0.22, 6)), m.black, [0.1, top + 0.48, 2.3]))
  root.add(turret)

  return {
    root,
    tick: (t) => {
      turret.rotation.y = Math.sin(t * 0.3) * 0.35
      gun.rotation.x = Math.sin(t * 0.45) * 0.03
    },
  }
}

function build(model: GamiModelId, m: Mats, highlight?: LocalPartId): Built {
  if (isFacility(model)) return facility(m, model.slice('facility-'.length) as FacilityKind)
  if (isProduct(model)) return PRODUCT_MODELS[model](m)
  if (model === 'motor') return motor(m)
  if (model === 'gimbal') return gimbal(m)
  if (model === 'inu') return inu(m)
  if (model === 'trackPad') return trackPad(m)
  if (model === 'visionBlock') return visionBlock(m)
  if (model === 'seal') return seal(m)
  if (model === 'forging') return forging(m)
  if (model === 'tank') return tank(m, highlight)
  return drone(m, highlight)
}

/** Stands on the ground: seen from just above, and never turned over. */
const grounded = (model: GamiModelId) => model === 'tank' || (isProduct(model) && model !== 'helicopter')

function startTilt(model: GamiModelId) {
  if (isFacility(model)) return 0.5
  if (grounded(model)) return 0.04
  if (model === 'helicopter') return 0.22
  return isVehicle(model) ? 0.42 : 0.28
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function Gami3DModel({ model, accent, className, spin = 0.5, interactive = false, highlight, distance = 1 }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    host.appendChild(renderer.domElement)
    renderer.domElement.style.display = 'block'

    const scene = new THREE.Scene()
    const pmrem = new THREE.PMREMGenerator(renderer)
    const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = environment

    const key = new THREE.DirectionalLight(0xffffff, 2.2)
    key.position.set(-3, 4, 3)
    scene.add(key)
    const rim = new THREE.DirectionalLight(0xffffff, 1.4)
    rim.position.set(3, 1.5, -4)
    scene.add(rim)
    scene.add(new THREE.HemisphereLight(0x9fb6d8, 0x0b0f16, 0.6))

    const mats = materials(accent)
    const built = build(model, mats, highlight)
    const pivot = new THREE.Group()
    const box = new THREE.Box3().setFromObject(built.root)
    const sphere = box.getBoundingSphere(new THREE.Sphere())
    built.root.position.sub(sphere.center)
    pivot.add(built.root)
    pivot.scale.setScalar(1 / sphere.radius)
    pivot.rotation.x = startTilt(model)
    scene.add(pivot)

    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50)
    const fit = (1 / Math.sin((camera.fov * Math.PI) / 360)) * distance
    camera.position.set(0, 0.25 * fit, fit)
    camera.lookAt(0, 0, 0)

    const resize = () => {
      // Layout size, not the bounding rect: a card scaling in would pin the canvas to its scaled-down size.
      const { clientWidth: width, clientHeight: height } = host
      if (!width || !height) return
      renderer.setSize(width, height, false)
      renderer.domElement.style.width = `${width}px`
      renderer.domElement.style.height = `${height}px`
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    resize()
    const sizes = new ResizeObserver(resize)
    sizes.observe(host)

    let visible = true
    const seen = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting))
    seen.observe(host)

    let turn = grounded(model) || isFacility(model) ? 2.2 : model === 'drone' ? -0.7 : 0.5
    let dragging: { x: number; y: number } | null = null
    let tilt = pivot.rotation.x
    const minTilt = grounded(model) || isFacility(model) ? -0.04 : -0.6
    const down = (event: PointerEvent) => {
      dragging = { x: event.clientX, y: event.clientY }
      host.setPointerCapture(event.pointerId)
    }
    const move = (event: PointerEvent) => {
      if (!dragging) return
      turn += (event.clientX - dragging.x) * 0.01
      tilt = Math.max(minTilt, Math.min(1.1, tilt + (event.clientY - dragging.y) * 0.006))
      dragging = { x: event.clientX, y: event.clientY }
    }
    const up = () => (dragging = null)
    if (interactive) {
      host.addEventListener('pointerdown', down)
      host.addEventListener('pointermove', move)
      host.addEventListener('pointerup', up)
      host.addEventListener('pointercancel', up)
    }

    const still = reducedMotion()
    let frame = 0
    let last = performance.now()
    const start = last
    const loop = (now: number) => {
      frame = requestAnimationFrame(loop)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (!visible) return
      if (!dragging && !still) turn += dt * spin
      pivot.rotation.y = turn
      pivot.rotation.x += (tilt - pivot.rotation.x) * 0.15
      if (!still) built.tick?.((now - start) / 1000)
      renderer.render(scene, camera)
    }
    frame = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(frame)
      sizes.disconnect()
      seen.disconnect()
      host.removeEventListener('pointerdown', down)
      host.removeEventListener('pointermove', move)
      host.removeEventListener('pointerup', up)
      host.removeEventListener('pointercancel', up)
      scene.traverse((item) => {
        if (item instanceof THREE.Mesh) {
          item.geometry.dispose()
          const list = Array.isArray(item.material) ? item.material : [item.material]
          for (const material of list) material.dispose()
        }
      })
      environment.dispose()
      pmrem.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    }
  }, [model, accent, spin, interactive, highlight, distance])

  return <div ref={hostRef} className={className} data-interactive={interactive || undefined} aria-hidden />
}
