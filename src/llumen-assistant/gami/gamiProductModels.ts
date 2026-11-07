/**
 * Procedural 3D models of the inventory's products (an APC, a helicopter, an air-defence launcher, a
 * howitzer, a patrol boat, a shell, a radar and a missile) and of the plants that build them.
 * True-ish scale in metres: Y up, ground at y = 0, noses towards −z.
 */
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { bevel, loft, mesh, sideExtrude, type Built, type Mats } from './gami3dKit'

export type ProductModelId = 'apc' | 'helicopter' | 'airDefence' | 'howitzer' | 'patrolBoat' | 'shell' | 'radar' | 'missile'
export type FacilityKind = 'air' | 'land' | 'armament' | 'electronics' | 'naval'

type Plan = [number, number][]
type Vec3 = [number, number, number]
/** One instance: its position, then a turn about y and a scale. */
type Place = [x: number, y: number, z: number, turn?: number, scale?: Vec3]

const UP = new THREE.Vector3(0, 1, 0)
const along = <T extends THREE.BufferGeometry>(geometry: T) => geometry.rotateX(Math.PI / 2)
const across = <T extends THREE.BufferGeometry>(geometry: T) => geometry.rotateZ(Math.PI / 2)
const rounded = (w: number, h: number, d: number, r: number) => new RoundedBoxGeometry(w, h, d, 2, r)
const v2 = (points: Plan) => points.map(([x, y]) => new THREE.Vector2(x, y))
const matte = (color: number, roughness = 0.85, metalness = 0.1, side: THREE.Side = THREE.FrontSide) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, side })
/** A repeatable 0–1 hash, so scattered trees and cars land in the same places every time. */
const hash = (i: number) => {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

const placer = new THREE.Object3D()
function instanced(geometry: THREE.BufferGeometry, material: THREE.Material, places: Place[], colors?: number[]) {
  const item = new THREE.InstancedMesh(geometry, material, places.length)
  places.forEach(([x, y, z, turn = 0, scale = [1, 1, 1]], i) => {
    placer.position.set(x, y, z)
    placer.rotation.set(0, turn, 0)
    placer.scale.set(...scale)
    placer.updateMatrix()
    item.setMatrixAt(i, placer.matrix)
    if (colors) item.setColorAt(i, new THREE.Color(colors[Math.floor(hash(i + 7) * colors.length)]))
  })
  return item
}

/** A round bar from one point to another. */
function rod(from: Vec3, to: Vec3, radius: number, material: THREE.Material) {
  const a = new THREE.Vector3(...from)
  const b = new THREE.Vector3(...to)
  const item = mesh(new THREE.CylinderGeometry(radius, radius, a.distanceTo(b), 10), material)
  item.position.copy(a).add(b).multiplyScalar(0.5)
  item.quaternion.setFromUnitVectors(UP, b.sub(a).normalize())
  return item
}

/** A circular arch's (z, y) outline, `span` wide and `rise` high, closed along its base. */
function arch(span: number, rise: number): Plan {
  const radius = (span * span) / (8 * rise) + rise / 2
  return Array.from({ length: 25 }, (_, i) => {
    const z = (i / 24 - 0.5) * span
    return [z, Math.max(0, Math.sqrt(radius * radius - z * z) - (radius - rise))]
  })
}

const between = (a: Plan, b: Plan, k: number): Plan => a.map(([x, z], i) => [x + (b[i][0] - x) * k, z + (b[i][1] - z) * k])
const scaled = (plan: Plan, sx: number, sz = sx): Plan => plan.map(([x, z]) => [x * sx, z * sz])
/** A plan pushed out by `d` on every side. */
const grow = (plan: Plan, d: number): Plan => {
  const mid = plan.reduce((sum, [, z]) => sum + z, 0) / plan.length
  return plan.map(([x, z]) => [x + Math.sign(x) * d, z + Math.sign(z - mid) * d])
}

/** Wheels on both sides at each z: tyres, hub discs and caps, instanced. */
function wheels(m: Mats, x: number, zs: number[], radius: number, width: number, y = radius) {
  const group = new THREE.Group()
  const places = zs.flatMap((z) => [-1, 1].map((side): Place => [side * x, y, z]))
  group.add(instanced(across(new THREE.CylinderGeometry(radius, radius, width, 36)), m.rubber, places))
  group.add(instanced(across(new THREE.CylinderGeometry(radius * 0.58, radius * 0.62, width + 0.04, 24)), m.grime, places))
  group.add(instanced(across(new THREE.CylinderGeometry(radius * 0.2, radius * 0.24, width + 0.14, 10)), m.iron, places))
  return group
}

/** Both sides' track: shoes, rubber pads and centre guides, instanced along a closed (z, y) loop run front to back along the ground. */
function tracks(m: Mats, x: number, path: Plan, width: number) {
  const loop = new THREE.CatmullRomCurve3(
    path.map(([z, y]) => new THREE.Vector3(0, y, z)),
    true,
    'centripetal',
  )
  const count = Math.round(loop.getLength() / 0.17)
  const parts = [
    new THREE.InstancedMesh(new THREE.BoxGeometry(width, 0.05, 0.14), m.iron, count * 2),
    new THREE.InstancedMesh(new THREE.BoxGeometry(width * 0.8, 0.04, 0.11).translate(0, -0.04, 0), m.rubber, count * 2),
    new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, 0.1, 0.08).translate(0, 0.07, 0), m.iron, count * 2),
  ]
  let index = 0
  for (let i = 0; i < count; i += 1) {
    const at = loop.getPointAt(i / count)
    const tangent = loop.getTangentAt(i / count)
    for (const side of [-1, 1]) {
      placer.position.set(side * x, at.y, at.z)
      placer.rotation.set(Math.atan2(-tangent.y, tangent.z), 0, 0)
      placer.scale.set(1, 1, 1)
      placer.updateMatrix()
      for (const part of parts) part.setMatrixAt(index, placer.matrix)
      index += 1
    }
  }
  const group = new THREE.Group()
  parts.forEach((part) => group.add(part))
  return group
}

