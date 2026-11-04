import { ShaderChunk } from 'three'

// r186's cube PCF compares every offset sample with the centre ray's depth. On a sloping receiver this
// shadows the receiver against itself. Intersect each filter ray with the receiver's actual tangent plane
// instead: softness no longer needs centimetres of normal offset to conceal self-shadowing bands.
const planeSample = /* glsl */ `
float pointPlaneShadowSample(samplerCubeShadow map, vec3 ray, float centreDepth,
    vec3 position, vec3 planeNormal, float near, float far, float bias, float mapSize) {
  float denominator = dot(planeNormal, ray);
  if (abs(denominator) < 0.0001) return texture(map, vec4(ray, centreDepth));
  vec3 onPlane = ray * (dot(planeNormal, position) / denominator);
  vec3 a = abs(onPlane);
  float viewZ = max(max(a.x, a.y), a.z);
  viewZ = max(viewZ, near);
  // Hardware bilinear comparison still spans up to one texel around each filter ray. Bound the
  // plane's depth change within that texel, rather than applying a large constant depth bias.
  vec3 n = abs(planeNormal), r = abs(ray);
  float dominant = max(max(r.x, r.y), r.z);
  float faceNormal = r.x >= max(r.y, r.z) ? n.x : (r.y >= r.z ? n.y : n.z);
  float footprint = 2.0 * dominant * (n.x + n.y + n.z - faceNormal) / (mapSize * abs(denominator));
  float planeBias = near * far * footprint / ((far - near) * viewZ);
  #ifdef USE_REVERSED_DEPTH_BUFFER
    float depth = near * (far - viewZ) / (viewZ * (far - near)) - bias + planeBias;
  #else
    float depth = far * (viewZ - near) / (viewZ * (far - near)) + bias - planeBias;
  #endif
  return texture(map, vec4(ray, depth));
}
`

const atlasSampling = /* glsl */ `
uniform sampler2DShadow casaPointShadowAtlas;
uniform vec4 casaPointShadowTiles[NUM_POINT_LIGHT_SHADOWS];
uniform float casaPointShadowQuality[NUM_POINT_LIGHT_SHADOWS];

// WebGL cube face order: +X, -X, +Y, -Y, +Z, -Z. Match each face's camera up vector exactly.
float casaAtlasCompare(int index, vec3 ray, float depth) {
  vec3 a = abs(ray);
  vec2 uv;
  int face;
  if (a.x >= max(a.y, a.z)) {
    face = ray.x > 0.0 ? 0 : 1;
    uv = vec2(ray.x > 0.0 ? -ray.z : ray.z, -ray.y) / a.x;
  } else if (a.y >= a.z) {
    face = ray.y > 0.0 ? 2 : 3;
    uv = vec2(ray.x, ray.y > 0.0 ? ray.z : -ray.z) / a.y;
  } else {
    face = ray.z > 0.0 ? 4 : 5;
    uv = vec2(ray.z > 0.0 ? ray.x : -ray.x, -ray.y) / a.z;
  }
  vec4 tile = casaPointShadowTiles[index];
  // Clamp within this face so bilinear comparisons never read a neighbouring bulb or cube face.
  vec2 halfTexel = 0.5 / (vec2(textureSize(casaPointShadowAtlas, 0)) * tile.zw);
  uv = clamp(uv * 0.5 + 0.5, halfTexel, 1.0 - halfTexel);
  uv = tile.xy + (vec2(float(face % 3), float(face / 3)) + uv) * tile.zw;
  return texture(casaPointShadowAtlas, vec3(uv, depth));
}
`

export const receiverPlaneShadows = ShaderChunk.shadowmap_pars_fragment
  .replace('varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];', 'varying vec3 casaShadowWorldNormal;')
  .replace('float getPointShadow( samplerCubeShadow', planeSample + '\nfloat getPointShadow( samplerCubeShadow')
  .replace(
    'float texelSize = shadowRadius / shadowMapSize.x;',
    'vec3 receiverPlane = normalize(cross(dFdx(lightToPosition), dFdy(lightToPosition)));\nfloat texelSize = shadowRadius / shadowMapSize.x;',
  )
  .replace(
    /texture\( shadowMap, vec4\( (bd3D \+ .+?), dp \) \)/g,
    'pointPlaneShadowSample(shadowMap, $1, dp, lightToPosition, receiverPlane, shadowCameraNear, shadowCameraFar, shadowBias, shadowMapSize.x)',
  )
  .replace('uniform samplerCubeShadow pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];', atlasSampling)
  .replace('pointPlaneShadowSample(samplerCubeShadow map,', 'pointPlaneShadowSample(int casaShadowIndex,')
  .replaceAll('texture(map, vec4(ray, centreDepth))', 'casaAtlasCompare(casaShadowIndex, ray, centreDepth)')
  .replaceAll('texture(map, vec4(ray, depth))', 'casaAtlasCompare(casaShadowIndex, ray, depth)')
  .replace('getPointShadow( samplerCubeShadow shadowMap,', 'getPointShadow( int casaShadowIndex,')
  .replaceAll('pointPlaneShadowSample(shadowMap,', 'pointPlaneShadowSample(casaShadowIndex,')
  .replace(
    'float texelSize = shadowRadius / shadowMapSize.x;',
    `if (casaPointShadowQuality[casaShadowIndex] < 0.5) {
      return mix(1.0, pointPlaneShadowSample(casaShadowIndex, bd3D, dp, lightToPosition,
        receiverPlane, shadowCameraNear, shadowCameraFar, shadowBias, shadowMapSize.x), shadowIntensity);
    }
    float texelSize = shadowRadius / shadowMapSize.x;`,
  )

// Compute point-shadow vectors in the fragment shader. One varying per bulb otherwise exceeds mobile GPUs'
// varying budget even though all their shadows now share a single texture.
export const atlasShadowVertexPars = ShaderChunk.shadowmap_pars_vertex.replace(
  /#if NUM_POINT_LIGHT_SHADOWS > 0[\s\S]*?#endif/,
  '#if NUM_POINT_LIGHT_SHADOWS > 0\nvarying vec3 casaShadowWorldNormal;\n#endif',
)
export const atlasShadowVertex = ShaderChunk.shadowmap_vertex.replace(
  /#if NUM_POINT_LIGHT_SHADOWS > 0[\s\S]*?#endif/,
  '#if NUM_POINT_LIGHT_SHADOWS > 0\ncasaShadowWorldNormal = shadowWorldNormal;\n#endif',
)

// Include the shader content in the program identity so edits cannot reuse an older compiled variant.
export const receiverPlaneShadowKey = [...receiverPlaneShadows]
  .reduce((hash, c) => (Math.imul(hash, 31) + c.charCodeAt(0)) | 0, 0)
  .toString(16)
