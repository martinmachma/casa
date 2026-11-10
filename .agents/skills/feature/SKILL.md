---
name: feature
description: Define and build a new Nest feature or a larger change. Use when the request adds or reshapes behaviour (not a plain bug fix or a pure visual tweak). Clarifies the idea, checks it against the whole app, then implements it.
---

# Feature

1. **Read the context.** `docs/ARCHITECTURE.md` and `docs/CONVENTIONS.md`, plus the modules the idea touches.
2. **Clarify.** If the request leaves open what the user sees, where it lives in the UI, or what is saved, ask up to three short questions. Where a sensible default exists, state it and move on instead of asking.
3. **Impact pass.** Follow the `impact` skill: list the modules, data (versions, demo mode, Supabase migration), existing features, and tests the change touches. Look for something already in the app that does most of it and extend that instead of adding a parallel path.
4. **Say the plan in a few lines** (what changes where, any migration, anything notable left out). Continue without waiting unless the plan contradicts something the user said or is destructive.
5. **Implement** following `docs/CONVENTIONS.md`: pure logic in plain `.ts` with a test when it is core logic, thin React/R3F on top. UI work also follows the `ui` skill.
6. **Verify.** `npm run check`; for anything visible, look at it in the running app (desktop layout). If the change alters module boundaries or the data model, update `docs/ARCHITECTURE.md`.
7. **Report** in a few lines: what was built, what was decided on the user's behalf, anything deferred. Commit on `develop` as `AGENTS.md` says.
