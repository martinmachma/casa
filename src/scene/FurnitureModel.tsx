import { useGLTF } from '@react-three/drei'
import { useLayoutEffect, useMemo } from 'react'
import { Box3, Mesh, MeshStandardMaterial, Vector3, type Material } from 'three'
import { modelUrl } from '../furniture/catalog'

// Kenney's upholstery materials; the item's colour goes on these, so a sofa can be any fabric.
const FABRIC = new Set(['carpet', 'carpetBlue'])

type FurnitureModelProps = {
  model: string
  width: number
  depth: number
  height: number
  fabric: string
}

/**
 * A furniture model stretched to exactly width × depth × height, standing on the floor and centred on the item.
 * Models face +z (plan south) at rotation 0, so they back onto a north wall.
 */
export const FurnitureModel = ({ model, width, depth, height, fabric }: FurnitureModelProps) => {
  const { scene } = useGLTF(modelUrl(model))

  const { object, size, offset } = useMemo(() => {
    const object = scene.clone(true)
    object.traverse((o) => {
      if (!(o instanceof Mesh)) return
      o.castShadow = true
      o.receiveShadow = true
      const tint = (m: Material) => {
        if (!FABRIC.has(m.name) || !(m instanceof MeshStandardMaterial)) return m
        const copy = m.clone()
        copy.userData.fabric = true
        return copy
      }
      o.material = Array.isArray(o.material) ? o.material.map(tint) : tint(o.material)
    })
    const box = new Box3().setFromObject(object)
    const size = box.getSize(new Vector3())
    const center = box.getCenter(new Vector3())
    return { object, size, offset: new Vector3(-center.x, -box.min.y, -center.z) }
  }, [scene])

  useLayoutEffect(() => {
    object.traverse((o) => {
      if (!(o instanceof Mesh)) return
      for (const m of [o.material].flat()) if (m.userData.fabric) (m as MeshStandardMaterial).color.set(fabric)
    })
  }, [object, fabric])

  return (
    <group scale={[width / (size.x || 1), Math.max(height, 0.005) / (size.y || 1), depth / (size.z || 1)]}>
      <primitive object={object} position={offset} />
    </group>
  )
}
