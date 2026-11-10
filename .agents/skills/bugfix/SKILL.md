---
name: bugfix
description: Fix a bug in Nest. Use when something that should work does not (wrong geometry, broken interaction, bad sync, visual glitch). Reproduces first, fixes the cause, checks for the same flaw elsewhere.
---

# Bugfix

1. **Reproduce.** Get the symptom to happen (running app, or a failing test for core logic such as geometry, measurement, collision, access rules). If it can't be reproduced, say so and what was tried; don't guess a fix.
2. **Find the cause, not the symptom.** Trace to where the wrong value or state originates, using `docs/ARCHITECTURE.md` to know which module owns it. Check `git log` for the area; other commits may have touched it recently.
3. **Fix minimally.** Change the cause; no refactors beside it. Don't paper over with guards or special cases.
4. **Test.** If the bug is in core logic, add a regression test next to the code (small, fast). Skip tests for pure UI glitches.
5. **Look sideways.** Search for the same pattern in sibling code (other furniture ops, other floors, demo vs Supabase paths) and fix or report it.
6. **Verify.** `npm run check`; re-run the original reproduction in the app.
7. **Report**: cause in one sentence, the fix, what else was checked. Commit on `develop`.
