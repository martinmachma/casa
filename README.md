# Casa

Our house in 3D: walls traced from the plan, paint colours per wall side, and box furniture you can drag around. A
Vite + React + TypeScript PWA using React Three Fiber, backed by Supabase and deployed on Vercel.

## Run it

```bash
npm install
cp .env.example .env.local   # then fill in the two values
npm run dev                  # http://localhost:5173
```

Without `.env.local` (and always in dev) the login screen offers **Try the demo**, which runs the whole app with data
saved only in this browser's localStorage.

| Script              | What it does                                             |
| ------------------- | -------------------------------------------------------- |
| `npm run dev`       | dev server                                               |
| `npm run build`     | typecheck + production build (with service worker)       |
| `npm run preview`   | serve the production build locally                       |
| `npm run lint`      | eslint (`npm run format` runs prettier)                  |
| `npm run typecheck` | `tsc -b`                                                 |
| `npm test`          | vitest: wall splitting, layout validation, wall snapping |
| `npm run icons`     | regenerate PWA icons from `public/favicon.svg`           |

## One-time setup

Casa shares the Supabase project with Haru. Everything Casa owns lives in the `house` schema and the `house` storage
bucket; it never touches Haru's tables.

### 1. Database

Open the Supabase dashboard → **SQL Editor** and run each file in [`supabase/migrations`](supabase/migrations) in
order (or, with the CLI linked to the project, `supabase db push`). The first,
[`20261012000000_house_schema.sql`](supabase/migrations/20261012000000_house_schema.sql), creates:

- `house.allowed_emails`: the guest list. Only emails here can read or write anything.
- `house.rooms`: optional names/notes for the rooms in the layout.
- `house.color_schemes`: named sets of wall colours (one active; a `Default` one is seeded).
- `house.walls`: the colour of each side of each layout wall, per scheme.
- `house.furniture_items`: the boxes: floor, size, position, rotation, colour.
- `house.is_allowed()`, which every RLS policy uses, plus a private `house` storage bucket with the same rule.

The later ones add to it: `…_house_realtime.sql` turns on live sync (walls and furniture stream to the other device
without a reload), `…_house_room_floors.sql` adds `house.room_floors`, the floor finish of each room, and
`…_house_furniture_models.sql` adds `furniture_items.model`.

Then add the two of you (lower-case emails):

```sql
insert into house.allowed_emails (email, note) values
  ('you@example.com', 'Martin'),
  ('her@example.com', 'Her');
```

### 2. Expose the schema to the API

Dashboard → **Project Settings → Data API → Exposed schemas**: add `house` (keep `public` and whatever Haru uses).
Without this the app gets "The schema must be one of the following…" errors.

### 3. Google sign-in

If Haru already signs in with Google, the provider is already on and you can skip to the redirect URLs.

1. Google Cloud Console → **APIs & Services → Credentials → Create credentials → OAuth client ID** (Web application).
   - Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
   - Add her Google account as a test user if the consent screen is still in "Testing".
2. Supabase → **Authentication → Sign In / Providers → Google**: enable it and paste the client ID and secret.
3. Supabase → **Authentication → URL Configuration → Redirect URLs**: add
   - `http://localhost:5173`
   - `https://<your-casa-domain>.vercel.app` (and any custom domain)

   Leave the Site URL as Haru's; Casa passes its own `redirectTo`, which only needs to be in this list.

> ⚠️ Because the project is shared, her Google sign-in also creates a user in Haru's auth. That's harmless as long as
> Haru's own RLS policies don't grant access to _every_ authenticated user. Worth a quick check.

### 4. Environment variables

`.env.local` for dev and Vercel → **Project → Settings → Environment Variables** for production:

| Name                     | Where to find it                             |
| ------------------------ | -------------------------------------------- |
| `VITE_SUPABASE_URL`      | Supabase → Project Settings → API → URL      |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon key |

The anon key is public by design; RLS is what protects the data. Never put the service-role key in this app.

### 5. Vercel

Import the repo in Vercel; the Vite preset is detected (build `npm run build`, output `dist`). Add the two env vars
and add the deployment URL to the Supabase redirect list (step 3).

## The layout

The house lives in [`src/layout/house.json`](src/layout/house.json). It is a **placeholder** (two ~7×7 m floors) until
the real plan is traced. The format is meant to be edited by hand:

```jsonc
{
  "floors": [
    {
      "id": "ground", // stable id: wall colours and furniture refer to it
      "name": "Ground floor",
      "elevation": 0, // metres above the ground floor's surface
      "height": 2.6, // wall height
      "wallThickness": 0.12, // default for walls without their own
      "rooms": [{ "id": "g-living", "name": "Living room", "label": [2, 3.5] }],
      "walls": [
        {
          "id": "g-north", // stable id: saved colours are keyed by it
          "from": [0, 0], // plan metres: x grows east, y grows south
          "to": [7, 0], // along the wall's centre line
          "thickness": 0.3,
          "openings": [
            // offset = distance from `from` to the opening's near edge
            { "type": "door", "offset": 1.5, "width": 0.9, "height": 2.0 },
            { "type": "window", "offset": 4.8, "width": 1.2, "height": 1.3, "sill": 0.9 },
          ],
        },
      ],
    },
  ],
}
```