/** An 8×8 wheeled APC in desert tan: faceted hull with a sloped nose, eight wheels, a remote 30 mm station, rear ramp, vision blocks, stowage and whips. */
function apc(m: Mats): Built {
  const root = new THREE.Group()
  const belly: Plan = [[-0.85, -3.3], [0.85, -3.3], [1.1, -2.9], [1.1, 3.55], [-1.1, 3.55], [-1.1, -2.9]]
  const waist: Plan = [[-1.0, -3.95], [1.0, -3.95], [1.4, -3.45], [1.4, 3.85], [-1.4, 3.85], [-1.4, -3.45]]
  const roof: Plan = [[-0.75, -2.4], [0.75, -2.4], [1.12, -2.0], [1.12, 3.72], [-1.12, 3.72], [-1.12, -2.0]]
  root.add(mesh(loft(belly, waist, 0.62, 1.42), m.armor))
  root.add(mesh(loft(waist, roof, 1.42, 2.2), m.armor))
  root.add(wheels(m, 1.2, [-2.65, -1.3, 0.75, 2.1], 0.58, 0.42))

  const glacis = Math.atan2(0.78, 1.55)
  const flank = Math.atan2(0.28, 0.78)
  const onGlacis = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, z: number, lift = 0.02) => {
    const item = mesh(geometry, material, [x, 1.42 + (z + 3.95) * Math.tan(glacis) + lift, z])
    item.rotation.x = -glacis
    root.add(item)
  }
  onGlacis(rounded(0.75, 0.03, 0.75, 0.01), m.black, 0.55, -3.15)
  for (let i = 0; i < 5; i += 1) onGlacis(rounded(0.7, 0.03, 0.05, 0.01), m.grime, 0.55, -3.43 + i * 0.13, 0.04)
  for (const side of [-1, 1]) {
    onGlacis(rounded(0.3, 0.08, 0.16, 0.02), m.grime, side * 0.78, -3.75)
    onGlacis(new THREE.BoxGeometry(0.22, 0.03, 0.1), m.glass, side * 0.78, -3.75, 0.07)
    root.add(mesh(new THREE.TorusGeometry(0.07, 0.022, 8, 20).rotateY(Math.PI / 2), m.iron, [side * 0.6, 0.95, -3.6]))
  }
  for (const x of [-0.65, -0.45, -0.25]) {
    const block = mesh(rounded(0.16, 0.09, 0.06, 0.015), m.glass, [x, 2.22, -2.36])
    block.rotation.x = -glacis
    root.add(block)
  }
  root.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 24), m.armor, [-0.45, 2.225, -1.95]))
  for (const x of [-0.45, 0.45]) root.add(mesh(rounded(0.7, 0.06, 1.0, 0.02), m.armor, [x, 2.23, 2.8]))
  const cupola = new THREE.Group()
  cupola.position.set(0.6, 2.2, 0.85)
  cupola.add(mesh(new THREE.CylinderGeometry(0.34, 0.36, 0.14, 24), m.armor, [0, 0.07, 0]))
  cupola.add(mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.05, 24), m.grime, [0, 0.16, 0]))
  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2
    const block = mesh(rounded(0.11, 0.06, 0.04, 0.01), m.glass, [Math.sin(angle) * 0.35, 0.08, Math.cos(angle) * 0.35])
    block.rotation.y = angle
    cupola.add(block)
  }
  root.add(cupola)

  for (const side of [-1, 1]) {
    const onFlank = (geometry: THREE.BufferGeometry, material: THREE.Material, y: number, z: number, out = 0) => {
      const item = mesh(geometry, material, [side * (1.4 - (y - 1.42) * Math.tan(flank) + out), y, z])
      item.rotation.z = side * flank
      root.add(item)
    }
    for (const z of [-1.4, -0.2, 1.0, 2.2]) onFlank(rounded(0.05, 0.1, 0.22, 0.02), m.glass, 2.0, z, 0.01)
    for (const z of [0.1, 1.5, 2.9]) onFlank(rounded(0.16, 0.38, 1.1, 0.04), m.grime, 1.72, z, 0.07)
    onFlank(new THREE.BoxGeometry(0.02, 0.05, 1.4), m.accent, 1.55, -1.7, 0.01)
    root.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 10), m.iron, [side * 0.95, 2.26, 3.4]))
    const whip = mesh(new THREE.CylinderGeometry(0.006, 0.01, 2.4, 6), m.black, [side * 0.95, 3.5, 3.5])
    whip.rotation.x = 0.08
    root.add(whip)
    root.add(mesh(rounded(0.22, 0.14, 0.05, 0.02), m.black, [side * 1.1, 1.6, 3.83]))
  }

  const ramp = mesh(rounded(1.5, 0.84, 0.08, 0.03), m.grime, [0, 1.02, 3.74])
  ramp.rotation.x = Math.atan2(0.3, 0.8)
  root.add(ramp)
  root.add(mesh(across(new THREE.CylinderGeometry(0.06, 0.06, 1.4, 12)), m.iron, [0, 0.66, 3.6]))
  const door = mesh(rounded(0.7, 0.66, 0.05, 0.02), m.grime, [0.35, 1.8, 3.83])
  door.rotation.x = -Math.atan2(0.13, 0.78)
  root.add(door)
  root.add(mesh(new THREE.BoxGeometry(0.2, 0.22, 0.02), m.glass, [0.35, 1.9, 3.86]))

  const rws = new THREE.Group()
  rws.position.set(0, 2.2, -0.5)
  rws.add(mesh(new THREE.CylinderGeometry(0.55, 0.6, 0.1, 32), m.grime, [0, 0.05, 0]))
  rws.add(mesh(new THREE.TorusGeometry(0.6, 0.015, 8, 48).rotateX(Math.PI / 2), m.accent, [0, 0.07, 0]))
  rws.add(mesh(rounded(0.95, 0.45, 1.05, 0.06), m.armor, [0, 0.33, 0.05]))
  rws.add(mesh(rounded(0.3, 0.3, 0.36, 0.04), m.iron, [0.6, 0.5, -0.15]))
  rws.add(mesh(new THREE.BoxGeometry(0.22, 0.2, 0.02), m.glass, [0.6, 0.5, -0.34]))
  rws.add(mesh(rounded(0.24, 0.24, 0.8, 0.03), m.iron, [-0.15, 0.38, -0.7]))
  rws.add(mesh(along(new THREE.CylinderGeometry(0.045, 0.05, 1.9, 16)), m.iron, [-0.15, 0.38, -2.0]))
  rws.add(mesh(along(new THREE.CylinderGeometry(0.065, 0.065, 0.22, 16)), m.black, [-0.15, 0.38, -2.95]))
  rws.add(mesh(rounded(0.3, 0.32, 0.55, 0.04), m.olive, [-0.68, 0.3, 0.1]))
  root.add(rws)
  return { root, tick: (t) => (rws.rotation.y = Math.sin(t * 0.35) * 0.9) }
}

/** A UH-60-style utility helicopter in olive: streamlined cabin with glazing and doors, twin engines, a four-blade rotor, tail boom, fin and tail rotor, wheeled gear. */
function helicopter(m: Mats): Built {
  const root = new THREE.Group()
  const skin = m.olive
  const panel = matte(0x47462f, 0.9, 0.05)
  const centre = 1.95
  const profile: Plan = [[0, -6.3], [0.45, -6.2], [0.85, -5.8], [1.12, -5.0], [1.28, -3.9], [1.32, -2.5], [1.3, 0.6], [1.12, 2.0], [0.8, 3.2], [0.5, 4.3]]
  const lathe = (points: Plan, segments: number, phi = 0, sweep = Math.PI * 2) =>
    new THREE.LatheGeometry(v2(points), segments, phi, sweep).rotateX(Math.PI / 2).scale(0.95, 0.82, 1)
  const radiusAt = (z: number) => {
    for (let i = 1; i < profile.length; i += 1) {
      const [r0, z0] = profile[i - 1]
      const [r1, z1] = profile[i]
      if (z <= z1) return r0 + ((r1 - r0) * (z - z0)) / (z1 - z0)
    }
    return profile[profile.length - 1][0]
  }
  /** A panel on the skin between z0 and z1, centred `phi` round from the bottom (π is the top). */
  const patch = (z0: number, z1: number, phi: number, half: number, material: THREE.Material, lift = 0.02) => {
    const points = [0, 0.25, 0.5, 0.75, 1].map((k): [number, number] => {
      const z = z0 + (z1 - z0) * k
      return [radiusAt(z) + lift, z]
    })
    root.add(mesh(lathe(points, 12, phi - half, half * 2), material, [0, centre, 0]))
  }
  root.add(mesh(lathe(profile, 40), skin, [0, centre, 0]))
  patch(-5.85, -4.0, Math.PI, 1.2, m.glass, 0.025)
  for (const side of [-1, 1]) {
    const up = (lift: number) => Math.PI + side * (lift - Math.PI / 2)
    patch(-2.4, -0.7, up(0), 0.55, panel, 0.015)
    patch(-1.95, -1.15, up(0.32), 0.17, m.glass, 0.03)
    patch(-0.35, 0.25, up(0.32), 0.17, m.glass, 0.025)
    patch(-3.95, -3.3, up(0.38), 0.24, m.glass, 0.025)
    root.add(mesh(new THREE.BoxGeometry(0.04, 0.04, 2.4), m.black, [side * 1.17, 2.55, -1.0]))
  }

  for (const side of [-1, 1]) {
    root.add(mesh(along(new THREE.CapsuleGeometry(0.36, 1.7, 6, 16)), skin, [side * 0.55, 3.1, 0.4]))
    root.add(mesh(along(new THREE.CylinderGeometry(0.29, 0.29, 0.06, 20)), m.black, [side * 0.55, 3.1, -0.76]))
    const exhaust = mesh(along(new THREE.CylinderGeometry(0.2, 0.26, 0.6, 16)), m.dark, [side * 0.78, 3.12, 1.75])
    exhaust.rotation.y = side * 0.35
    root.add(exhaust)
  }
  root.add(mesh(rounded(1.3, 0.45, 3.2, 0.15), skin, [0, 3.0, 0.2]))
  root.add(mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.75, 16), m.dark, [0, 3.55, -0.2]))
  const rotor = new THREE.Group()
  rotor.position.set(0, 3.95, -0.2)
  rotor.add(mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.2, 24), m.dark))
  rotor.add(mesh(new THREE.CylinderGeometry(0.15, 0.25, 0.3, 16), m.dark, [0, 0.25, 0]))
  const blade = new RoundedBoxGeometry(7.6, 0.06, 0.53, 1, 0.025).translate(4.15, 0, 0)
  const grip = rounded(0.7, 0.14, 0.22, 0.05).translate(0.55, 0, 0)
  for (let i = 0; i < 4; i += 1) {
    for (const [geometry, material] of [
      [blade, m.black],
      [grip, m.dark],
    ] as const) {
      const item = mesh(geometry, material)
      item.rotation.y = (i * Math.PI) / 2
      rotor.add(item)
    }
  }
  root.add(rotor)

  root.add(mesh(along(new THREE.CylinderGeometry(0.22, 0.5, 6.6, 24)), skin, [0, 2.3, 7.3]))
  root.add(mesh(new THREE.TorusGeometry(0.285, 0.02, 8, 32), m.accent, [0, 2.3, 9.2]))
  root.add(mesh(sideExtrude([[9.7, 2.3], [10.25, 4.4], [10.8, 4.6], [11.0, 4.4], [10.65, 2.2]], 0.16, 0.03), skin))
  root.add(mesh(rounded(4.2, 0.07, 0.8, 0.03), skin, [0, 2.35, 10.25]))
  const tailRotor = new THREE.Group()
  tailRotor.position.set(0.2, 4.0, 10.55)
  tailRotor.add(mesh(across(new THREE.CylinderGeometry(0.1, 0.1, 0.2, 16)), m.dark))
  const tailBlade = rounded(0.03, 1.55, 0.2, 0.01).translate(0, 0.8, 0)
  for (let i = 0; i < 4; i += 1) {
    const item = mesh(tailBlade, m.black, [0.06, 0, 0])
    item.rotation.x = (i * Math.PI) / 2
    tailRotor.add(item)
  }
  root.add(tailRotor)

  for (const side of [-1, 1]) {
    root.add(mesh(across(new THREE.CylinderGeometry(0.32, 0.32, 0.2, 24)), m.rubber, [side * 1.35, 0.32, -3.1]))
    root.add(mesh(across(new THREE.CylinderGeometry(0.15, 0.15, 0.22, 16)), m.dark, [side * 1.35, 0.32, -3.1]))
    root.add(rod([side * 1.3, 0.35, -3.1], [side * 1.0, 1.2, -2.8], 0.06, m.dark))
    root.add(rod([side * 1.3, 0.35, -3.1], [side * 0.8, 0.95, -3.6], 0.04, m.dark))
  }
  root.add(mesh(across(new THREE.CylinderGeometry(0.18, 0.18, 0.12, 16)), m.rubber, [0, 0.18, 8.6]))
  root.add(rod([0, 0.18, 8.6], [0, 2.1, 8.2], 0.05, m.dark))
  root.add(mesh(rounded(0.05, 0.22, 0.4, 0.02), m.black, [0, 3.35, 2.2]))
  root.add(mesh(rounded(0.05, 0.2, 0.35, 0.02), m.black, [0, 0.82, -1.0]))
  return {
    root,
    tick: (t) => {
      rotor.rotation.y = t * 5
      tailRotor.rotation.x = t * 20
    },
  }
}

