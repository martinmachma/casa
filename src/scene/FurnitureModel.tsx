import { useGLTF } from '@react-three/drei'
import { useLayoutEffect, useMemo } from 'react'
import { Box3, Mesh, MeshStandardMaterial, Vector3, type Material } from 'three'
import { modelUrl } from '../furniture/catalog'
import { isLamp } from './HouseLights'
import { lightColor } from '../devices/lights'

const WARM = lightColor(undefined)

// Kenney's upholstery materials; the item's colour goes on these, so a sofa can be any fabric.
const FABRIC = new Set(['carpet', 'carpetBlue'])
// A lamp's shade, which glows when it's lit.
const SHADE = 'lamp'
const SHADE_GLOW = 1.5

type FurnitureModelProps = {
  model: string
  width: number
  depth: number
  height: number
  fabric: string
  /** How brightly a lamp is lit, 0 (off) to 1. */
  glow?: number
  /** The colour a lamp gives off. */
  glowColor?: string
}

/**
 * A furniture model stretched to exactly width × depth × height, standing on the floor and centred on the item.
 * Models face +z (plan south) at rotation 0, so they back onto a north wall.
 */
export const FurnitureModel = ({
  model,
  width,
  depth,
  height,
  fabric,
  glow = 0,
  glowColor = WARM,
}: FurnitureModelProps) => {
  const { scene } = useGLTF(modelUrl(model))

  const { object, size, offset } = useMemo(() => {
    const object = scene.clone(true)
    object.traverse((o) => {
      if (!(o instanceof Mesh)) return
      // A lamp's bulb sits inside its shade, which would otherwise swallow its light.
      o.castShadow = !isLamp(model)
      o.receiveShadow = true
      const tint = (m: Material) => {
        const fabric = FABRIC.has(m.name)
        const shade = m.name === SHADE && isLamp(model)
        // Every piece has its own materials, so one can fade without the others.
        const copy = m.clone()
        if (!(fabric || shade) || !(m instanceof MeshStandardMaterial)) return copy
        copy.userData.fabric = fabric
        copy.userData.shade = shade
        return copy
      }
      o.material = Array.isArray(o.material) ? o.material.map(tint) : tint(o.material)
    })
    const box = new Box3().setFromObject(object)
    const size = box.getSize(new Vector3())
    const center = box.getCenter(new Vector3())
    return { object, size, offset: new Vector3(-center.x, -box.min.y, -center.z) }
  }, [scene, model])

  useLayoutEffect(() => {
    object.traverse((o) => {
      if (!(o instanceof Mesh)) return
      for (const m of [o.material].flat()) {
        if (m.userData.fabric) (m as MeshStandardMaterial).color.set(fabric)
        if (m.userData.shade) {
          ;(m as MeshStandardMaterial).emissive.set(glowColor)
          ;(m as MeshStandardMaterial).emissiveIntensity = glow * SHADE_GLOW
        }
      }
    })
  }, [object, fabric, glow, glowColor])

  return (
    <group scale={[width / (size.x || 1), Math.max(height, 0.005) / (size.y || 1), depth / (size.z || 1)]}>
      <primitive object={object} position={offset} />
    </group>
  )
}