- Walls meet at their centre lines; corners are filled automatically.
- Each wall has two paintable sides: walking `from` → `to` with north up, **side A is on the right, B on the left**.
- Windows default to a 0.9 m sill, doors to 0.
- The file is validated at startup (and in `npm test`): openings that overlap, run past the wall end or are taller than
  the floor fail with a message naming the wall.
- Keep ids stable once colours are saved. Renaming a wall id orphans its saved colours.

## Using it

- **Room labels** show each room's floor area, measured to the wall faces with doors closed. Rooms come from the
  `rooms` label points in the layout: the floor is flood-filled from each label, so a room needs closed walls around
  it (two labels in one open space, like stairs and landing, split it halfway between them).
- **Tap a room's floor** to pick its finish: wood, tiles, carpet or concrete (drawn in the app, no downloads). Saved
  per colour scheme like the walls.
- **Sizes** labels every wall face with its length (inside a room that's its clear width, outside the overall size),
  every door and window with its width × height (and sill), and each room with width × depth and height. With a
  mouse, hovering a wall shows its length, thickness and height; the wall panel shows them too. While a piece of
  furniture is selected or dragged, dashed lines show how far each side is from the nearest wall.
- **Measure**: tap two points on the floor for the distance between them. Taps near a wall face or corner land
  exactly on it, and a nearly straight line squares up, so wall-to-wall measurements are exact. A third tap starts
  a new one.
- **Sun** lights the house as at a date and time (Europe/Prague clock) with real shadows; Winter/Spring/Summer
  jump to the solstices and equinox. North isn't known yet: turn the North slider until the orange arrow on the
  ground points north (remembered on that device). Once known, put it in `site.north` in `house.json` (degrees
  clockwise from the plan's up), along with the exact `latitude`/`longitude` (Prague for now).
- **Floor switcher** shows that floor plus the ones below it (for context; only the current floor is clickable).
- **Top** is a plan view (drag to pan, scroll/pinch to zoom); **3D** orbits.
- **Walk** puts you in the biggest room at eye height (1.6 m). Drag to look around; walk with W A S D or the
  arrow keys (Q/E or ←/→ turn), or the on-screen buttons. Walls stop you except at doors, and so does furniture;
  ⌂ takes you back to the start. The floor above is drawn as a ceiling so sunlight comes in through the windows.
- **Camera buttons** (bottom left, made for phones): hold the arrows to move, ⟲ ⟳ to rotate, ⤒ ⤓ to tilt, + − to
  zoom, ⌂ to reset. ✕ tucks them away (remembered on that device).
- **Click a wall** (in 3D) to pick its colour; **Other side** switches to the opposite face. Colours save
  automatically.
- Changes show up on the other signed-in device straight away (Supabase Realtime); in the demo, other tabs of the
  same browser follow along.
- **Furniture** lists what's on the floor and adds more: pick a piece from the catalog (sofas, tables, beds,
  kitchen units, bathroom fittings… 48 low-poly models from Kenney's [Furniture Kit](https://kenney.nl/assets/furniture-kit),
  CC0) or a plain **Box** with a size in centimetres. Models are stretched to the size you set, face south at 0°, and
  the colour swatches change their upholstery. Drag a piece across the floor; with snapping on, it squares up
  and sits flush against a wall (or into a corner) when it gets within 25 cm. Rotate in 15° or 90° steps (or R /
  Shift+R), Delete removes.

## Code map

```
src/
  layout/      house.json · types · geometry (wall splitting, validation) · rooms (floor regions, areas); tested
  furniture/   catalog.ts: the models and default sizes · snap.ts: wall snapping (pure; tested)
  measure/     measure.ts: snapping taps to wall faces · dimensions.ts: wall face runs, opening sizes ·
               clearance.ts: furniture-to-wall gaps (pure; tested)
  walk/        collide.ts: what blocks walking, sliding along walls (pure; tested)
  sun/         sun.ts: sun position and direction, local clock time (pure; tested) · useSun
  data/        Backend interface · supabaseBackend · localBackend (demo) · useHouseData (optimistic + live sync)
  auth/        AuthGate (login / guest-list screen) · useAccess
  scene/       HouseScene (canvas, cameras) · Lights · FloorWalls · RoomFloors + floorMaterials · FurnitureBox +
               FurnitureModel · WalkCamera · MeasureTool ·
               RoomLabels
  ui/          WallPanel · RoomPanel · FurniturePanel · FurnitureEditor · NumberField
public/models/furniture/   catalog models (.glb) and their thumbnails (rendered once from the models)
supabase/migrations/   the house schema
```