/** A Patriot-style launcher on an 8×8 truck: glazed cab, generator, four square canisters on an elevating frame with its ram, outrigger jacks down. */
function airDefence(m: Mats): Built {
  const root = new THREE.Group()
  for (const x of [-0.5, 0.5]) root.add(mesh(new THREE.BoxGeometry(0.2, 0.32, 10.6), m.iron, [x, 0.98, 0]))
  root.add(wheels(m, 1.05, [-4.3, -2.9, 2.2, 3.6], 0.6, 0.45))
  root.add(mesh(sideExtrude([[-5.55, 1.25], [-5.55, 2.25], [-5.25, 3.05], [-3.45, 3.08], [-3.45, 1.25]], 2.5, 0.04), m.armor))
  const screen = mesh(new THREE.BoxGeometry(2.1, 0.7, 0.03), m.glass, [0, 2.66, -5.43])
  screen.rotation.x = Math.atan2(0.3, 0.8)
  root.add(screen)
  root.add(mesh(new THREE.BoxGeometry(1.7, 0.75, 0.04), m.black, [0, 1.75, -5.57]))
  root.add(mesh(rounded(2.5, 0.28, 0.3, 0.05), m.iron, [0, 1.05, -5.6]))
  root.add(mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.06, 20), m.grime, [-0.5, 3.1, -4.3]))
  root.add(rod([0.8, 3.08, -3.8], [0.9, 5.0, -3.7], 0.01, m.black))
  for (const side of [-1, 1]) {
    root.add(mesh(new THREE.BoxGeometry(0.03, 0.55, 1.0), m.glass, [side * 1.26, 2.55, -4.4]))
    root.add(mesh(new THREE.BoxGeometry(0.01, 0.06, 1.4), m.accent, [side * 1.26, 1.62, -4.5]))
    root.add(mesh(new THREE.BoxGeometry(0.26, 0.14, 0.03), m.glass, [side * 0.95, 1.55, -5.59]))
    root.add(rod([side * 1.25, 2.6, -5.2], [side * 1.48, 2.6, -5.2], 0.02, m.black))
    root.add(mesh(rounded(0.06, 0.4, 0.22, 0.02), m.black, [side * 1.5, 2.6, -5.2]))
    root.add(mesh(rounded(0.55, 0.08, 3.0, 0.03), m.tan, [side * 1.05, 1.27, -3.6]))
  }
  root.add(mesh(rounded(2.3, 1.4, 1.6, 0.06), m.armor, [0, 1.95, -2.4]))
  root.add(instanced(new THREE.BoxGeometry(2.34, 0.05, 1.1), m.black, [0, 1, 2, 3, 4, 5].map((i): Place => [0, 1.6 + i * 0.13, -2.4])))
  root.add(rod([0.8, 2.6, -1.9], [0.8, 3.1, -1.9], 0.05, m.black))
  root.add(mesh(rounded(2.5, 0.15, 6.4, 0.05), m.tan, [0, 1.32, 2.0]))
  root.add(mesh(along(new THREE.CylinderGeometry(0.3, 0.3, 1.4, 20)), m.grime, [-0.95, 0.95, 0.3]))
  root.add(mesh(rounded(0.5, 0.5, 1.2, 0.05), m.armor, [0.95, 0.95, 0.3]))

  for (const z of [-1.0, 5.0])
    for (const side of [-1, 1]) {
      root.add(mesh(rounded(1.2, 0.16, 0.22, 0.04), m.iron, [side * 1.15, 1.0, z]))
      root.add(mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.4, 12), m.iron, [side * 1.65, 0.88, z]))
      root.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.9, 12), m.steel, [side * 1.65, 0.52, z]))
      root.add(mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.08, 20), m.iron, [side * 1.65, 0.04, z]))
    }

  root.add(mesh(rounded(1.8, 0.5, 1.0, 0.05), m.iron, [0, 1.65, 4.6]))
  root.add(mesh(across(new THREE.CylinderGeometry(0.15, 0.15, 2.3, 16)), m.dark, [0, 1.95, 4.75]))
  const lift = new THREE.Group()
  lift.position.set(0, 1.95, 4.75)
  const canister = rounded(0.95, 0.95, 5.8, 0.05)
  const cover = new THREE.BoxGeometry(0.8, 0.8, 0.02)
  for (const x of [-0.49, 0.49])
    for (const y of [0.6, 1.58]) {
      lift.add(mesh(canister, m.tan, [x, y, -2.85]))
      lift.add(mesh(cover, m.black, [x, y, -5.76]))
      lift.add(mesh(cover, m.grime, [x, y, 0.06]))
    }
  for (const z of [-0.5, -2.85, -5.2]) lift.add(mesh(rounded(2.08, 2.12, 0.14, 0.03), m.iron, [0, 1.09, z]))
  lift.add(mesh(new THREE.BoxGeometry(1.9, 0.12, 5.9), m.iron, [0, 0.06, -2.85]))
  lift.add(mesh(new THREE.BoxGeometry(0.01, 0.07, 1.2), m.accent, [0.975, 1.6, -4.3]))
  root.add(lift)

  root.add(mesh(rounded(0.4, 0.15, 0.4, 0.04), m.iron, [0, 1.47, 2.6]))
  const ram = mesh(new THREE.CylinderGeometry(0.08, 0.08, 1, 12), m.steel)
  const sleeve = mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.9, 12).translate(0, 0.45, 0), m.iron)
  root.add(ram, sleeve)
  const base = new THREE.Vector3(0, 1.45, 2.6)
  const tip = new THREE.Vector3()
  const elevate = (angle: number) => {
    lift.rotation.x = angle
    lift.updateMatrix()
    tip.set(0, 0, -2.4).applyMatrix4(lift.matrix)
    ram.position.copy(base).lerp(tip, 0.5)
    ram.scale.set(1, tip.distanceTo(base), 1)
    ram.quaternion.setFromUnitVectors(UP, tip.sub(base).normalize())
    sleeve.position.copy(base)
    sleeve.quaternion.copy(ram.quaternion)
  }
  elevate(0.5)
  return { root, tick: (t) => elevate(0.5 + Math.sin(t * 0.35) * 0.12) }
}

