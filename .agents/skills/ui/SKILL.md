---
name: ui
description: Build or change Nest's user interface (panels, drawers, rows, buttons, modes, 3D overlays). Use for any visible UI work so it matches the rest of the app and is checked in the browser.
---

# UI

1. **Match what exists.** Before writing new markup or CSS, find the closest existing component in `src/ui/` and the classes/tokens it uses in `src/styles.css`; reuse or extend it. Read the UI section of `docs/CONVENTIONS.md`.
2. **Consistency over novelty.** Same active/selected state, outline, spacing, icon set (lucide-react) and wording style as neighbouring UI. No new colours or sizes if a token exists.
3. **Desktop first.** Don't spend effort on the mobile layout unless asked, but don't actively break it.
4. **Keep state where it belongs.** UI components render and dispatch; logic goes in the owning module as plain functions (see `docs/ARCHITECTURE.md`).
5. **Verify in the browser.** Start the dev server (`npm run dev`, http://localhost:5173, the demo login works without Supabase), exercise the interaction, check the console for errors, and include a screenshot in the report. Check empty and many-item states when relevant.
6. **Finish**: `npm run check`, commit on `develop`.
