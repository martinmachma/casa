# Casa — Smart home plan

Written 2026-10-13 as a handoff to a new session. Read `AGENTS.md` and `docs/IMPLEMENTATION_PLAN.md` first.

## Goal

Make Casa the 3D front end of the house's smart home: devices (lights, switches, sockets, sensors, thermostats,
blinds) placed in the model, and later live state and control through Home Assistant running on a Raspberry Pi in the
house. Phase A needs no hardware and is the work for now; phase B waits for the Pi.

## Where things stand (useful context)

- Everything placed in the house lives in **versions** (`house.versions.data`, jsonb `HouseState`:
  `walls`, `floors`, `furniture`, `rooms`). Edits go into a local draft (`src/data/useHouseData.ts`) with undo/redo;
  saving makes a new immutable version, one of which is live. New kinds of placed things are added the same way as
  `rooms` was: an optional array on `HouseState`, defaulted in `supabaseBackend.ts` `fromRow`, no migration needed.
- Edits go through `edit(change, key?)` in `useHouseData`; a `key` merges consecutive edits (one drag) into one undo
  step, and `endEdit()` ends the run (called on drag end and on selection change).
- Selection: `src/scene/selection.ts` (`Selection` union: wall, room, furniture). The right panel ("inspector") is
  picked in `src/App.tsx` by selection kind. Edit mode tools are in `src/ui/ModeBar.tsx` (select, measure).
- Furniture is the closest precedent: `FurnitureBox.tsx` / `FurnitureModel.tsx` (drag on the floor plane, snapping in
  `src/furniture/snap.ts`), `FurniturePanel.tsx` (add), `FurnitureEditor.tsx` (edit).
- Wall geometry: `src/layout/geometry.ts`, wall faces `a`/`b` (`src/layout/types.ts`). Floor heights per floor in
  `house.json`. The electrical plan the layout was traced from is `docs/02_SO-22_1NP_R04-1.jpg`.
- Tests: small and core-logic only (`npm test`); no snapshot tests.

## Phase A — devices in the model (no Pi)

### A1. Data

```ts
// src/data/types.ts
export type DeviceKind = 'light' | 'switch' | 'socket' | 'sensor' | 'thermostat' | 'blind' | 'other'
export type Device = {
  id: string
  floor: string            // layout floor id
  kind: DeviceKind
  name: string
  x: number; y: number      // plan position, metres
  z: number                 // height above the floor, metres (socket 0.3, switch 1.1, ceiling light = ceiling)
  /** Set for wall-mounted devices: which wall and face it sits on. Ceiling/free devices leave it out. */
  wall?: { wallId: string; side: WallSide }
  /** Home Assistant entity id, e.g. light.living_ceiling; filled in phase B. */
  entity?: string
}
// HouseState gets `devices?: Device[]`; fromRow defaults it to [].
```

Hook API in `useHouseData`: `devices`, `addDevice`, `patchDevice(id, patch, key?)`, `removeDevice`, all via `edit`.

### A2. Placing

- New edit tool in `ModeBar`: "Devices" (lucide `Lightbulb`), next to select and measure; a `Selection` kind `device`.
- With the tool on, the inspector shows a device palette (kind buttons). Picking a kind then tapping in the scene
  places it:
  - socket/switch/sensor/thermostat/blind: snap to the nearest wall face within ~0.4 m (reuse the face maths from
    `snap.ts` / `measure.ts`), at the kind's default height;
  - light: on the ceiling at the tapped point (z = floor height).
- Dragging a device moves it along its wall (or across the ceiling); key `device:${id}` for undo.
- `DeviceEditor` panel: name, kind, height (cm), HA entity (free text for now), delete.
- Render: small simple meshes (`src/scene/Devices.tsx`): flat plate on the wall for switch/socket, puck on the ceiling
  for lights, small box for sensors; colour by kind; shown in plan, 3D and walk views; hidden from outside.
- Left panel: a device count per room (point-in-region with `floorRegions` from `src/layout/rooms.ts`).

### A3. Tests

- Wall snapping of a tapped point to the nearest face (side, offset, clamped inside the wall's length, not inside a
  door/window opening).
- Device-in-room assignment.

### A4. Nice next steps (optional)

- Lights cast a real point light at night (with the sun panel's time); cap the number of lights for performance.
- A printable list of devices per room for the electrician.

## Phase B — Home Assistant (needs the Pi)

Owner setup (Martin, not the agent): Raspberry Pi 4/5 with Home Assistant OS, devices paired (Zigbee dongle or
Wi-Fi), remote access via Nabu Casa or Tailscale, a long-lived access token.

- **Never put the HA token in the client bundle or in Supabase rows readable by the app.** Route calls through a
  Supabase Edge Function (`supabase/functions/ha`) that checks `house.is_allowed()` for the caller, holds the HA URL
  and token as secrets, and proxies: `GET states` (filtered to entities used in the live version) and
  `POST services/<domain>/<service>`.
- Client: `src/home/useHomeState.ts` polls the function (or subscribes via a websocket the function relays; polling
  every few seconds is fine to start). A mock backend with fake states for the demo and for development before the Pi.
- In view mode: tap a light/switch/socket to toggle; sensors show their reading as a label; thermostats show
  temperature/target; the room legend shows room temperature where a sensor is in it.
- `DeviceEditor` gets an entity picker from the HA entity list instead of free text.

## Out of scope for now

Automations (stay in Home Assistant), cameras, energy dashboards.

## Workflow reminders

Work on `develop`, commit and push there; merge to `main` only when Martin says. Phase A needs no migration. Verify in
the browser preview (`.claude/launch.json` → `casa`, demo login) including phone width.