/** A K9-style tracked 155 mm self-propelled howitzer: tan hull on six road wheels a side, big turret set aft, a long L52 barrel with a muzzle brake. */
function howitzer(m: Mats): Built {
  const root = new THREE.Group()
  root.add(mesh(sideExtrude([[-3.75, 1.25], [-3.3, 0.5], [3.4, 0.5], [3.7, 0.85], [3.7, 1.25]], 2.3, 0.02), m.grime))
  root.add(mesh(sideExtrude([[-3.8, 1.2], [-3.75, 1.36], [-2.3, 1.8], [3.65, 1.82], [3.75, 1.72], [3.75, 1.2]], 3.4, 0.03), m.armor))
  const glacis = Math.atan2(0.44, 1.45)

  root.add(wheels(m, 1.42, [-2.45, -1.5, -0.55, 0.4, 1.35, 2.3], 0.34, 0.42, 0.42))
  for (const side of [-1, 1]) {
    const x = side * 1.42
    root.add(mesh(across(new THREE.CylinderGeometry(0.3, 0.3, 0.5, 24)), m.iron, [x, 0.75, -3.3]))
    for (let i = 0; i < 10; i += 1) {
      const angle = (i / 10) * Math.PI * 2
      const tooth = mesh(rounded(0.52, 0.08, 0.08, 0.015), m.iron, [x, 0.75 + Math.cos(angle) * 0.31, -3.3 + Math.sin(angle) * 0.31])
      tooth.rotation.x = -angle
      root.add(tooth)
    }
    root.add(mesh(across(new THREE.CylinderGeometry(0.3, 0.3, 0.45, 24)), m.iron, [x, 0.62, 3.25]))
    root.add(mesh(across(new THREE.CylinderGeometry(0.2, 0.2, 0.47, 20)), m.grime, [x, 0.62, 3.25]))
    for (const z of [-2.0, 0, 2.0]) root.add(mesh(across(new THREE.CylinderGeometry(0.09, 0.09, 0.3, 12)), m.iron, [x, 1.02, z]))
    root.add(mesh(sideExtrude([[-3.5, 0.92], [3.45, 0.92], [3.6, 1.25], [-3.7, 1.25]], 0.04, 0.008), m.armor, [side * 1.72, 0, 0]))
    root.add(mesh(rounded(0.3, 0.12, 0.14, 0.03), m.grime, [side * 1.4, 1.43, -3.62]))
    root.add(mesh(new THREE.BoxGeometry(0.22, 0.07, 0.02), m.glass, [side * 1.4, 1.43, -3.7]))
  }
  root.add(
    tracks(
      m,
      1.42,
      [
        [-2.8, 0.06],
        [0, 0.06],
        [2.6, 0.06],
        [3.25, 0.25],
        [3.58, 0.62],
        [3.35, 0.9],
        [2.9, 1.14],
        [0, 1.15],
        [-2.9, 1.14],
        [-3.45, 1.02],
        [-3.62, 0.75],
        [-3.4, 0.38],
      ],
      0.55,
    ),
  )
  root.add(mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.05, 24), m.armor, [-0.85, 1.83, -2.0]))
  for (const x of [-1.05, -0.85, -0.65]) {
    const block = mesh(rounded(0.16, 0.08, 0.06, 0.015), m.glass, [x, 1.81, -2.36])
    block.rotation.x = -glacis
    root.add(block)
  }
  root.add(mesh(rounded(1.1, 0.04, 1.2, 0.01), m.black, [0.8, 1.83, -1.5]))
  root.add(mesh(rounded(1.0, 0.85, 0.06, 0.02), m.grime, [0, 1.35, 3.78]))

  const turret = new THREE.Group()
  turret.position.set(0, 1.82, 0.7)
  turret.add(mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.08, 48), m.iron, [0, 0.03, 0]))
  const plan: Plan = [[-1.0, -2.05], [1.0, -2.05], [1.6, -1.5], [1.62, 2.35], [-1.62, 2.35], [-1.6, -1.5]]
  turret.add(mesh(loft(plan, plan.map(([x, z]): [number, number] => [x * 0.92, z < 0 ? z + 0.25 : z - 0.05]), 0.06, 1.12), m.armor))
  turret.add(mesh(rounded(1.0, 0.8, 0.45, 0.06), m.armor, [0, 0.55, -2.1]))
  const gun = new THREE.Group()
  gun.position.set(0, 0.58, -2.2)
  gun.add(mesh(along(new THREE.CylinderGeometry(0.2, 0.22, 1.2, 24)), m.armor, [0, 0, -0.5]))
  gun.add(mesh(along(new THREE.CylinderGeometry(0.11, 0.085, 7.0, 24)), m.tan, [0, 0, -3.5]))
  gun.add(mesh(along(new THREE.CylinderGeometry(0.145, 0.145, 0.8, 24)), m.tan, [0, 0, -3.3]))
  gun.add(mesh(new THREE.TorusGeometry(0.112, 0.012, 8, 32), m.accent, [0, 0, -1.25]))
  gun.add(mesh(along(new THREE.CylinderGeometry(0.15, 0.15, 0.55, 24)), m.iron, [0, 0, -7.2]))
  for (const z of [-7.08, -7.3]) gun.add(mesh(new THREE.BoxGeometry(0.34, 0.1, 0.1), m.black, [0, 0, z]))
  gun.rotation.x = 0.12
  turret.add(gun)

  const top = 1.12
  turret.add(mesh(new THREE.CylinderGeometry(0.38, 0.4, 0.18, 24), m.armor, [0.75, top + 0.09, 0.6]))
  turret.add(mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.05, 24), m.iron, [0.75, top + 0.2, 0.6]))
  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2
    const block = mesh(rounded(0.11, 0.06, 0.04, 0.01), m.glass, [0.75 + Math.sin(angle) * 0.39, top + 0.1, 0.6 + Math.cos(angle) * 0.39])
    block.rotation.y = angle
    turret.add(block)
  }
  turret.add(mesh(rounded(0.12, 0.14, 0.5, 0.03), m.iron, [0.75, top + 0.32, 0.25]))
  turret.add(mesh(along(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 8)), m.black, [0.75, top + 0.34, -0.4]))
  turret.add(mesh(rounded(0.7, 0.06, 0.8, 0.02), m.armor, [-0.8, top + 0.03, 0.9]))
  turret.add(mesh(rounded(0.35, 0.35, 0.5, 0.04), m.armor, [0.85, top + 0.16, -1.25]))
  turret.add(mesh(new THREE.BoxGeometry(0.25, 0.2, 0.02), m.glass, [0.85, top + 0.17, -1.51]))
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i += 1) {
      const tube = mesh(along(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 12)), m.iron, [side * (1.05 + i * 0.11), 0.95, -1.7])
      tube.rotation.x = 0.6
      turret.add(tube)
    }
    const hatch = mesh(rounded(0.04, 0.8, 0.9, 0.015), m.grime, [side * 1.57, 0.6, 0.6])
    hatch.rotation.z = side * Math.atan2(0.13, 1.06)
    turret.add(hatch)
    const whip = mesh(new THREE.CylinderGeometry(0.006, 0.01, 2.2, 6), m.black, [side * 1.3, top + 1.1, 2.0])
    whip.rotation.x = 0.1
    turret.add(whip)
  }
  turret.add(mesh(rounded(2.8, 0.4, 0.5, 0.03), m.iron, [0, 0.55, 2.6]))
  turret.add(mesh(rounded(1.0, 0.35, 0.4, 0.08), m.cloth, [-0.6, 0.9, 2.6]))
  turret.add(mesh(rounded(0.8, 0.3, 0.4, 0.04), m.olive, [0.7, 0.88, 2.6]))
  root.add(turret)
  return {
    root,
    tick: (t) => {
      turret.rotation.y = Math.sin(t * 0.25) * 0.4
      gun.rotation.x = 0.12 + Math.sin(t * 0.5) * 0.06
    },
  }
}

const DECK: Plan = [[0, -20.5], [1.6, -17], [2.9, -12], [3.6, -5], [3.7, 4], [3.55, 19.5], [-3.55, 19.5], [-3.7, 4], [-3.6, -5], [-2.9, -12], [-1.6, -17]]
const KEEL: Plan = [[0, -15.5], [0.25, -13.5], [0.6, -10], [1.0, -4], [1.4, 4], [2.6, 18.8], [-2.6, 18.8], [-1.4, 4], [-1.0, -4], [-0.6, -10], [-0.25, -13.5]]
const hazeGrey = () => {
  const material = matte(0x8a949e, 0.7, 0.25, THREE.DoubleSide)
  material.flatShading = true
  return material
}

