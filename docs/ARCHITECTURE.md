# Casa architecture

How the app fits together. Read this before changes that cross modules or touch saved data. If you change a module's
role, a dependency direction, or the data model, update this file in the same commit.

## Shape

Vite + React + TypeScript PWA. `main.tsx` mounts `App.tsx` (auth gate, then the lazily loaded `House.tsx`).
`House.tsx` is the shell: it owns most UI state (`useState`, passed down as props; there is no global store), composes
the 3D scene and the UI panels, and talks to the data layer through `useHouseData`.

## Modules (`src/`)

Dependency direction, low to high: **layout → {furniture, measure, walk, sun, weather} → {data, devices, rooms} → scene → ui → House**.
A module may import from the left of itself, not the right. (A few small upward leaks exist today:
`rooms/roomItems` imports `isLamp` from `scene/HouseLights`, `scene` imports `ui/isTyping`. Don't add more.)

| Module | Owns | Kind |
| --- | --- | --- |
| `layout` | `house.json` (the real traced plan), types, `validateLayout` (run at import), wall pieces/openings/paint faces, room flood-fill and areas, ground, WC | pure TS, leaf |
| `furniture` | catalog (+`footprints.json`), snapping, collision, group, clipboard, duplicate, cut | pure |
| `measure` | distances, clearances, dimensions | pure |
| `walk` | walk-mode collision, stairs, start position (eye height 1.6 m) | pure |
| `sun` | NOAA sun position, `sunNow()` | pure |
| `weather` | Open-Meteo forecast/current (cached in localStorage), confidence | fetch + pure |
| `data` | `HouseState`, versions, the `Backend` interface, `useHouseData`, local (demo) and Supabase backends, migrations of saved state (`builtInFixtures`, `builtInFinishes`), wall areas | hooks + pure |
| `devices` | the 135 fixed electrical points, device kinds, placement, lights, shades, scenes | mostly pure + small hooks |
| `rooms` | room views, items per room, room order | pure + one query hook |
| `lib` | Supabase client, query client, realtime, `useStable` | leaf helpers |
| `auth` | `AuthGate`, `useAccess` (guest list check, Google sign-in) | React |
| `scene` | everything inside the R3F `<Canvas>`: walls, floors, openings, furniture, device models, lights, shadows, AO, cameras, picking. Pure helpers (`shadows`, `pick`, `raycast`, `itemSection`, `lightEmission`, `pointShadowLayout`, `roomMeshes`) are separate files with tests | R3F + pure |
| `ui` | DOM panels, top bar, room nav, kit primitives (`kit.tsx`), todo popup. No R3F | React |

## Data model

- **`HouseState`** (`data/types.ts`): wall paint, wall areas, furniture, room name overrides, devices, device names,
  built-in finishes and fixtures. Optional fields are defaulted when loading (`supabaseBackend.fromRow`), so adding a
  field needs no migration.
- **Versions** are immutable snapshots (`house.versions`, jsonb). `house.live_version` is a one-row pointer to the
  version that is "the house now" (null = bare house). The `Backend` interface covers load, save, rename, delete,
  setLive, `replaceLive` (conditional, one winner when two people go live at once), room order, and subscribe.
- **Unsaved edits** live in `useHouseData`: a history (draft, past, future, limit 100). `edit(change, key?)` merges
  same-key edits into one undo step. The draft persists to localStorage (`casa.draft.<backend.kind>`) and survives a
  reload on that device. Saving creates a new version. `newerLive` flags that someone made another version live while
  you were editing.
- **Modes**: Home shows only the saved live version. Edit (`?edit` in the URL) works on the draft.
- **Two backends, same interface**: Supabase (real) and local (demo: localStorage `casa.demo.*`, tabs synced with
  BroadcastChannel). Demo is offered in dev or when Supabase isn't configured. Any data change must work in both.
- **Realtime**: `supabaseBackend.subscribe` listens to `versions` and `live_version` and reloads the react-query cache.
- **Server state** is react-query (keys such as `['versions', kind]`, `['roomOrder', kind]`, `['access', userId]`,
  `['todos']`). Mutations are followed by `invalidateQueries`.
- **Per-browser state, not synced**: light/shade/scene state (`devices/*`, localStorage), weather cache, north and
  camera preferences.
- **Supabase calls** belong in `data/supabaseBackend.ts`. Existing exceptions: `auth/useAccess.ts`, `ui/TodoPopup.tsx`,
  `ui/useOpenTodoCount.ts`, `lib/useRealtime.ts`. New code goes through `data`.
- **Database**: everything in the `house` schema and `house` storage bucket (shared Supabase project with Haru; never
  touch Haru's tables). RLS uses `house.is_allowed()`. The old `walls`, `room_floors`, `furniture_items`,
  `color_schemes` and `rooms` tables are unused.

## Units and coordinates

- Metres in all data and logic. Plan x grows east, y grows south. In 3D, plan (x, y) maps to (x, z) with Y up; floor
  elevation is a Y offset.
- Angles: item `rotation` in radians; `site.north` in degrees clockwise from plan-up; sun azimuth in radians
  clockwise from north. UI steps are 15° and 90°.
- Furniture catalog sizes are centimetres; stored items are metres.
- Wall sides: walking `from` → `to` with north up, side `a` is on the right, `b` on the left. Opening `offset` runs
  from the wall's `from` point. Wall ids are stable (saved paint is keyed by them), so never renumber them.
- `house.json` is cast to `HouseLayout` (no shape schema); `validateLayout` checks ids, zero-length walls, `partOf`,
  and opening bounds/overlap/height.

## Rendering notes

Performance-sensitive; read `docs/LIGHTING.md` before touching lights, shadows or post-processing.

- Canvas runs `frameloop="demand"`; quality drops to 1x DPR while the camera moves.
- Shadow maps are cached across frames by a caster signature; point-light shadows share an atlas.
- Fixtures and lights stay mounted at zero intensity (changing the light count recompiles shaders). Floors fade
  rather than unmount.
- Raycasting is off outside Edit for most meshes.

## Features that exist / don't

Exist: versions + undo/redo, Edit with Interior and Devices modes, scenes, paint areas, furniture, bathroom fittings,
roof/outdoor/stairs, electrical routes view, walk mode, sun and moon, weather, todos popup, per-user room order,
nicknames, PWA.
Not built: Home Assistant. Lights, shades and scenes switch in-app only. Devices carry an optional `entity` for later.
Don't build HA integration until Martin says it's set up, then ask how the app should reach it (browser with token
and CORS, or a Supabase edge function).

## Other docs

`LIGHTING.md` (lighting/shadow pipeline) and `ELECTRICAL.md` (traced electrical plan) are current. The early
implementation and smart-home plans were removed as outdated; the code and this file are the truth.
