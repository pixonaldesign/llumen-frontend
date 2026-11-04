/**
 * Procedural 3D models of the alert's cut-off parts (and the UAV and Abrams tank that carry them),
 * turning slowly in place. Built from three.js primitives so the demo needs no model files.
 */
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { LocalPartId } from './gamiTypes'

export type GamiModelId = LocalPartId | 'drone' | 'tank'

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

type Built = { root: THREE.Group; tick?: (t: number) => void }

function materials(accent: string) {
  const trim = new THREE.Color(accent)
  return {
    dark: new THREE.MeshStandardMaterial({ color: 0x2b3038, metalness: 0.85, roughness: 0.38 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xa7b0bb, metalness: 0.95, roughness: 0.22 }),
    black: new THREE.MeshStandardMaterial({ color: 0x12151a, metalness: 0.5, roughness: 0.55 }),
    copper: new THREE.MeshStandardMaterial({ color: 0xc27a3c, metalness: 1, roughness: 0.32 }),
    paint: new THREE.MeshStandardMaterial({ color: 0xc3c9d1, metalness: 0.35, roughness: 0.48 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0x0b1424,
      metalness: 0.1,
      roughness: 0.04,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
    }),
    accent: new THREE.MeshStandardMaterial({ color: trim, metalness: 0.3, roughness: 0.4 }),
    laser: new THREE.MeshStandardMaterial({ color: 0x3a2424, metalness: 0.2, roughness: 0.15 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x1b1d21, metalness: 0, roughness: 0.92 }),
    sand: new THREE.MeshStandardMaterial({ color: 0x8f7f62, metalness: 0.35, roughness: 0.58 }),
    forged: new THREE.MeshStandardMaterial({ color: 0x6f757d, metalness: 0.9, roughness: 0.48 }),
    armorGlass: new THREE.MeshPhysicalMaterial({
      color: 0x3d6b66,
      metalness: 0.05,
      roughness: 0.05,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      transparent: true,
      opacity: 0.78,
    }),
    interlayer: new THREE.MeshStandardMaterial({ color: 0xdfe8e6, metalness: 0, roughness: 0.3, transparent: true, opacity: 0.55 }),
  }
}

type Mats = ReturnType<typeof materials>

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, at: [number, number, number] = [0, 0, 0]) {
  const item = new THREE.Mesh(geometry, material)
  item.position.set(...at)
  return item
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

  const hot = (part: LocalPartId) => (highlight === part ? m.accent : m.dark)
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
  turret.add(mesh(new THREE.SphereGeometry(0.15, 32, 24), highlight === 'gimbal' ? m.accent : m.paint))
  turret.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 24), m.glass, [0, -0.02, -0.13]).rotateX(Math.PI / 2))
  root.add(turret)

  if (highlight === 'inu') {
    hull.transparent = true
    hull.opacity = 0.32
    hull.depthWrite = false
    root.add(mesh(new RoundedBoxGeometry(0.26, 0.14, 0.2, 2, 0.02), m.accent, [0, 0.02, -0.35]))
  }

  return {
    root,
    tick: (t) => {
      prop.rotation.z = t * 28
    },
  }
}

const bevel = (size: number) => ({ bevelEnabled: true, bevelSize: size, bevelThickness: size, bevelSegments: 2 })

/** A side profile, given as (z, y) points, extruded `width` across x and centred on it. */
function sideExtrude(points: [number, number][], width: number, edge = 0.01) {
  const shape = new THREE.Shape(points.map(([z, y]) => new THREE.Vector2(-z, y)))
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: width - edge * 2, ...bevel(edge) })
  geometry.rotateY(Math.PI / 2)
  geometry.translate(-width / 2 + edge, 0, 0)
  return geometry
}

/** A plan outline, given as (x, z) points, extruded `height` up from y = 0. */
function topExtrude(points: [number, number][], height: number, edge = 0.01) {
  const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z)))
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: height - edge * 2, ...bevel(edge) })
  geometry.rotateX(-Math.PI / 2)
  geometry.translate(0, edge, 0)
  return geometry
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