/** A 40 m fast patrol craft in haze grey: hard-chine V hull, stealthy superstructure and bridge, mast with a turning radar, bow gun, remote guns, life rafts and a RHIB. */
function patrolBoat(m: Mats): Built {
  const root = new THREE.Group()
  const haze = hazeGrey()
  const windows = m.glass.clone()
  windows.side = THREE.DoubleSide
  const boot = between(KEEL, DECK, 0.36)
  const line = between(KEEL, DECK, 0.4)
  root.add(mesh(loft(KEEL, boot, 0, 1.19), matte(0x5c2f2b, 0.9, 0.05, THREE.DoubleSide)))
  root.add(mesh(loft(boot, line, 1.19, 1.32), matte(0x15181c, 0.8, 0.1, THREE.DoubleSide)))
  root.add(mesh(loft(line, DECK, 1.32, 3.3), haze))
  const walk = scaled(DECK, 0.95, 0.97)
  root.add(mesh(loft(walk, walk, 3.3, 3.34), matte(0x59616a, 0.95, 0.05, THREE.DoubleSide)))

  const house: Plan = [[-2.9, -6], [2.9, -6], [3.0, 8], [-3.0, 8]]
  root.add(mesh(loft(house, [[-2.6, -4.9], [2.6, -4.9], [2.7, 7.6], [-2.7, 7.6]], 3.3, 6.2), haze))
  const bridge: Plan = [[-2.3, -4.4], [2.3, -4.4], [2.4, 2.6], [-2.4, 2.6]]
  const bridgeTop: Plan = [[-2.5, -4.85], [2.5, -4.85], [2.2, 2.3], [-2.2, 2.3]]
  root.add(mesh(loft(bridge, bridgeTop, 6.2, 8.4), haze))
  root.add(mesh(loft(grow(between(bridge, bridgeTop, 0.36), 0.04), grow(between(bridge, bridgeTop, 0.8), 0.04), 6.99, 7.96), windows))
  root.add(instanced(new THREE.BoxGeometry(5.66, 0.6, 0.9), m.glass, [-3, -1.2, 0.6, 4.4].map((z): Place => [0, 4.6, z])))

  root.add(mesh(new THREE.CylinderGeometry(0.35, 0.8, 5.2, 4).rotateY(Math.PI / 4), haze, [0, 11.0, 0.2]))
  root.add(mesh(rounded(3.6, 0.12, 0.14, 0.04), m.dark, [0, 12.2, 0.2]))
  root.add(mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.12, 8), haze, [0, 13.65, 0.2]))
  for (const side of [-1, 1]) {
    root.add(rod([side * 1.6, 12.2, 0.2], [side * 1.75, 14.6, 0.2], 0.02, m.black))
    root.add(mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.5, 12), haze, [side * 1.4, 8.65, 1.3]))
    root.add(mesh(new THREE.SphereGeometry(0.55, 24, 16), matte(0xdcdfe2, 0.6, 0.05), [side * 1.4, 9.3, 1.3]))
  }
  const radar = new THREE.Group()
  radar.position.set(0, 13.71, 0.2)
  radar.add(mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.35, 12), m.dark, [0, 0.17, 0]))
  radar.add(mesh(rounded(3.2, 0.3, 0.22, 0.06), m.dark, [0, 0.45, 0]))
  radar.add(mesh(rounded(0.3, 0.2, 0.4, 0.05), m.dark, [0, 0.42, 0.25]))
  root.add(radar)

  const gun = new THREE.Group()
  gun.position.set(0, 3.34, -11.0)
  gun.add(mesh(new THREE.CylinderGeometry(1.05, 1.1, 0.4, 32), haze, [0, 0.2, 0]))
  gun.add(mesh(loft([[-0.9, -0.95], [0.9, -0.95], [1.0, 1.0], [-1.0, 1.0]], [[-0.5, -0.45], [0.5, -0.45], [0.7, 0.85], [-0.7, 0.85]], 0.4, 1.45), haze))
  gun.add(mesh(along(new THREE.CylinderGeometry(0.09, 0.07, 3.4, 16)), m.dark, [0, 0.9, -2.4]))
  gun.add(mesh(along(new THREE.CylinderGeometry(0.1, 0.1, 0.3, 16)), m.dark, [0, 0.9, -4.0]))
  root.add(gun)
  const remote = (x: number, y: number, z: number) => {
    const item = new THREE.Group()
    item.position.set(x, y, z)
    item.add(mesh(new THREE.CylinderGeometry(0.28, 0.38, 0.8, 16), haze, [0, 0.4, 0]))
    item.add(mesh(rounded(0.6, 0.5, 0.8, 0.08), haze, [0, 1.05, 0]))
    item.add(mesh(along(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 10)), m.dark, [0.12, 1.05, -0.95]))
    item.add(mesh(rounded(0.25, 0.3, 0.4, 0.05), m.dark, [-0.42, 1.0, 0]))
    root.add(item)
  }
  remote(0, 3.34, 12.5)
  remote(0, 6.2, 7.0)

  root.add(mesh(rounded(1.8, 1.3, 1.6, 0.1), haze, [0, 6.85, 5.4]))
  root.add(mesh(new THREE.BoxGeometry(1.82, 0.12, 1.62), m.accent, [0, 7.2, 5.4]))
  root.add(mesh(new THREE.BoxGeometry(1.5, 0.05, 1.3), m.black, [0, 7.51, 5.4]))
  const rafts = [-2.0, 2.0].flatMap((x) => [3.2, 4.6, 6.0].map((z): Place => [x, 6.55, z]))
  root.add(instanced(along(new THREE.CapsuleGeometry(0.32, 0.6, 4, 12)), matte(0xd8d8d0, 0.7, 0), rafts))
  root.add(mesh(rounded(2.0, 0.7, 5.0, 0.3), m.rubber, [0, 3.7, 16.4]))
  root.add(mesh(rounded(0.6, 0.5, 0.6, 0.08), m.dark, [0, 4.25, 16.6]))

  const posts = [-1, 1].flatMap((side) => Array.from({ length: 16 }, (_, i): Place => [side * 3.45, 3.84, -6 + i * 1.6]))
  root.add(instanced(new THREE.CylinderGeometry(0.03, 0.03, 1.0, 6), haze, posts))
  for (const side of [-1, 1])
    for (const y of [3.85, 4.32]) root.add(mesh(new THREE.BoxGeometry(0.04, 0.04, 24), haze, [side * 3.45, y, 6]))
  const bollards = [-1, 1].flatMap((side) => [-14, 0, 15].map((z): Place => [side * 2.9, 3.5, z]))
  root.add(instanced(new THREE.CylinderGeometry(0.14, 0.16, 0.35, 12), m.dark, bollards))
  return { root, tick: (t) => (radar.rotation.y = t * 1.6) }
}

/** One 155 mm round standing up: olive body on a boat-tail base, copper driving band, yellow HE band and stencil, steel nose fuze. */
function round(m: Mats, drab: THREE.Material, stencil: THREE.Material) {
  const item = new THREE.Group()
  const body: Plan = [[0, 0], [0.066, 0], [0.074, 0.03], [0.0775, 0.07], [0.0775, 0.47], [0.074, 0.53], [0.064, 0.59], [0.049, 0.645], [0.034, 0.69]]
  item.add(mesh(new THREE.LatheGeometry(v2(body), 48), drab))
  item.add(mesh(new THREE.LatheGeometry(v2([[0.034, 0.69], [0.031, 0.715], [0.025, 0.75], [0.016, 0.782], [0.007, 0.8], [0, 0.806]]), 32), m.steel))
  item.add(mesh(new THREE.CylinderGeometry(0.0795, 0.0795, 0.026, 48), m.copper, [0, 0.075, 0]))
  item.add(mesh(new THREE.CylinderGeometry(0.0779, 0.0779, 0.02, 48), stencil, [0, 0.42, 0]))
  item.add(mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.014, 6), m.forged, [0, 0.69, 0]))
  item.add(mesh(new THREE.TorusGeometry(0.0335, 0.0025, 6, 32).rotateX(Math.PI / 2), m.accent, [0, 0.702, 0]))
  for (const [i, width] of [0.05, 0.035, 0.045].entries()) item.add(mesh(new THREE.BoxGeometry(width, 0.007, 0.002), m.black, [0, 0.28 + i * 0.016, -0.0777]))
  return item
}

/** A 155 mm artillery shell standing on a wooden pallet, two more lying in chocks beside it. */
function shell(m: Mats): Built {
  const root = new THREE.Group()
  const wood = matte(0x7a5b3c, 0.9, 0)
  const drab = matte(0x4f5530, 0.6, 0.15)
  const stencil = matte(0xb8a040, 0.7, 0.05)
  root.add(instanced(new THREE.BoxGeometry(0.09, 0.09, 0.8), wood, [-0.4, 0, 0.4].map((x): Place => [x, 0.045, 0])))
  root.add(instanced(new THREE.BoxGeometry(0.95, 0.022, 0.13), wood, [-0.33, -0.165, 0, 0.165, 0.33].map((z): Place => [0, 0.101, z])))
  root.add(instanced(new THREE.BoxGeometry(0.5, 0.05, 0.07), wood, [-0.2, 0.25].map((z): Place => [0.2, 0.137, z])))
  root.add(mesh(new THREE.BoxGeometry(0.003, 0.012, 0.8), m.accent, [-0.476, 0.06, 0]))
  const upright = round(m, drab, stencil)
  upright.position.set(-0.24, 0.112, 0.02)
  root.add(upright)
  for (const x of [0.1, 0.29]) {
    const lying = round(m, drab, stencil)
    lying.rotation.x = -Math.PI / 2
    lying.position.set(x, 0.24, 0.4)
    root.add(lying)
  }
  return { root }
}

