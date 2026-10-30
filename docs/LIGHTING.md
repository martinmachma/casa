# Lighting and shadow rendering

Investigated and corrected on 2026-10-30.

## Existing stack

Casa uses React Three Fiber 9.8.1 and Drei 10.7.9 with Three.js 0.186.1's WebGLRenderer. Walls, slabs, outdoor objects and GLTF furniture use standard PBR materials. R3F supplies ACES filmic tone mapping and sRGB output. The canvas renders on demand at a device pixel ratio of 1–2.

A hemisphere light supplies indirect sky/ground fill. The date/time calculation supplies a directional sun, with a directional moon fill at night. Indoor fixtures and lamps are point lights with cube shadow maps. The permanent house proxy keeps the physical walls, floor slabs and roof in the shadow pass when the visual cutaway hides them. Room focus uses a separate blur/compositing pass. There was no ambient occlusion or bloom.

## Root causes and corrections

- **Excessive point-light bias.** The installed Three.js cube-shadow implementation compares perspective depth. The old `-0.002` bias with a 5 cm near plane moved a 6 m receiver's comparison to approximately 4.84 m. That detached furniture shadows and let light reach surfaces around solid intersections. The near plane is now 10 cm, depth bias is `-0.000005`, and normal bias is 3 mm.
- **PCF self-shadowing.** The cube filter compared offset rays against the centre ray's depth, producing bands on sloping receivers when the large bias was removed. The material shader now intersects each filter ray with the receiver plane and bounds the remaining hardware bilinear filter footprint. This permits soft edges without a large constant offset. The adjustment is limited to the installed r186 PCF cube-shadow chunk; recheck it when upgrading Three.js.
- **Mismatched caster surfaces.** The house proxy cast from its back faces and sank slab tops and roof surfaces by 12 cm as a workaround. Its nearest faces now cast shadows, and slab surfaces match the visible slabs. The visible roof and proxy share the same box definitions, including the membrane, coping and chimney. The ground slab depth also matches the visible foundation. Visible geometry and editing coordinates are unchanged.
- **Incomplete sunlight occlusion.** Shadow intensity was 0.45 in studio mode and 0.85 with the sun, so 55% or 15% of direct illumination passed through opaque geometry even in full shadow. Direct shadows now fully block their light. Moon fill also casts shadows. Hemisphere fill is retained; exposure and ambient intensity were not raised to conceal artifacts.
- **Resolution and coverage.** A fixed 40 m shadow view could miss outdoor geometry. Directional shadow cameras now fit physical casters and plot receivers, with a filter margin and texel-aligned bounds. The sun uses one 4096 map, moon one 2048 map, and point sources retain 512 maps. Explicit PCF replaces R3F's default request for the removed PCFSoftShadowMap. PCF radius is 1.5 texels.
- **Stale maps.** The previous checks omitted emitter movement and parts of object transforms; selecting shadowed lights only every 30 requested frames could leave newly added lights unshadowed. A shared update runs after geometry/editing hooks, updates world matrices, compares full caster transforms and geometry identity, and tracks light positions and directional targets. Changed shadows refresh together; camera-only frames reuse their maps. This also updates sunlight shadows inside RoomBlur when time changes.
- **Shadowless lights and lamps.** Overflow lights used to shine through walls. The existing texture-unit budget now limits the illuminating light pool, prioritising lights near the viewed area; every rendered point source has a shadow. Lamp shades cast sunlight shadows while omitting point-light depth writes so their embedded bulbs can light the room. Bases and stems cast both kinds of shadow. Other opaque casters consistently use their nearest faces.
- **Missing contact occlusion.** A new 16-sample screen-space pass uses Three.js's existing SSAO shader, with a 20 cm radius, 55% strength and a depth-aware blur. It multiplies indirect diffuse illumination before tone mapping, leaving direct light and emission alone. It runs at half resolution, capped at 960 pixels on its longest edge, and supports perspective, orthographic and layered room rendering. Glass, overlays, invisible shadow proxies and fading surfaces do not become false occluders. Existing local clipping is respected.

Box, extruded-prism and floor winding/normals were inspected and are consistent with their intended faces. The room-floor finish intentionally sits 3 mm above its slab to avoid z-fighting. Overlapping wall boxes are retained for solid junctions; nearest-surface shadow depth avoids relying on their internal back faces. No new libraries, engine replacement, model edits, camera changes or sun/date calculation changes were needed.

## Landing follow-up