/** An Abrams-style main battle tank; `highlight` lights the part the Kingdom makes for it. */
function tank(m: Mats, highlight?: LocalPartId): Built {
  const root = new THREE.Group()
  const hull = m.sand.clone()
  const turretPaint = m.sand.clone()
  const see = (material: THREE.Material) => {
    material.transparent = true
    material.opacity = 0.22
    material.depthWrite = false
  }
  const hot = (part: LocalPartId, fallback: THREE.Material) => (highlight === part ? m.accent : fallback)
  if (highlight === 'seal') see(turretPaint)

  root.add(
    mesh(
      sideExtrude(
        [
          [-1.32, 0.5],
          [-1.32, 0.42],
          [-1.08, 0.22],
          [1.16, 0.22],
          [1.3, 0.38],
          [1.3, 0.5],
        ],
        0.74,
      ),
      m.dark,
    ),
  )
  root.add(
    mesh(
      sideExtrude(
        [
          [-1.44, 0.52],
          [-1.4, 0.6],
          [-0.7, 0.76],
          [1.28, 0.79],
          [1.34, 0.72],
          [1.34, 0.52],
        ],
        1.24,
        0.015,
      ),
      hull,
    ),
  )
  for (let i = 0; i < 5; i += 1) root.add(mesh(new RoundedBoxGeometry(0.9, 0.012, 0.06, 1, 0.005), m.dark, [0, 0.795, 0.78 + i * 0.1]))
  for (const x of [-0.12, 0, 0.12]) root.add(mesh(new RoundedBoxGeometry(0.09, 0.05, 0.05, 1, 0.01), hot('visionBlock', m.armorGlass), [x, 0.76, -0.76]))
  root.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 24), hull, [0, 0.77, -0.64]))

  const skirt = hull.clone()
  if (highlight === 'trackPad' || highlight === 'forging') see(skirt)
  for (const side of [-1, 1]) {
    root.add(mesh(new RoundedBoxGeometry(0.03, 0.2, 2.5, 1, 0.01), skirt, [side * 0.62, 0.44, -0.1]))
    for (let i = 0; i < 6; i += 1) root.add(mesh(new RoundedBoxGeometry(0.035, 0.18, 0.012, 1, 0.004), skirt, [side * 0.62, 0.44, -1.1 + i * 0.4]))
  }

  const wheel = new THREE.CylinderGeometry(0.12, 0.12, 0.2, 32).rotateZ(Math.PI / 2)
  const hub = new THREE.CylinderGeometry(0.055, 0.055, 0.22, 16).rotateZ(Math.PI / 2)
  const arm = new RoundedBoxGeometry(0.05, 0.05, 0.22, 1, 0.012)
  const wheels = [-0.86, -0.57, -0.28, 0.01, 0.3, 0.59, 0.88]
  for (const side of [-1, 1]) {
    const x = side * 0.47
    for (const z of wheels) {
      root.add(mesh(wheel, m.rubber, [x, 0.15, z]))
      root.add(mesh(hub, hot('forging', hull), [x, 0.15, z]))
      const link = mesh(arm, hot('forging', m.forged), [side * 0.35, 0.22, z + 0.1])
      link.rotation.x = 0.6
      root.add(link)
    }
    root.add(mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.18, 12).rotateZ(Math.PI / 2), m.dark, [x, 0.36, 1.18]))
    root.add(mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.18, 24).rotateZ(Math.PI / 2), m.dark, [x, 0.32, -1.16]))
    for (const z of [-0.45, 0.15, 0.75]) root.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.14, 12).rotateZ(Math.PI / 2), m.dark, [x, 0.47, z]))
  }

  const loop = new THREE.CatmullRomCurve3(
    [
      [-0.95, 0.02],
      [0, 0.02],
      [0.95, 0.02],
      [1.2, 0.18],
      [1.32, 0.37],
      [1.18, 0.5],
      [0.6, 0.52],
      [-0.6, 0.51],
      [-1.2, 0.45],
      [-1.29, 0.31],
      [-1.15, 0.14],
    ].map(([z, y]) => new THREE.Vector3(0, y, z)),
    true,
    'centripetal',
  )
  const shoe = new RoundedBoxGeometry(0.26, 0.03, 0.068, 1, 0.008)
  const pad = new RoundedBoxGeometry(0.1, 0.02, 0.05, 1, 0.006)
  const padMaterial = hot('trackPad', m.rubber)
  const count = 84
  for (let i = 0; i < count; i += 1) {
    const at = loop.getPointAt(i / count)
    const tangent = loop.getTangentAt(i / count)
    for (const side of [-1, 1]) {
      const link = new THREE.Group()
      link.position.set(side * 0.47, at.y, at.z)
      link.rotation.x = Math.atan2(-tangent.y, tangent.z)
      link.add(mesh(shoe, m.dark))
      for (const dx of [-0.065, 0.065]) link.add(mesh(pad, padMaterial, [dx, -0.024, 0]))
      root.add(link)
    }
  }

  const turret = new THREE.Group()
  turret.position.set(0, 0.79, -0.05)
  turret.add(mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.04, 48), hot('seal', m.dark), [0, 0.0, 0]))
  turret.add(
    mesh(
      topExtrude(
        [
          [-0.18, -0.9],
          [0.18, -0.9],
          [0.48, -0.46],
          [0.5, 0.34],
          [-0.5, 0.34],
          [-0.48, -0.46],
        ],
        0.26,
        0.02,
      ),
      turretPaint,
      [0, 0.02, 0],
    ),
  )
  turret.add(
    mesh(
      topExtrude(
        [
          [-0.46, 0.34],
          [0.46, 0.34],
          [0.42, 0.7],
          [-0.42, 0.7],
        ],
        0.2,
        0.015,
      ),
      turretPaint,
      [0, 0.07, 0],
    ),
  )
  for (const x of [-0.49, 0.49]) turret.add(mesh(new RoundedBoxGeometry(0.03, 0.12, 0.5, 1, 0.01), m.dark, [x, 0.16, 0.0]))
  turret.add(mesh(new RoundedBoxGeometry(0.9, 0.025, 0.2, 1, 0.01), m.dark, [0, 0.12, 0.8]))
  turret.add(mesh(new RoundedBoxGeometry(0.34, 0.2, 0.12, 2, 0.03), hot('seal', turretPaint), [0, 0.15, -0.95]))
  if (highlight === 'seal')
    for (const x of [-0.11, 0.11]) turret.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.42, 16).rotateX(Math.PI / 2), m.accent, [x, 0.1, -0.66]))
  const gun = new THREE.Group()
  gun.position.set(0, 0.16, -1.0)
  gun.add(mesh(new THREE.CylinderGeometry(0.038, 0.045, 1.7, 24).rotateX(Math.PI / 2), m.dark, [0, 0, -0.85]))
  gun.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.24, 24).rotateX(Math.PI / 2), m.dark, [0, 0, -0.75]))
  gun.add(mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.06, 24).rotateX(Math.PI / 2), m.black, [0, 0, -1.7]))
  turret.add(gun)

  const cupola = new THREE.Group()
  cupola.position.set(0.24, 0.3, 0.04)
  cupola.add(mesh(new THREE.CylinderGeometry(0.14, 0.15, 0.08, 32), turretPaint))
  cupola.add(mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.03, 32), m.dark, [0, 0.055, 0]))
  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2
    const block = mesh(new RoundedBoxGeometry(0.07, 0.04, 0.025, 1, 0.006), hot('visionBlock', m.armorGlass))
    block.position.set(Math.sin(angle) * 0.145, 0.01, Math.cos(angle) * 0.145)
    block.rotation.y = angle
    cupola.add(block)
  }
  cupola.add(mesh(new RoundedBoxGeometry(0.06, 0.06, 0.16, 1, 0.01), m.dark, [0, 0.1, -0.04]))
  cupola.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.28, 8).rotateX(Math.PI / 2), m.black, [0, 0.1, -0.24]))
  turret.add(cupola)
  turret.add(mesh(new RoundedBoxGeometry(0.16, 0.1, 0.16, 2, 0.02), turretPaint, [0.3, 0.32, -0.5]))
  turret.add(mesh(new RoundedBoxGeometry(0.12, 0.06, 0.012, 1, 0.004), m.glass, [0.3, 0.32, -0.585]))
  turret.add(mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.02, 24), turretPaint, [-0.24, 0.29, 0.02]))
  for (const x of [-0.36, 0.36]) turret.add(mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.6, 6), m.black, [x, 0.57, 0.58]))
  root.add(turret)

  return {
    root,
    tick: (t) => {
      turret.rotation.y = Math.sin(t * 0.35) * 0.32
      gun.rotation.x = Math.sin(t * 0.5) * 0.04
    },
  }
}

function build(model: GamiModelId, m: Mats, highlight?: LocalPartId): Built {
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

const isVehicle = (model: GamiModelId) => model === 'drone' || model === 'tank'

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
    pivot.rotation.x = model === 'tank' ? 0.12 : isVehicle(model) ? 0.42 : 0.28
    scene.add(pivot)

    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50)
    const fit = (1 / Math.sin((camera.fov * Math.PI) / 360)) * distance
    camera.position.set(0, 0.25 * fit, fit)
    camera.lookAt(0, 0, 0)

    const resize = () => {
      const { width, height } = host.getBoundingClientRect()
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

    let turn = model === 'tank' ? 2.2 : model === 'drone' ? -0.7 : 0.5
    let dragging: { x: number; y: number } | null = null
    let tilt = pivot.rotation.x
    const down = (event: PointerEvent) => {
      dragging = { x: event.clientX, y: event.clientY }
      host.setPointerCapture(event.pointerId)
    }
    const move = (event: PointerEvent) => {
      if (!dragging) return
      turn += (event.clientX - dragging.x) * 0.01
      tilt = Math.max(-0.6, Math.min(1.1, tilt + (event.clientY - dragging.y) * 0.006))
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
