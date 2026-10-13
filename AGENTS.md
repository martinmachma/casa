# Agent notes for Casa

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
