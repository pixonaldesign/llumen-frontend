/**
 * Procedural 3D models of the alert's critical parts (and the UAV that carries them), turning slowly
 * in place. Built from three.js primitives so the demo needs no model files.
 */
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { PartId } from './gamiTypes'

export type GamiModelId = PartId | 'drone'

type Props = {
  model: GamiModelId
  /** The glow and trim colour. */
  accent: string
  className?: string
  /** Radians per second. */
  spin?: number
  /** Drag to turn the model. */
  interactive?: boolean
  /** On the drone: the part to light up. */
  highlight?: PartId
  /** Camera distance, as a multiple of the model's fitted size. */
  distance?: number
}

type Built = { root: THREE.Group; tick?: (t: number) => void }

function materials(accent: string) {
  const glow = new THREE.Color(accent)
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
      emissive: new THREE.Color(0x1d3d6b),
      emissiveIntensity: 0.5,
    }),
    accent: new THREE.MeshStandardMaterial({
      color: glow,
      emissive: glow,
      emissiveIntensity: 0.9,
      metalness: 0.3,
      roughness: 0.4,
    }),
    laser: new THREE.MeshStandardMaterial({ color: 0xff3b30, emissive: 0xff3b30, emissiveIntensity: 1.6 }),
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
  return { root, tick: (t) => ((led.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.6 + 0.6 * Math.abs(Math.sin(t * 2))) }
}

/** A MALE fixed-wing UAV with a pusher prop, a chin turret and a V-tail; `highlight` lights the part it carries. */
function drone(m: Mats, highlight?: PartId): Built {
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

  const hot = (part: PartId) => (highlight === part ? m.accent : m.dark)
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
      if (highlight) m.accent.emissiveIntensity = 0.6 + 0.8 * Math.abs(Math.sin(t * 2.4))
    },
  }
}

function build(model: GamiModelId, m: Mats, highlight?: PartId): Built {
  if (model === 'motor') return motor(m)
  if (model === 'gimbal') return gimbal(m)
  if (model === 'inu') return inu(m)
  return drone(m, highlight)
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
    const rim = new THREE.DirectionalLight(new THREE.Color(accent), 2.4)
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
    pivot.rotation.x = model === 'drone' ? 0.42 : 0.28
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

    let turn = model === 'drone' ? -0.7 : 0.5
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
