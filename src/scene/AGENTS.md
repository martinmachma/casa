# src/scene

Everything inside the R3F `<Canvas>`. Performance-sensitive.

- Read `docs/LIGHTING.md` before touching lights, shadows, AO or post-processing, and the "Scene performance" section
  of `docs/CONVENTIONS.md` before measuring anything.
- Put logic in plain `.ts` files with a test (like `shadows.ts`, `pick.ts`); keep `.tsx` components thin.
- The canvas renders on demand (`frameloop="demand"`): anything that changes visuals must invalidate.
- No allocation in `useFrame`. Don't change light counts or unmount fixtures (shader recompiles). Floors fade, not
  unmount.
- Don't import from `ui/` (an existing leak, `ui/isTyping`, is not a precedent).
