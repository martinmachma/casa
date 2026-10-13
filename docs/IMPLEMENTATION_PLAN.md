# Casa — Implementation plan

Last updated: 2026-10-12

## Phase 1 — House model, wall colours, box furniture

### Done (first pass, branch `claude/project-thread-lacb0s`, not pushed yet)

- [x] Vite + React + TypeScript scaffold, eslint, prettier, vitest, README
- [x] Installable PWA (manifest, generated icons, service worker)
- [x] Supabase migration: `house` schema with `allowed_emails`, `rooms`, `color_schemes`, `walls`, `furniture_items`;
      RLS via `house.is_allowed()` on every table; private `house` storage bucket with the same rule. Checked on a
      local Postgres with stubbed auth.
- [x] Google sign-in, gated by `house.allowed_emails` (a "not on the guest list" screen for anyone else)
- [x] Layout as hand-editable JSON wall segments with door/window openings; placeholder of two ~7×7 m floors;
      validated at startup
- [x] 3D view: walls extruded from the layout, floor switcher, top-down and orbit cameras
- [x] Click a wall to pick its colour, separately for each side; saved to Supabase (active colour scheme)
- [x] Box furniture: add with width/depth/height, drag on the floor, rotate (15°/90°), snap flush to walls and corners,
      edit size/colour/name, delete
- [x] Demo mode (browser-only storage) for trying the app before Supabase is set up

### Owner setup (Martin) — needed before real use

- [ ] Run `supabase/migrations/20261012000000_house_schema.sql` in the Supabase SQL editor
- [ ] Insert both emails into `house.allowed_emails`
- [ ] Add `house` to Project Settings → Data API → Exposed schemas
- [ ] Google provider on in Supabase (likely already on for Haru); her account as a test user if the consent screen is
      in testing
- [ ] Add `http://localhost:5173` and the Vercel URL to Auth → URL Configuration → Redirect URLs
- [ ] Set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` in `.env.local` and Vercel
- [ ] Check Haru's RLS doesn't grant access to every authenticated user (her login creates a user in the shared
      project)
- [ ] Approve pushing the branch; create the Vercel project from the repo

### Remaining in Phase 1

- [x] Trace the real floor plan into `src/layout/house.json` (from the electrical plan + architectural 1NP plan; upper-floor window heights and ceiling height guessed)
- [ ] End-to-end check against the real Supabase project: sign-in, allow-list rejection, colours and furniture saving
- [ ] Test on phones (touch drag, pinch zoom, PWA install on iOS/Android)
- [x] Live sync between two devices (Supabase Realtime on `house.walls`, `house.room_floors`,
      `house.furniture_items`; needs the realtime migration applied); not yet tried against the real project
- [ ] Colour schemes UI: create, rename, switch the active scheme (the table exists; the app only uses the active one)
- [x] Room names: renamed per version (stored in the version data; `house.rooms` stays unused)

### 3D upgrades (branch `feat/3d-upgrades`, 2026-10-12, not pushed)

- [x] Room labels with floor areas (flood fill between walls) and a measuring tool that snaps to wall faces
- [x] Floor finishes per room (procedural wood, tiles, carpet, concrete), saved per colour scheme
- [x] 48 Kenney furniture models (CC0) with a catalog, stretched to size, upholstery colour
- [x] First-person walk mode with wall/door collisions
- [x] Sunlight by date and time (Prague coordinates for now), adjustable north
- [x] On-screen camera buttons for phones
- [ ] Apply the three new migrations, then check live sync between two phones
- [ ] Set the real `site.north` / latitude / longitude in `house.json` once the site plan is in
- [x] Phone top bar fits one row (icon mode bar)

### Known limitations

- Wall colours are picked in the 3D view; in top-down view wall faces aren't clickable.
- Rotating in 15° steps doesn't re-snap (snapping would undo the turn); 90° turns re-seat the item against the wall.
- Undo/redo covers unsaved edits on this device; it resets on save, discard or reload.
