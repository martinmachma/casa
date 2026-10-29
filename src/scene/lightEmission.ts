import { PointLight, ShaderChunk, type Camera, type Object3D } from 'three'

/** Match WebGLLights' point-light order, including shadow-prioritisation and camera layers. */
export const ceilingLightMask = (scene: Object3D, camera: Camera) => {
  const lights: PointLight[] = []
  scene.traverseVisible((o) => {
    if (o instanceof PointLight && o.layers.test(camera.layers)) lights.push(o)
  })
  lights.sort((a, b) => Number(b.castShadow) - Number(a.castShadow))
  return lights.map((l) => (l.userData.downlight ? 1 : 0))
}

// The visible ceiling fixtures are downward-facing diffusers. Keep their cube shadows, with a cosine
// emission lobe below the fitting. Bare point sources (floor/table lamps) retain their existing emission.
export const fixtureLighting = ShaderChunk.lights_fragment_begin.replace(
  'getPointLightInfo( pointLight, geometryPosition, directLight );',
  `getPointLightInfo( pointLight, geometryPosition, directLight );
  directLight.color *= mix(1.0,
    max(dot(directLight.direction, normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz)), 0.0),
    casaCeilingLights[i]);
  directLight.visible = any(greaterThan(directLight.color, vec3(0.0)));`,
)
