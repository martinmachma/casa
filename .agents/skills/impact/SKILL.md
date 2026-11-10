---
name: impact
description: Map everything a proposed Nest change touches across the app before changing code. Use at the start of any non-trivial change, or when asked "what would this affect?". Read-only.
---

# Impact analysis

Read-only: change nothing. Produce a short report.

1. State the change in one sentence.
2. Search the code for every place the concerned concept lives (types, state, persistence, rendering, UI, tests): names, synonyms, and its callers/consumers. Use `docs/ARCHITECTURE.md` to know which modules to look in.
3. Report, briefly:
   - **Modules and files** touched, and which are pure logic vs React/R3F.
   - **Data**: effect on the saved version document, unsaved local changes, demo-mode storage, Supabase schema (would a migration break what `main` runs?), realtime sync.
   - **Behaviour that interacts**: related features (copy/paste, snapping, collisions, devices/scenes, walk mode, Edit modes) that must keep working.
   - **Tests** to add or likely to break.
   - **Existing code to reuse** instead of adding new.
   - **Risks / open questions** that need the user's decision.
4. Keep it under ~40 lines; list file paths, not code.
