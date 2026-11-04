import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { Box3, DirectionalLight, Light, Mesh, PointLight, Vector3, type Object3D } from 'three'
import { casterSignature, fitSunShadow } from './shadows'

/** Cache shadows across camera-only frames; geometry and lights are checked after the editing/cutaway hooks. */
export const ShadowUpdates = () => {
  const previous = useRef('')
  const lightStates = useRef(new Map<Light, string>())
  // Explicit order matters when a floor or cutaway remounts: its new frame hooks must finish before this.
  // RoomBlur (1) or ItemOutline (2) already owns the final render.
  useFrame(({ scene, gl }) => {
    scene.updateMatrixWorld(true)
    const signature = casterSignature(scene)
    const changed = previous.current !== signature
    previous.current = signature
    const lights: (DirectionalLight | PointLight)[] = []
    scene.traverseVisible((o: Object3D) => {
      if ((o instanceof DirectionalLight || o instanceof PointLight) && o.castShadow && o.intensity > 0) lights.push(o)
    })
    const current = new Set<Light>(lights)
    for (const l of lightStates.current.keys()) if (!current.has(l)) lightStates.current.delete(l)
    let bounds: Box3 | undefined
    for (const light of lights) {
      const aim = light instanceof DirectionalLight ? light.target.getWorldPosition(new Vector3()).toArray() : []
      // Position is enough for a point source; directional shadow cameras also depend on their target.
      // PointShadowAtlas owns point-light resolution changes and already requests their redraws.
      const size = light instanceof DirectionalLight ? [light.shadow.mapSize.x, light.shadow.mapSize.y] : []
      const state = [...light.position.toArray(), ...aim, ...size].join(',')
      if (!changed && lightStates.current.get(light) === state) continue
      if (light instanceof DirectionalLight) {
        // Bounds do not depend on the camera. Only visit receiver geometry when a sun shadow needs refitting.
        if (!bounds) {
          bounds = new Box3()
          scene.traverseVisible((o) => {
            // The distant decorative ground mustn't consume the whole shadow map.
            if (o instanceof Mesh && (o.castShadow || o.receiveShadow) && !o.userData.shadowGround)
              bounds!.expandByObject(o)
          })
        }
        fitSunShadow(light, bounds)
      }
      lightStates.current.set(light, [...light.position.toArray(), ...aim, ...size].join(','))
      light.shadow.needsUpdate = true
      gl.shadowMap.needsUpdate = true
    }
  }, 0.25)
  return null
}
