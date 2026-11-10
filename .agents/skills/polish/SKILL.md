---
name: polish
description: Polish an existing Nest feature end to end, visually and functionally, on its own branch, with before/after screenshots and a behaviour walkthrough. Use when asked to "polish", "make X feel finished", "clean up X properly", or to take a rough feature to done. Asks about real design decisions along the way.
---

# Polish a feature

Goal: take one feature from "works" to "finished" in one pass, and show the result. This is the exception to the
develop-only rule in `AGENTS.md`: work on a branch, because the user will review before anything lands on `develop`.

## 1. Scope
- Name the feature and its boundary in one sentence (what is in, what is not). If the request is ambiguous, ask.
- Read `docs/ARCHITECTURE.md`, `docs/CONVENTIONS.md`, then run the `impact` skill for the feature so polish doesn't
  break its neighbours (Home vs Edit, undo, snapping, devices/scenes, both backends).

## 2. Branch
- `git switch -c polish/<feature> develop` (from an up-to-date `develop`). Commit in small steps; push the branch so
  Vercel builds a preview. No PR and no merge unless asked.

## 3. Baseline: see it before touching it
- Run the app (`npm run dev`, http://localhost:5173). Use whatever browser tooling is available; with Claude Code's
  Chrome tools use the user's Chrome, where the real house data is.
- Exercise the feature as a user would: every control, every state (empty, one, many, long names, selected, hover,
  disabled, error), both floors if relevant, Home and Edit modes, undo/redo, reload persistence, realtime between two
  tabs if it syncs.
- Save screenshots to `polish-shots/<feature>/before-*.png` (git-ignored). Note console errors.
- Write a **punch list**: each item is visual (alignment, spacing, states, consistency with neighbouring UI, copy,
  icons, motion) or functional (bugs, edge cases, missing feedback, keyboard/pointer handling, perf in 3D, data
  loss). Mark each *must* / *should* / *nice*.

## 4. Decide
- Ask the user about decisions only they can make: visual direction, behaviour trade-offs, anything that removes or
  changes existing behaviour, scope creep that costs real time. Use the interactive question tool when there is one;
  otherwise a short numbered list. Batch into at most 4 questions, each with a recommended default and why.
- Everything else, decide yourself using the conventions and say what you chose in the report. Don't ask about
  things the codebase already answers.
- For a substantial visual change, explore 2 or 3 options first. If a design tool is available (for example Claude
  design / an artifact mockup), use it; otherwise build quick variants in code or describe them with screenshots.
  Let the user pick before building the full thing.

## 5. Polish
- Work down the punch list, must first. Follow the `ui` skill for visual work and the `bugfix` skill (reproduce, fix
  the cause, look sideways) for functional ones. Reuse existing components, tokens and primitives.
- Keep logic in plain modules with a test when it is core logic; no refactors outside the feature's boundary
  (list them as follow-ups instead).
- Scene changes: check frame cost and visual identity as described in `docs/CONVENTIONS.md`.

## 6. Verify
- Re-walk everything from the baseline in the running app; check the console is clean. Save `after-*.png` for the same
  states as the before shots, plus any new states.
- `npm run check`, `npm run lint` (no new errors in touched files), `npm run build`. Then run the `review` skill on
  the branch diff and fix what it finds.

## 7. Report
Short, in this order:
1. Branch name, commits, preview URL if known; not merged.
2. Before/after screenshots side by side for the key states (show them, don't just list paths).
3. Behaviour walkthrough: what now happens for each interaction, one line each.
4. Decisions: asked and answered, and the ones taken on the user's behalf.
5. Left out / follow-ups, with why.
6. How to land it: merge `polish/<feature>` into `develop` when the user says so.
