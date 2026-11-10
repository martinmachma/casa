# Lighting and shadow rendering

Investigated and corrected on 2026-10-30.

## Existing stack

Nest uses React Three Fiber 9.8.1 and Drei 10.7.9 with Three.js 0.186.1's WebGLRenderer. Walls, slabs, outdoor objects and GLTF furniture use standard PBR materials. R3F supplies ACES filmic tone mapping and sRGB output. The canvas renders on demand at a device pixel ratio of 1–2.

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

Only the artificial horizontal cut faces use matte section shading with the existing cap colour and
indirect hemisphere illumination. They do not receive shadow-map or screen-space AO marks. The first flat,
unlit treatment looked highlighted at night; using the existing ambient lighting gives the caps subdued
colour and face shading. Applying that treatment to entire stubs was too broad: vertical sides and end
faces of shortened walls now retain direct lighting, physical shadow reception and contact occlusion, as
do the remaining faces of clipped doors/frames. Physical sills and low-wall ledges also retain shadows.
Frames receive shadows consistently with door leaves.

The complete house remains in the physical shadow pass, so solid walls still block sunlight when visually
cut away. No ambient intensity, paint colour, bias, exposure, geometry or sun calculation was changed.
Night and even studio lighting were rechecked in Chrome during the refinements; the final upper-floor
orbit check confirms shadowed vertical faces and uninterrupted horizontal caps.

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
- `npm test` and the production build pass.

## Distant-room lighting

Every switched-on bulb now illuminates the house, regardless of camera position or the GPU's texture-unit
limit. All point shadows share one depth atlas, retaining the physical walls, closed doors, slabs and roof
as occluders. The four bulbs nearest the viewed area use 512-pixel faces, the next four use 256, and the
rest use 128 with one filtered shadow comparison instead of five. Brightness, colour and downward emission
do not depend on those tiers. A smaller atlas budget reduces detail further rather than omitting bulbs.
Detailed-light selection has hysteresis and follows the orbit target, avoiding changes from rotation alone.
Shadows remain cached across camera-only frames; changed atlas tiles refresh when their allocation changes.

Point-shadow vectors use one shared normal varying instead of one position varying per bulb, keeping the
shader within mobile varying limits. Shadow projection is initialized explicitly when the shared atlas
replaces Three's cube allocation. Geometry/cutaway updates, shadow invalidation, material preparation and
colour rendering now have explicit frame order, including when changing floors or entering room focus.

Browser validation covered 24 illuminated rooms on a 16-texture-unit renderer, distant on/off isolation,
moved occluders, the actual two-floor house, room focus, floor transitions, and simultaneous sun/moon lighting.
The 24-light fixture used four 512, four 256 and sixteen 128-pixel maps: 75% fewer shadow texels than
24 full-detail cube maps, with one point-shadow sampler. This is an allocation comparison, not an FPS claim.

## Light switching performance (2026-11-04)

Every fixture now stays mounted, including bulbs switched off or on a hidden floor, with zero intensity
while inactive. This keeps Three's point-light/shadow counts and atlas layout stable: toggling a light or
opening its room no longer recompiles all the house's materials for a new light count. Dark fixtures
skip shadow depth passes; switching one back on refreshes its occlusion, including edits made while off.
The atlas texture is initialized even when every bulb starts off, keeping the shadow sampler valid.
The nearest fixtures retain the detailed atlas slots even when dark, so switching does not move their
neighbours' cached shadows. Zero-intensity lights skip direct illumination and shadow sampling.

In the local two-floor demo at night, switching a dining light off previously created 21 shader programs
and stalled a frame for 8.24 seconds. With stable slots, on/off switches created no programs and the
largest frame gaps were 100–117 ms in the same browser session. Switching the whole room off also created
no programs. These are local interaction measurements, not an FPS guarantee for other devices.

## View switching performance (2026-11-04)

Profiled in Chrome on an M1 Pro with the real house at night, at 2× on a 1512×720 window. The cost was the GPU, and
it hardly depended on the lights: with every bulb at zero the room view took 68 ms a frame against 79 ms.

- **The room view cleared depth part-way through the screen's pass.** On Metal that stores and reloads the antialiased
  picture. Nothing needed it: the blurred quad before it writes no depth. Removing it took the room view from 79 to
  30 ms a frame, antialiasing kept. Opening an item now resets depth with the dim's own quad instead of a clear.
