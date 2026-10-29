import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { Box3, DirectionalLight, Light, Mesh, PointLight, Vector3, type Object3D } from 'three'
import { casterSignature, fitSunShadow } from './shadows'

/** Cache shadows across camera-only frames; geometry and lights are checked after the editing/cutaway hooks. */
export const ShadowUpdates = () => {
  const previous = useRef('')
  const lightStates = useRef(new Map<Light, string>())
  useFrame(({ scene, gl }) => {
    scene.updateMatrixWorld(true)
    const signature = casterSignature(scene)
    const changed = previous.current !== signature
    previous.current = signature
    const bounds = new Box3()
    const lights: (DirectionalLight | PointLight)[] = []
    scene.traverseVisible((o: Object3D) => {
      if ((o instanceof DirectionalLight || o instanceof PointLight) && o.castShadow && o.intensity > 0) lights.push(o)
      // The distant decorative ground is a receiver, but mustn't consume the whole shadow map.
      if (o instanceof Mesh && (o.castShadow || o.receiveShadow) && !o.userData.shadowGround) bounds.expandByObject(o)
    })
    const current = new Set<Light>(lights)
    for (const l of lightStates.current.keys()) if (!current.has(l)) lightStates.current.delete(l)
    for (const light of lights) {
      const aim = light instanceof DirectionalLight ? light.target.getWorldPosition(new Vector3()).toArray() : []
      // Position is enough for a point source; directional shadow cameras also depend on their target.
      const state = [...light.position.toArray(), ...aim, light.shadow.mapSize.x, light.shadow.mapSize.y].join(',')
      if (!changed && lightStates.current.get(light) === state) continue
      if (light instanceof DirectionalLight) fitSunShadow(light, bounds)
      lightStates.current.set(
        light,
        [...light.position.toArray(), ...aim, light.shadow.mapSize.x, light.shadow.mapSize.y].join(','),
      )
      light.shadow.needsUpdate = true
      gl.shadowMap.needsUpdate = true
    }
  })
  return null
}
