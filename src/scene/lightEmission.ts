import { PointLight, ShaderChunk, type Camera, type Object3D } from 'three'

/** Match WebGLLights' point-light order, including shadow-prioritisation and camera layers. */
export const scenePointLights = (scene: Object3D, camera: Camera) => {
  const lights: PointLight[] = []
  scene.traverseVisible((o) => {
    if (o instanceof PointLight && o.layers.test(camera.layers)) lights.push(o)
  })
  lights.sort((a, b) => Number(b.castShadow) - Number(a.castShadow))
  return lights
}

export const ceilingLightMask = (scene: Object3D, camera: Camera) =>
  scenePointLights(scene, camera).map((l) => (l.userData.downlight as number | undefined) ?? 0)

const RE_DIRECT =
  'RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );'

// Ceiling fixtures are downward-facing diffusers, and wall lights nearly so. Keep their cube shadows, with a
// cosine emission lobe below the fitting, as strong as each light's mask. Bare point sources (floor/table lamps) keep
// their existing emission.
// Every pixel goes through every bulb in the house, on or off. One that's off, out of reach or behind the surface adds
// nothing, so it's left there: its shadow isn't looked up and its full specular isn't worked out for a colour of zero,
// which together are most of the frame. The sun and moon are the same.
export const fixtureLighting = ShaderChunk.lights_fragment_begin
  .replace(
    'getPointLightInfo( pointLight, geometryPosition, directLight );',
    `directLight.visible = false;
  if ( any( greaterThan( pointLight.color, vec3( 0.0 ) ) ) ) {
    getPointLightInfo( pointLight, geometryPosition, directLight );
    directLight.color *= mix(1.0,
      max(dot(directLight.direction, normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz)), 0.0),
      casaCeilingLights[i]);
    directLight.visible = any(greaterThan(directLight.color, vec3(0.0))) && dot(geometryNormal, directLight.direction) > 0.0;
  }`,
  )
  .replace(RE_DIRECT, `if ( directLight.visible ) ${RE_DIRECT}`)
  .replace(
    'getDirectionalLightInfo( directionalLight, directLight );',
    `getDirectionalLightInfo( directionalLight, directLight );
  directLight.visible = any(greaterThan(directLight.color, vec3(0.0))) && dot(geometryNormal, directLight.direction) > 0.0;`,
  )
  .replace(/(getDirectionalLightInfo[\s\S]*?)RE_Direct\(/, '$1if ( directLight.visible ) RE_Direct(')
  .replace('getPointShadow( pointShadowMap[ i ],', 'getPointShadow( UNROLLED_LOOP_INDEX,')
  .replace(
    'vPointShadowCoord[ i ]',
    'vec4(transpose(mat3(viewMatrix)) * (geometryPosition - pointLight.position) + casaShadowWorldNormal * pointLightShadow.shadowNormalBias, 1.0)',
  )