- **Fades ran at full resolution.** Only camera movement dropped to 1×, so a floor fading in with the camera still drew
  every pixel at 2× (38 ms a frame, against 14 ms). Fades and cut walls now count as motion, from a switch's first frame.
- **Floors were rebuilt on every switch.** `Fade` unmounted what it hid, so each return remounted a floor and linked
  up to 9 programs again. It now hides them and keeps them mounted. `fadedAway` keeps them out of picking, which
  doesn't otherwise look at `visible`. Electrical-plan devices, which filtered in and out by floor, do the same.
- **The AO pass let go of materials out of sight**, which relinked or re-patched them on return. A material keeps its
  patch until it's disposed; it must then be restored, as a disposed material can be used again (StrictMode does this in
  development), and patching one twice fails to compile. AO targets no longer reallocate with the pixel ratio.
- **`MergeParts` compared every part on every React render.** Device models and fixtures now skip renders that don't
  touch them.

Repeat floor switches went from 1.1–1.7 s of frames over 40 ms, and 9 linked programs, to 0.55–0.9 s and at most 2.
These are development-build figures from a Mac under heavy memory pressure, so they compare with each other only.
A room's first visit still links about 16 programs for its cut walls; later visits link few or none.

**Going to planning at night froze the page.** At night home had a moon and a sun casting no shadow; planning has no
moon and a sun that casts, so the number of directional lights changed, and with it every material's program. From a room that
took 23 links and stalled one frame for 10 seconds. The moon and sun now stay mounted, at zero if need be, and only the
brighter one casts, so that number never changes. The same switch now links nothing and its longest frame is 94 ms. At
dusk, when both are lit, the fainter one no longer casts a shadow.

## Remaining limitations

This is raster lighting with approximate indirect fill, not global illumination. Screen-space AO cannot account for offscreen or hidden surfaces, and is deliberately local and subtle. Transparent glass does not model transmission/refraction or coloured shadows. Finite shadow maps can still soften or lose very small details, especially at grazing angles. Decorative distant ground outside the physical plot does not enlarge the sun map.

Geometry edits redraw the affected shadow set immediately, so editing a scene with many active bulbs costs
more than orbiting a static scene. Distant shadows lose fine detail as their resolution falls. Lamp shades
remain transparent to all point-light shadow passes, not only their own bulb. Cutaway furniture retains its
complete physical shadow, matching the existing behaviour. The atlas integration follows Three r186's
shadow viewport API and shader chunks; an engine upgrade needs visual verification of both.

## Phone rendering and camera timing (2026-11-07)

Coarse-pointer devices (including landscape phones) and windows up to 820 CSS pixels wide use a lighter graphics
profile. The canvas stays at 1× DPR; directional and point-shadow faces are half the desktop width and height.
Every bulb and physical occluder remains, with the same intensity, colour, reach and switching behaviour. The
lighting/atlas material patch stays active while the SSAO normal, occlusion and blur passes are skipped.

Focused rooms draw straight to the screen on phones, avoiding the offscreen house programs and blur passes.
Room-only picking, item close-ups, dimming and controls remain. The desktop blur, AO and resolution are unchanged.
Phones also skip background compilation of the blur programs they no longer use. The profile updates when the
viewport or primary pointer changes; it applies in Edit as well as Home and changes no saved data.

Room and return flights now advance by elapsed time from their first active frame, instead of capping every frame
at 1/30 second. The cap stretched a nominal 1.1-second flight to 5.145 seconds in a local Chrome demo with 120 ms of
artificial work per frame. With the fix, a phone-sized room flight took 1.136 seconds under the same artificial load;
a light close-up took 1.107 seconds. These measure animation timing on this Mac, not FPS or a physical-phone benchmark.
Phone checks also covered opening and switching a light: switching retained the same 22 shader programs.

## AO blur on Windows (2026-11-09)

On a Windows PC (Chrome and Edge, ANGLE on Direct3D 11) the house froze the whole browser on its first frame. `?gfx=`
switches pinned it to the AO's depth-aware blur: the normal pass and the SSAO quad alone ran fine. The blur read its
camera kind from a bool uniform and sampled with filtered `texture2D` in a nested loop. It now takes the camera kind
as a define and reads exact texels with `texelFetch`, like SSAOShader does. All three AO targets share one size, so
the result is the same (a pixel diff against the old blur was no larger than one between two frames of the same code).
An 8-bulb shadow cap tried first (shader size as the suspect) didn't help and was reverted: every bulb casts again,
and the PC runs it fine.
