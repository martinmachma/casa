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
without a reload).

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
- **Floor switcher** shows that floor plus the ones below it (for context; only the current floor is clickable).
- **Top** is a plan view (drag to pan, scroll/pinch to zoom); **3D** orbits.
- **Click a wall** (in 3D) to pick its colour; **Other side** switches to the opposite face. Colours save
  automatically.
- Changes show up on the other signed-in device straight away (Supabase Realtime); in the demo, other tabs of the
  same browser follow along.
- **Furniture → Add box** with a size in centimetres. Drag a box across the floor; with snapping on, it squares up
  and sits flush against a wall (or into a corner) when it gets within 25 cm. Rotate in 15° or 90° steps (or R /
  Shift+R), Delete removes.

## Code map

```
src/
  layout/      house.json · types · geometry (wall splitting, validation) · rooms (floor regions, areas); tested
  furniture/   snap.ts: wall snapping (pure; tested)
  data/        Backend interface · supabaseBackend · localBackend (demo) · useHouseData (optimistic + live sync)
  auth/        AuthGate (login / guest-list screen) · useAccess
  scene/       HouseScene (canvas, lights, cameras) · FloorWalls · FurnitureBox · RoomLabels
  ui/          WallPanel · FurniturePanel · FurnitureEditor · NumberField
supabase/migrations/   the house schema
```