/** A long-range surveillance radar on a two-axle trailer: jacks down, generator up front, a tilted phased-array face of tiles turning on its pedestal. */
function radar(m: Mats): Built {
  const root = new THREE.Group()
  for (const x of [-0.7, 0.7]) root.add(mesh(new THREE.BoxGeometry(0.18, 0.28, 6.2), m.iron, [x, 0.95, 0.3]))
  root.add(mesh(rounded(2.5, 0.1, 6.6, 0.03), m.tan, [0, 1.14, 0.3]))
  root.add(wheels(m, 1.0, [1.6, 2.65], 0.5, 0.35))
  for (const side of [-1, 1]) root.add(rod([side * 0.7, 0.95, -2.8], [0, 0.75, -4.4], 0.06, m.iron))
  root.add(mesh(new THREE.TorusGeometry(0.1, 0.03, 8, 20).rotateX(Math.PI / 2), m.iron, [0, 0.75, -4.55]))
  root.add(rod([0, 0.85, -4.0], [0, 0.2, -4.0], 0.04, m.iron))
  root.add(mesh(across(new THREE.CylinderGeometry(0.18, 0.18, 0.12, 16)), m.rubber, [0, 0.18, -4.0]))
  for (const z of [-2.6, 3.4])
    for (const side of [-1, 1]) {
      root.add(mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.45, 12), m.iron, [side * 1.15, 0.88, z]))
      root.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.0, 12), m.steel, [side * 1.15, 0.55, z]))
      root.add(mesh(new THREE.CylinderGeometry(0.25, 0.28, 0.06, 20), m.iron, [side * 1.15, 0.03, z]))
    }
  root.add(mesh(rounded(2.2, 1.3, 1.5, 0.06), m.tan, [0, 1.84, -2.15]))
  root.add(instanced(new THREE.BoxGeometry(2.24, 0.05, 1.0), m.black, [0, 1, 2, 3, 4, 5].map((i): Place => [0, 1.5 + i * 0.14, -2.15])))
  root.add(mesh(new THREE.BoxGeometry(1.4, 0.05, 0.01), m.accent, [0, 2.3, -2.91]))
  root.add(rod([0.7, 2.49, -2.6], [0.7, 2.95, -2.6], 0.05, m.black))
  root.add(mesh(rounded(0.9, 1.0, 1.0, 0.05), m.olive, [-0.7, 1.69, 2.9]))
  root.add(mesh(across(new THREE.CylinderGeometry(0.35, 0.35, 0.4, 24)), m.olive, [0.7, 1.55, 2.9]))
  root.add(mesh(across(new THREE.CylinderGeometry(0.15, 0.15, 0.42, 16)), m.dark, [0.7, 1.55, 2.9]))
  root.add(mesh(new THREE.CylinderGeometry(0.55, 0.75, 0.9, 32), m.iron, [0, 1.64, 0.5]))

  const head = new THREE.Group()
  head.position.set(0, 2.09, 0.5)
  head.add(mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.16, 40), m.dark, [0, 0.08, 0]))
  head.add(mesh(rounded(0.7, 1.5, 0.7, 0.05), m.dark, [0, 0.9, 0.55]))
  for (const side of [-1, 1]) head.add(rod([side * 0.3, 0.6, 0.55], [side * 1.6, 1.04, 0.39], 0.05, m.iron))
  const face = new THREE.Group()
  face.position.set(0, 2.0, 0)
  face.rotation.x = 0.3
  face.add(mesh(rounded(5.2, 3.2, 0.32, 0.05), m.dark))
  const tiles: Place[] = []
  for (let c = 0; c < 14; c += 1) for (let r = 0; r < 8; r += 1) tiles.push([(c - 6.5) * 0.36, (r - 3.5) * 0.38, -0.17])
  face.add(instanced(new THREE.BoxGeometry(0.32, 0.34, 0.03), matte(0x3a4048, 0.6, 0.3), tiles))
  for (const y of [-1.62, 1.62]) face.add(mesh(rounded(5.3, 0.12, 0.38, 0.03), m.iron, [0, y, 0]))
  for (const x of [-2.62, 2.62]) face.add(mesh(rounded(0.12, 3.3, 0.38, 0.03), m.iron, [x, 0, 0]))
  face.add(mesh(rounded(4.4, 2.4, 0.5, 0.05), m.iron, [0, 0, 0.4]))
  face.add(mesh(rounded(3.0, 0.22, 0.18, 0.04), m.dark, [0, 1.82, -0.05]))
  face.add(mesh(new THREE.BoxGeometry(5.0, 0.035, 0.02), m.accent, [0, -1.53, -0.2]))
  head.add(face)
  root.add(head)
  return { root, tick: (t) => (head.rotation.y = t * 0.6) }
}

/** A precision-guided cruise missile on a display stand: seeker dome, swept mid-body wings, cruciform tail fins, belly intake, trim ring. */
function missile(m: Mats): Built {
  const root = new THREE.Group()
  root.add(mesh(rounded(1.4, 0.1, 3.2, 0.04), m.dark, [0, 0.05, 0]))
  for (const z of [-0.9, 0.9]) {
    root.add(mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.72, 16), m.steel, [0, 0.46, z]))
    root.add(mesh(rounded(0.42, 0.06, 0.14, 0.02), m.dark, [0, 0.82, z]))
    root.add(mesh(rounded(0.3, 0.02, 0.15, 0.008), m.rubber, [0, 0.855, z]))
    for (const side of [-1, 1]) {
      const cheek = mesh(rounded(0.05, 0.18, 0.14, 0.015), m.dark, [side * 0.19, 0.9, z])
      cheek.rotation.z = -side * 0.5
      root.add(cheek)
    }
  }
  const plaque = new THREE.Group()
  plaque.position.set(0, 0.3, -1.45)
  plaque.rotation.x = 0.6
  plaque.add(mesh(rounded(0.6, 0.3, 0.04, 0.01), m.black))
  plaque.add(mesh(new THREE.BoxGeometry(0.44, 0.025, 0.01), m.accent, [0, -0.08, -0.024]))
  root.add(plaque)
  root.add(mesh(rounded(0.4, 0.2, 0.2, 0.04), m.dark, [0, 0.18, -1.38]))

  const body = new THREE.Group()
  body.position.set(0, 1.0, 2.1)
  const hull: Plan = [[0.09, 0], [0.13, 0.08], [0.163, 0.3], [0.17, 0.5], [0.17, 3.3], [0.165, 3.55], [0.15, 3.8], [0.126, 3.98], [0.1, 4.08]]
  body.add(mesh(new THREE.LatheGeometry(v2(hull), 48).rotateX(-Math.PI / 2), m.paint))
  body.add(mesh(new THREE.SphereGeometry(0.1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(-Math.PI / 2), m.glass, [0, 0, -4.08]))
  body.add(mesh(new THREE.TorusGeometry(0.1, 0.008, 8, 40), m.steel, [0, 0, -4.08]))
  body.add(mesh(along(new THREE.CylinderGeometry(0.075, 0.09, 0.12, 24)), m.black, [0, 0, 0.04]))
  body.add(mesh(new THREE.TorusGeometry(0.171, 0.007, 8, 64), m.accent, [0, 0, -3.25]))
  for (const z of [-1.3, -2.7]) body.add(mesh(new THREE.TorusGeometry(0.1705, 0.004, 6, 64), m.dark, [0, 0, z]))
  const plan = new THREE.Shape(v2([[-1.3, -1.95], [-1.3, -1.75], [0, -1.6], [1.3, -1.75], [1.3, -1.95], [0, -2.45]]))
  const wing = new THREE.ExtrudeGeometry(plan, { depth: 0.025, ...bevel(0.006) }).rotateX(Math.PI / 2).translate(0, 0.0125, 0)
  body.add(mesh(wing, m.paint, [0, -0.06, 0]))
  const fin = sideExtrude([[0.02, 0.15], [-0.12, 0.52], [-0.3, 0.52], [-0.55, 0.15]], 0.022, 0.006)
  for (let i = 0; i < 4; i += 1) {
    const item = mesh(fin, m.paint)
    item.rotation.z = Math.PI / 4 + (i * Math.PI) / 2
    body.add(item)
  }
  body.add(mesh(rounded(0.2, 0.12, 0.6, 0.04), m.dark, [0, -0.17, -0.5]))
  root.add(body)
  return { root }
}

export const PRODUCT_MODELS: Record<ProductModelId, (m: Mats) => Built> = {
  apc,
  helicopter,
  airDefence,
  howitzer,
  patrolBoat,
  shell,
  radar,
  missile,
}

/** A point `d` metres round a stadium loop's centreline, straights `2 × half` long, ends of radius `r`. */
function lapPoint(d: number, half: number, r: number): [number, number] {
  const arc = Math.PI * r
  const total = 4 * half + 2 * arc
  let s = ((d % total) + total) % total
  if (s < 2 * half) return [-half + s, r]
  s -= 2 * half
  if (s < arc) return [half + Math.sin(s / r) * r, Math.cos(s / r) * r]
  s -= arc
  if (s < 2 * half) return [half - s, -r]
  s -= 2 * half
  return [-half - Math.sin(s / r) * r, -Math.cos(s / r) * r]
}

/**
 * A defence plant campus, about 220 × 150 m: production halls, an office block, gate and fence, parking,
 * trees and rooftop plant, plus what marks the kind of plant (a hangar, a test track, stacks and
 * igloos, a radome, or a dock on the water).
 */
