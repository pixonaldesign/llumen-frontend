/**
 * The shared pieces of the GAMI 3D models: their materials and the primitives they are built from.
 * Every model is three.js geometry, so the demo needs no model files.
 */
import * as THREE from 'three'
import { STATUS } from './gamiTypes'

/** A model's root, and what moves on it each frame (`t` in seconds). */
export type Built = { root: THREE.Group; tick?: (t: number) => void }

export function materials(accent: string) {
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
    /** The part a vehicle view points out: the one cut off from Poland. */
    missing: new THREE.MeshStandardMaterial({
      color: STATUS.critical,
      emissive: new THREE.Color(STATUS.critical).multiplyScalar(0.45),
      metalness: 0.15,
      roughness: 0.42,
    }),
    /** CARC desert tan armour, faceted so plate edges read. */
    armor: new THREE.MeshStandardMaterial({ color: 0x84734f, metalness: 0.1, roughness: 0.86, flatShading: true, side: THREE.DoubleSide }),
    tan: new THREE.MeshStandardMaterial({ color: 0x84734f, metalness: 0.1, roughness: 0.8 }),
    grime: new THREE.MeshStandardMaterial({ color: 0x5f553f, metalness: 0.2, roughness: 0.9 }),
    iron: new THREE.MeshStandardMaterial({ color: 0x37352f, metalness: 0.75, roughness: 0.55 }),
    cloth: new THREE.MeshStandardMaterial({ color: 0x7a6b4c, metalness: 0, roughness: 1 }),
    olive: new THREE.MeshStandardMaterial({ color: 0x55523a, metalness: 0, roughness: 0.95 }),
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

export type Mats = ReturnType<typeof materials>

export function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, at: [number, number, number] = [0, 0, 0]) {
  const item = new THREE.Mesh(geometry, material)
  item.position.set(...at)
  return item
}

export const bevel = (size: number) => ({ bevelEnabled: true, bevelSize: size, bevelThickness: size, bevelSegments: 2 })

/** A side profile, given as (z, y) points, extruded `width` across x and centred on it. */
export function sideExtrude(points: [number, number][], width: number, edge = 0.01) {
  const shape = new THREE.Shape(points.map(([z, y]) => new THREE.Vector2(-z, y)))
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: width - edge * 2, ...bevel(edge) })
  geometry.rotateY(Math.PI / 2)
  geometry.translate(-width / 2 + edge, 0, 0)
  return geometry
}

/** A solid between two plan outlines, (x, z) points in the same order: `bottom` at y0, `top` at y1. */
export function loft(bottom: [number, number][], top: [number, number][], y0: number, y1: number) {
  const low = bottom.map(([x, z]) => new THREE.Vector3(x, y0, z))
  const high = top.map(([x, z]) => new THREE.Vector3(x, y1, z))
  const points: THREE.Vector3[] = []
  low.forEach((a, i) => {
    const j = (i + 1) % low.length
    points.push(a, low[j], high[j], a, high[j], high[i])
  })
  for (const [ring, outline] of [
    [low, bottom],
    [high, top],
  ] as const) {
    const flat = outline.map(([x, z]) => new THREE.Vector2(x, z))
    for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(flat, [])) points.push(ring[a], ring[b], ring[c])
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points)
  geometry.computeVertexNormals()
  return geometry
}
