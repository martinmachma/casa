# Agent notes for Casa

Casa is our house in 3D: a Vite + React + TypeScript PWA (React Three Fiber, Supabase, Vercel). Desktop first; ignore
mobile layout unless Martin asks.

## Start here

- Read `docs/ARCHITECTURE.md` (modules, data model, units) and `docs/CONVENTIONS.md` (how code is written, how to
  verify) before changing anything that crosses modules or touches saved data. Folders with their own `AGENTS.md`
  (`src/scene`, `src/ui`) add rules for that area.
- Think about the change in the context of the whole app: what else uses this concept, how it behaves in both
  backends (Supabase and demo), and whether something existing already does most of it.
- Skills live in `.agents/skills/` (also visible to Claude Code via `.claude/skills`): `feature` (define + build),
  `bugfix`, `ui`, `impact` (what does a change touch, read-only), `review` (check a diff against the conventions).
  Use the matching one for the task.
- Before saying work is done: `npm run check` (typecheck + tests; also `npm run lint` on files you touched, the repo has a few older lint errors). Before pushing: `npm run build`.

## Git workflow

- Day-to-day work goes on `develop`. Commit and push there directly; no feature branches or PRs unless Martin asks.
- `main` is the release branch. Merge `develop` into `main` only when the work is finished and Martin says it's ready.
- Supabase migrations (`supabase/migrations/`) can be applied to the live database as soon as they're written, before the code reaches `main`, as long as they don't break what `main` is running (e.g. additive columns/tables are fine; drops, renames or tightened constraints are not). If a migration would break `main`, stop and check with Martin.

## Tests

- Keep the suite small and fast (seconds, `npm test`).
- Test only core logic that's likely to break: geometry, measurements, access rules.
- No trivial or exhaustive tests, no snapshot tests.

## Where work runs

- Prefer local: a Remote Control session on Martin's Mac in `/Users/martin.mach/git/casa`, using his npm, git and logins.
- Use cloud sessions only when the Mac isn't available (e.g. he's on his phone).

## Communication

- Keep usage low. Short replies; report only when work is done or blocked.
