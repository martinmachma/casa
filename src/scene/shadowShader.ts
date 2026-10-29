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

export const receiverPlaneShadows = ShaderChunk.shadowmap_pars_fragment
  .replace('float getPointShadow( samplerCubeShadow', planeSample + '\nfloat getPointShadow( samplerCubeShadow')
  .replace(
    'float texelSize = shadowRadius / shadowMapSize.x;',
    'vec3 receiverPlane = normalize(cross(dFdx(lightToPosition), dFdy(lightToPosition)));\nfloat texelSize = shadowRadius / shadowMapSize.x;',
  )
  .replace(
    /texture\( shadowMap, vec4\( (bd3D \+ .+?), dp \) \)/g,
    'pointPlaneShadowSample(shadowMap, $1, dp, lightToPosition, receiverPlane, shadowCameraNear, shadowCameraFar, shadowBias, shadowMapSize.x)',
  )

// Include the shader content in the program identity so edits cannot reuse an older compiled variant.
export const receiverPlaneShadowKey = [...receiverPlaneShadows]
  .reduce((hash, c) => (Math.imul(hash, 31) + c.charCodeAt(0)) | 0, 0)
  .toString(16)
