---
name: review
description: Review Nest changes (the working tree diff or recent commits) against the project's architecture and conventions. Use before finishing a task or when asked to review. Read-only.
---

# Review

Read-only unless asked to fix. Review `git diff` (and `git diff --staged`, or the commits named).

Check, in this order:
1. **Correctness**: logic errors, units/coordinate mistakes, edge cases (multiple floors, rotated items, empty state), demo mode vs Supabase parity.
2. **Fit with the app**: respects module boundaries and dependency direction in `docs/ARCHITECTURE.md`; reuses existing code rather than duplicating it; doesn't break related features.
3. **Conventions**: `docs/CONVENTIONS.md` (pure logic separated from R3F/React, naming, styling, comments, no dead code, no unrequested dependencies).
4. **Tests**: core logic covered, suite still small and fast; no trivial or snapshot tests.
5. **Data safety**: migrations additive unless `main` is unaffected; RLS preserved.
6. **Perf** in `src/scene/`: nothing that allocates per frame or forces extra shadow/draw work.

Run `npm run check`. Report findings most severe first, each with `file:line`, what's wrong, and a concrete fix. If nothing is wrong, say so in one line.