The landing screenshot exposed a separate problem: the broad diagonal band came from downstairs ceiling
fixtures sending light upward through the real stair opening. Isolating the upper-floor sources removed the
band, so this was neither an AO mark nor a missing stairwell slab. Three.js point lights model bare bulbs
emitting in all directions ([PointLight documentation](https://threejs.org/docs/pages/PointLight.html)).

Ceiling fixtures now use a downward cosine emission lobe, matching the downward-facing diffuser. Cube maps
still handle physical occlusion and retain their resolution. This removes direct uplight from downstairs
ceiling fittings without closing the stairwell, disabling lower-floor lighting, or changing exposure. The
on-axis intensity and sun simulation are unchanged. Floor/table lamps retain their existing emission.

Emission flags follow the renderer's light ordering and visibility so a shadowed ceiling fitting cannot
accidentally give a nearby lamp its angular profile. Transparent and fading standard materials use the same
emission rule, with screen-space AO disabled for transparent surfaces. The landing was rechecked in logged-in
Chrome with all floors active after a clean reload. The suite now has 220 passing tests, including emitter
ordering/visibility checks; production build and scoped lint pass (existing HouseLights refresh warning only).

## Cutaway surfaces and shaft ownership follow-up

The dark blocks on the landing's shortened walls were the physical shadow map being evaluated on an
artificial section. The complete house deliberately remains in that map: removing it would let sunlight
through the cut walls. The stub's new horizontal face lies inside that complete volume, and the outer
faces beside doors and overlapping wall ends saw discontinuous occlusion. Disabling shadow reception on
only the stubs confirmed the cause; disabling AO did not remove the rectangular differences.

Cutaway wall remnants and clipped door/frame remnants use matte section materials with the existing
surface colours. Exposed wall tops use the existing cap colour in the same way. These artificial surfaces
stay out of the AO depth/normal pass and receive only the existing indirect illumination. The first flat,
unlit treatment kept the full paint brightness at night and looked highlighted; sections now follow the
scene's hemisphere colour/intensity and their face normals. Direct-light and specular highlight loops are
omitted for section materials, so the misleading shadow comparisons and bright light spots cannot appear.
Full wall faces, floors, furniture and the physical house shadow proxy retain their lighting, occlusion and
shadows; no ambient intensity, paint colour, bias, exposure or sun calculation was changed. Night and even
studio lighting were rechecked in Chrome after this refinement.

`u-shaft-s15` is now a structural member of `u-middle`: picking, painting, debug identity, room sorting and
cutaway use its parent wall. The measured projecting footprint remains in the scene, snapping/collision
geometry and physical shadow proxy. Parent paint uses the parent's along-wall coordinates; legacy member
paint remains a fallback. Other wall identities and stored paint-part numbering are retained.

Browser comparisons covered the focused landing and several orbit angles on the furnished upper floor,
cut/uncut transitions, night, studio light and simulated 13:05 sunlight.
222 tests pass, including a ray test through the merged wall's stepped physical profile and ownership/paint
coordinates, plus invalid compound-wall definitions. The production build passes. Scoped lint retains the
existing renderer-mutation errors in OpeningFills' clipping hook and existing CutawayWall refresh warnings.

## Validation

- Geometry tests cover both faces of an upper slab, the foot of a wall, open windows, roof/coping height, full transform and geometry invalidation, and shadow-camera coverage at low/high solar altitudes while preserving sun direction.
- Browser checks used the logged-in Chrome house: exterior, furnished ground floor, focused living/kitchen view, orthographic plan, and simulated noon. Shadows remain aligned with furniture and walls; solid geometry blocks direct light.
- A temporary independent room fixture exercised front/side/top views, morning/noon/evening/night lighting, moved emitters, moved/rotated furniture and nonuniform scaling. The wall bands and large shadow separation reproduced before the corrections and were absent in the final checks. The fixture used production scene components and was removed after validation.
- A 120-frame local fixture run measured approximately 120 fps with cached shadows. This is a small-scene check on this Mac, not a benchmark for low-end phones or a large number of simultaneously edited lights.
- `npm test` and the production build pass. Repository-wide ESLint also scans an existing nested `.haru/worktrees` checkout and fails its TypeScript root discovery. A scoped lint check distinguishes existing warnings/errors from the changed rendering code.

## Remaining limitations

This is raster lighting with approximate indirect fill, not global illumination. Screen-space AO cannot account for offscreen or hidden surfaces, and is deliberately local and subtle. Transparent glass does not model transmission/refraction or coloured shadows. Finite shadow maps can still soften or lose very small details, especially at grazing angles. Decorative distant ground outside the physical plot does not enlarge the sun map.

The GPU texture budget can omit lower-priority point lights when too many are on at once; those lights no longer create unoccluded fill. Geometry edits redraw the affected shadow set immediately, so editing a scene with many active bulbs costs more than orbiting a static scene. Lamp shades remain transparent to all point-light shadow passes, not only their own bulb. Cutaway furniture retains its complete physical shadow, matching the existing behaviour.
