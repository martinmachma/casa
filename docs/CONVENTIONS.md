# Casa conventions

How code is written here. Follow what neighbouring files do; this lists the patterns that matter.

## Structure

- Core logic lives in plain `.ts` files that take plain data and return plain data (see `scene/shadows.ts`,
  `scene/pick.ts`, `furniture/snap.ts`). `.tsx` components stay thin and wire logic to React/R3F.
- Respect the module dependency direction in `ARCHITECTURE.md`. Don't import upward; move the shared piece down.
- Look for an existing helper before writing one (geometry in `layout`, `useStable`, `ui/kit.tsx`, `scene/palette.ts`).
- Don't add dependencies without asking.

## TypeScript / React

- Named exports only. Components are arrow functions: `export const Foo = (...) => ...`. Files: `PascalCase.tsx` for
  components, `camelCase.ts` for logic, `foo.test.ts` beside `foo.ts`.
- TS is strict with unused locals/params as errors. No `any` without a reason.
- Prettier decides formatting (no semicolons, single quotes, width 120): run `npm run format`.
- Memoise deliberately: `useMemo`/`memo` for expensive or prop-stable work, `useStable` for callbacks passed to
  memoised children. Edits go through `edit(fn, key)` so undo merges correctly.
- Wrap localStorage access in try/catch (private mode). Backend errors surface as `error`/`notice` strings.

## Comments

Exported things get a short `/** */` saying why, and units where relevant. No commented-out code, no TODOs left
behind, no comments that restate the code.

## UI / styling

- One stylesheet, `src/styles.css`, with CSS custom properties at the top (`--bg`, `--accent`, radii, shadows).
  Reuse existing classes (`btn`, `icon-btn`, `field`, `muted`) and primitives from `ui/kit.tsx` before adding new.
- Icons: `lucide-react` only; custom ones live in `ui/deviceIcons.tsx` and `ui/weatherIcons.ts`.
- Rows and list items use the app's active state and an outline, not new highlight styles.
- Desktop first. Don't spend time on mobile layout unless Martin asks.
- 3D colours come from `scene/palette.ts` and the `*Materials.ts` files.

## Scene performance

Read `LIGHTING.md` first. No per-frame allocation in `useFrame`; keep shader-affecting state stable (don't change
light counts, keep fixtures mounted); don't add draw calls or shadow casters casually. Measuring a change:

- `gl.finish()` is a no-op in Chrome here. For frame cost, time R3F `addEffect` → `addAfterEffect` plus a 1×1
  `readPixels`. Per-pass `EXT_disjoint_timer_query` numbers are inflated; use them for a whole frame at most.
- Prove a shader change is visually identical with a pixel diff of two loads against a same-code null run, at night
  and at noon (moon and sun take different branches). A toggle must restore the true old shader.
- A one-off spike may be a shader re-link: diff `gl.info.programs` across the switch.

## Data and migrations

- New `HouseState` fields are optional and defaulted on load. Never rename or reuse wall ids.
- Every data change works in both backends (Supabase and local demo).
- Migrations go in `supabase/migrations/`, stay in the `house` schema, keep RLS via `house.is_allowed()`. Additive
  ones may be applied before `main` has the code; drops, renames, tightened constraints may not (ask first).

## Tests

Small and fast; core logic only (geometry, measurement, snapping, collision, access rules, real-layout checks).
Co-located. No snapshot tests, no trivial tests. `npm run check` = typecheck + tests. Run `npm run lint` too and don't add new lint errors (a few older ones in
`scene/DebugHover.tsx` and `scene/OpeningFills.tsx` are known).

## Verifying

- `npm run check` after edits. `npm run build` before pushing (a cached `tsc -b` once hid a type error that failed
  the Vercel preview). The repo ships `.githooks/pre-push`; enable it once per clone with
  `git config core.hooksPath .githooks`.
- Check visible changes in the running app at http://localhost:5173 (`npm run dev`). Martin's real house data only
  loads there, with his sign-in; the demo works for anything not depending on his data. With the claude-in-chrome
  tools, use his Chrome (rooms open via `button[aria-label="<room>"]`).
- Other sessions commit to `develop` while you work. Undo your own work with targeted edits or `git revert`, never
  `git checkout <old> -- file`. Read the staged diff before committing; if it's bigger than expected, stop.
