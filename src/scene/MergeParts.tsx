import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import {
  BufferAttribute,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  type BufferGeometry,
  type Group,
  type Object3D,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { applyFade, unfaded } from './Fade'

const MAPS = [
  'map',
  'normalMap',
  'roughnessMap',
  'metalnessMap',
  'emissiveMap',
  'aoMap',
  'alphaMap',
  'envMap',
  'lightMap',
  'bumpMap',
  'displacementMap',
] as const

const ids = new WeakMap<object, number>()
let nextId = 0
const fnId = (f: object) => {
  let id = ids.get(f)
  if (id === undefined) ids.set(f, (id = nextId++))
  return id
}

/**
 * How a part is drawn: parts drawn alike go into one mesh. Its colour is left out where it can go in the vertices
 * instead. Undefined for a part left as it is.
 */
const drawKey = (o: Object3D) => {
  const m = o as Mesh
  if (!m.isMesh || m.type !== 'Mesh' || m.children.length || Object.keys(m.userData).length) return undefined
  const mat = m.material
  if (!(mat instanceof MeshStandardMaterial) || mat.type !== 'MeshStandardMaterial' || !mat.visible) return undefined
  if (MAPS.some((k) => mat[k]) || m.customDepthMaterial || m.customDistanceMaterial) return undefined
  // A part that takes the pointer itself keeps its own mesh.
  if ((m as { __r3f?: { eventCount?: number } }).__r3f?.eventCount) return undefined
  const g = m.geometry
  if (Object.keys(g.morphAttributes).length || g.drawRange.count !== Infinity) return undefined
  const own = unfaded(mat)
  const baked = !mat.vertexColors && !g.attributes.color
  return [
    baked ? 'baked' : mat.color.getHexString(),
    Object.entries(g.attributes)
      .map(([k, a]) => `${k}${a.itemSize}${a.normalized}`)
      .sort()
      .join(),
    g.index ? 'i' : '',
    mat.emissive.getHexString(),
    mat.emissiveIntensity,
    mat.roughness,
    mat.metalness,
    own.opacity,
    own.transparent,
    own.depthWrite,
    mat.side,
    mat.shadowSide,
    mat.vertexColors,
    mat.flatShading,
    mat.depthTest,
    mat.colorWrite,
    mat.polygonOffset && `${mat.polygonOffsetFactor},${mat.polygonOffsetUnits}`,
    mat.name,
    JSON.stringify(mat.userData),
    m.castShadow,
    m.receiveShadow,
    m.renderOrder,
    m.frustumCulled,
    fnId(m.raycast),
  ].join('|')
}

type Merged = { signature: string; meshes: Mesh[]; hidden: Set<Mesh> }

/**
 * Draws its static parts (plain meshes that differ at most in colour) as one mesh per look, in place of each part on
 * its own: a fitting built from dozens of boxes and discs takes a handful of draws. Parts with children (a selection
 * outline), their own pointer handlers or textures stay as they are. Merged again whenever a render changes a part.
 */
export const MergeParts = ({ children }: { children: ReactNode }) => {
  const group = useRef<Group>(null)
  const merged = useRef<Merged>({ signature: '', meshes: [], hidden: new Set() })
  const inverse = useRef(new Matrix4())

  useLayoutEffect(() => {
    const root = group.current
    if (!root) return
    const state = merged.current
    root.updateWorldMatrix(false, true)
    inverse.current.copy(root.matrixWorld).invert()
    const parts: { mesh: Mesh; key: string; matrix: Matrix4 }[] = []
    const ours = new Set(state.meshes)
    root.traverse((o) => {
      if (o === root || ours.has(o as Mesh)) return
      if (!o.visible && !state.hidden.has(o as Mesh)) return
      const key = drawKey(o)
      if (key === undefined) return
      parts.push({ mesh: o as Mesh, key, matrix: new Matrix4().multiplyMatrices(inverse.current, o.matrixWorld) })
    })
    const signature = parts
      .map(
        ({ mesh, key, matrix }) =>
          `${mesh.id}:${mesh.geometry.uuid}:${key}:${(mesh.material as MeshStandardMaterial).color.getHexString()}:${matrix.elements.join(',')}`,
      )
      .join(';')
    if (signature === state.signature) return
    state.signature = signature

    for (const m of state.hidden) m.visible = true
    state.hidden.clear()
    for (const m of state.meshes) {
      root.remove(m)
      m.geometry.dispose()
      ;(m.material as MeshStandardMaterial).dispose()
    }
    state.meshes = []

    const byKey = new Map<string, typeof parts>()
    for (const p of parts) byKey.set(p.key, [...(byKey.get(p.key) ?? []), p])
    for (const list of byKey.values()) {
      // A look used once is drawn once either way. A mirrored part without an index can't be wound back.
      if (list.length < 2 || list.some(({ mesh, matrix }) => matrix.determinant() < 0 && !mesh.geometry.index)) continue
      const baked = list[0].key.startsWith('baked')
      const placed = list.map(({ mesh, matrix }) => {
        const g = mesh.geometry.clone().applyMatrix4(matrix)
        g.clearGroups()
        if (baked) {
          const { r, g: green, b } = (mesh.material as MeshStandardMaterial).color
          const count = g.attributes.position.count
          const rgb = new Float32Array(count * 3)
          for (let i = 0; i < count; i++) rgb.set([r, green, b], i * 3)
          g.setAttribute('color', new BufferAttribute(rgb, 3))
        }
        // A mirroring transform turns faces inside out: wind them back.
        if (matrix.determinant() < 0 && g.index) {
          const index = g.index.array
          for (let i = 0; i < index.length; i += 3) [index[i + 1], index[i + 2]] = [index[i + 2], index[i + 1]]
        }
        return g
      })
      const geometry = mergeGeometries(placed as BufferGeometry[], false)
      placed.forEach((g) => g.dispose())
      if (!geometry) continue
      const first = list[0].mesh
      const source = first.material as MeshStandardMaterial
      const material = source.clone()
      Object.assign(material, unfaded(source))
      if (baked) {
        material.color.setRGB(1, 1, 1)
        material.vertexColors = true
      }
      const mesh = new Mesh(geometry, material)
      // The section of a cut piece is still worked out from the parts themselves (useItemCut).
      mesh.userData.mergedParts = true
      mesh.castShadow = first.castShadow
      mesh.receiveShadow = first.receiveShadow
      mesh.renderOrder = first.renderOrder
      mesh.frustumCulled = first.frustumCulled
      mesh.raycast = first.raycast
      root.add(mesh)
      state.meshes.push(mesh)
      for (const { mesh: part } of list) {
        part.visible = false
        state.hidden.add(part)
      }
    }
    applyFade(root)
  })

  useEffect(
    () => () => {
      for (const m of merged.current.meshes) {
        m.geometry.dispose()
        ;(m.material as MeshStandardMaterial).dispose()
      }
    },
    [],
  )

  return <group ref={group}>{children}</group>
}