export function facility(m: Mats, kind: FacilityKind): Built {
  const root = new THREE.Group()
  const ground = matte(0x1f242b, 0.95, 0)
  const road = matte(0x8d939a, 0.9, 0)
  const lot = matte(0x6c727a, 0.92, 0)
  const paint = matte(0xd4d7db, 0.8, 0)
  const wall = matte(0xb9bec4, 0.55, 0.4)
  const roofMetal = matte(0xa3a9b0, 0.5, 0.5)
  const concrete = matte(0xc6c8cb, 0.9, 0)
  const white = matte(0xe4e6e8, 0.6, 0.1)
  const galv = matte(0x8f969d, 0.5, 0.6)
  const naval = kind === 'naval'
  const east = naval ? 70 : 120
  const hvac: Place[] = []
  const ticks: ((t: number) => void)[] = []

  root.add(mesh(new THREE.BoxGeometry(east + 120, 1, 170), ground, [(east - 120) / 2, -0.5, 0]))
  const pave = (material: THREE.Material, x0: number, z0: number, x1: number, z1: number, y = 0.03) => {
    root.add(mesh(new THREE.BoxGeometry(x1 - x0, 0.06, z1 - z0), material, [(x0 + x1) / 2, y, (z0 + z1) / 2]))
  }
  pave(road, -6, -85, 6, 72)
  pave(road, -110, -47, east - 8, -37)
  pave(road, -110, 62, east - 8, 72)
  pave(road, -110, -47, -102, 72)

  const hall = (z: number, depth: number, roof: 'saw' | 'barrel') => {
    const [x0, x1, height] = [-98, -18, 11]
    const length = x1 - x0
    const x = (x0 + x1) / 2
    root.add(mesh(new THREE.BoxGeometry(length, height, depth), wall, [x, height / 2, z]))
    root.add(mesh(new THREE.BoxGeometry(length - 3, 1.6, depth + 0.1), m.glass, [x, height - 2.2, z]))
    for (const dz of [-depth / 4, depth / 4]) root.add(mesh(new THREE.BoxGeometry(0.2, 6, 7), m.dark, [x0 - 0.1, 3, z + dz]))
    if (roof === 'saw') {
      const [pitch, rise] = [8, 3]
      const teeth = Array.from({ length: length / pitch }, (_, i): Place => [x0 + i * pitch, height, z])
      root.add(instanced(sideExtrude([[0, 0], [pitch, 0], [0, rise]], depth, 0.05).rotateY(Math.PI / 2), roofMetal, teeth))
      root.add(instanced(new THREE.BoxGeometry(0.12, rise - 0.5, depth - 1.5), m.glass, teeth.map(([px, py, pz]): Place => [px - 0.08, py + rise / 2, pz])))
    } else {
      const rise = depth * 0.22
      root.add(mesh(sideExtrude(arch(depth, rise), length, 0.05), roofMetal, [x, height, z]))
      root.add(instanced(new THREE.BoxGeometry(5, 0.3, 2.4), m.glass, Array.from({ length: 7 }, (_, i): Place => [x0 + 8 + i * 10.5, height + rise - 0.05, z])))
    }
    root.add(mesh(new THREE.BoxGeometry(8, 6, depth * 0.6), concrete, [x1 + 4, 3, z]))
    hvac.push([x1 + 4, 6.6, z - depth * 0.13], [x1 + 4, 6.6, z + depth * 0.13])
  }
  hall(-22, 26, 'saw')
  hall(10, 26, 'saw')
  hall(42, 22, 'barrel')

  const [ax, az] = [-56, -62]
  root.add(mesh(new THREE.BoxGeometry(48, 16, 14), concrete, [ax, 8, az]))
  root.add(mesh(new THREE.BoxGeometry(45, 13.6, 0.3), m.glass, [ax, 8.2, az - 7.1]))
  root.add(instanced(new THREE.BoxGeometry(0.22, 13.6, 0.5), wall, Array.from({ length: 16 }, (_, i): Place => [ax - 22.5 + i * 3, 8.2, az - 7.2])))
  for (const y of [5.2, 9.6, 13.8]) root.add(mesh(new THREE.BoxGeometry(45, 0.35, 0.5), wall, [ax, y, az - 7.2]))
  root.add(mesh(new THREE.BoxGeometry(48.3, 0.45, 14.3), m.accent, [ax, 15.4, az]))
  root.add(mesh(new THREE.BoxGeometry(10, 0.4, 4), wall, [ax, 4.2, az - 9]))
  hvac.push(...[-15, -5, 5, 15].map((dx): Place => [ax + dx, 16.6, az]))

  for (const x of [-8, 8]) root.add(mesh(new THREE.BoxGeometry(1.2, 3, 1.2), concrete, [x, 1.5, -80]))
  root.add(mesh(new THREE.BoxGeometry(6.6, 0.18, 0.18), white, [-4.2, 1.1, -80.6]))
  root.add(mesh(new THREE.BoxGeometry(0.9, 0.2, 0.2), m.accent, [-3.2, 1.1, -80.6]))
  root.add(mesh(new THREE.BoxGeometry(5, 3, 4), concrete, [12.5, 1.5, -75]))
  root.add(mesh(new THREE.BoxGeometry(5.1, 1.1, 4.1), m.glass, [12.5, 2, -75]))
  root.add(mesh(new THREE.BoxGeometry(6.4, 0.3, 5.4), m.dark, [12.5, 3.15, -75]))

  pave(lot, 12, -72, 66, -50)
  const cars: Place[] = []
  const lines: Place[] = []
  for (let i = 0; i < 17; i += 1)
    for (const [row, z] of [-66, -56].entries()) {
      const x = 15 + i * 3
      lines.push([x - 1.5, 0.07, z])
      if (hash(i * 2 + row) > 0.22) cars.push([x, 0.62, z + (hash(i + row * 31) - 0.5) * 0.6])
    }
  root.add(instanced(new THREE.BoxGeometry(0.15, 0.02, 5), paint, lines))
  const carPaint = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.4, roughness: 0.45 })
  root.add(instanced(rounded(1.85, 0.8, 4.4, 0.25), carPaint, cars, [0xd9dcdf, 0xa2a8ae, 0x2d3239, 0x46525f, 0x15181c, 0xb5ab95]))
  root.add(instanced(rounded(1.6, 0.6, 2.3, 0.2), m.glass, cars.map(([x, y, z]): Place => [x, y + 0.55, z + 0.15])))

  const conifers: Place[] = []
  const broadleaf: Place[] = []
  const spots: [number, number][] = [
    ...Array.from({ length: 14 }, (_, i): [number, number] => [-112.5, -72 + i * 10]),
    ...[-105, -98, -91, -84, -26, -18].map((x): [number, number] => [x, -75]),
    ...[22, 34, 46, 58].map((x): [number, number] => [x, -77]),
  ]
  spots.forEach(([x, z], i) => {
    const s = 0.75 + hash(i) * 0.5
    const list = i % 2 ? broadleaf : conifers
    list.push([x, 0, z, 0, [s, s, s]])
  })
  const leaf = matte(0x2f4a3a, 0.95, 0)
  root.add(instanced(new THREE.ConeGeometry(2.6, 7, 10).translate(0, 4.5, 0), leaf, conifers))
  root.add(instanced(new THREE.SphereGeometry(2.6, 14, 10).translate(0, 4.0, 0), leaf, broadleaf))
  root.add(instanced(new THREE.CylinderGeometry(0.25, 0.3, 1.6, 8).translate(0, 0.8, 0), matte(0x3b3128, 0.95, 0), [...conifers, ...broadleaf]))

  const fx = naval ? 68 : 115
  const fences: [number, number, number, number][] = [
    [-115, -80, -8.6, -80],
    [8.6, -80, fx, -80],
    [-115, 80, fx, 80],
    [-115, -80, -115, 80],
  ]
  if (!naval) fences.push([115, -80, 115, 80])
  const posts: Place[] = []
  const rails: Place[] = []
  for (const [x0, z0, x1, z1] of fences) {
    const length = Math.hypot(x1 - x0, z1 - z0)
    const n = Math.ceil(length / 4)
    for (let i = 0; i <= n; i += 1) posts.push([x0 + ((x1 - x0) * i) / n, 1.2, z0 + ((z1 - z0) * i) / n])
    for (const y of [0.25, 1.25, 2.3]) rails.push([(x0 + x1) / 2, y, (z0 + z1) / 2, Math.atan2(-(z1 - z0), x1 - x0), [length, 1, 1]])
  }
  root.add(instanced(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6), galv, posts))
  root.add(instanced(new THREE.BoxGeometry(1, 0.04, 0.04), galv, rails))

  if (kind === 'air') {
    const [hx, hz] = [62, 30]
    root.add(mesh(sideExtrude(arch(46, 16), 44, 0.1).rotateY(Math.PI / 2), roofMetal, [hx, 0, hz]))
    root.add(instanced(sideExtrude(arch(46.6, 16.3), 0.4, 0.05).rotateY(Math.PI / 2), wall, [-16, -8, 0, 8, 16].map((dz): Place => [hx, 0, hz + dz])))
    const opening = new THREE.ShapeGeometry(new THREE.Shape(v2(arch(38, 13)))).rotateY(Math.PI)
    root.add(mesh(opening, matte(0x14181d, 0.9, 0), [hx, 0.02, hz - 22.15]))
    pave(concrete, 30, -34, 95, 7.8, 0.035)
    root.add(mesh(new THREE.BoxGeometry(0.3, 0.02, 38), paint, [hx, 0.075, -14]))
    const uav = new THREE.Group()
    uav.position.set(hx, 0, -18)
    uav.add(mesh(along(new THREE.CapsuleGeometry(0.55, 7, 4, 12)), m.paint, [0, 1.6, 0]))
    uav.add(mesh(rounded(17, 0.18, 1.3, 0.06), m.paint, [0, 1.85, -0.4]))
    for (const side of [-1, 1]) {
      const tail = mesh(rounded(2.4, 0.1, 0.9, 0.04), m.paint, [side * 0.8, 2.3, 3.6])
      tail.rotation.z = side * 0.6
      uav.add(tail)
      uav.add(rod([side * 0.7, 0, -0.2], [side * 0.3, 1.4, -0.2], 0.06, m.dark))
    }
    uav.add(rod([0, 0, -3.0], [0, 1.3, -3.0], 0.06, m.dark))
    root.add(uav)
    root.add(rod([100, 0, -22], [100, 12, -22], 0.35, galv))
    const beacon = new THREE.Group()
    beacon.position.set(100, 12, -22)
    beacon.add(mesh(rounded(5, 0.6, 0.5, 0.1), m.dark, [0, 0.5, 0]))
    root.add(beacon)
    ticks.push((t) => (beacon.rotation.y = t * 1.2))
  }

  if (kind === 'land') {
    const [tx, tz] = [62, 22]
    const stadium = (half: number, r: number) => {
      const outline = new THREE.Shape()
      outline.absarc(half, 0, r, -Math.PI / 2, Math.PI / 2, false)
      outline.absarc(-half, 0, r, Math.PI / 2, (Math.PI * 3) / 2, false)
      outline.closePath()
      return outline
    }
    const ring = stadium(22, 22)
    ring.holes.push(stadium(22, 14))
    const asphalt = matte(0x3a3f46, 0.9, 0)
    root.add(mesh(new THREE.ShapeGeometry(ring, 24).rotateX(-Math.PI / 2), asphalt, [tx, 0.05, tz]))
    root.add(mesh(new THREE.SphereGeometry(10, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.6, 0.3, 0.9), matte(0x4b5a3d, 0.95, 0), [tx, 0, tz]))
    root.add(mesh(sideExtrude([[-7, 0], [0, 2.5], [7, 0]], 7, 0.05).rotateY(Math.PI / 2), concrete, [tx, 0.05, tz + 18]))
    const parts: [THREE.BufferGeometry, THREE.Material, Vec3][] = [
      [rounded(2.8, 0.8, 6.4, 0.2), m.black, [0, 0.4, 0]],
      [rounded(3, 1.3, 7, 0.2), m.tan, [0, 1.3, 0]],
      [rounded(1.8, 0.7, 2.4, 0.2), m.tan, [0, 2.3, 0.6]],
      [along(new THREE.CylinderGeometry(0.08, 0.08, 3, 8)), m.iron, [0, 2.3, -2.0]],
    ]
    const parked = Array.from({ length: 8 }, (_, i): Place => [22 + i * 10, 0, -27])
    for (const [geometry, material, [ox, oy, oz]] of parts) root.add(instanced(geometry, material, parked.map(([x, y, z]): Place => [x + ox, y + oy, z + oz])))
    const runner = new THREE.Group()
    for (const [geometry, material, at] of parts) runner.add(mesh(geometry, material, at))
    runner.rotation.order = 'YXZ'
    root.add(runner)
    const rampAt = (x: number, z: number) => (z > 17 && Math.abs(x) < 7 ? 2.5 * (1 - Math.abs(x) / 7) : 0)
    const drive = (t: number) => {
      const [x, z] = lapPoint(t * 9, 22, 18)
      const [nx, nz] = lapPoint(t * 9 + 0.5, 22, 18)
      runner.position.set(tx + x, 0.05 + rampAt(x, z), tz + z)
      runner.rotation.y = Math.atan2(-(nx - x), -(nz - z))
      runner.rotation.x = Math.atan2(rampAt(nx, nz) - rampAt(x, z), Math.hypot(nx - x, nz - z))
    }
    drive(0)
    ticks.push(drive)
  }

  if (kind === 'armament') {
    root.add(mesh(new THREE.BoxGeometry(22, 10, 16), concrete, [95, 5, 20]))
    hvac.push([89, 10.6, 20], [101, 10.6, 20])
    for (const x of [89, 101]) {
      root.add(mesh(new THREE.CylinderGeometry(1.5, 2.1, 48, 24), concrete, [x, 24, 34]))
      for (const y of [42, 46.8]) root.add(mesh(new THREE.CylinderGeometry(1.58, 1.62, 1.1, 24), m.dark, [x, y, 34]))
    }
    const igloos = [28, 46, 64].flatMap((x) => [5, 38].map((z): Place => [x, 0, z]))
    root.add(instanced(sideExtrude(arch(11, 5.5), 14, 0.1).rotateY(Math.PI / 2), matte(0x4b5a3d, 0.95, 0), igloos))
    root.add(instanced(new THREE.BoxGeometry(13, 6, 0.8), concrete, igloos.map(([x, , z]): Place => [x, 3, z - 7.2])))
    root.add(instanced(new THREE.BoxGeometry(4, 3.6, 0.3), m.dark, igloos.map(([x, , z]): Place => [x, 1.8, z - 7.7])))
    root.add(instanced(new THREE.BoxGeometry(8, 0.06, 6), concrete, igloos.map(([x, , z]): Place => [x, 0.035, z - 11])))
  }

  if (kind === 'electronics') {
    root.add(mesh(new THREE.BoxGeometry(18, 3, 18), concrete, [35, 1.5, 32]))
    root.add(mesh(new THREE.CylinderGeometry(6.5, 6.8, 5, 32), white, [35, 5.5, 32]))
    root.add(mesh(new THREE.SphereGeometry(8, 32, 24), white, [35, 13, 32]))
    const [cx, cz] = [75, -20]
    root.add(mesh(new THREE.BoxGeometry(40, 12, 22), white, [cx, 6, cz]))
    const front: Place[] = []
    const ends: Place[] = []
    for (const y of [3, 6.2, 9.4]) {
      for (let i = 0; i < 18; i += 1) front.push([cx + (i - 8.5) * 2.2, y, cz])
      for (let i = 0; i < 8; i += 1) ends.push([cx, y, cz + (i - 3.5) * 2.4])
    }
    root.add(instanced(new THREE.BoxGeometry(1.6, 1.3, 22.2), m.glass, front))
    root.add(instanced(new THREE.BoxGeometry(40.2, 1.3, 1.6), m.glass, ends))
    hvac.push(...[-15, -5, 5, 15].flatMap((dx) => [-5, 5].map((dz): Place => [cx + dx, 12.6, cz + dz])))
    root.add(mesh(new THREE.CylinderGeometry(0.5, 1.8, 36, 4).rotateY(Math.PI / 4), galv, [95, 18, 40]))
    root.add(mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.3, 12), galv, [95, 30, 40]))
    for (let i = 0; i < 3; i += 1) {
      const angle = (i / 3) * Math.PI * 2
      const panel = mesh(new THREE.BoxGeometry(0.7, 2.4, 0.3), white, [95 + Math.sin(angle) * 1.2, 27.5, 40 + Math.cos(angle) * 1.2])
      panel.rotation.y = angle
      root.add(panel)
    }
    const array = new THREE.Group()
    array.position.set(95, 36, 40)
    array.add(mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.8, 12), m.dark, [0, 0.4, 0]))
    array.add(mesh(rounded(6, 0.7, 0.5, 0.12), m.dark, [0, 1.1, 0]))
    root.add(array)
    ticks.push((t) => (array.rotation.y = t * 0.8))
  }

  if (naval) {
    root.add(mesh(new THREE.BoxGeometry(60, 0.6, 170), matte(0x1b3346, 0.35, 0.1), [100, -1.0, 0]))
    root.add(mesh(new THREE.BoxGeometry(1.2, 1.45, 170), concrete, [70.6, -0.575, 0]))
    root.add(instanced(new THREE.CylinderGeometry(0.3, 0.35, 0.7, 12), m.dark, Array.from({ length: 15 }, (_, i): Place => [69.4, 0.35, -70 + i * 10])))
    const [dx, dz] = [40, 22]
    for (const side of [-1, 1]) root.add(mesh(new THREE.BoxGeometry(62, 2.4, 2), concrete, [dx, 1.2, dz + side * 10]))
    root.add(mesh(new THREE.BoxGeometry(62, 0.1, 18), matte(0x4a5057, 0.9, 0), [dx, 0.06, dz]))
    root.add(mesh(new THREE.BoxGeometry(1.2, 2.4, 18), m.dark, [70.4, 1.2, dz]))
    root.add(instanced(new THREE.BoxGeometry(1, 1.1, 1.4), m.dark, Array.from({ length: 10 }, (_, i): Place => [22 + i * 4, 0.65, dz])))
    const hull = new THREE.Group()
    hull.position.set(dx, 1.2, dz)
    hull.rotation.y = -Math.PI / 2
    const haze = hazeGrey()
    hull.add(mesh(loft(scaled(KEEL, 1.15), scaled(DECK, 1.15), 0, 3.8), haze))
    hull.add(mesh(new THREE.BoxGeometry(5.2, 2.8, 10), haze, [0, 5.2, 2]))
    root.add(hull)
    for (const side of [-1, 1]) {
      const z = dz + side * 12.5
      root.add(mesh(new THREE.BoxGeometry(62, 0.2, 0.4), m.dark, [dx, 0.1, z]))
      root.add(mesh(new THREE.BoxGeometry(8, 1, 1.2), white, [dx, 0.7, z]))
      for (const ox of [-3, 3]) root.add(rod([dx + ox, 1, z], [dx + ox * 0.3, 24, z], 0.5, white))
    }
    root.add(mesh(new THREE.BoxGeometry(3, 2.4, 29), white, [dx, 25, dz]))
    const trolley = new THREE.Group()
    trolley.position.set(dx, 27, dz)
    trolley.add(mesh(rounded(3.6, 1.6, 3.2, 0.15), m.dark))
    trolley.add(rod([0, -0.8, 0], [0, -17, 0], 0.06, m.black))
    trolley.add(mesh(rounded(1.2, 1.0, 0.8, 0.1), m.dark, [0, -17.4, 0]))
    root.add(trolley)
    ticks.push((t) => (trolley.position.z = dz + Math.sin(t * 0.3) * 10))
    const slip = mesh(new THREE.BoxGeometry(40, 0.8, 14), concrete, [60, -0.4, -18])
    slip.rotation.z = -Math.atan2(2, 40)
    root.add(slip)
    for (const side of [-1, 1]) {
      const rail = mesh(new THREE.BoxGeometry(40, 0.15, 0.3), m.dark, [60, 0.06, -18 + side * 3])
      rail.rotation.z = slip.rotation.z
      root.add(rail)
    }
  }

  root.add(instanced(rounded(2.6, 1.2, 1.8, 0.1), matte(0x9ea4ab, 0.6, 0.4), hvac))
  return { root, tick: ticks.length ? (t) => ticks.forEach((step) => step(t)) : undefined }
}
